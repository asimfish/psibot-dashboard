'use strict';
(async()=>{
const $=id=>document.getElementById(id),FPS=15,errors=[];
let data,sources,addendum,players=[],frame=0,last=0,playing=false,pendingPlay=false,raf=0,generation=0,epoch=0,scene=0,anchor=0,start=0;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const safe=p=>{if(typeof p!=='string'||p.startsWith('/')||p.includes('\\')||p.includes(':')||p.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('非法静态资源路径');return p;};
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
async function bytes(path){const r=await fetch(safe(path));if(!r.ok)throw Error('来源缺失 '+path);return r.arrayBuffer();}
async function digest(b){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function json(path,pin){const b=await bytes(path);if(pin&&await digest(b)!==pin)throw Error('来源SHA不匹配 '+path);return JSON.parse(new TextDecoder().decode(b));}
const timeFor=(p,f)=>Math.min((Math.min(f,p.c.media.last_frame)+.2)/FPS,Number.isFinite(p.v.duration)?Math.max(0,p.v.duration-.001):Infinity);
function stop(message='已暂停；可逐帧检查'){epoch++;pendingPlay=false;playing=false;cancelAnimationFrame(raf);for(const p of players)p.v.pause();$('playback-state').textContent=message;}
function stalePause(local,g){if(g!==generation||(!pendingPlay&&!playing))for(const p of local)p.v.pause();}
function render(){
 $('seek').value=String(frame);$('clock').textContent=`EP${scene} · 原相机帧${frame} · native tick${frame*8} · ${(frame/FPS).toFixed(3)}s`;
 for(const p of players){const f=Math.min(frame,p.c.media.last_frame),r=p.timeline.frames[f],held=frame>=p.c.media.last_frame;
  p.state.textContent=held?`记录已结束：原${p.c.original_outcome} / ${p.c.termination_reason}；保持真实末帧${f}（${(f/FPS).toFixed(3)}s）`:`本案相机帧${f} · ${(f/FPS).toFixed(3)}s`;
  p.state.classList.toggle('held',held);p.task.textContent=r.instruction;
  p.stage.textContent=r.stage===null?'没有已返回的动作阶段':`动作子任务 stage${r.stage} / 位置${r.stage+1}`;
  p.phase.textContent=`原物理事件阶段：${r.physical_phase===null?'未知':r.physical_phase+'/3'}`;
  p.score.textContent=!r.policy_returned?'当前相机帧无新响应；显示上一条原指令，不补分数':r.score===null?(r.planner_terminal?'原Planner已终止：保持当前策略；无新分类器分数':'原completion：null（没有产生分数）'):`原completion：${r.score} · 输入位置${r.score_input_position_inferred}（由切换边界推断）`;
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
function validateTimeline(t,c){if(t.episode!==c.episode||t.fps!==15||t.video_frames!==c.media.frames||t.frames.length!==c.media.frames||t.frames.length<1||t.frames.length>1126||t.frames.some((r,f)=>r.frame!==f||r.native_relative_tick!==8*f||typeof r.instruction!=='string'||typeof r.policy_returned!=='boolean'||!(r.score===null||(typeof r.score==='number'&&Number.isFinite(r.score)))))throw Error('逐帧来源/时钟不匹配');return t;}
async function choose(value){
 stop();const g=++generation;scene=[0,56].includes(Number(value))?Number(value):0;$('scene').value=String(scene);frame=last=0;players=[];$('cards').replaceChildren();$('error').textContent='';for(const id of ['play','pause','restart','prev','next','seek'])$(id).disabled=true;
 const pair=data.cases.filter(c=>c.source_episode===scene).sort((a,b)=>a.condition.localeCompare(b.condition)),local=[],loads=[];
 for(const c of pair){const card=el('article','card'),top=el('div','card-top');card.dataset.condition=c.condition;top.append(el('h2','',c.condition==='A'?'A · 原部署缩放':'B · 训练式首缩放'),el('strong','outcome-'+(c.original_outcome||'U'),c.original_outcome?'原 '+c.original_outcome:'待独立验收'));card.append(top,el('p','caseid',c.episode));$('cards').append(card);
  if(!c.media){card.append(el('p','pending','该正式案例尚无已验收的原始封存与媒体。结果、阶段和视频均不补填。'));continue;}
  const v=el('video');v.src=safe(c.media.video);v.muted=true;v.playsInline=true;v.preload='metadata';v.setAttribute('aria-label',`${c.condition} EP${scene} Ours 原${c.original_outcome}完整视频`);card.append(v);
  const state=el('div','video-state'),taskbox=el('div','task'),task=el('span');taskbox.append(el('strong','','模型完整原子任务指令'),task);const stage=el('div','stage'),score=el('div','score'),phase=el('div','phase');card.append(state,taskbox,stage,score,phase);
  const links=el('p','downloads');for(const [path,label]of [[c.media.video,'下载完整原时长标注视频'],[c.media.timeline,'下载逐帧timeline']]){const a=el('a','',label);a.href=safe(path);a.download='';links.append(a,el('span','',' · '));}card.append(links);
  const p={c,v,state,task,stage,score,phase,timeline:null};local.push(p);
  v.addEventListener('error',()=>{if(g!==generation)return;stop('视频错误；本场景停止');$('error').textContent=c.condition+' 视频加载失败';errors.push(c.condition+' video error');});
  v.addEventListener('loadedmetadata',()=>{if(g===generation&&p.timeline)v.currentTime=timeFor(p,frame);});
  loads.push(json(c.media.timeline,c.media.timeline_sha256).then(t=>{p.timeline=validateTimeline(t,c);}));
 }
 try{await Promise.all(loads);if(g!==generation)return false;players=local;last=Math.max(0,...local.map(p=>p.c.media.last_frame));$('seek').max=String(last);render();for(const id of ['play','pause','restart','prev','next','seek'])$(id).disabled=!players.length;$('playback-state').textContent=pair.every(c=>c.media)?'两路已验收来源就绪；点击同步播放':'仅显示已有独立验收素材；另一条件保持待填';return true;
 }catch(error){if(g!==generation)return false;for(const p of local)p.v.pause();stop('来源不完整；拒绝播放');$('error').textContent=String(error);errors.push(String(error));return false;}
}
function eventText(c,event){if(!c.media)return'待验收';if(!event)return'原记录未达到';return`${event.seconds.toFixed(3)}s / tick${event.native_tick}`;}
function outcomes(){
 const body=$('results').querySelector('tbody');body.replaceChildren();
 for(const c of data.cases){const tr=el('tr');tr.append(el('td','',`EP${c.source_episode} ${c.side==='left'?'左':'右'} / ${c.condition}`),el('td','',c.media?`原${c.original_outcome} / ${c.termination_reason}`:'待原始封存与独立验收'));
  for(const key of ['pickup','pour95','restore']){const td=el('td'),event=c.events?.[key];if(event&&event.recorded_frame_available){const b=el('button','',eventText(c,event));b.addEventListener('click',async()=>{if(await choose(c.source_episode))seek(event.video_frame_on_or_after);});td.append(b);}else td.textContent=eventText(c,event)+(event&&!event.recorded_frame_available?'；事件之后无新的相机采样':'');tr.append(td);}body.append(tr);
 }
 $('coverage').textContent=`四个选定正式格中，${data.cases.filter(c=>c.media).length}格已有独立实际证据；其余保持待填。不显示总体成功率。`;
 const B=data.cases.filter(c=>c.condition==='B');$('B-summary').textContent=B.map(c=>!c.media?`EP${c.source_episode}待验收`:`EP${c.source_episode}原${c.original_outcome}，${c.termination_reason}；原物理事件阶段${c.review.physical_phase}/3。`).join(' ');
 const x=addendum;$('B-EP0-score').textContent=`B / EP0：接收杯峰值${x.maximum_B_particles}/1290（${(x.maximum_B_fraction*100).toFixed(2)}%），未达原95%倾倒条件。排除边界后的${x.stage1_scores_excluding_boundary.observations}个stage1分数最高${x.stage1_scores_excluding_boundary.maximum.toFixed(6)}（f${x.stage1_scores_excluding_boundary.maximum_at.frame}），≥0.975为0次。f245的0.988574属于stage0切换边界，不算倾倒阳性。本例不是稍降阈值就能完成的证据。`;
 $('closure-status').textContent=['A','B'].map(k=>sources.runs[k]?`${k}：已绑定全部自有世代关闭后的独立母级总账。`:`${k}：尚未绑定最终母级验收，不代填关闭状态。`).join(' ');
 for(const limit of data.limits)$('limits').append(el('li','',limit));
}
try{
 const raw=await bytes('data.json');data=JSON.parse(new TextDecoder().decode(raw));sources=await json('sources.json');if(await digest(raw)!==sources.data_sha256)throw Error('案例表SHA不匹配');
 if(data.schema!=='T947_ours_resize_live_v1'||data.method!=='ours'||data.diagnostic_only!==true||data.population_SR!==false||data.canary_excluded!==true||data.frame_hz!==15||data.native_hz!==120||data.execution_horizon!==4||data.prediction_horizon!==30||data.no_event_warp!==true||data.cases?.length!==4)throw Error('四格Ours诊断契约不匹配');
 if(new Set(data.cases.map(c=>c.condition+':'+c.source_episode)).size!==4||data.cases.some(c=>!['A','B'].includes(c.condition)||![0,56].includes(c.source_episode)||c.episode.includes('resource')||(c.media?(!['S','F','U'].includes(c.original_outcome)||c.media.last_frame!==c.media.frames-1||!hex(c.media.timeline_sha256)||!hex(c.media.video_sha256)):(c.original_outcome!==null||c.events!==null))))throw Error('正式身份、待填或可变时长不匹配');
 for(const c of data.cases)if(c.media){const s=sources.cases.find(s=>s.episode===c.episode);if(!s||s.condition!==c.condition||s.source_episode!==c.source_episode||!hex(s.original_case_seal_sha256)||!hex(s.original_RESULT_sha256)||!hex(s.independent_case_review_sha256)||!hex(s.media_receipt_sha256)||s.derived_files[c.media.video]!==c.media.video_sha256||s.derived_files[c.media.timeline]!==c.media.timeline_sha256)throw Error('逐案独审与媒体来源绑定缺失');}
 if(data.all_four_actual_cases_accepted!==data.cases.every(c=>c.media!==null)||typeof data.prepared_only!=='boolean'||data.published===data.prepared_only||sources.prepared_only!==data.prepared_only)throw Error('准备/出版状态不匹配');
 if(!data.prepared_only&&(!data.all_four_actual_cases_accepted||!sources.runs.A||!sources.runs.B))throw Error('四案或母级未齐，拒绝公开待填页');
 addendum=await json(sources.B_EP0_addendum.path,sources.B_EP0_addendum.sha256);for(const k of ['A','B'])if(sources.runs[k]){const r=await json(sources.runs[k].public_summary,sources.runs[k].public_summary_sha256);if(r.passed!==true||r.all_owned_children_and_guardian_closed!==true||r.population_SR!==false)throw Error('独立母级附录不匹配');}
 $('publication-note').textContent=data.prepared_only?'私有候选：待四条实际证据与根代理终审，禁止先公开待填页。':'四格独立证据已绑定；这是选定诊断，不是总体成功率。';outcomes();
 $('scene').addEventListener('change',()=>choose($('scene').value));$('play').addEventListener('click',play);$('pause').addEventListener('click',()=>stop());$('restart').addEventListener('click',()=>{seek(0);play();});$('prev').addEventListener('click',()=>seek(frame-1));$('next').addEventListener('click',()=>seek(frame+1));$('seek').addEventListener('input',()=>seek($('seek').value));
 window.resizeLiveViewer=Object.freeze({choose,seek,play,pause:stop,snapshot:()=>({scene,frame,last,playing,pendingPlay,generation,epoch,errors:[...errors],cards:players.map(p=>({condition:p.c.condition,episode:p.c.episode,actual_frame:Math.min(frame,p.c.media.last_frame),last_frame:p.c.media.last_frame,currentTime:p.v.currentTime,paused:p.v.paused,task:p.task.textContent,score:p.score.textContent,state:p.state.textContent}))})});
 const requested=new URL(location.href).searchParams.get('scene');await choose(requested==='56'?56:0);
}catch(error){stop('证据加载失败；拒绝展示未绑定的对照');$('error').textContent=String(error);errors.push(String(error));}
})();
