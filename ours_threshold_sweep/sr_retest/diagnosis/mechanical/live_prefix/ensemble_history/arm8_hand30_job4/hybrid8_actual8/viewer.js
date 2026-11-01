'use strict';
(async()=>{
const $=id=>document.getElementById(id),FPS=15,errors=[];
let data,sources,players=[],frame=0,last=0,playing=false,pendingPlay=false,raf=0,generation=0,epoch=0,scene=0,method='both',anchor=0,start=0;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const safe=p=>{if(typeof p!=='string'||p.startsWith('/')||p.includes('\\')||p.includes(':')||p.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('非法静态资源路径');return p;};
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const conditionLabel=c=>'ARM8 / HAND30 · 本轮选定诊断';
const caseOrder=(a,b)=>['ours','mem0'].indexOf(a.method)-['ours','mem0'].indexOf(b.method);
async function bytes(path){const r=await fetch(safe(path));if(!r.ok)throw Error('来源缺失 '+path);return r.arrayBuffer();}
async function digest(b){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function json(path,pin){const b=await bytes(path);if(pin&&await digest(b)!==pin)throw Error('来源SHA不匹配 '+path);return JSON.parse(new TextDecoder().decode(b));}
const timeFor=(p,f)=>Math.min((Math.min(f,p.c.media.last_frame)+.2)/FPS,Number.isFinite(p.v.duration)?Math.max(0,p.v.duration-.001):Infinity);
function stop(message='已暂停；可逐帧检查'){epoch++;pendingPlay=false;playing=false;cancelAnimationFrame(raf);for(const p of players)p.v.pause();$('playback-state').textContent=message;}
function stalePause(local,g){if(g!==generation||(!pendingPlay&&!playing))for(const p of local)p.v.pause();}
function render(){
 $('seek').value=String(frame);$('clock').textContent=`${method==='both'?'Ours + Mem0':method.toUpperCase()} EP${scene} · 原相机帧${frame} · native tick${frame*8} · ${(frame/FPS).toFixed(3)}s`;
 for(const p of players){const f=Math.min(frame,p.c.media.last_frame),r=p.timeline.frames[f],held=frame>=p.c.media.last_frame;
  p.state.textContent=held?`记录已结束：原${p.c.original_outcome} / ${p.c.termination_reason}；保持真实末帧${f}（${(f/FPS).toFixed(3)}s）`:`本案相机帧${f} · ${(f/FPS).toFixed(3)}s`;
  p.state.classList.toggle('held',held);p.task.textContent=r.instruction;
  p.stage.textContent=r.stage===null?'没有已返回的动作阶段':`动作子任务 stage${r.stage} / 位置${r.stage+1}`;
  p.phase.textContent=`原物理事件阶段：${r.physical_phase===null?'未知':r.physical_phase+'/3'}`;
  p.kfs.textContent='原KF选择：'+JSON.stringify(r.actual_keyframe_selection)+'；原DAG选择：'+JSON.stringify(r.actual_dag_selection);
  p.score.textContent=!r.policy_returned?'当前相机帧无新响应；显示上一条原指令，不补分数':r.score===null?(r.planner_terminal?'原Planner terminal；本条不展示新数值分数':p.c.method==='mem0'?'Mem0原运行未记录数值 completion_score':'原响应未记录数值 completion_score'):`原completion：${r.score} · 输入位置${r.score_input_position_inferred}（由切换边界推断）`;
 }
}
function seek(n){stop();frame=Math.max(0,Math.min(last,Math.round(Number(n)||0)));for(const p of players)p.v.currentTime=timeFor(p,frame);render();}
function animate(g,e){
 if(!playing||g!==generation||e!==epoch)return;
 const t=Math.min(last/FPS,start+(performance.now()-anchor)/1000);frame=Math.min(last,Math.floor(t*FPS+1e-5));
 for(const p of players){if(frame>=p.c.media.last_frame){p.v.pause();const target=timeFor(p,p.c.media.last_frame);if(Math.abs(p.v.currentTime-target)>.001)p.v.currentTime=target;}else if(Math.abs(p.v.currentTime-t)>1/FPS+.02)p.v.currentTime=timeFor(p,frame);}
 render();if(t>=last/FPS){stop('本场景所有已有录像已结束；各自保持真实末帧');return;}raf=requestAnimationFrame(()=>animate(g,e));
}
async function play(){
 if(pendingPlay){stop('已取消等待中的播放');return;}if(playing){stop();return;}if(!players.length)return;
 if(frame>=last)seek(0);stop();const g=generation,e=++epoch,local=[...players];pendingPlay=true;$('playback-state').textContent='等待浏览器播放；再次点击可取消';
 try{for(const p of local){p.v.currentTime=timeFor(p,frame);p.v.playbackRate=1;}await Promise.all(local.filter(p=>frame<p.c.media.last_frame).map(p=>p.v.play()));
  if(g!==generation||e!==epoch){stalePause(local,g);return;}pendingPlay=false;playing=true;start=frame/FPS;anchor=performance.now();$('playback-state').textContent='按原时钟播放；短片结束后保持原末帧';raf=requestAnimationFrame(()=>animate(g,e));
 }catch(error){if(g!==generation||e!==epoch){stalePause(local,g);return;}stop('播放失败；已停止本场景所有录像');$('error').textContent=String(error);errors.push(String(error));}
}
function validateTimeline(t,c){if(t.episode!==c.episode||t.method!==c.method||t.history_horizon!==c.history_horizon||t.execution_horizon!==4||t.prediction_horizon!==30||t.fps!==15||t.video_frames!==c.media.frames||t.frames.length!==c.media.frames||t.frames.length<1||t.frames.length>1126||t.frames.some((r,f)=>r.frame!==f||r.native_relative_tick!==8*f||typeof r.instruction!=='string'||typeof r.policy_returned!=='boolean'||!(r.score===null||(typeof r.score==='number'&&Number.isFinite(r.score)))))throw Error('逐帧来源/时钟不匹配');return t;}
async function choose(value,methodValue=$('method').value){
 stop();const g=++generation;method=['both','ours','mem0'].includes(methodValue)?methodValue:'both';$('method').value=method;scene=[0,1,56,57].includes(Number(value))?Number(value):0;$('scene').value=String(scene);frame=last=0;players=[];$('cards').replaceChildren();$('error').textContent='';for(const id of ['play','pause','restart','prev','next','seek'])$(id).disabled=true;
 const pair=data.cases.filter(c=>c.source_episode===scene&&(method==='both'||c.method===method)).sort(caseOrder),local=[],loads=[];
 for(const c of pair){const card=el('article','card'),top=el('div','card-top');card.dataset.condition=c.condition;top.append(el('h2','',`${c.method.toUpperCase()} · ${conditionLabel(c)} · H4/P30 · resizeB`),el('strong',c.original_outcome?'outcome-'+c.original_outcome:'pending',c.original_outcome?'原 '+c.original_outcome:'待独立验收'));card.append(top,el('p','caseid',c.episode));$('cards').append(card);
  if(c.diagnosis&&(c.diagnosis.note||c.diagnosis.events?.length)){const diagnosis=el('details','diagnosis');diagnosis.append(el('summary','','逐案诊断：语言切换与物理事件参考（展开全文）'),el('p','muted','物理量与完成参考仅用于事后诊断，不作为策略的GT输入或控制信号。'));if(c.diagnosis.note)diagnosis.append(el('p','',c.diagnosis.note));for(const d of c.diagnosis.events||[])diagnosis.append(el('p','',`frame${d.frame} · ${(d.frame/FPS).toFixed(3)}s · ${d.kind}: ${d.text}`));card.append(diagnosis);}
  if(!c.media){card.append(el('p','pending',c.review?`原${c.original_outcome} / ${c.termination_reason}；实际证据已验收，当前没有导出录像，不补造画面。`:'该案例尚无已验收的原始封存与媒体。结果、阶段和视频均不补填。'));continue;}
  if(c.original_outcome==='U')card.append(el('p','pending','仅已验收的原始录制前缀：评估中断U，非物理失败；不补造后续画面或SR。'));
  const v=el('video');v.src=safe(c.media.video);v.muted=true;v.playsInline=true;v.preload='metadata';v.setAttribute('aria-label',`${c.method} ${c.condition} EP${scene} 原${c.original_outcome}${c.original_outcome==='U'?'录制前缀':'完整视频'}`);card.append(v);
  const state=el('div','video-state'),taskbox=el('div','task'),task=el('span');taskbox.append(el('strong','','模型完整原子任务指令'),task);const stage=el('div','stage'),score=el('div','score'),phase=el('div','phase'),kfs=el('pre','kfs');card.append(state,taskbox,stage,score,phase,kfs);let gallery=null;if(c.media.keyframes?.length){gallery=el('details','kf-gallery');gallery.append(el('summary','',`展开本案${c.media.keyframes.length}个真实KF（记录后汇总，非当前时刻状态）`));card.append(gallery);}else card.append(el('p','muted','KF图像来源不可用：没有已验收的录像帧映射；仅按原响应显示实际选择元数据，不补造图像。'));for(const k of c.media.keyframes||[]){const figure=el('figure'),img=el('img'),caption=el('figcaption','',`实际KF：source stage${k.source_subtask_id} / model frame${k.model_frame} / camera frame${k.video_frame}；有损录像可视化`);img.src=safe(k.path);img.alt=caption.textContent;img.loading='lazy';img.style.maxWidth='100%';figure.append(img,caption);gallery.append(figure);}
  const links=el('p','downloads');for(const [path,label]of [[c.media.video,c.original_outcome==='U'?'下载已验收录制前缀':'下载完整原时长标注视频'],[c.media.timeline,'下载逐帧timeline']]){const a=el('a','',label);a.href=safe(path);a.download='';links.append(a,el('span','',' · '));}card.append(links);
  const p={c,v,state,task,stage,score,phase,kfs,timeline:null};local.push(p);
  v.addEventListener('error',()=>{if(g!==generation)return;stop('视频错误；本场景停止');$('error').textContent=c.condition+' 视频加载失败';errors.push(c.condition+' video error');});
  v.addEventListener('loadedmetadata',()=>{if(g===generation&&p.timeline)v.currentTime=timeFor(p,frame);});
  loads.push(json(c.media.timeline,c.media.timeline_sha256).then(t=>{p.timeline=validateTimeline(t,c);}));
 }
 try{await Promise.all(loads);if(g!==generation)return false;players=local;last=Math.max(0,...local.map(p=>p.c.media.last_frame));$('seek').max=String(last);render();for(const id of ['play','pause','restart','prev','next','seek'])$(id).disabled=!players.length;$('playback-state').textContent=pair.every(c=>c.media)?`${pair.length}路已验收来源就绪；点击同步播放`:'仅显示已有独立验收素材；未获验收的案例保持待填';return true;
 }catch(error){if(g!==generation)return false;for(const p of local)p.v.pause();stop('来源不完整；拒绝播放');$('error').textContent=String(error);errors.push(String(error));return false;}
}
function outcomes(){
 const body=$('results').querySelector('tbody');body.replaceChildren();
 for(const c of data.cases){const tr=el('tr');for(const value of [`${c.method.toUpperCase()} / EP${c.source_episode} ${c.side==='left'?'左':'右'} / ${conditionLabel(c)}`,c.review?`原${c.original_outcome} / ${c.termination_reason}`:'待真实封存、独审与媒体',c.review?(c.review.stage2_actual_observed?'已记录':'未记录'):'待实际证据',c.review?(c.review.stage2_DAG_ancestor_KF_observed?'已记录':'未记录'):'待实际证据'])tr.append(el('td','',value));body.append(tr);}
 $('coverage').textContent=`八个选定ARM8/HAND30诊断案例中${data.cases.filter(c=>c.media).length}格有已验收媒体；其余保持待填，不预填结果。`;
 for(const limit of data.limits)$('limits').append(el('li','',limit));
}
try{
 const raw=await bytes('data.json');data=JSON.parse(new TextDecoder().decode(raw));sources=await json('sources.json');if(await digest(raw)!==sources.data_sha256)throw Error('案例表SHA不匹配');
 if(data.schema!=='T947_hybrid8_JOB_paired_episode_page_v1'||data.diagnostic_only!==true||data.population_SR!==false||data.canary_excluded!==true||data.frame_hz!==15||data.native_hz!==120||data.execution_horizon!==4||data.prediction_horizon!==30||data.resize_condition!=='B'||data.no_event_warp!==true||data.cases?.length!==8||!((data.prepared_only===true&&data.published===false)||(data.prepared_only===false&&data.published===true))||sources.prepared_only!==data.prepared_only||sources.published!==data.published)throw Error('匹配历史窗逐案诊断契约/展示状态不匹配');
 if(new Set(data.cases.map(c=>`${c.method}:${c.source_episode}:${c.condition}`)).size!==8||data.cases.some(c=>!['ours','mem0'].includes(c.method)||![0,1,56,57].includes(c.source_episode)||!(c.condition==='ARM8_HAND30'&&c.history_horizon===8&&c.arm_history_horizon===8&&c.hand_history_horizon===30)||c.episode!==`t947_hybrid8_${c.method}_ep${String(c.source_episode).padStart(3,'0')}_v1`||(c.media?(!['S','F','U'].includes(c.original_outcome)||c.media.last_frame!==c.media.frames-1||!hex(c.media.timeline_sha256)||!hex(c.media.video_sha256)):(c.review?!['S','F','U'].includes(c.original_outcome):c.original_outcome!==null))))throw Error('正式身份/待填/时长不匹配');
 for(const c of data.cases)if(c.review&&!c.media){const s=sources.cases.find(s=>s.episode===c.episode);if(!s||!hex(s.independent_case_review_sha256)||!hex(s.source_run_media_acceptance_sha256)||!sources.runs[s.source_FILES_sha256]||sources.runs[s.source_FILES_sha256].media_acceptance_sha256!==s.source_run_media_acceptance_sha256)throw Error('无录像实际结果缺少独审来源');}
 for(const c of data.cases)if(c.media){const s=sources.cases.find(s=>s.episode===c.episode);if(!s||s.method!==c.method||s.history_horizon!==c.history_horizon||!hex(s.original_case_seal_sha256)||!hex(s.original_RESULT_sha256)||!hex(s.independent_case_review_sha256)||!hex(s.media_receipt_sha256)||s.derived_files[c.media.video]!==c.media.video_sha256||s.derived_files[c.media.timeline]!==c.media.timeline_sha256||!hex(s.source_run_media_acceptance_sha256)||!sources.runs[s.source_FILES_sha256]||sources.runs[s.source_FILES_sha256].media_acceptance_sha256!==s.source_run_media_acceptance_sha256)throw Error('逐案独审/实际母级/媒体来源绑定缺失');for(const k of c.media.keyframes||[])if(s.derived_files[k.path]!==k.sha256||!hex(k.sha256))throw Error('实际KF可视化来源绑定缺失');}
 $('publication-note').textContent=data.published?'公开诊断展示：仅显示已封存、独立验收的原始案例素材；待审格保持原未知状态。':'私有准备页：只显示已封存、独立验收素材；待审格不预填结果。';
 const pendingNew=data.cases.filter(c=>!c.review).length;
 $('pending-method-state').textContent=pendingNew?`${pendingNew}个本轮选定案例待实际封存与独审；不补填结果、阶段或录像。`:'逐案原S/F/U按各自实际证据保留；不推总体成功率或修复保证。';outcomes();
 $('method').addEventListener('change',()=>choose($('scene').value,$('method').value));$('scene').addEventListener('change',()=>choose($('scene').value));$('play').addEventListener('click',play);$('pause').addEventListener('click',()=>stop());$('restart').addEventListener('click',()=>{seek(0);play();});$('prev').addEventListener('click',()=>seek(frame-1));$('next').addEventListener('click',()=>seek(frame+1));$('seek').addEventListener('input',()=>seek($('seek').value));
 window.historyViewer=Object.freeze({choose,seek,play,pause:stop,snapshot:()=>({scene,method,frame,last,playing,pendingPlay,generation,epoch,errors:[...errors],cards:players.map(p=>({condition:p.c.condition,episode:p.c.episode,actual_frame:Math.min(frame,p.c.media.last_frame),last_frame:p.c.media.last_frame,currentTime:p.v.currentTime,paused:p.v.paused,task:p.task.textContent,score:p.score.textContent,state:p.state.textContent}))})});
 const requested=new URL(location.href).searchParams.get('scene');await choose([0,1,56,57].includes(Number(requested))?Number(requested):0,new URL(location.href).searchParams.get('method')||'both');
}catch(error){stop('证据加载失败；拒绝展示未绑定的对照');$('error').textContent=String(error);errors.push(String(error));}
})();
