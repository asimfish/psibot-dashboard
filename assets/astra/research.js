'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safe=v=>{if(typeof v!=='string')return '';if(/^(assets|results)\/astra\/[A-Za-z0-9_./-]+$/.test(v)&&!v.includes('..'))return v;try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='asimfish.github.io'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
 const names={rich:'全部输入',minus_S:'去末端位姿/开口',minus_J:'去关节状态',minus_K:'去相机标定',minus_F:'去数值误差',minus_H:'去图像/动作历史',rgb_only:'去五类信息',full:'全部输入',no_numeric_state:'去数值状态',historical_xhigh:'历史 xhigh',scene_state_privileged:'物体/手部特权状态','delta/proprio':'增量 / 本体','waypoint/none':'路径点 / 低信息','waypoint/proprio':'路径点 / 本体','code/proprio':'程序 / 本体','code/privileged':'程序 / 特权'};
 const cameras={head_camera:'头部相机',chest_camera:'胸部相机',third_camera:'第三视角',wrist_camera:'腕部相机',agentview:'固定外部视角',robot0_eye_in_hand:'腕部视角'};
 const keys={task_instruction:'任务说明',static_robot:'固定机器人说明',hand_semantics:'手部语义',requests_remaining_including_this:'剩余预算',memory_from_previous_decision:'文字记忆',last_action_status:'分类执行状态',S:'末端位姿/开口',J:'关节角/速度',K:'相机标定',F:'数值执行误差',H:'图像/动作历史',previous_observations_own_actions:'图像/动作历史',robot:'机器人状态',cameras:'相机信息',last_execution_feedback:'执行反馈',sim_time_s:'仿真时间'};
 const cname=x=>x==='rgb_only'&&currentTask.startsWith('psi_')?'RGB精简条件':names[x]||x;
 const status=v=>v===true?'成功':v===false?'失败':'中断';
 const badge=v=>`<span class="status ${v===true?'success':v===false?'failure':'interrupted'}">${status(v)}</span>`;
 function ci(k,n){if(!n)return '尚无有效终态';const z=1.959963984540054,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return `${((c-h)*100).toFixed(1)}–${((c+h)*100).toFixed(1)}%`;}
 let study,protocol,episodes,audit,traces,report,nativeGallery,currentTask='fr3_place',currentRow='',currentEpisode='';
 const rowById=id=>study.rows.find(r=>r.id===id), episodeById=id=>episodes.find(e=>e.episode_id===id), videoById=id=>audit.find(x=>x.episode_id===id&&x.video_url);
 const poster=x=>safe(x?.contact_sheet)||'';
 const median=(s,scale=1)=>s.median===null?'未记录':`${(s.median/scale).toFixed(1)}<small>IQR ${(s.q1/scale).toFixed(1)}–${(s.q3/scale).toFixed(1)} · ${s.n}条${s.missing?' / 缺'+s.missing+'条':''}</small>`;
 const sr=r=>r.selected_case?'<b>选取的成功案例</b><small>不计算正式成功率</small>':r.valid_n?`<b>${r.valid_n<20?'探索：':''}${r.successes}/${r.valid_n}（${(100*r.successes/r.valid_n).toFixed(1)}%）</b><small>Wilson 95% CI ${ci(r.successes,r.valid_n)}${r.interruptions?' · '+r.interruptions+'中断':''}</small>`:'<b>未形成有效终态</b><small>'+r.interruptions+'中断</small>';
 function rowMarkup(r){
  const x=r.episode_ids.map(videoById).find(Boolean), src=poster(x), readiness=r.selected_case?'单条选例':`${r.valid_n}/20 最低有效回合`;
  return `<tr data-condition="${esc(r.condition)}" class="${r.id===currentRow?'selected-row':''}"><th scope="row"><button class="condition-select" data-row="${esc(r.id)}" aria-pressed="${r.id===currentRow}">${esc(cname(r.condition))}</button><small>${esc(readiness)}</small></th><td>${esc(r.difference)}</td><td>${sr(r)}</td><td>未记录<small>模型调用中位数：${median(r.requests)}<br>调用次数不等于重试</small></td><td>${median(r.elapsed,r.elapsed_kind==='wall_s'?60:1)}<small>${r.elapsed_kind==='wall_s'?'完整墙钟 · 分钟':r.elapsed_kind==='model_wait_s'?'模型等待 · 秒':'模型推理累计 · 秒'}</small></td><td><button class="sample-select" data-row="${esc(r.id)}" aria-label="${esc(cname(r.condition))}的录像与输入">${src?`<img loading="lazy" src="${esc(src)}" alt="${esc(cname(r.condition))}原录像时序采样预览">`:''}<span>${x?'播放与对比 ▷':'缺录像 · 查看记录'}</span></button></td></tr>`;
 }
 function figures(images,label){return `<div class="input-camera-grid">${images.map(i=>`<figure><a href="${esc(safe(i.url))}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(safe(i.url))}" alt="${esc(cameras[i.camera]||i.camera)}实际模型输入RGB"></a><figcaption><b>${esc(cameras[i.camera]||i.camera)}</b><span>${esc(label||i.label||'实际模型输入 PNG')}</span></figcaption></figure>`).join('')}</div>`;}
 function drawTask(){
  document.querySelectorAll('video').forEach(v=>v.pause());
  const task=study.tasks.find(t=>t.id===currentTask),rows=study.rows.filter(r=>r.task===currentTask);
  const base=rows.find(r=>r.condition==='rich'||r.condition==='full'||r.condition==='waypoint/proprio')||rows[0],meta=episodeById(base.episode_ids[0]);
  if(!rows.some(r=>r.id===currentRow))currentRow=rows.find(r=>r.condition==='minus_S'||r.condition==='waypoint/none')?.id||rows[0].id;
  $('task-select').value=currentTask;
  $('task-title').textContent=task.title;
  $('task-contract').innerHTML=`<dl class="design"><div><dt>模型看到几个相机？</dt><dd>${task.model_camera_count===null?'模型数量待核；有3路回放':task.model_camera_count+' 路 RGB：'+task.cameras.map(c=>cameras[c]||c).join('、')}<small>${esc(task.camera_basis)}</small></dd></div><div><dt>动作接口</dt><dd>${esc(task.action)}</dd></div><div><dt>样本与比较范围</dt><dd>${currentTask==='fr3_place'?'两个初态的探索对照，尚未达到每条件20条':currentTask.startsWith('panda')?'每格20回合；输入包与接口同时变化，不作单字段归因':currentTask==='psi_roundtrip'?'选取的长程成功案例；没有重复测试分母':'历史小批次，按协议分开；尚无手势库接口的20条对照'}</dd></div><div><dt>留存模型 / 推理档位</dt><dd>${esc(meta.model)} / ${esc(meta.reasoning_effort)}${currentTask.startsWith('panda')?'<small>原配置记录；未重核上游模型回执。</small>':''}</dd></div></dl><p class="baseline-inputs"><b>${currentTask.startsWith('panda')?'路径点 / 本体参考输入':currentTask==='psi_roundtrip'?'案例输入': '基线 / 本协议输入'}：</b>${base.input_fields.map(x=>esc(keys[x]||x)).join(' · ')}</p>`;
  const images=task.model_images||[],panda=task.public_input_examples||[];
  $('task-views').innerHTML=images.length?`<p class="caption">任务输入示例：${esc(task.sample_trace_id)}，第1轮真实PNG。所选回合的输入在下方单独显示。</p>${figures(images,'第1轮真实模型输入')}`:panda.length?`<p class="caption">原报告公开的真实查询图；每组注明对应输入/接口，不能代替未公开条件的PNG。</p>${panda.reduce((html,i,index)=>index%2?html:html+`<p class="caption">${esc(cname(i.condition))} · ${esc(i.source_episode)}</p>${figures(panda.slice(index,index+2),'原报告第1次查询')}`,'')}`:task.id.startsWith('panda_')?'<p class="quiet">原协议为两路RGB，本任务真实输入PNG尚未收录；回放仅为固定外部视角。</p>':`<p class="quiet">逐轮模型RGB清单尚未核到。三个回放机位在下方播放器中切换。</p>`;
  $('matrix').innerHTML=`<table><caption>同任务、同协议分别统计。任务重试未记录；耗时为有记录尝试的中位数与IQR，失败早停不能解释成更快。</caption><thead><tr><th scope="col">条件 / 样本</th><th scope="col">输入区别</th><th scope="col">成功 / 有效 ↑</th><th scope="col">任务重试 ↓ / 调用</th><th scope="col">耗时 ↓</th><th scope="col">原录像与输入</th></tr></thead><tbody>${rows.map(rowMarkup).join('')}</tbody></table>`;
  drawRow(false);
 }
 function card(id,title,camera){
  const e=episodeById(id),x=camera?audit.find(x=>x.episode_id===id&&x.camera===camera&&x.video_url):videoById(id),v=x?.visual_review||{},t=x?.technical||{};
  if(!e)return '';
  return `<article class="video-card" data-episode="${esc(id)}"><div class="video-title"><b>${esc(title)}</b>${badge(e.success)}</div>${x?`<video controls playsinline preload="none" src="${esc(safe(x.video_url))}" poster="${esc(poster(x))}" aria-label="${esc(id)}原录像"></video>`:'<div class="missing-video">这个回合缺原录像</div>'}<div class="video-info"><p class="caption">${esc(id)}${x?' · '+esc(cameras[x.camera]||x.camera)+' · '+t.width+'×'+t.height:''}</p><p><b>画面观察</b>${esc(v.observation_zh||'缺录像，保留中断记录')}</p><p><b>视角 / 渲染</b>${esc(v.viewpoint||'未留录像')} ${esc(v.rendering_zh||'')}</p><p class="caption">模型调用 ${e.requests??'未记录'} 次；墙钟 ${e.wall_s!=null?(e.wall_s/60).toFixed(2)+'分钟':'未记录'}；任务重试未记录。</p><a href="astra-evidence.html?episode=${encodeURIComponent(id)}">逐轮动作与录像审查 →</a></div></article>`;
 }
 function drawRow(scroll=true){
  document.querySelectorAll('#case-videos video').forEach(v=>v.pause());
  const r=rowById(currentRow);
  if(!r.episode_ids.includes(currentEpisode))currentEpisode=r.episode_ids[0];
  $('selected-condition').textContent=cname(r.condition);
  $('episode-select').innerHTML=r.episode_ids.map(id=>`<option value="${esc(id)}">${esc(id)} · ${status(episodeById(id).success)}</option>`).join('');$('episode-select').value=currentEpisode;
  $('selected-fields').innerHTML=`<p><b>输入清单${r.input_inventory_basis?'（首轮实际可见）':''}：</b>${r.input_fields.map(x=>esc(keys[x]||x)).join(' · ')}</p>${r.first_step_unavailable?.length?`<p class="caption">首轮尚无 ${r.first_step_unavailable.map(k=>esc(keys[k]||k)).join('、')}；与条件删除分别记录，后续轮次见实际掩码。</p>`:''}<p class="caption">${esc(r.difference)}。控制器仍使用本体状态完成执行。</p>`;
  const e=episodeById(currentEpisode);let ref=null;
  if(r.task==='fr3_place')ref=episodeById(`fr3_${e.seed}_rich`);
  else if(r.task.startsWith('panda_')){const rr=study.rows.find(x=>x.task===r.task&&x.condition==='waypoint/proprio');ref=episodeById(rr.episode_ids[e.trial_index]);}
  else if(r.task==='psi_grasp_recovery')ref=episodeById('psibot_recovery_9511_full');
  $('comparison-note').textContent=r.task==='fr3_place'?'同seed基线与当前条件；两个初态仅作探索。':r.task.startsWith('panda_')?'参考列固定为路径点/本体输入；按原批次回合编号展示，未独立核同初态快照SHA。接口或预算有差别时不作单因素比较。':r.task==='psi_grasp_recovery'?'同seed恢复对照；旧手关节输出接口。短初态录像仍保留其证据限制。':'本协议没有匹配对照；仅展示原回合。';
  $('case-videos').innerHTML=(ref&&ref.episode_id!==currentEpisode?card(ref.episode_id,'参考条件'): '')+card(currentEpisode,cname(r.condition));
  const trace=traces.find(t=>t.id===currentEpisode);
  $('decision-inputs').innerHTML=trace?`<label>查看实际输入轮次<select id="decision-select">${trace.decisions.map((d,i)=>`<option value="${i}">第${d.number}轮 · 仿真${Number(d.sim_time||0).toFixed(2)}秒</option>`).join('')}</select></label><p id="actual-mask" class="caption"></p><div id="actual-images"></div>`:r.task.startsWith('panda_')?'<p class="quiet">本回合逐轮输入PNG未在本站收录；上方仅展示原报告公开并注明条件的真实示例。回放视频不当作模型全部输入。</p>':'<p class="quiet">本回合逐轮RGB输入清单待核；已披露特权数值信息，回放相机不代替模型输入。</p>';
  if(trace){const draw=()=>{const d=trace.decisions[Number($('decision-select').value)];$('actual-mask').textContent=Object.entries(d.mask||{}).map(([k,v])=>`${keys[k]||k}：${v.reason_zh}`).join('；')||'历史协议原可见字段：'+d.visible_input_keys.map(k=>keys[k]||k).join('、');$('actual-images').innerHTML=figures((d.images||[]).filter(i=>i.url), '真实输入 · 包含标注的当前/历史帧')+(d.images||[]).filter(i=>i.url).map(i=>`<span class="caption">${esc(cameras[i.camera]||i.camera)}：${esc(i.temporal_role)}</span>`).join(' · ');};$('decision-select').addEventListener('change',draw);draw();}
  if(r.task==='psi_roundtrip'){
   const vv=audit.filter(v=>v.episode_id===currentEpisode&&v.video_url);
   $('case-camera-controls').innerHTML=vv.map(v=>`<button data-case-camera="${esc(v.camera)}">${esc(cameras[v.camera])}</button>`).join('');
  }else $('case-camera-controls').innerHTML='';
  document.querySelectorAll('[data-row]').forEach(el=>{el.classList.toggle('active',el.dataset.row===currentRow);if(el.hasAttribute('aria-pressed'))el.setAttribute('aria-pressed',String(el.dataset.row===currentRow));});
  document.querySelectorAll('#matrix tbody tr').forEach(tr=>tr.classList.toggle('selected-row',tr.dataset.condition===r.condition));
  const u=new URL(location.href);u.searchParams.set('task',currentTask);u.searchParams.set('condition',r.condition);history.replaceState(null,'',u);
  if(scroll)$('selected-case').scrollIntoView({block:'start'});
 }
 function drawProtocol(){
  const fields={H:'图像/动作历史',M:'文字记忆',C:'分类执行反馈',resolution_only:'仅RGB分辨率',...cameras,...keys};
  const taskNames={fr3_place:'FR3 放置',psi_grasp:'PsiBot 抓取',psi_pick_place_100ml:'100ml 放置',psi_roundtrip_100ml:'100ml 往返'};
  $('protocol-conditions').innerHTML=protocol.conditions.map(c=>{const applicable=Object.entries(protocol.task_camera_conditions).filter(([,t])=>t.conditions.includes(c.id)).map(([id])=>taskNames[id]);return `<tr><th scope="row">${esc(c.label)}</th><td>${esc(c.changed.length?c.changed.map(k=>fields[k]||k).join('、'):'无删除')}</td><td>${esc(applicable.join('、'))}</td><td>每个适用任务 0 / 20 · 待执行</td><td>同任务固定接口、初态、预算与其他输入</td></tr>`;}).join('');
  $('psi-coverage').innerHTML=study.tasks.filter(t=>t.id.startsWith('psi_')).map(t=>{const rr=study.rows.filter(r=>r.task===t.id),n=rr.reduce((a,r)=>a+r.attempts,0);return `<li><button data-task="${esc(t.id)}">${esc(t.title)}</button><span>${n}条原记录 · ${rr.length}个条件${t.id==='psi_roundtrip'?' · 选例':''}</span></li>`;}).join('');
 }
 function drawNativeQualification(){
  document.querySelectorAll('#native-camera-evidence video').forEach(v=>v.pause());
  const r=nativeGallery.records.find(x=>x.task===$('native-task-select').value);
  $('native-qualification-status').textContent=`${r.title} · ${r.cameras.length} 路相机 · ${r.native_gate_passed?'控制检查通过':'控制检查未通过'}。${r.reason} 模型调用 0，正式试次 0。`;
  $('native-camera-evidence').innerHTML=r.cameras.map(c=>`<article class="native-camera-card"><h4>${esc(c.label)}</h4><div class="native-camera-pair"><figure><a href="${esc(safe(c.image))}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(safe(c.image))}" alt="${esc(r.title+' '+c.label)}资格检查首帧原图"></a><figcaption>初始原生 RGB · 资格检查，未发送给模型</figcaption></figure><figure><video controls playsinline preload="none" src="${esc(safe(c.video))}" poster="${esc(safe(c.image))}" aria-label="${esc(r.title+' '+c.label)}同回合原生控制检查录像"></video><figcaption>同回合原录像 · ${c.decoded_frames} 帧 · 1×仿真时间</figcaption></figure></div><p><b>视角与渲染：</b>${esc(c.view_note)}</p><p class="caption">实际首帧与编码中间帧已查看；完整录像已解码校验。录像证明有限控制检查，不证明抓取或放置成功。</p></article>`).join('');
 }
 async function init(){
  const load=async n=>{const res=await fetch('results/astra/'+n);if(!res.ok)throw Error(n+' HTTP '+res.status);return res.json();};
  [study,protocol,episodes,audit,traces,report,nativeGallery]=await Promise.all(['input_study_v5.json','protocol_v6.json','episodes.json','video_audit.json','decision_traces.json','experiments.json','native_qualification_20261011.json'].map(load));audit=audit.records;
  const p=new URLSearchParams(location.search),legacy={inputs:'fr3_place',actions:'panda_square',long:'psi_roundtrip'},target=p.get('task')||legacy[p.get('study')];
  if(study.tasks.some(t=>t.id===target))currentTask=target;
  currentRow=study.rows.find(r=>r.task===currentTask&&r.condition===p.get('condition'))?.id||'';
  $('task-select').innerHTML=study.tasks.map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
  $('task-select').addEventListener('change',e=>{currentTask=e.target.value;currentEpisode='';drawTask();});
  $('episode-select').addEventListener('change',e=>{currentEpisode=e.target.value;drawRow(false);});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-row],[data-task],[data-case-camera],[data-play-cases],[data-pause-cases]');if(!b)return;
   if(b.dataset.row){currentRow=b.dataset.row;currentEpisode='';drawRow();}
   else if(b.dataset.task){currentTask=b.dataset.task;currentRow='';currentEpisode='';drawTask();$('study').scrollIntoView();}
   else if(b.dataset.caseCamera){document.querySelectorAll('#case-videos video').forEach(v=>v.pause());$('case-videos').innerHTML=card(currentEpisode,cname(rowById(currentRow).condition),b.dataset.caseCamera);document.querySelectorAll('[data-case-camera]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));}
   else document.querySelectorAll('#case-videos video').forEach(v=>{if(b.hasAttribute('data-pause-cases'))v.pause();else{v.currentTime=0;v.play().catch(()=>{});}});
  });
  $('native-task-select').innerHTML=nativeGallery.records.map(r=>`<option value="${esc(r.task)}">${esc(r.title)}</option>`).join('');$('native-task-select').value='psi_grasp';
  $('native-task-select').addEventListener('change',drawNativeQualification);
  drawTask();drawProtocol();drawNativeQualification();$('loading').hidden=true;$('study-content').hidden=false;
  $('historical-reasoning').textContent=`FR3相同10初态：medium ${report.paired_e3.medium_successes}/10（Wilson 95% CI ${ci(report.paired_e3.medium_successes,10)}，含1中断），xhigh ${report.paired_e3.xhigh_successes}/10（${ci(report.paired_e3.xhigh_successes,10)}）。这是推理档位对照；匹配录像缺失，不代替输入删除实验。`;
  window.astraStudyReady=true;
 }
 init().catch(e=>{$('loading').textContent='实验记录加载失败，请刷新；可下载下方原数据。';$('load-error').hidden=false;$('load-error').textContent=e.message;});
})();
