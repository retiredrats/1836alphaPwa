import {db} from './db.js';

const IND = ['pop','gdp_agri','gdp_ind','gdp_serv'];

export function nextQuarter(q){
  const y = parseInt(q.slice(0,4),10);
  const n = parseInt(q.slice(5),10);
  const n2 = n===4?1:n+1;
  const y2 = n===4?y+1:y;
  return `${y2}Q${n2}`;
}
function clamp(x,lo,hi){ return Math.max(lo, Math.min(hi, x)); }

export async function generateSuggestions(){
  const states = await db.countries_state.toArray();
  const base = await db.base.toArray();
  const caps = await db.caps.toArray();
  const noise = await db.noise.toArray();

  const baseMap = new Map(base.map(b=>[`${b.country_id}|${b.indicator}`, b.base_q_growth]));
  const capMap = new Map(caps.map(c=>[c.indicator, {min:c.min_q_growth, max:c.max_q_growth}]));
  const noiseMap = new Map(noise.map(n=>[n.indicator, n.noise_amp]));

  const targets = new Set(states.map(s=> nextQuarter(s.quarter)));
  const all = await db.suggestions.toArray();
  const keep = all.filter(s=> !targets.has(s.quarter));
  await db.suggestions.clear();
  if (keep.length) await db.suggestions.bulkAdd(keep);

  const rows = [];
  for (const st of states){
    const q = nextQuarter(st.quarter);
    for (const ind of IND){
      const b = baseMap.get(`${st.country_id}|${ind}`) || 0.0;
      const nAmp = noiseMap.get(ind) || 0.0;
      const eps = (Math.random()*2-1)*nAmp;
      const cap = capMap.get(ind) || {min:-0.02, max:0.02};
      const sug = clamp(b + eps, cap.min, cap.max);
      rows.push({country_id:st.country_id, quarter:q, indicator:ind,
                 base:b, struct_effect:0.0, noise_draw:eps,
                 suggested_q_growth:sug, min_cap:cap.min, max_cap:cap.max});
    }
  }
  if (rows.length) await db.suggestions.bulkAdd(rows);
}

export async function settleQuarter(){
  const states = await db.countries_state.toArray();
  if (!states.length) return 0;
  const qTarget = nextQuarter(states[0].quarter);
  const sugg = await db.suggestions.where('quarter').equals(qTarget).toArray();

  const suggMap = new Map(sugg.map(s=>[`${s.country_id}|${s.indicator}`, s]));

  const fiscal = new Map((await db.fiscal.toArray()).map(f=>[f.country_id, f]));
  const archMap = new Map((await db.archetype.toArray()).map(a=>[a.archetype, a]));
  const colmods = await db.colonial_module.toArray();
  const colByCq = new Map(colmods.map(c=>[`${c.country_id}|${c.quarter}`, c]));

  let newsLines = [];
  const nextStates = [];

  for (const st of states){
    const cid = st.country_id;
    const qPrev = st.quarter;
    const q = qTarget;

    const g = (ind)=>{
      const s = suggMap.get(`${cid}|${ind}`);
      if (!s) return 0.0;
      const val = s.suggested_q_growth;
      return clamp(val, s.min_cap, s.max_cap);
    };

    const pop = +(st.population_m * (1+g('pop'))).toFixed(4);
    const a = +(st.gdp_agri * (1+g('gdp_agri'))).toFixed(3);
    let i = +(st.gdp_ind * (1+g('gdp_ind'))).toFixed(3);
    let s = +(st.gdp_serv * (1+g('gdp_serv'))).toFixed(3);

    const cm = colByCq.get(`${cid}|${qPrev}`);
    let indAdd=0, servAdd=0, fiscalBonus=0;
    if (cm){
      const arch = archMap.get(cm.archetype);
      if (arch){
        const extraction = clamp(cm.extraction_share, 0, 0.95);
        const tp = clamp(cm.trade_preference, arch.trade_pref_floor, arch.trade_pref_ceil);
        const portsMul = 1 + 0.05*(cm.ports_level_colonial||0) + 0.03*(cm.sea_lanes_level||0);
        const dI = cm.colonial_gdp * arch.alpha_industrial * extraction;
        const dS = cm.colonial_gdp * arch.alpha_service   * extraction * (1 + tp) * portsMul;
        indAdd = +dI.toFixed(3);
        servAdd = +dS.toFixed(3);
        const admin = arch.admin_cost_base + arch.unrest_to_cost*(cm.unrest||0) + arch.garrison_cost_per_level*(cm.garrison_level||0);
        fiscalBonus = +(arch.tau_ind*dI + arch.tau_serv*dS - admin).toFixed(3);
      }
    }
    i += indAdd; s += servAdd;

    if (fiscalBonus !== 0){
      let due = q;
      const lag = (cm && cm.remittance_lag_q) || 1;
      for (let k=0;k<lag;k++) due = nextQuarter(due);
      await db.remittance_queue.add({country_id:cid, quarter_due:due, amount:fiscalBonus, ind_add:indAdd, serv_add:servAdd, note:'colonial lag'});
    }

    const fisc = fiscal.get(cid) || {};
    let nominal = a + i + s;
    let revenue = (fisc.revenue_rate || 0.115) * nominal;
    const dues = await db.remittance_queue.where({country_id:cid, quarter_due:q}).toArray();
    if (dues.length) revenue += dues.reduce((sum,d)=>sum+(d.amount||0),0);
    const mil = (fisc.military_per_10k || 1.0) * ((st.army_k||0)/10.0);
    const rate = (st.credit==='A') ? (fisc.interest_A||0.012) : (st.credit==='B') ? (fisc.interest_B||0.017) : (fisc.interest_C||0.025);
    const expense = (fisc.expense_base||8.0) + mil + rate*(st.debt||0);
    let debt = +(st.debt + Math.max(0, expense - revenue)).toFixed(3);

    let credit = st.credit;
    const debtRatio = debt / Math.max(nominal, 1e-6);
    if (debtRatio>1.2 && (credit==='A'||credit==='B')) credit='C';
    else if (debtRatio>0.9 && credit==='A') credit='B';

    let leg = st.legitimacy, infl = st.influence;
    if (cm && cm.unrest>60 && cm.extraction_share>0.5){
      leg = Math.max(40, leg-1);
      infl = Math.max(30, infl-1);
    }

    nextStates.push({
      country_id: cid, country_name: st.country_name, quarter: q,
      population_m: pop, gdp_agri: a, gdp_ind: i, gdp_serv: s,
      army_k: st.army_k,
      morale: Math.max(40, Math.min(90, st.morale + (Math.random()<0.5?-1:1))),
      training: Math.max(40, Math.min(90, st.training + (Math.random()<0.6?0:1))),
      legitimacy: leg, influence: infl,
      revenue: +revenue.toFixed(3), expense: +expense.toFixed(3),
      debt: debt, credit: credit,
      port_level_home: st.port_level_home, logistics_delay_q: st.logistics_delay_q
    });

    for (const d of dues){ await db.remittance_queue.delete(d.id); }

    newsLines.push({quarter:q, country_id:cid, headline: `${q} ${cid}: 农/工/服 ${a.toFixed(1)}/${i.toFixed(1)}/${s.toFixed(1)}；财政 收入${revenue.toFixed(2)} 支出${expense.toFixed(2)} 债务${debt.toFixed(2)} 信用${credit}。`});
  }

  await db.countries_state.bulkAdd(nextStates);
  if (newsLines.length) await db.news.bulkAdd(newsLines);
  return nextStates.length;
}
