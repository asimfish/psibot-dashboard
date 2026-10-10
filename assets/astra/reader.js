'use strict';
(() => {
 const $=id=>document.getElementById(id), esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safe=u=>{if(typeof u!=='string')return '';if(/^(assets|results)\/astra\/[A-Za-z0-9_./-]+$/.test(u)&&!u.includes('..'))return u;try{const x=new URL(u);return x.protocol==='https:'&&x.hostname==='asimfish.github.io'&&!x.username&&!x.password?x.href:'';}catch{return '';}};
 const conditionNames={rich:'全部输入（基线）',minus_S:'移除末端位姿与开口',minus_J:'移除关节角度与速度',minus_K:'移除相机标定',minus_F:'移除数值执行误差',minus_H:'移除历史图像与动作',rgb_only:'移除以上五类信息',full:'完整输入',no_numeric_state:'不提供数值状态',historical_xhigh:'历史 xhigh',scene_state_privileged:'物体与手部特权状态',
 'delta/proprio':'增量动作 / 本体输入','waypoint/none':'路径点 / 低信息','waypoint/proprio':'路径点 / 本体输入','code/proprio':'程序 / 本体输入','code/privileged':'程序 / 特权状态'};
 const protocolNames={robosuite:'Panda · 输入包与接口',fr3_input_dependency:'FR3 · 输入解耦',fr3_long1:'FR3 · 再抓取案例',psibot_e3:'PsiBot · 历史抓取',psibot_input_pilot:'PsiBot · 输入 pilot',psibot_input_recovery:'PsiBot · 恢复输入对照',psibot_wrist_relative:'PsiBot · 相对控制案例',campaign20:'后续 20×7 批次','100ml_development_demonstration':'PsiBot · 100ml 往返案例'};
 const cameras={head_camera:'头部相机',chest_camera:'胸部相机',third_camera:'第三视角',wrist_camera:'腕部相机',agentview:'固定外部视角'};
 const visualNames={completion_visible:'可见几何完成末态',completion_sequence_visible:'可见完成序列',lift_sequence_visible:'可见抬起序列',partial_progress_visible:'可见部分进展',no_completion_visible:'未见完成',no_completion:'未见完成',not_determined:'采样不足以判定',incomplete_sequence:'初态 / 未完整执行'};
 const qualityNames={usable_with_limits:'可用，带视角限制',insufficient_action_evidence:'动作证据不足',missing:'缺录像'};
 const status=v=>v===true?'success':v===false?'failure':'interrupted', statusText=v=>v===true?'成功':v===false?'失败':'中断';
 const badge=v=>`<span class="status ${status(v)}">${statusText(v)}</span>`;
 const ci=(k,n)=>{if(!n)return '尚无有效样本';const z=1.959963984540054,p=k/n,b=1+z*z/n,c=(p+z*z/(2*n))/b,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/b;return `${((c-h)*100).toFixed(1)}–${((c+h)*100).toFixed(1)}%`;};
 const cname=c=>conditionNames[c]||c;
 const taskName=x=>x.protocol==='robosuite'?({Lift:'抓起物块',Can:'搬运罐',Square:'方孔套柱'}[x.task]||x.task):x.protocol==='100ml_development_demonstration'?'100ml 烧杯往返':x.protocol==='fr3_input_dependency'?'瓶子放置并撤手':x.protocol==='fr3_long1'?'放置后再次抓起':x.robot==='PsiBot'?'瓶子抓取与稳定抬升':x.task;
 const link=(params={})=>'astra-evidence.html?'+new URLSearchParams(params).toString();
 const table=(heads,rows,caption,cls='')=>`<div class="result-table ${cls}"><table><caption>${caption}</caption><thead><tr>${heads.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((x,i)=>i===0?`<th scope="row">${x}</th>`:`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 const step=(n,title)=>`<h3 class="step-title"><span>${n}</span>${title}</h3>`;
 const design=rows=>`<dl class="design">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
 const poster=x=>['fr3_input_dependency','100ml_development_demonstration'].includes(x.protocol)?`assets/astra/reader-posters/${x.asset_id}.jpg`:safe(x.contact_sheet);
 let input,report,audit,episodes,traceData;
 async function fetchJSON(name){const r=await fetch('results/astra/'+name);if(!r.ok)throw Error(name+' HTTP '+r.status);return r.json();}
 function videoCard(x,title){
  if(!x)return '<p class="quiet">此回合尚未收录录像。</p>';
  const v=x.visual_review,t=x.technical||{},src=safe(x.video_url);
  return `<article class="video-card"><div class="video-title">${esc(title)}${badge(x.metric_success)}</div>${src?`<video controls playsinline preload="none" src="${esc(src)}" poster="${esc(poster(x))}" aria-label="${esc(x.episode_id)}原视频"></video>`:'<div class="missing-video">缺录像</div>'}<div class="video-info"><p><b>画面：</b>${esc(v.observation_zh)}</p><details><summary>视角、渲染与时间</summary><dl><dt>视角</dt><dd>${esc(v.viewpoint)}</dd><dt>渲染检查</dt><dd>${esc(v.rendering_zh)}</dd><dt>轨迹记录</dt><dd>${esc(x.camera)} · ${t.width||'—'}×${t.height||'—'} · ${Number(t.duration_s||0).toFixed(1)} 秒原录像</dd></dl><p class="quiet">预览为末次采样帧；点击播放完整原视频。观察为时序采样，数值成功按原生评分。</p></details><a href="${esc(link({episode:x.episode_id,camera:x.camera}))}">查看该回合视角、渲染及逐轮输入 →</a></div></article>`;
 }
 const pick=(id,camera)=>audit.find(x=>x.episode_id===id&&(!camera||x.camera===camera));
 let study='inputs',pairCondition='minus_S',pairSeed='9404';
 const inference={rich:'作为配对基线',minus_S:'两个初态的成败均反转',minus_J:'一个失败变成功，一个成功保持',minus_K:'两个初态的成败均反转',minus_F:'两次终态与基线相同',minus_H:'一个失败变成功，一个成功保持',rgb_only:'一次成功，一次中断'};
 function inputsPanel(){
  const rows=input.rows.map(r=>[`<b>${esc(cname(r.condition))}</b>`,...r.pairs.map(p=>`<button class="pair-result" data-pair-condition="${r.condition}" data-pair-seed="${p.seed}" aria-label="${esc(cname(r.condition))}，初态${p.seed}，${statusText(p.success)}，查看配对录像">${badge(p.success)} <span aria-hidden="true">▷</span></button>`),`<b>${r.successes}/${r.valid_n}</b><small>95% CI ${ci(r.successes,r.valid_n)}${r.valid_n<2?'<br>另有1中断':''}</small>`,`<span class="row-inference">${inference[r.condition]}</span>`]);
  return `<p class="panel-kicker">01 · FR3 · 同初态输入对照</p><h2>移除某类输入，任务结果会改变吗？</h2><p class="panel-answer">移除位姿或标定信息后，一个初态从失败变成功，另一个从成功变失败。两个初态不足以判定输入是否必需。</p>${step(1,'怎么测')}${design([
   ['机器人与任务','Franka FR3：抓起瓶子，直立放到绿色垫，松手并撤离。'],
   ['固定条件','Astra xhigh；两个初态 9403 / 9404；四路当前 RGB；腕相对末端与夹爪控制；最多 30 次请求、120 秒动作。'],
   ['唯一变化','依次移除五类输入中的一类，另测同时移除五类；每个初态、每个条件各执行一次随机轨迹。'],
   ['怎样判成功','目标中心误差≤4 cm，直立偏角≤15°，稳定≥1 秒且速度≤5 cm/s；同时松手、撤离。']
  ])}<p class="result-note">始终保留：当前 RGB、任务说明、剩余预算、文字记忆和分类执行状态。“去历史”仍有文字记忆，“去数值误差”仍有分类反馈。</p>${step(2,'测到了什么')}<div id="paired-inputs">${table(['移除的信息','初态 A<small>9403</small>','初态 B<small>9404</small>','成功 / 有效','相对基线的变化'],rows,'14 次尝试：13 次有终态，1 次中断。点击成功 / 失败查看同初态配对录像。','input-table')}</div><p class="result-note">每组只有 1–2 个有效样本。“移除以上五类”同时改变五个输入包，仍保留文字；相机视角、分辨率与文字记忆尚未独立测试。</p>
  <details class="appendix"><summary>输入字段、模型调用与耗时明细</summary><div class="details-body"><p>五类输入分别为：末端位姿与开口、关节角度与速度、相机标定、数值执行误差、历史图像与自身动作。首轮尚无反馈 / 历史，与主动删除分开记录。</p>${table(['输入条件','初态 A · 请求 / 墙钟','初态 B · 请求 / 墙钟'],input.rows.map(r=>[esc(cname(r.condition)),...r.pairs.map(p=>`${p.requests} 次 / ${(p.wall_s/60).toFixed(2)} 分钟`)]),'耗时为墙钟；失败可能提前停止，不据此排列效率。')}<a href="results/astra/input_ablation.json">完整输入矩阵与每初态差值 JSON →</a></div></details>
  ${step(3,'在原录像中对照')}<div class="evidence-controls"><label>对照条件<select id="pair-condition">${input.rows.map(r=>`<option value="${r.condition}">${esc(cname(r.condition))}</option>`).join('')}</select></label><label>相同初态<select id="pair-seed"><option value="9403">A · 9403</option><option value="9404">B · 9404</option></select></label></div><p id="pair-explainer" class="pair-explainer"></p><div id="paired-video-evidence" class="evidence-pair"></div>`;
 }
 function drawPair(){
  document.querySelectorAll('#paired-video-evidence video').forEach(v=>v.pause());
  const r=input.rows.find(x=>x.condition===pairCondition),p=r.pairs.find(x=>String(x.seed)===pairSeed),b=pick(p.baseline_episode_id),v=pick(p.episode_id);
  $('pair-condition').value=pairCondition;$('pair-seed').value=pairSeed;
  $('pair-explainer').textContent=`初态 ${pairSeed}：基线${statusText(p.baseline_success)} → 当前条件${statusText(p.success)}。两段录像属于同一初态、不同模型轨迹。`;
  $('paired-video-evidence').innerHTML=videoCard(b,'全部输入 · 基线')+videoCard(v,cname(pairCondition));
 }
 function actionsPanel(){
  const conditions=[['delta','proprio'],['waypoint','none'],['waypoint','proprio'],['code','proprio'],['code','privileged']];
  const rows=['Lift','Can','Square'].map(task=>[`<b>${{Lift:'抓起物块',Can:'搬运罐',Square:'方孔套柱'}[task]}</b>`,...conditions.map(([i,o])=>{const x=report.robosuite_main_runs.find(r=>r.task===task&&r.interface===i&&r.observation===o);return `<a class="cell-link" href="${esc(link({protocol:'robosuite',task,condition:i+'/'+o,prompt:'v3',run:x.run_id}))}"><b>${x.successes}/${x.n}</b><small>95% CI ${ci(x.successes,x.n)}</small></a>`;})]);
  return `<p class="panel-kicker">02 · Panda · 输入包与动作接口比较</p><h2>输入信息与动作接口怎样影响任务完成？</h2><p class="panel-answer">方孔套柱任务中，路径点接口的低信息输入为 0/20，本体输入为 18/20。这里比较整个输入包，尚不能拆出某个字段的贡献。</p>${step(1,'怎么测')}${design([
   ['机器人与任务','Panda / MuJoCo：抓起物块（Lift）、搬运罐（Can）、方孔套柱（Square）。'],
   ['固定条件','Astra medium；服务器 prompt v3；每条件 20 回合，共 15 个任务×条件单元格。'],
   ['比较条件','增量动作、路径点、生成程序；低信息、本体信息、特权物体状态等输入包。'],
   ['怎样判成功','采用 robosuite 各任务原生终态。程序接口预算不同于短动作接口，接口间不作同预算归因。']
  ])}${step(2,'测到了什么')}${table(['任务','增量动作<br>本体输入','路径点<br>低信息','路径点<br>本体输入','生成程序<br>本体输入','生成程序<br>特权状态'],rows,'主矩阵 300 回合；每格为成功 / 20 与 Wilson 95% 区间。点数字查看该格的 20 个回合。')}
  <p class="result-note">低信息仍有任务文字与部分历史。本体包同时含状态、标定和辅助先验；本组不是五类输入的单项消融。</p>${step(3,'对应的录像证据')}<p>点结果表中的数字，即可查看该机器人、任务、条件和提示版本对应的 20 个回合。</p><a class="primary-link" href="${esc(link({protocol:'robosuite',task:'Square',condition:'waypoint/proprio',prompt:'v3'}))}">查看“方孔套柱 / 路径点 / 本体输入”的录像 →</a>
  <details class="appendix"><summary>调用成本与其他基线</summary><div class="details-body">${table(['任务 / 条件','平均模型查询','平均等待（秒）'],report.robosuite_main_runs.map(r=>[`${esc(r.task)} · ${esc(cname(r.interface+'/'+r.observation))}`,Number(r.mean_queries).toFixed(1),Number(r.mean_model_wait_s).toFixed(1)]),'等待为模型请求等待，不是完整墙钟。')}<p>脚本上界为三任务各 20/20；随机下界为各 0/20。它们不是 Astra 试验。早期 Mac prompt v1/v2 的 70 回合保留在证据库，不并入上面的 300 回合。</p><a href="https://asimfish.github.io/astra-control-dashboard/" target="_blank" rel="noopener">完整原协议与控制预算 →</a></div></details>`;
 }
 function reasoningPanel(){
  const p=report.paired_e3;
  return `<p class="panel-kicker">03 · FR3 · 推理档位比较</p><h2>提高推理强度，放置任务是否完成得更多？</h2><p class="panel-answer">同一组 10 个初态，medium 完成 3/10，xhigh 完成 9/10；medium 包含一次网络中断。</p>${step(1,'怎么测')}${design([
   ['机器人与任务','Franka FR3 · 放置任务；历史 SafeLab E3 批次。'],
   ['配对范围','相同 10 个 seed：9301–9310；采用该批次原生放置终态。'],
   ['变化因素','Astra 的推理档位 medium 与 xhigh；这是推理对照，输入删除属于实验 01。'],
   ['记录范围','本页保留已核历史统计；逐 seed 的成对录像未收录在本站。原 E3 来源保留协议。']
  ])}${step(2,'测到了什么')}${table(['推理档位','成功 / 尝试','Wilson 95% CI','网络中断'],[['medium',`${p.medium_successes}/${p.pairs}`,ci(p.medium_successes,p.pairs),p.medium_network_interrupted_episodes],['xhigh',`${p.xhigh_successes}/${p.pairs}`,ci(p.xhigh_successes,p.pairs),'0']],'同 seed 子集；中断保留在 10 次尝试分母。')}<p class="result-note">观察到的差异为 6/10。样本量为每档 10 个初态，未检验统计显著性，也未按相同推理成本比较。</p>${step(3,'证据与仍缺的记录')}<p>这里是历史聚合统计。本站没有这 10 个 seed 的逐次配对录像，不能用其他 FR3 成功片段替代。</p><a class="primary-link" href="https://asimfish.github.io/safeot-dashboard/agentic/e3_verified_20260910.json" target="_blank" rel="noopener">查看原 E3 聚合证据 →</a>
  <details class="appendix"><summary>同批其他机器人与任务成绩</summary><div class="details-body">${table(['机器人 / 任务','档位','成功 / 分母','Wilson 95% CI','记录口径'],report.historical_e3.map(r=>[`${r.robot} · ${r.task==='grasp'?'抓取保持':'放置'}`,r.effort,`${r.successes}/${r.denominator}`,ci(r.successes,r.denominator),r.robot==='PsiBot'?'有效队列；另有4无效、2未运行':`所有计划尝试；${r.infrastructure_interrupted_episodes}中断`]),'不同机器人和任务分别统计；完整 medium 20 个初态不替代上面的匹配子集。')}<a href="${esc(link({protocol:'psibot_e3'}))}">查看 PsiBot 历史抓取录像（不是上面的 FR3 对照） →</a></div></details>`;
 }
 function longPanel(){
  const r=report.roundtrip;
  return `<p class="panel-kicker">04 · PsiBot · 选取的开发案例</p><h2>Astra 能完成抓起、放下、再抓起和返回吗？</h2><p class="panel-answer">100ml 烧杯往返案例通过四个原生阶段，最终中心误差 7.96 mm；该轨迹使用特权状态输入，完成耗时约 4.75 小时。</p>${step(1,'怎么测')}${design([
   ['机器人与任务','PsiBot：A 点抓起 → B 点放下撤手 → 再抓起 → A 点放下撤手。'],
   ['模型与控制','Astra xhigh；模型输出手部动作，通用控制器执行。235 次实际上游模型回执。'],
   ['模型可见输入','物体位姿、尺寸、速度，杯垫几何，手部标记与部分网格边界；属于仿真特权状态。'],
   ['报告范围','开发后选取的成功轨迹；没有同协议重复测试的成功率分母。']
  ])}${step(2,'测到了什么')}<div class="case-measures"><div><b>4 / 4</b><span>原生阶段</span></div><div><b>7.96 mm</b><span>最终 A 点中心误差</span></div><div><b>235 次</b><span>模型调用</span></div><div><b>4.75 小时</b><span>完整墙钟</span></div></div><p class="result-note">录像 / 仿真长 330.9 秒，完整墙钟约 4.75 小时。这个成功案例还不能回答实时响应和稳定成功率。</p>${step(3,'四个阶段与三机位原视频')}<div id="roundtrip"><div class="camera-controls" role="group" aria-label="原录像机位">${['third_camera','head_camera','chest_camera'].map(c=>`<button data-camera="${c}" aria-pressed="${c==='third_camera'}">${cameras[c]}</button>`).join('')}</div><video class="native-video" id="roundtrip-video" controls playsinline preload="none" src="assets/astra/media/collect41_third_camera.mp4" poster="assets/astra/reader-posters/38132227e4530831.jpg" aria-label="100ml往返完整原视频"></video><div class="phase-timeline">${[['A 点抓起',247.758333],['B 点放下撤手',269.025],['B 点再抓起',297.841667],['A 点放下撤手',323.733333]].map(([title,t])=>`<button data-phase="${t}">${title}<small>${t.toFixed(2)} 秒</small></button>`).join('')}</div><div id="roundtrip-observation"></div></div><details class="appendix"><summary>物理判据、输入与调用明细</summary><div class="details-body"><p>抬升≥5 cm；放置中心误差≤2.5 cm，底部高度≤8 mm，直立偏角≤15°，稳定≥1 秒且速度≤5 cm/s；撤手距离≥12 cm。原生最大抬升约 5.81 cm。</p><p>输入 token 5,051,123，输出 439,318；未知用量请求 0。原生评估器阶段及接触计数不反馈给模型。</p><a href="results/astra/experiments.json">完整案例与原生记录 →</a></div></details>`;
 }
 function setStudy(name,update=true){
  const names={ablation:'inputs',robosuite:'actions',e3:'reasoning',roundtrip:'long'};name=names[name]||name;if(!['inputs','actions','reasoning','long'].includes(name))name='inputs';
  document.querySelectorAll('video').forEach(v=>v.pause());study=name;
  document.querySelectorAll('[data-study]').forEach(b=>{const active=b.dataset.study===name;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  $('experiment-panel').setAttribute('aria-labelledby','tab-'+name);$('experiment-panel').innerHTML=({inputs:inputsPanel,actions:actionsPanel,reasoning:reasoningPanel,long:longPanel}[name])();
  if(name==='inputs'){drawPair();$('pair-condition').addEventListener('change',e=>{pairCondition=e.target.value;drawPair();});$('pair-seed').addEventListener('change',e=>{pairSeed=e.target.value;drawPair();});}
  if(name==='long')roundtripObservation('third_camera');
  if(update){const u=new URL(location.href);u.searchParams.set('study',name);u.hash='input-study';history.replaceState(null,'',u);}
 }
 function roundtripObservation(camera){const x=pick('psibot_roundtrip_collect41',camera);$('roundtrip-observation').innerHTML=`<p class="caption"><b>视角：</b>${esc(x.visual_review.viewpoint)}</p><p class="caption"><b>画面观察：</b>${esc(x.visual_review.observation_zh)}</p><a href="${esc(link({episode:x.episode_id,camera}))}">查看此机位渲染检查与采样帧 →</a>`;}
 const pendingSeek=new WeakMap();
 function seekVideo(v,t){if(!v)return;const old=pendingSeek.get(v);if(old)v.removeEventListener('loadedmetadata',old);const go=()=>{pendingSeek.delete(v);v.currentTime=Math.min(t,Number.isFinite(v.duration)?v.duration:t);v.play().catch(()=>{});};if(v.readyState>0)go();else{pendingSeek.set(v,go);v.addEventListener('loadedmetadata',go,{once:true});v.load();}}
 function initReport(){
  setStudy(new URLSearchParams(location.search).get('study')||(location.hash==='#roundtrip'?'long':'inputs'),false);
  document.querySelector('[role=tablist]').addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('[data-study]')],i=tabs.indexOf(document.activeElement),n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();setStudy(tabs[n].dataset.study);});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-study],[data-pair-condition],[data-camera],[data-phase]');if(!b)return;if(b.dataset.study)setStudy(b.dataset.study);else if(b.dataset.pairCondition){pairCondition=b.dataset.pairCondition;pairSeed=b.dataset.pairSeed;drawPair();$('paired-video-evidence').scrollIntoView({block:'start'});}else if(b.dataset.phase)seekVideo($('roundtrip-video'),Number(b.dataset.phase));else if(b.dataset.camera){const v=$('roundtrip-video'),t=v.currentTime,playing=!v.paused,old=pendingSeek.get(v);if(old){v.removeEventListener('loadedmetadata',old);pendingSeek.delete(v);}v.pause();v.src='assets/astra/media/collect41_'+b.dataset.camera+'.mp4';v.poster=poster(pick('psibot_roundtrip_collect41',b.dataset.camera));const restore=()=>{pendingSeek.delete(v);v.currentTime=Math.min(t,v.duration);if(playing)v.play().catch(()=>{});};pendingSeek.set(v,restore);v.addEventListener('loadedmetadata',restore,{once:true});v.load();document.querySelectorAll('[data-camera]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));roundtripObservation(b.dataset.camera);}});
  window.astraReadableReady=true;
 }

 let libPage=0,selectedAsset='',runFilter='';const filterNames=['robot','task','condition','protocol','camera','result','quality','prompt'];
 function options(name,values,label){const node=$('filter-'+name),old=node.value;while(node.options.length>1)node.remove(1);for(const v of [...new Set(values)].filter(Boolean).sort()){const o=document.createElement('option');o.value=v;o.textContent=label?label(v):v;node.append(o);}node.value=[...node.options].some(x=>x.value===old)?old:'';}
 function libRows(){const q=$('filter-search').value.trim().toLowerCase();return audit.filter(x=>filterNames.every(k=>{const v=$('filter-'+k).value;if(!v)return true;return (k==='result'?status(x.metric_success):k==='quality'?x.visual_review.render_quality:k==='prompt'?x.prompt_version:x[k])===v;})&&(!runFilter||x.episode_id.startsWith('robosuite:'+runFilter+':'))&&(!q||[x.episode_id,x.seed,x.asset_id,x.condition,x.robot,taskName(x),x.visual_review.observation_zh].join(' ').toLowerCase().includes(q)));}
 function drawLibrary(){
  const rows=libRows(),pages=Math.max(1,Math.ceil(rows.length/12));libPage=Math.max(0,Math.min(libPage,pages-1));
  $('audit-count').textContent=`${new Set(rows.map(x=>x.episode_id)).size} 个回合 · ${rows.length} 条机位 / 缺录像记录${runFilter?' · 已限定原结果表批次':''}`;
  $('audit-table').innerHTML=rows.length?table(['机器人 / 任务','输入 / 动作条件','原生结果','画面证据',''],rows.slice(libPage*12,(libPage+1)*12).map(x=>[`${esc(x.robot)}<small>${esc(taskName(x))} · ${x.seed!=null?'seed '+esc(x.seed):esc(x.episode_id.split(':').pop())}</small>`,esc(cname(x.condition)),badge(x.metric_success),`${esc(qualityNames[x.visual_review.render_quality]||x.visual_review.render_quality)}<small>${esc(cameras[x.camera]||x.camera||'未留录像')}</small>`,`<button class="library-row" data-asset="${esc(x.asset_id||x.episode_id)}">查看录像 →</button>`]),'原生评分与画面证据分别记录；点击回合查看视角、渲染和实际观察。'):'<p class="empty-state">没有符合这些筛选条件的回合。</p>';
  $('audit-page').textContent=`${libPage+1} / ${pages}`;$('audit-prev').disabled=libPage===0;$('audit-next').disabled=libPage>=pages-1;
 }
 async function showRecord(id,scroll=true){
  const x=audit.find(x=>(x.asset_id||x.episode_id)===id);if(!x)return;selectedAsset=id;document.querySelectorAll('video').forEach(v=>v.pause());
  const v=x.visual_review,t=x.technical||{},src=safe(x.video_url),traces=traceData||await fetchJSON('decision_traces.json');traceData=traces;
  if(selectedAsset!==id)return;
  const trace=traces.find(z=>z.id===x.episode_id),e=episodes.find(z=>z.episode_id===x.episode_id),source=safe(x.trace_url||e?.source_url||e?.trace_url);
  $('evidence-detail').innerHTML=`<div class="detail-heading"><div><p class="eyebrow">${esc(protocolNames[x.protocol]||x.protocol)}</p><h2>${esc(x.robot)} · ${esc(taskName(x))}</h2><p>${esc(cname(x.condition))} · ${x.seed!=null?'seed '+esc(x.seed):esc(x.episode_id)} · ${esc(cameras[x.camera]||x.camera||'缺录像')}</p></div><div>${badge(x.metric_success)}<p class="caption">原生任务结果</p></div></div><div class="review-grid"><div>${src?`<video id="audit-video" controls playsinline preload="none" poster="${esc(poster(x))}" src="${esc(src)}" aria-label="${esc(x.episode_id)}原视频"></video><div class="timestamps">${(x.samples||[]).map(s=>`<button data-video-time="${s.time_s}">${s.time_s.toFixed(2)}s</button>`).join('')}</div><p class="caption">点时间跳到原视频对应采样位置。</p>`:'<div class="missing-video">此回合没有原录像链接。</div>'}</div><div><h3>录像检查</h3><dl class="review-facts"><dt>视角</dt><dd>${esc(v.viewpoint||'未留录像')}</dd><dt>渲染质量</dt><dd>${esc(v.rendering_zh||qualityNames[v.render_quality]||'未留录像')}</dd><dt>画面中的行为</dt><dd>${esc(v.observation_zh||'无可审查画面')}</dd><dt>可见结果</dt><dd>${esc(visualNames[v.visible_outcome]||v.visible_outcome||'未判定')} · ${esc(qualityNames[v.render_quality]||v.render_quality)}</dd></dl><p class="quiet">采样画面不单独判定接触力、厘米误差和稳定时长；原生评分保留在上方。</p>${source?`<a href="${esc(source)}" target="_blank" rel="noopener">原结果 / 决策来源 ↗</a>`:''}</div></div>${safe(x.contact_sheet)?`<details class="appendix"><summary>展开实际时序采样帧</summary><figure class="sample-sheet"><img loading="lazy" src="${esc(safe(x.contact_sheet))}" alt="${esc(x.episode_id)}按时间顺序的真实采样帧"><figcaption>所列帧已实际查看；这是稀疏采样，不是连续逐帧认证。</figcaption></figure></details>`:''}<details class="appendix"><summary>回合身份、数据与原评分口径</summary><div class="details-body"><p>回合：${esc(x.episode_id)}<br>原输入标识：${esc(x.condition)}<br>实验组：${esc(x.protocol)}<br>提示版本：${esc(x.prompt_version||'该记录未标注')}</p><p>${e?`模型请求 ${esc(e.requests)}；仿真时长 ${esc(e.sim_s)} 秒；动作时长 ${esc(e.action_s)} 秒；停止原因 ${esc(e.stop_reason)}。`:'逐回合成本记录未收录。'}</p><p>原录像 ${t.width||'—'}×${t.height||'—'} · ${esc(t.fps)} fps · ${t.duration_s!=null?Number(t.duration_s).toFixed(3):'—'} 秒；完整解码 ${t.full_decode_pass===true?'通过':'无录像'}。</p><p>视频 SHA256：${esc(t.sha256)}</p><a href="results/astra/video_audit.json">完整原始审查记录 →</a></div></details>${trace?`<details class="trace-viewer" id="decision-viewer"><summary>逐轮查看真正送入模型的输入与动作</summary><div class="trace-controls"><label>决策<select id="trace-decision">${trace.decisions.map((d,i)=>`<option value="${i}">第 ${d.number} 轮 · 仿真 ${Number(d.sim_time||0).toFixed(2)} 秒</option>`).join('')}</select></label><button id="trace-prev">←</button><button id="trace-next">→</button></div><div id="trace-fields" class="trace-fields"></div><div id="trace-images" class="trace-images"></div><div class="code-grid"><div><h4>模型动作</h4><pre id="trace-actions"></pre></div><div><h4>执行反馈</h4><pre id="trace-feedback"></pre></div></div></details>`:'<p class="quiet">此回合没有本站逐轮输入记录；原来源入口见录像检查。</p>'}`;
  if(trace){const draw=()=>{const i=Number($('trace-decision').value),d=trace.decisions[i];$('trace-fields').textContent=Object.entries(d.mask||{}).map(([k,v])=>`${input.fields[k]||k}：${v.reason_zh}`).join('；');$('trace-images').innerHTML=(d.images||[]).map(im=>safe(im.url)?`<figure><img loading="lazy" src="${esc(safe(im.url))}" alt="决策${d.number}实际${esc(im.camera||im.label)}输入"><figcaption>${esc(cameras[im.camera]||im.camera||im.label)} · ${esc(im.temporal_role||'current')}</figcaption></figure>`:'').join('');$('trace-actions').textContent=JSON.stringify({actions:d.actions??[],done:d.done??null},null,2);$('trace-feedback').textContent=JSON.stringify({status:d.status,execution:d.execution??[]},null,2);$('trace-prev').disabled=i===0;$('trace-next').disabled=i===trace.decisions.length-1;};$('trace-decision').addEventListener('change',draw);for(const [id,delta]of[['trace-prev',-1],['trace-next',1]])$(id).addEventListener('click',()=>{$('trace-decision').value=String(Number($('trace-decision').value)+delta);draw();});draw();}
  const u=new URL(location.href);u.searchParams.set('episode',x.episode_id);if(x.camera)u.searchParams.set('camera',x.camera);u.hash='evidence-detail';history.replaceState(null,'',u);
  if(scroll)$('evidence-detail').scrollIntoView({block:'start'});window.astraEvidenceSelected=x.episode_id;
 }
 function initLibrary(){
  const c=audit.length;$('audit-overview').innerHTML='<p><b>录像已逐路检查：</b>402 路完整解码，1,401 张时序采样帧已实际查看。</p><p>9 路动作证据不足（7 路关键接触遮挡、2 路仅初态），5 个回合缺录像。视角与渲染问题在每个回合内说明。</p>';
  options('robot',audit.map(x=>x.robot));options('task',audit.map(x=>x.task),v=>taskName(audit.find(x=>x.task===v)));options('condition',audit.map(x=>x.condition),cname);options('protocol',audit.map(x=>x.protocol),v=>protocolNames[v]||v);options('camera',audit.map(x=>x.camera),v=>cameras[v]||v);options('prompt',audit.map(x=>x.prompt_version));
  const params=new URLSearchParams(location.search);runFilter=params.get('run')||'';
  for(const k of filterNames){const value=params.get(k),node=$('filter-'+k);if(value&&[...node.options].some(x=>x.value===value))node.value=value;node.addEventListener('change',()=>{libPage=0;drawLibrary();});}
  if(params.get('search'))$('filter-search').value=params.get('search');$('filter-search').addEventListener('input',()=>{libPage=0;drawLibrary();});
  $('filter-reset').addEventListener('click',()=>{for(const k of filterNames)$('filter-'+k).value='';$('filter-search').value='';runFilter='';libPage=0;drawLibrary();history.replaceState(null,'',location.pathname);});
  $('audit-prev').addEventListener('click',()=>{libPage--;drawLibrary();});$('audit-next').addEventListener('click',()=>{libPage++;drawLibrary();});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-asset],[data-video-time]');if(!b)return;if(b.dataset.asset)showRecord(b.dataset.asset).catch(fail);else if(b.dataset.videoTime)seekVideo($('audit-video'),Number(b.dataset.videoTime));});
  drawLibrary();const id=params.get('episode'),camera=params.get('camera');if(id){const x=pick(id,camera)||pick(id);if(x)showRecord(x.asset_id||x.episode_id,false).catch(fail);else $('evidence-detail').innerHTML='<p class="empty-state">这个回合没有收录在目录中。请查找其他回合。</p>';}
  window.astraReadableReady=true;
 }
 function fail(error){$('load-error').hidden=false;$('load-error').textContent='实验数据暂未载入：'+error.message+'。请刷新，或使用完整数据下载入口。';}
 const isLibrary=document.body.dataset.page==='evidence';
 Promise.all([fetchJSON('input_ablation.json'),fetchJSON('experiments.json'),fetchJSON('video_audit.json'),isLibrary?fetchJSON('episodes.json'):Promise.resolve([])]).then(([i,r,a,e])=>{input=i;report=r;audit=a.records;episodes=e;if(isLibrary)initLibrary();else initReport();}).catch(fail);
})();
