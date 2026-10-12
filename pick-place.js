(() => {
  'use strict';
  // Keep historical deep links usable after the former page moves to its archive.
  const legacyHash = () => location.hash && !['#selected','#progress','#servers','#protocol','#pick-place-progress'].includes(location.hash) && /^#[\w-]+$/.test(location.hash);
  if (legacyHash()) {location.replace('pick_place_history_20261010.html' + location.hash); return;}
  window.addEventListener('hashchange', () => {if (legacyHash()) location.replace('pick_place_history_20261010.html' + location.hash);});
  const LIVE = 'https://raw.githubusercontent.com/asimfish/psibot-dashboard/refs/heads/feature/t-525-pick-place-live/results/pick_place_current.json';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const pct = v => finite(v) && v >= 0 && v <= 100 ? v.toFixed(v % 1 ? 1 : 0) + '%' : '—';
  const spatialBound = c => c.complete && c.episodes === 50 && data.protocol.paper_ssr_equivalence === 'LOCAL_REPOSITORY_SPATIAL20_DOMAIN_BOUND' && finite(c.paper_ssr_percent) && c.paper_ssr_percent === c.terminal_spatial_ssr20_percent;
  const spatialLabel = c => spatialBound(c) ? '空间 SSR20 · 本地论文实现已绑定' : '终态空间 SSR20 · 绑定待核验';
  const date = s => s ? new Date(s).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai',hour12:false}) : '未核验';
  let data, selected = 'glass_beaker_250ml', method = 'dp', busy = false, origin = 'fallback', lastError = false;
  function valid(d) {
    if (d.schema_version !== 1 || d.generation !== 'paper_v4' || d.objects?.length !== 13 || new Set(d.objects.map(o => o.id)).size !== 13 || !Number.isFinite(Date.parse(d.published_at)) || !Number.isFinite(Date.parse(d.source_updated_at))) throw Error('进度数据格式不匹配');
    for (const o of d.objects) for (const m of ['dp','act']) {
      const cs = o.methods[m].conditions;
      if (cs.length !== 4 || new Set(cs.map(c => c.added_cm)).size !== 4 || cs.some(c => ![0,1,2,3].includes(c.added_cm))) throw Error('泛化档位不完整');
      if (cs.some(c => c.complete && (c.episodes !== 50 || !Number.isFinite(c.sr_percent) || !Number.isFinite(c.terminal_spatial_ssr20_percent)))) throw Error('测试结果不完整');
      if (cs.some(c => c.paper_ssr_percent != null && (!c.complete || !finite(c.paper_ssr_percent) || c.paper_ssr_percent < 0 || c.paper_ssr_percent > 100 || c.paper_ssr_percent !== c.terminal_spatial_ssr20_percent))) throw Error('空间 SSR 绑定数据无效');
      const ref=o.methods[m].paper_reference;
      if(ref && [ref.sr_percent,ref.ssr_percent].some(v=>!finite(v)||v<0||v>100)) throw Error('论文参考值无效');
    }
    for(const key of ['fleet_gpu_telemetry','candidate_progress','candidate_cross_card_screening','candidate_pro6000_testing'])
      if(d[key]!==undefined&&!Array.isArray(d[key]))throw Error('服务器数据格式不匹配');
    for(const h of d.fleet_gpu_telemetry||[])
      if(!Object.hasOwn(hostNames,h.host)||!Array.isArray(h.gpus)||h.gpus.length>32||h.gpus.some(g=>!Number.isInteger(g.index)||g.index<0||g.index>=32))throw Error('GPU 数据格式不匹配');
    return d;
  }
  function freshness() {
    if (!data) return;
    const age = Date.now() - Date.parse(data.source_updated_at), pubAge = Date.now() - Date.parse(data.published_at);
    const stale = age > 1200000 || pubAge > 1200000;
    $('connection').textContent = stale ? '进度来源已过期 · 等待恢复同步' : origin === 'live' ? (lastError ? '更新连接暂时失败 · 保留上次数据' : '持续监管 · 自动更新') : (lastError ? '自动更新暂不可用 · 显示页面快照' : '页面发布时的快照 · 正在连接自动更新');
    document.querySelector('.freshness').classList.toggle('stale', stale || lastError || origin !== 'live');
    $('updated').textContent = `来源更新：${date(data.source_updated_at)} · 网页同步：${date(data.published_at)}（北京时间）`;
    for(const node of document.querySelectorAll('[data-sampled-at]')) {
      const old=Date.now()-Date.parse(node.dataset.sampledAt)>Math.max(180,(data.publish_seconds||600)+180)*1000;
      node.classList.toggle('telemetry-stale',old||node.dataset.sampleFailed==='true');
      node.querySelector('.sample-status').textContent=old||node.dataset.sampleFailed==='true'?'GPU 样本过期或查询失败':'GPU 采样已同步';
    }
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
    $('conditions').innerHTML = m.conditions.map(c => `<article class="condition"><h3>+${c.added_cm}cm</h3><small>测试 XY ±${c.xy_half_range_cm}cm${c.added_cm === 0 ? ' · 采集范围对照' : ''}</small>${c.complete ? `<div class="scores">${pct(c.sr_percent)}</div><small>SR · ${c.successes}/50 成功</small><div class="bar"><span style="width:${c.sr_percent}%"></span></div><div class="scores">${pct(c.terminal_spatial_ssr20_percent)}</div><small>${spatialLabel(c)} · ${c.spatial_safe_successes}/50</small><div class="bar ssr"><span style="width:${c.terminal_spatial_ssr20_percent}%"></span></div><p class="small">实际范围外 ${c.settled_outside_count}/50<br>范围外 SR ${pct(c.outside_sr_percent)} / SSR20 ${pct(c.outside_spatial_ssr20_percent)}</p><div class="hardware ${c.same_gpu ? 'pass' : 'pending'}">${esc(c.test_gpu || '测试显卡待核验')} · ${c.same_gpu === true ? '采集同型号' : c.same_gpu === false ? '跨型号 · 选定档位需复核' : '同型号状态待核验'}</div>` : `<div class="state"><span class="pill pending">${esc(c.status_label)}</span><p class="small">完整50次结束后显示 SR / SSR20</p></div>`}</article>`).join('');
    const primary=data.protocol.primary_added_cm;
    const cell=m.conditions.find(c=>c.added_cm===primary),ref=m.paper_reference;
    const blockers=[];
    if(m.conditions.filter(c=>c.complete).length!==4)blockers.push('四档50次尚未全部完成');
    if(!cell?.complete)blockers.push('共同档位50次待完成');
    else {
      if(cell.same_gpu!==true)blockers.push('采集同型号显卡待复核');
      if(!spatialBound(cell))blockers.push('空间 SSR 原始记录绑定待核验');
    }
    if(!ref)blockers.push('论文无精确对应行');
    else if(cell?.complete){
      if(cell.sr_percent<ref.sr_percent)blockers.push(`SR ${pct(cell.sr_percent)} / 目标 ${pct(ref.sr_percent)}`);
      if(spatialBound(cell)&&cell.paper_ssr_percent<ref.ssr_percent)blockers.push(`SSR ${pct(cell.paper_ssr_percent)} / 目标 ${pct(ref.ssr_percent)}`);
    }
    $('acceptance').textContent = `当前 ${m.conditions.filter(c=>c.complete).length}/4 档完整测试。${primary===2?'共同档位 +2cm（XY ±5cm）。':'共同档位待位置覆盖核验。'}${blockers.length?'待验收：'+blockers.join('；')+'。':'当前方法已满足本轮 SR / 空间 SSR 参考门槛；物体验收还需 DP / ACT 均达标。'}`;
    const bound=data.objects.reduce((n,o)=>n+Object.values(o.methods).reduce((s,m)=>s+m.conditions.filter(spatialBound).length,0),0);
    $('ssrBinding').textContent=bound?`${bound} 组完整50次已绑定本地论文空间域实现：原生任务成功、空间记录有效、终态物体到原生放置目标的三维距离 ≤20mm，分母50。按每组原始记录和模型 SHA 核验后计分；未完整或未绑定的组继续标为待核验。`:'当前数据尚未携带已审阅的空间 SSR 绑定；测试格暂显示终态空间 SSR20，完整50次及绑定核验后签发。';
    $('commonCondition').textContent=primary===2?'首轮完整曲线按实际位置覆盖选定共同 +2cm（XY ±5cm）：所有物体和方法采用同一档位，完整四档与原始跨卡结果保留。最终验收逐项检查采集同型号显卡、SR 和已绑定空间 SSR 的论文门槛。':'按实际落在采集范围外的覆盖率选择共同泛化档位，保留完整曲线；统一档位的采集同型号显卡复核与论文 SSR 核验分别记录。';
    $('evidence').innerHTML = `<p>模型 SHA256：${esc(m.model_sha256 || '模型未完成')}</p>` + m.conditions.filter(c=>c.complete).map(c=>`<p>+${c.added_cm}cm · 原始记录 SHA256：${esc(c.raw_sha256)}<br>结果核验记录 SHA256：${esc(c.receipt_sha256)}</p>`).join('');
  }
  function matrix() {
    const stage = $('stage').value;
    let html = '';
    for(const o of data.objects) for(const k of ['dp','act']) {
      const m = o.methods[k], n = m.conditions.filter(c=>c.complete).length;
      if(stage==='training' && m.verified_model || stage==='testing' && n===4 || stage==='complete' && n!==4) continue;
      html += `<tr data-task="${esc(o.id)}-${k}"><td><button data-object="${esc(o.id)}" data-method="${k}">${esc(o.label)}<span class="cell-label">${k.toUpperCase()} · 采集 ${esc(o.collection_gpu)}</span></button></td><td class="paper-sr">${m.paper_reference?`<strong>${pct(m.paper_reference.sr_percent)}</strong>`:'—<span class="cell-label">论文未对应</span>'}</td><td class="paper-ssr">${m.paper_reference?`<strong>${pct(m.paper_reference.ssr_percent)}</strong>`:'—<span class="cell-label">论文未对应</span>'}</td><td><span class="pill ${m.verified_model ? 'pass' : 'pending'}">${esc(m.status_label)}</span>${m.optimizer_updates !== null ? `<span class="cell-label">${m.optimizer_updates.toLocaleString()}/${m.required_updates.toLocaleString()}</span>` : ''}</td>` + m.conditions.map(c=>`<td>${c.complete ? `<strong>${pct(c.sr_percent)} / ${pct(c.terminal_spatial_ssr20_percent)}</strong><span class="cell-label">50次 · ${spatialBound(c)?'空间 SSR 已绑定':'SSR 绑定待核验'} · 范围外 ${c.settled_outside_count}次</span><span class="cell-label">${c.same_gpu === true ? '采集同型号' : c.same_gpu === false ? '跨型号需复核' : '显卡待核验'}</span>` : `<span class="pill pending">${esc(c.status_label)}</span>`}</td>`).join('') + '</tr>';
    }
    $('matrix').innerHTML = html;
    $('emptyMatrix').hidden = !!html;
  }
  const hostNames={aliyun:'aliyun', '30109':'30109',mainskill:'mainskill',liyufeng_4090:'4090', '5090':'5090','volc-pro6000':'Pro6000'};
  function fleetJobs() {
    const jobs=new Map(), label=id=>data.objects.find(o=>o.id===id)?.label||id;
    const put=(host,gpu,title,value,max,kind)=>{
      if(!Object.hasOwn(hostNames,host)||!Number.isInteger(gpu)||gpu<0||gpu>=32)return;
      const key=host+':'+gpu;
      if(!jobs.has(key))jobs.set(key,{host,gpu,title,value:finite(value)?value:null,max:finite(max)?max:null,kind});
    };
    for(const r of data.candidate_progress||[])if(r.active)put(r.host,r.gpu,label(r.object)+' · '+r.method.toUpperCase(),r.optimizer_updates,r.required_updates,'训练');
    for(const [host,rows] of [['5090',data.candidate_cross_card_screening],['volc-pro6000',data.candidate_pro6000_testing]])
      for(const r of rows||[])if(r.active)put(host,r.gpu,label(r.object)+' · ACT · +'+r.added_cm+'cm',r.closed_trials,50,'候选测试');
    // Baseline native lanes are separate from candidate training and history.
    for(const w of data.workers||[]) {
      if(w.name==='liyufeng_4090' && /原生测试中/.test(w.status_label))put('liyufeng_4090',0,w.activity,null,null,'原生测试');
      const match=/^(5090|volc-pro6000) · GPU([01])$/.exec(w.name);
      if(match && /原生测试中/.test(w.status_label))put(match[1],Number(match[2]),w.activity,null,null,'原生测试');
    }
    return jobs;
  }
  function gauge(value,label) {
    return `<div class="metric"><span>${esc(label)}</span>${finite(value)&&value>=0&&value<=100?`<div class="meter" role="img" aria-label="${esc(label)}"><span style="width:${value}%"></span></div>`:''}</div>`;
  }
  function gpuTable(host,gpus,jobs) {
    return `<div class="table-wrap"><table class="gpu-table"><caption class="sr-only">${esc(hostNames[host])} 显卡与 PickPlace 当前作业</caption><thead><tr><th scope="col">GPU / 型号</th><th scope="col">当前任务</th><th scope="col">实际进展</th><th scope="col">GPU 利用率</th><th scope="col">显存</th></tr></thead><tbody>${gpus.map(g=>{
      const j=jobs.get(host+':'+g.index),total=g.memory_total_mib,used=g.memory_used_mib;
      const memory=finite(total)&&total>0&&finite(used)&&used>=0&&used<=total;
      const progress=j&&finite(j.value)&&finite(j.max)&&j.max>0&&j.value>=0&&j.value<=j.max;
      return `<tr data-gpu="${esc(host)}:${g.index}"><th scope="row">GPU ${g.index}<span class="cell-label">${esc(g.model||'型号待采样')}</span></th><td>${j?`<strong>${esc(j.title)}</strong><span class="cell-label">${esc(j.kind)}</span>`:'<span class="muted">无 PickPlace 作业绑定</span><span class="cell-label">共享作业或资源状态以采样为准</span>'}</td><td>${progress?`${j.value.toLocaleString()} / ${j.max.toLocaleString()}<progress value="${j.value}" max="${j.max}" aria-label="${esc(j.title+'实际进展')}"></progress>`:j?'正在执行 · 计数待同步':'—'}</td><td>${gauge(g.utilization_percent,pct(g.utilization_percent))}</td><td>${memory?gauge(100*used/total,(used/1024).toFixed(1)+' / '+(total/1024).toFixed(1)+' GiB'):'—'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function fleet() {
    const jobs=fleetJobs(),telemetry=data.fleet_gpu_telemetry||[],hostFilter=$('hostFilter').value,showAll=$('allGpus').checked;
    const readHost=host=>telemetry.find(r=>r.host===host),known=telemetry.reduce((s,h)=>s+(h.gpus?.length||0),0);
    const training=[...jobs.values()].filter(r=>r.kind==='训练').length,testing=jobs.size-training;
    $('fleetSummary').innerHTML=[[training,'PickPlace 训练卡'],[testing,'PickPlace 测试卡'],[known||'—','已采样显卡（含共享作业）']].map(([n,t])=>`<div><strong>${n}</strong><span>${t}</span></div>`).join('');
    $('fleet').innerHTML=Object.keys(hostNames).filter(h=>hostFilter==='all'||hostFilter===h).map(host=>{
      const sample=readHost(host),all=[...(sample?.gpus||[])],own=[...jobs.values()].filter(j=>j.host===host);
      for(const j of own)if(!all.some(g=>g.index===j.gpu))all.push({index:j.gpu});
      all.sort((a,b)=>a.index-b.index);
      const primary=showAll?all:all.filter(g=>jobs.has(host+':'+g.index)),other=all.filter(g=>!jobs.has(host+':'+g.index));
      const trainInfo=data.training_servers.find(r=>r.name===host),workerInfo=data.workers.find(r=>r.name===host);
      const training=own.filter(j=>j.kind==='训练').length;
      const activity=own.length?[training?training+' 个训练作业正在更新':'',own.length-training?(own.length-training)+' 个原生测试作业正在执行':''].filter(Boolean).join(' · '):trainInfo?.status_label||workerInfo?.status_label||'等待作业状态同步';
      return `<article class="host" data-host="${esc(host)}" ${sample?.source_updated_at?`data-sampled-at="${esc(sample.source_updated_at)}" data-sample-failed="${!sample.fresh}"`:''}><div class="host-heading"><div><h3>${esc(hostNames[host])}</h3><span class="small">${own.length} 张卡有 PickPlace 当前作业 · ${sample?.gpus?.length||'—'} 张卡已采样</span></div><div class="host-resources">CPU ${pct(sample?.cpu_percent)}<span>内存可用 ${finite(sample?.memory_available_gib)?sample.memory_available_gib+' / '+sample.memory_total_gib+' GiB':'—'}</span></div></div><p class="small">${esc(activity)}</p>${primary.length?gpuTable(host,primary,jobs):'<p class="muted">当前没有已绑定的 PickPlace 显卡作业。</p>'}${!showAll&&other.length?`<details class="other-gpus"><summary>查看其他 ${other.length} 张显卡</summary>${gpuTable(host,other,jobs)}</details>`:''}<div class="host-sample"><span class="sample-status">${sample?.fresh?'GPU 采样已同步':'GPU 数据待同步'}</span><span>采样：${date(sample?.source_updated_at)}</span></div></article>`;
    }).join('');
    const history=[];
    for(const r of data.candidate_progress||[])if(!r.active)history.push([r.host,label(r.object),r.method.toUpperCase(),r.status_label]);
    for(const [host,rows] of [['5090',data.candidate_cross_card_screening],['volc-pro6000',data.candidate_pro6000_testing]])for(const r of rows||[])if(!r.active)history.push([host,label(r.object),'ACT · +'+r.added_cm+'cm',r.status_label]);
    $('candidateHistory').innerHTML=history.length?'<table><thead><tr><th scope="col">服务器</th><th scope="col">物体</th><th scope="col">方法 / 档位</th><th scope="col">结果与待办</th></tr></thead><tbody>'+history.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p class="muted">暂无候选历史记录。</p>';
    function label(id){return data.objects.find(o=>o.id===id)?.label||id;}
  }
  function render() {
    const t = data.totals;
    $('stats').innerHTML = [[`${t.verified_models} / ${t.required_models}`,'模型核验完成','DP + ACT · 最终预算与模型校验'],[`${t.complete_cells} / ${t.required_cells}`,'完整测试组','每物体 × 方法 × 四档泛化'],[`${t.complete_trials.toLocaleString()} / ${t.required_trials.toLocaleString()}`,'已核验原生试次','每组 50 次 · 含成功与失败'],[`${t.same_gpu_cells} / ${t.complete_cells}`,'完整组使用采集同型号卡','最终验收：同型号卡及 SR / 空间 SSR 门槛']].map(([v,l,s])=>`<div class="card stat"><strong>${v}</strong><span>${l}</span><small>${s}</small></div>`).join('');
    menu(); detail(); matrix(); fleet(); freshness();
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
  $('hostFilter').addEventListener('change',()=>{if(data){fleet();freshness();}});
  $('allGpus').addEventListener('change',()=>{if(data){fleet();freshness();}});
  for(const k of ['dp','act']) $(k).addEventListener('click',()=>{method=k;if(data)detail();});
  $('refresh').addEventListener('click', tick);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  tick();setInterval(tick,60000);setInterval(freshness,10000);
})();
