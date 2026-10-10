(() => {
  'use strict';
  // Keep historical deep links usable after the former page moves to its archive.
  const legacyHash = () => location.hash && !['#selected','#progress','#servers','#protocol','#pick-place-progress'].includes(location.hash) && /^#[\w-]+$/.test(location.hash);
  if (legacyHash()) {location.replace('pick_place_history_20261010.html' + location.hash); return;}
  window.addEventListener('hashchange', () => {if (legacyHash()) location.replace('pick_place_history_20261010.html' + location.hash);});
  const LIVE = 'https://raw.githubusercontent.com/asimfish/psibot-dashboard/refs/heads/feature/t-525-pick-place-live/results/pick_place_current.json';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = v => typeof v === 'number' ? v.toFixed(v % 1 ? 1 : 0) + '%' : '—';
  const date = s => s ? new Date(s).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai',hour12:false}) : '未核验';
  let data, selected = 'glass_beaker_250ml', method = 'dp', busy = false, origin = 'fallback', lastError = false;
  function valid(d) {
    if (d.schema_version !== 1 || d.generation !== 'paper_v4' || d.objects?.length !== 13 || new Set(d.objects.map(o => o.id)).size !== 13 || !Number.isFinite(Date.parse(d.published_at)) || !Number.isFinite(Date.parse(d.source_updated_at))) throw Error('进度数据格式不匹配');
    for (const o of d.objects) for (const m of ['dp','act']) {
      const cs = o.methods[m].conditions;
      if (cs.length !== 4 || new Set(cs.map(c => c.added_cm)).size !== 4 || cs.some(c => ![0,1,2,3].includes(c.added_cm))) throw Error('泛化档位不完整');
      if (cs.some(c => c.complete && (c.episodes !== 50 || !Number.isFinite(c.sr_percent) || !Number.isFinite(c.terminal_spatial_ssr20_percent)))) throw Error('测试结果不完整');
    }
    return d;
  }
  function freshness() {
    if (!data) return;
    const age = Date.now() - Date.parse(data.source_updated_at), pubAge = Date.now() - Date.parse(data.published_at);
    const stale = age > 1200000 || pubAge > 1200000;
    $('connection').textContent = stale ? '进度来源已过期 · 等待恢复同步' : origin === 'live' ? (lastError ? '更新连接暂时失败 · 保留上次数据' : '持续监管 · 自动更新') : (lastError ? '自动更新暂不可用 · 显示页面快照' : '页面发布时的快照 · 正在连接自动更新');
    document.querySelector('.freshness').classList.toggle('stale', stale || lastError || origin !== 'live');
    $('updated').textContent = `来源更新：${date(data.source_updated_at)} · 网页同步：${date(data.published_at)}（北京时间）`;
  }
  function menu() {
    const q = $('search').value.toLowerCase().trim();
    const rows = data.objects.filter(o => (o.label + ' ' + o.id).toLowerCase().includes(q));
    $('emptySearch').hidden = rows.length !== 0;
    $('objects').innerHTML = rows.map(o => {
      const n = Object.values(o.methods).reduce((s,m) => s + m.conditions.filter(c=>c.complete).length, 0);
      return `<button type="button" data-object="${esc(o.id)}" class="${o.id === selected ? 'active' : ''}" aria-pressed="${o.id === selected}">${esc(o.label)}<small>模型 ${Object.values(o.methods).filter(m=>m.verified_model).length}/2 · 测试 ${n}/8</small></button>`;
    }).join('');
  }
  function train(m) {
    const update = m.optimizer_updates;
    const transfers = m.transfer_total_bytes ? `<p class="small">训练数据传输 ${(m.transfer_bytes/2**20).toFixed(0)} / ${(m.transfer_total_bytes/2**20).toFixed(0)} MiB · 传输进度 ${(m.transfer_bytes/m.transfer_total_bytes*100).toFixed(1)}%</p>` : '';
    return `<p><strong>${esc(m.status_label)}</strong>${update !== null ? ` · 优化器 ${update.toLocaleString()} / ${m.required_updates.toLocaleString()} 次更新` : ''}</p>${update !== null ? `<progress max="${m.required_updates}" value="${update}" aria-label="优化器训练进度"></progress>` : ''}${transfers}${typeof m.train_loss === 'number' ? `<p class="small">最近有限训练 loss：${m.train_loss.toPrecision(4)} · 训练误差不等于成功率</p>` : ''}${m.progress_stalled ? '<p class="note">进展计数超过30分钟未前进，需要检查。监管服务心跳不计作训练进展。</p>' : ''}`;
  }
  function detail() {
    const o = data.objects.find(o=>o.id === selected), m = o.methods[method];
    $('objectTitle').textContent = o.label + ' · ' + method.toUpperCase();
    for(const k of ['dp','act']) {$ (k).classList.toggle('active', method === k); $(k).setAttribute('aria-pressed', method === k);}
    $('modelStatus').textContent = m.verified_model ? '模型核验完成 · 原生测试另行验收' : m.status_label;
    $('modelStatus').className = 'pill ' + (m.verified_model ? 'pass' : 'pending');
    $('trainingDetails').innerHTML = train(m);
    $('reference').textContent = `采集 ${o.source_episodes} 条 · XY ±3cm · ${o.collection_gpu}。` + (m.paper_reference ? `论文 Table 20 参考：SR ${pct(m.paper_reference.sr_percent)} / SSR ${pct(m.paper_reference.ssr_percent)}（3 seeds × 50）。` : '论文 Table 20 无精确对应行。');
    $('conditions').innerHTML = m.conditions.map(c => `<article class="condition"><h3>+${c.added_cm}cm</h3><small>测试 XY ±${c.xy_half_range_cm}cm${c.added_cm === 0 ? ' · 采集范围对照' : ''}</small>${c.complete ? `<div class="scores">${pct(c.sr_percent)}</div><small>SR · ${c.successes}/50 成功</small><div class="bar"><span style="width:${c.sr_percent}%"></span></div><div class="scores">${pct(c.terminal_spatial_ssr20_percent)}</div><small>终态空间 SSR20 · ${c.spatial_safe_successes}/50</small><div class="bar ssr"><span style="width:${c.terminal_spatial_ssr20_percent}%"></span></div><p class="small">实际范围外 ${c.settled_outside_count}/50<br>范围外 SR ${pct(c.outside_sr_percent)} / SSR20 ${pct(c.outside_spatial_ssr20_percent)}</p><div class="hardware ${c.same_gpu ? 'pass' : 'pending'}">${esc(c.test_gpu || '测试显卡待核验')} · ${c.same_gpu === true ? '采集同型号' : c.same_gpu === false ? '跨型号 · 选定档位需复核' : '同型号状态待核验'}</div>` : `<div class="state"><span class="pill pending">${esc(c.status_label)}</span><p class="small">完整50次结束后显示 SR / SSR20</p></div>`}</article>`).join('');
    $('acceptance').textContent = `当前 ${m.conditions.filter(c=>c.complete).length}/4 档完整测试。最终统一泛化档位和论文SSR等价性仍待核验；当前未签发该物体完整论文验收。`;
    $('evidence').innerHTML = `<p>模型 SHA256：${esc(m.model_sha256 || '模型未完成')}</p>` + m.conditions.filter(c=>c.complete).map(c=>`<p>+${c.added_cm}cm · 原始记录 SHA256：${esc(c.raw_sha256)}<br>结果核验记录 SHA256：${esc(c.receipt_sha256)}</p>`).join('');
  }
  function matrix() {
    const stage = $('stage').value;
    let html = '';
    for(const o of data.objects) for(const k of ['dp','act']) {
      const m = o.methods[k], n = m.conditions.filter(c=>c.complete).length;
      if(stage==='training' && m.verified_model || stage==='testing' && n===4 || stage==='complete' && n!==4) continue;
      html += `<tr><td><button data-object="${esc(o.id)}" data-method="${k}">${esc(o.label)}<span class="cell-label">${k.toUpperCase()} · 采集 ${esc(o.collection_gpu)}</span></button></td><td><span class="pill ${m.verified_model ? 'pass' : 'pending'}">${esc(m.status_label)}</span>${m.optimizer_updates !== null ? `<span class="cell-label">${m.optimizer_updates.toLocaleString()}/${m.required_updates.toLocaleString()}</span>` : ''}</td>` + m.conditions.map(c=>`<td>${c.complete ? `<strong>${pct(c.sr_percent)} / ${pct(c.terminal_spatial_ssr20_percent)}</strong><span class="cell-label">50次 · 范围外 ${c.settled_outside_count}次</span><span class="cell-label">${c.same_gpu === true ? '采集同型号' : c.same_gpu === false ? '跨型号需复核' : '显卡待核验'}</span>` : `<span class="pill pending">${esc(c.status_label)}</span>`}</td>`).join('') + '</tr>';
    }
    $('matrix').innerHTML = html;
    $('emptyMatrix').hidden = !!html;
  }
  function render() {
    const t = data.totals;
    $('stats').innerHTML = [[`${t.verified_models} / ${t.required_models}`,'模型核验完成','DP + ACT · 最终预算与模型校验'],[`${t.complete_cells} / ${t.required_cells}`,'完整测试组','每物体 × 方法 × 四档泛化'],[`${t.complete_trials.toLocaleString()} / ${t.required_trials.toLocaleString()}`,'已核验原生试次','每组 50 次 · 含成功与失败'],[`${t.same_gpu_cells} / ${t.complete_cells}`,'完整组使用采集同型号卡','最终论文验收：待统一档位与SSR核验']].map(([v,l,s])=>`<div class="card stat"><strong>${v}</strong><span>${l}</span><small>${s}</small></div>`).join('');
    menu(); detail(); matrix(); freshness();
    $('workers').innerHTML = data.workers.map(w=>`<div><strong>${esc(w.name)}</strong><span class="pill pending">${esc(w.status_label)}</span><p>${esc(w.activity)}</p>${w.available_gib !== null ? `<small>可用内存 ${w.available_gib} / 需 ${w.required_gib} GiB</small>` : ''}</div>`).join('');
    $('trainingServers').innerHTML = data.training_servers.map(s=>`<div><strong>${esc(s.name)}</strong><p>${esc(s.status_label)}</p><small>记录更新时间 ${date(s.source_updated_at)}</small></div>`).join('');
    $('alerts').innerHTML = data.alerts.map(a=>`<li>${esc(a)}</li>`).join('');
    $('controllers').innerHTML = data.controllers.map(c=>`<div><strong>${esc(c.role)}</strong><span class="pill ${c.active ? 'pass' : 'pending'}">${c.active ? '运行中' : '未确认运行'}</span></div>`).join('');
    $('sources').innerHTML = data.sources.map(s=>`<p>${esc(s.name)} · ${date(s.updated_at)} · ${s.stale ? '需检查更新' : '已同步'}</p>`).join('');
    $('dataLink').href = origin === 'live' ? LIVE : 'results/pick_place_current.json';
    $('loadError').hidden = true;
  }
  async function get(url) {
    const controller = new AbortController(), timer = setTimeout(()=>controller.abort(), 8000);
    try {const r = await fetch(url + '?v=' + Date.now(), {cache:'no-store', signal:controller.signal}); if(!r.ok) throw Error('HTTP ' + r.status); return valid(await r.json());} finally {clearTimeout(timer);}
  }
  async function tick() {
    if(busy) return;
    busy = true; $('refresh').disabled = true;
    try {
      if(!data) { try {data = await get('results/pick_place_current.json'); render();} catch(_) {} }
      const d = await get(LIVE);
      if(!data || Date.parse(d.published_at) >= Date.parse(data.published_at)) {data = d; origin = 'live';}
      lastError = false; render();
    } catch(_) {
      lastError = true;
      if(data) freshness(); else {$('loadError').hidden = false; $('loadError').textContent = '暂时无法读取进度，请稍后刷新。历史成绩与视频仍可从历史页查看。'; $('connection').textContent = '数据暂不可用';}
    } finally {busy = false; $('refresh').disabled = false;}
  }
  function choose(id,k) {selected = id; if(k) method = k; menu(); detail();}
  $('objects').addEventListener('click', e=>{const b=e.target.closest('[data-object]');if(b)choose(b.dataset.object);});
  $('matrix').addEventListener('click', e=>{const b=e.target.closest('[data-object]');if(b){choose(b.dataset.object,b.dataset.method);$('selected').scrollIntoView({behavior:'smooth'});}});
  $('search').addEventListener('input',()=>data&&menu());
  $('stage').addEventListener('change',()=>data&&matrix());
  for(const k of ['dp','act']) $(k).addEventListener('click',()=>{method=k;if(data)detail();});
  $('refresh').addEventListener('click', tick);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  tick();setInterval(tick,60000);setInterval(freshness,10000);
})();
