import {db, exportAll, importAll} from './db.js';
import {ensureSeed} from './seed.js';
import {generateSuggestions, settleQuarter} from './logic.js';

const $ = (sel)=>document.querySelector(sel);

async function renderDashboard(){
  const rows = await db.countries_state.orderBy('id').toArray();
  const latest = {};
  for (const r of rows){ latest[r.country_id] = r; }
  const list = Object.values(latest);
  const html = [`<table><thead><tr>
  <th>国家</th><th>季度</th><th>人口(m)</th><th>农</th><th>工</th><th>服</th>
  <th>收入</th><th>支出</th><th>债务</th><th>信用</th><th>合法</th><th>影响</th>
  </tr></thead><tbody>`];
  for (const r of list){
    html.push(`<tr>
      <td>${r.country_name} (${r.country_id})</td>
      <td>${r.quarter}</td>
      <td>${r.population_m.toFixed(3)}</td>
      <td>${r.gdp_agri.toFixed(1)}</td>
      <td>${r.gdp_ind.toFixed(1)}</td>
      <td>${r.gdp_serv.toFixed(1)}</td>
      <td>${r.revenue.toFixed(2)}</td>
      <td>${r.expense.toFixed(2)}</td>
      <td>${r.debt.toFixed(2)}</td>
      <td>${r.credit}</td>
      <td>${r.legitimacy}</td>
      <td>${r.influence}</td>
    </tr>`);
  }
  html.push('</tbody></table>');
  $('#dashboard').innerHTML = html.join('');
}

async function renderSuggestions(){
  const sugs = await db.suggestions.orderBy('id').toArray();
  sugs.sort((a,b)=> (a.country_id+a.indicator).localeCompare(b.country_id+b.indicator));
  const html = [`<table><thead><tr>
    <th>国家</th><th>季度</th><th>指标</th>
    <th>base</th><th>noise</th><th>建议值</th><th>范围</th><th>保存</th>
  </tr></thead><tbody>`];
  for (const s of sugs){
    const id = s.id;
    html.push(`<tr>
      <td>${s.country_id}</td>
      <td>${s.quarter}</td>
      <td>${s.indicator}</td>
      <td>${s.base.toFixed(4)}</td>
      <td>${s.noise_draw.toFixed(4)}</td>
      <td><input class="inline" id="sug-${id}" value="${s.suggested_q_growth.toFixed(4)}"></td>
      <td>${s.min_cap.toFixed(3)}..${s.max_cap.toFixed(3)}</td>
      <td><button data-id="${id}" class="btn-save">保存</button></td>
    </tr>`);
  }
  html.push('</tbody></table>');
  $('#suggestions').innerHTML = html.join('');
  $('#suggestions').querySelectorAll('.btn-save').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      const id = Number(e.currentTarget.getAttribute('data-id'));
      const val = parseFloat($('#sug-'+id).value);
      const rec = await db.suggestions.get(id);
      if (rec){
        rec.suggested_q_growth = val;
        await db.suggestions.put(rec);
      }
      alert('已保存');
    });
  });
}

async function renderNews(){
  const ns = await db.news.orderBy('id').reverse().toArray();
  const html = ns.slice(0,20).map(n=> `<li>[${n.quarter}] ${n.country_id} — ${n.headline}</li>`).join('');
  $('#news').innerHTML = html;
}

$('#btn-generate').addEventListener('click', async ()=>{
  await generateSuggestions();
  await renderSuggestions();
  alert('已生成建议值（下一季度）。');
});

$('#btn-settle').addEventListener('click', async ()=>{
  const n = await settleQuarter();
  await renderDashboard();
  await renderNews();
  alert('结算完成 '+n+' 个国家。');
});

$('#btn-export').addEventListener('click', async ()=>{
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '1836_save.json'; a.click();
  URL.revokeObjectURL(url);
});

$('#file-import').addEventListener('change', async (ev)=>{
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
