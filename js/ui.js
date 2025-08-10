import {db, exportAll, importAll} from './db.js';
import {ensureSeed} from './seed.js';
import {needSuggestions, generateSuggestions, settleQuarter} from './logic.js';

const $ = (sel)=>document.querySelector(sel);
function fmtPct(x){ return (x*100).toFixed(2)+'%'; }
function zhIndicator(k){ return k==='gdp_agri'?'农业GDP':k==='gdp_ind'?'工业GDP':k==='gdp_serv'?'服务GDP':k==='pop'?'人口':'？'; }

async function renderDashboard(){
  const rows = await db.countries_state.orderBy('id').toArray();
  const latest = {};
  for (const r of rows){ latest[r.country_id] = r; }
  const list = Object.values(latest);

  const upcomingQ = (r)=> {
    const q=r.quarter; const y=+q.slice(0,4), n=+q.slice(5); return `${n===4?y+1:y}Q${n===4?1:n+1}`;
  };

  const blocks = await Promise.all(list.map(async r=>{
    // 读“下一季”的手工财政
    const qNext = upcomingQ(r);
    const fm = await db.fiscal_manual.get({country_id:r.country_id, quarter:qNext}) || {fix_rev:0,fix_exp:0,tmp_rev:0,tmp_exp:0};

    return `
    <details open>
      <summary><strong>${r.country_name} (${r.country_id})</strong> — ${r.quarter}
        ｜ 人口 ${r.population_m.toFixed(3)}m ｜ 国库 £${(r.treasury||0).toFixed(2)} ｜ 债务 £${r.debt.toFixed(2)} ｜ 信用 ${r.credit}
      </summary>
      <table>
        <thead><tr><th>板块</th><th>规模</th><th>备注</th></tr></thead>
        <tbody>
          <tr><td>农业</td><td>£${r.gdp_agri.toFixed(1)}</td><td>—</td></tr>
          <tr><td>工业</td><td>£${r.gdp_ind.toFixed(1)}</td><td>—</td></tr>
          <tr><td>服务</td><td>£${r.gdp_serv.toFixed(1)}</td><td>—</td></tr>
        </tbody>
      </table>

      <div class="fiscal-box">
        <div class="fiscal-title">下一季（${qNext}）手工财政（£）</div>
        <div class="fiscal-grid" data-cid="${r.country_id}" data-q="${qNext}">
          <label>固定收入<input inputmode="decimal" class="f-in"  value="${fm.fix_rev||0}"></label>
          <label>固定支出<input inputmode="decimal" class="f-ex"  value="${fm.fix_exp||0}"></label>
          <label>临时收入<input inputmode="decimal" class="t-in"  value="${fm.tmp_rev||0}"></label>
          <label>临时支出<input inputmode="decimal" class="t-ex"  value="${fm.tmp_exp||0}"></label>
          <button class="btn-fiscal-save">保存本国下一季财政</button>
        </div>
        <small>殖民地当季到期的汇回，会在结算时自动并入“临时收入”。</small>
      </div>
    </details>`;
  }));

  $('#dashboard').innerHTML = blocks.join('') || '<p>暂无数据</p>';

  // 绑定保存事件
  document.querySelectorAll('.btn-fiscal-save').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      const box = e.currentTarget.closest('.fiscal-grid');
      const cid = box.dataset.cid, q = box.dataset.q;
      const fix_rev = parseFloat(box.querySelector('.f-in').value)||0;
      const fix_exp = parseFloat(box.querySelector('.f-ex').value)||0;
      const tmp_rev = parseFloat(box.querySelector('.t-in').value)||0;
      const tmp_exp = parseFloat(box.querySelector('.t-ex').value)||0;
      const old = await db.fiscal_manual.get({country_id:cid, quarter:q});
      if (old) {
        old.fix_rev=fix_rev; old.fix_exp=fix_exp; old.tmp_rev=tmp_rev; old.tmp_exp=tmp_exp;
        await db.fiscal_manual.put(old);
      } else {
        await db.fiscal_manual.add({country_id:cid, quarter:q, fix_rev, fix_exp, tmp_rev, tmp_exp});
      }
      alert(`${cid} ${q} 财政已保存`);
    });
  });
}

async function renderSuggestions(){
  const sugs = await db.suggestions.orderBy('id').toArray();
  sugs.sort((a,b)=> (a.country_id+a.indicator).localeCompare(b.country_id+b.indicator));
  const html = [`<table><thead><tr>
    <th>国家</th><th>季度</th><th>指标</th>
    <th>基线</th><th>扰动</th><th>范围</th><th>建议值</th>
  </tr></thead><tbody>`];
  for (const s of sugs){
    const id = s.id;
    html.push(`<tr>
      <td>${s.country_id}</td>
      <td>${s.quarter}</td>
      <td>${zhIndicator(s.indicator)}</td>
      <td>${fmtPct(s.base)}</td>
      <td>${fmtPct(s.noise_draw)}</td>
      <td>${fmtPct(s.min_cap)} ~ ${fmtPct(s.max_cap)}</td>
      <td><span class="cell-pct"><input class="inline pct" id="sug-${id}" value="${(s.suggested_q_growth*100).toFixed(2)}" inputmode="decimal"></span></td>
    </tr>`);
  }
  html.push('</tbody></table>');
  $('#suggestions').innerHTML = html.join('');
  $('#suggestions').querySelectorAll('.pct').forEach(inp=>{
    inp.addEventListener('blur', async (e)=>{
      const id = Number(e.target.id.replace('sug-',''));
      const v  = parseFloat(e.target.value);
      const rec = await db.suggestions.get(id);
      if (rec && !Number.isNaN(v)){ rec.suggested_q_growth=v/100; await db.suggestions.put(rec); }
    });
    inp.addEventListener('keydown', e=>{ if (e.key==='Enter') e.target.blur(); });
  });
}

async function renderNews(){
  const ns = await db.news.orderBy('id').reverse().toArray();
  $('#news').innerHTML = ns.slice(0,20).map(n=> `<li>[${n.quarter}] ${n.country_id} — ${n.headline}</li>`).join('');
}

/** 动态按钮：根据状态切换显示与功能 */
async function updateStepButton(){
  const st = await needSuggestions();
  const btn = $('#btn-step');
  if (st.need){
    btn.textContent = '生成建议值';
    btn.onclick = async ()=>{
      await generateSuggestions();
      await renderSuggestions();
      await updateStepButton(); // 更新成结算按钮
      alert('已生成建议值（下一季度）。');
    };
  } else {
    btn.textContent = '结算本季';
    btn.onclick = async ()=>{
      const n = await settleQuarter();
      await renderDashboard();
      await renderNews();
      await updateStepButton(); // 更新成生成按钮
      alert('已结算 '+n+' 个国家。');
    };
  }
}

// 初始化时调用一次
(async function init(){
  await ensureSeed();
  await renderDashboard();
  await renderSuggestions();
  await renderNews();
  await updateStepButton(); // 初始化按钮状态
})();

// 事件
$('#btn-step')?.addEventListener('click', stepOnce);

$('#btn-export')?.addEventListener('click', async ()=>{
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download='1836_save.json'; a.click();
  URL.revokeObjectURL(url);
});
$('#file-import')?.addEventListener('change', async (ev)=>{
  const f = ev.target.files[0]; if(!f) return;
  const text = await f.text(); await importAll(JSON.parse(text));
  await renderDashboard(); await renderSuggestions(); await renderNews(); alert('导入完成');
});

// 初始化
(async function init(){
  await ensureSeed();
  await renderDashboard();
  await renderSuggestions();
  await renderNews();
})();
