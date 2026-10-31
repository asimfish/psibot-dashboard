'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const fields = ['sampled_arm7', 'ensemble_arm7', 'sampled_hand6', 'ensemble_hand6'];
  let data, queries;
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function node(tag, text, cls) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; }
  const fmt = x => Number(x).toFixed(6);
  async function get(path) { const r = await fetch(path, {cache:'no-store'}); assert(r.ok, path + ' HTTP ' + r.status); return new Uint8Array(await r.arrayBuffer()); }
  const decode = b => JSON.parse(new TextDecoder().decode(b));
  async function hash(b) { const v = await crypto.subtle.digest('SHA-256', b); return Array.from(new Uint8Array(v), x => x.toString(16).padStart(2, '0')).join(''); }
  function pair(a, b) { const box = node('span', undefined, 'metric-pair'); box.append(node('span',fmt(a),'a'), node('span','→','arrow'), node('span',fmt(b),'b')); return box; }
  function renderTable() {
    const body = $('#stage-table tbody'); body.replaceChildren(); const filter = $('#method-filter').value;
    for (const method of data.methods.filter(m => filter === 'all' || m.id === filter)) {
      for (const r of method.rows) {
        const tr = node('tr',undefined,r.stage === 2 ? 'small-sample' : ''); tr.dataset.method = method.id; tr.dataset.stage = String(r.stage);
        const title = node('td'); title.append(node('span',method.title,'row-title'),node('span','stage' + r.stage + ' · ' + data.stage_labels[r.stage],'row-stage'));
        const count = node('td',String(r.query_count)); if (r.stage === 2) count.append(node('span','仅2个 · 慎解读','tiny-badge'));
        tr.append(title,count); for (const f of fields) { const td = node('td'); td.append(pair(r[f+'_A'],r[f+'_B'])); tr.append(td); }
        body.append(tr);
      }
    }
    $('#row-count').textContent = '当前显示' + body.children.length + '行；各阶段每方法有效query为60 / 30 / 2。完整精度保留在JSON。';
  }
  function renderQuery() {
    const frame = Number($('#query-frame').value); const rr = queries.rows.filter(r => r.frame === frame); const root = $('#query-details'); root.replaceChildren();
    $('#query-context').textContent = 'frame' + frame + ' · stage' + rr[0].stage + ' · ' + (rr[0].included_in_stage_table ? '计入阶段表' : '跨阶段边界，不计入阶段表');
    for (const r of rr) {
      const card = node('article',undefined,'query-card'); card.append(node('h3',data.methods.find(m => m.id === r.method).title)); const dl = node('dl');
      for (const [f,title] of fields.map((x,i) => [x,['采样 arm7','集成 arm7','采样 hand6','集成 hand6'][i]])) { dl.append(node('dt',title + ' · rad'),node('dd',fmt(r[f+'_A']) + ' → ' + fmt(r[f+'_B']))); }
      card.append(dl); root.append(card);
    }
  }
  function validate(d, q, s) {
    assert(d.schema === 'resize_probe_panel_v1' && q.schema === 'resize_probe_query_metrics_v1' && s.schema === 'resize_probe_sources_v1','不支持的来源格式');
    assert(d.closed_loop === false && d.population_SR === false && d.training_scene_count === 1 && q.closed_loop === false && q.new_SR === false,'实验解释范围不匹配');
    assert(typeof d.published === 'boolean' && d.private_only === !d.published && s.prepared_only === !d.published,'发布状态不一致');
    assert(d.observations === 368 && d.query_count_per_run === 94 && d.prediction_horizon === 30 && d.nominal_selected_prefix === 4,'固定时钟/步数不匹配');
    assert(JSON.stringify(d.stage_counts) === '[60,30,2]' && JSON.stringify(d.stage_boundaries) === '[241,363]','阶段计数或边界不匹配');
    assert(d.methods.length === 2 && d.methods.map(m=>m.id).join(',') === 'mem0,ours' && q.rows.length === 188,'方法或query记录缺失');
    assert(d.methods.every(m=>m.checkpoint_step === 30000 && m.AA_exact === true && m.actual_noise_equal_AB === true && m.rows.length === 3),'原始重复性门未通过');
    for (const m of d.methods) {
      const rows = q.rows.filter(r=>r.method === m.id); assert(rows.length === 94 && new Set(rows.map(r=>r.frame)).size === 94,'query重复或缺失');
      for (const r of rows) {
        assert(Number.isInteger(r.frame) && r.frame >= 0 && r.frame < 368 && r.stage === (r.frame < 241 ? 0 : r.frame < 363 ? 1 : 2),'query帧阶段错位');
        assert(r.included_in_stage_table === ![240,361].includes(r.frame),'边界掩码不匹配');
        for (const f of fields) for (const v of ['A','B']) assert(Number.isFinite(r[f+'_'+v]) && r[f+'_'+v] >= 0,'无效误差数值');
      }
      for (const a of m.rows) {
        const rows2 = rows.filter(r=>r.stage === a.stage && r.included_in_stage_table); assert(rows2.length === d.stage_counts[a.stage] && a.query_count === rows2.length,'阶段分母不匹配');
        for (const f of fields) for (const v of ['A','B']) { const key = f+'_'+v; const mean = rows2.reduce((x,r)=>x+r[key],0)/rows2.length; assert(Math.abs(a[key]-mean)<1e-12,'阶段表与逐query数据不一致'); }
      }
    }
    assert(d.classifier.ours.raw_records_exact_AB === true && d.classifier.mem0.changed_threshold_masks.length === 1 && d.classifier.mem0.changed_threshold_masks[0].frame === 354,'分类器解释门不匹配');
    assert(d.excluded_init_probes.length === 2 && d.excluded_init_probes.every(r=>r.outcome === 'U' && r.query_count === 0),'初始化U排除门不匹配');
    assert(d.legacy_records.unchanged === true && d.legacy_records.existing_closed_loop_records === 400 && d.legacy_records.existing_U_records === 48,'旧结果保护门不匹配');
    assert(/^[a-f0-9]{64}$/.test(s.independent_final_review_sha256) && /^[a-f0-9]{64}$/.test(s.independent_manifest_sha256),'缺少独立验收指纹');
  }
  async function main() {
    const [sb, db, qb, figure] = await Promise.all(['sources.json','data.json','query_metrics.json','arm_rmse_by_query.png'].map(get)); const source = decode(sb);
    assert(await hash(db) === source.data_sha256 && await hash(qb) === source.query_metrics_sha256 && await hash(figure) === source.figure_sha256,'来源SHA校验失败，停止展示');
    data = decode(db); queries = decode(qb); validate(data, queries, source);
    $('#publication-note').textContent = data.published ? '已发布诊断附录 · 无新增闭环SR' : '独立网页候选 · 尚未发布';
    $('#rgb-source').textContent = data.fixed_history.RGB_source; $('#q-source').textContent = data.fixed_history.q_source; $('#history-source').textContent = data.fixed_history.source;
    for (const stage of data.stages) $('#instructions').append(node('li',stage.text));
    for (const limit of data.limits) $('#limits').append(node('li',limit));
    const c = data.classifier.mem0.changed_threshold_masks[0]; $('#mem0-score').textContent = '原观测frame354 / stage1：A = ' + c.A.toFixed(6) + '，B = ' + c.B.toFixed(6) + '。该帧跨过原0.5阈值。';
    for (const r of data.excluded_init_probes) { const a = node('article',undefined,'callout'); a.append(node('h3',r.id + ' · U / 0 query'),node('p',r.reason)); $('#excluded').append(a); }
    for (const r of queries.rows.filter(r=>r.method === 'mem0')) { const option = node('option','frame' + r.frame + ' · stage' + r.stage); option.value = String(r.frame); $('#query-frame').append(option); }
    renderTable(); renderQuery(); $('#method-filter').addEventListener('change',renderTable); $('#query-frame').addEventListener('change',renderQuery);
    await $('#error-figure').decode(); $('#loading').hidden = true; $('#content').hidden = false;
    window.resizeProbePanel = {snapshot:()=>({ready:true,published:data.published,methods:data.methods.map(m=>m.id),tableRows:$('#stage-table tbody').children.length,query:Number($('#query-frame').value),queryRows:queries.rows.length,stageCounts:data.stage_counts,closedLoop:data.closed_loop,populationSR:data.population_SR})};
  }
  main().catch(e=>{ $('#error').textContent = '数据完整性检查未通过：' + String(e.message || e) + '。本页已停止展示对照结果，请检查来源。'; $('#error').hidden = false; $('#loading').hidden = true; $('#content').hidden = true; });
})();
