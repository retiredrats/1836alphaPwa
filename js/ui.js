import {db, exportAll, importAll} from './db.js';
import {ensureSeed} from './seed.js';
import {generateSuggestions, settleQuarter} from './logic.js';

const $ = (sel)=>document.querySelector(sel);

function fmtPctFloat(x){ return (x*100).toFixed(2)+'%'; }
function zhIndicator(k){
  return k==='gdp_agri'?'农业GDP'
       :k==='gdp_ind' ?'工业GDP'
       :k==='gdp_serv'?'服务GDP'
       :k==='pop'     ?'人口'
       :'？';
}

async function renderDashboard(){
  const rows = await db.countries_state.orderBy('id').toArray();
  const latest = {};
  for (const r of rows){ latest[r.country_id] = r; }
  const list = Object.values(latest);

  const html = list.map(r => `
  <details open>
    <summary><strong>${r.country_name} (${r.country_id})</strong> — ${r.quarter}
      ｜ 人口 ${r.population_m.toFixed(3)}m ｜ 债务 £${r.debt.toFixed(2)} ｜ 信用 ${r.credit} ｜ 合法 ${r.legitimacy} ｜ 影响 ${r.influence}
    </summary>
    <table>
      <thead><tr><th>板块</th><th>规模</th><th>备注</th></tr></thead>
      <tbody>
        <tr><td>农业</td><td>£${r.gdp_agri.toFixed(1)}</td><td>—</td></tr>
        <tr><td>工业</td><td>£${r.gdp_ind.toFixed(1)}</td><td>—</td></tr>
        <tr><td>服务</td><td>£${r.gdp_serv.toFixed(1)}</td><td>—</td></tr>
        <tr><td>财政</td><td>收入 £${r.revenue.toFixed(2)} ／ 支出 £${r.expense.toFixed(2)}</td><td>军队 ${r.army_k.toFixed(0)}k</td></tr>
      </tbody>
    </table>
  </details>`).join('');

  $('#dashboard').innerHTML = html || '<p>暂无数据</p>';
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
      <td>${fmtPctFloat(s.base)}</td>
      <td>${fmtPctFloat(s.noise_draw)}</td>
      <td>${fmtPctFloat(s.min_cap)} ~ ${fmtPctFloat(s.max_cap)}</td>
      <td>
        <span class="cell-pct">
          <input class="inline pct" id="sug-${id}" value="${(s.suggested_q_growth*100).toFixed(2)}" inputmode="decimal">
        </span>
      </td>
    </tr>`);
  }
  html.push('</tbody></table>');
  $('#suggestions').innerHTML = html.join('');

  // 失焦自动保存（输入为百分比数值 → 保存为小数）
  $('#suggestions').querySelectorAll('.pct').forEach(inp=>{
    inp.addEventListener('blur', async (e)=>{
      const id = Number(e.target.id.replace('sug-',''));
      const v  = parseFloat(e.target.value);
      const rec = await db.suggestions.get(id);
      if (rec && !Number.isNaN(v)){
        rec.suggested_q_growth = v/100;
        await db.suggestions.put(rec);
      }
    });
    // 回车也触发失焦保存
    inp.addEventListener('keydown', e=>{ if (e.key==='Enter') e.target.blur(); });
  });
}

async function renderNews(){
  const ns = await db.news.orderBy('id').reverse().toArray();
  const html = ns.slice(0,20).map(n=> `<li>[${n.quarter}] ${n.country_id} — ${n.headline}</li>`).join('');
  $('#news').innerHTML = html;
}

// 顶部按钮：保持与现有单页布局兼容
$('#btn-generate')?.addEventListener('click', async ()=>{
  await generateSuggestions();
  await renderSuggestions();
  alert('已生成建议值（下一季度）。');
});

$('#btn-settle')?.addEventListener('click', async ()=>{
  const n = await settleQuarter();
  await renderDashboard();
  await renderNews();
  alert('结算完成 '+n+' 个国家。');
});

$('#btn-export')?.addEventListener('click', async ()=>{
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '1836_save.json'; a.click();
  URL.revokeObjectURL(url);
});

$('#file-import')?.addEventListener('change', async (ev)=>{
  const file = ev.target.files[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  await importAll(data);
  await renderDashboard();
  await renderSuggestions();
  await renderNews();
  alert('导入完成');
});

(async function init(){
  await ensureSeed();
  await renderDashboard();
  await renderSuggestions();
  await renderNews();
})();
