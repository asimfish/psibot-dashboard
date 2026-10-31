'use strict';
(async()=>{
const $=id=>document.getElementById(id),END=5728/120,FPS=15,LAST=716,players=[],errors=[];
let data,frame=0,playing=false,anchor=0,start=0,rate=1,raf=0,generation=0;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const safe=p=>{if(typeof p!=='string'||p.startsWith('/')||p.includes('\\')||p.split('/').some(x=>x===''||x==='.'||x==='..')||p.includes(':'))throw Error('非法静态资源路径');return p;};
async function read(p){const r=await fetch(safe(p));if(!r.ok)throw Error('证据加载失败 '+p+' '+r.status);return r.json();}
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x!==null&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');
const sec=x=>x===null||x===undefined?'本窗口无':Number(x).toFixed(3)+'s';
const findings={EE:'专家 arm7 + 专家 hand6：21.750s 达到95%倾倒；37.042s 接触原垫，38.633s 开始出现描述性开手目标，39.542s 持续离手并达到原任务 SR 事件。',EL:'专家 arm7 + 模型 hand6：先倒满，随后空中脱手。24.667s 杯对腕旋转超过5°；25.658s 持续失去手接触，26.042s 才碰到接收垫，未放回原垫。不是“只是没松手”。',LE:'模型 arm7 + 专家 hand6：19.842s 杯对腕旋转超过5°，22.000s 持续脱手，B 始终未接到液体。此时专家手指仍保持原闭手目标，直到38.633s才出现开手目标变化。',LL:'模型 arm7 + 模型 hand6：原失败命令的固定回放。19.325s 杯对腕旋转超过5°，24.825s 持续脱手。原完整75s结果仍为F；这里只展示共同时间前缀。'};
function render(){
 $('seek').value=String(frame);$('clock').textContent=`frame ${frame} · native tick ${frame*8} · ${(frame/FPS).toFixed(3)}s`;
 for(const p of players){const r=p.c.frames[frame];p.physical.textContent=`物理事件进度 ${r.physical_phase}/3：${r.physical_progress}`;p.metrics.textContent=`B ${r.B}/1290 · 手接触 ${r.hand_contacts} · 原垫/接收垫 ${r.pad_S1}/${r.pad_S2}\n杯倾角 ${r.tilt_deg.toFixed(2)}° · ${r.relative_reference_active?'杯对腕偏转 '+r.relative_rotation_from_tick1200_deg.toFixed(2)+'°（10s参考）':'相对姿态参考为10s，此时尚未到达'}`;p.retention.textContent=r.retention_description+(r.current_open_target_marker?' · 已出现描述性开手目标变化':'');}
}
function freeze(atEnd=false){playing=false;cancelAnimationFrame(raf);generation++;for(const p of players)p.v.pause();$('playback-state').textContent=atEnd?'共同 native 窗口结束，保持真实末相机帧':'全部暂停；可逐帧检查';}
function seekFrame(n){freeze();frame=Math.max(0,Math.min(LAST,Math.round(Number(n)||0)));for(const p of players)p.v.currentTime=frame/FPS;render();}
function animate(token){if(!playing||token!==generation)return;const target=Math.min(END,start+(performance.now()-anchor)/1000*rate);frame=Math.min(LAST,Math.floor(target*FPS+1e-5));for(const p of players){if(Math.abs(p.v.currentTime-target)>1/FPS+.01)p.v.currentTime=frame/FPS;}render();if(target>=END){freeze(true);for(const p of players)p.v.currentTime=END;return;}raf=requestAnimationFrame(()=>animate(token));}
async function play(){
 if(frame>=LAST)seekFrame(0);freeze();const token=++generation;
 try{for(const p of players){p.v.currentTime=frame/FPS;p.v.playbackRate=rate;}await Promise.all(players.map(p=>p.v.play()));if(token!==generation){for(const p of players)p.v.pause();return;}start=frame/FPS;anchor=performance.now();playing=true;$('playback-state').textContent='四路共享原始 native 时钟播放';raf=requestAnimationFrame(()=>animate(token));}
 catch(e){freeze();$('error').textContent='同步播放失败，请检查四个视频文件：'+e.message;errors.push(String(e));}
}
try{
 data=await read('data.json');if(data.schema!=='T1048-fixed-mechanical-four-way-v1'||typeof data.published!=='boolean'||typeof data.prepared_candidate_only!=='boolean'||data.fixed_commands_only!==true||data.online_SR!==false||data.GT_control!==false||data.last_native_tick!==5728||data.cases.map(c=>c.id).join(',')!=='EE,EL,LE,LL')throw Error('候选证据契约不匹配');
 for(const c of data.cases){if(c.frames.length!==717||c.frame_hz!==15||c.video_frames!==717||c.frames.some((r,i)=>r.frame!==i||r.native_tick!==i*8||Math.abs(r.native_seconds-i/15)>1e-9)||!/^media\/[a-zA-Z0-9_.-]+\.mp4$/.test(c.video))throw Error('逐帧 native 时钟或视频路径不匹配');}
 const review=await read('evidence/source_review.json'),sources=await read('sources.json');
 const {published,prepared_candidate_only,...scientificTrace}=data;const {candidate_only,...scientificSources}=sources;
 if(review.schema!=='T947-derived-source-review-binding-v1'||review.fixed_commands_only!==true||review.online_SR!==false||review.GT_control!==false||review.case_acceptance?.length!==4||sources.cases?.length!==4||await digest(scientificTrace)!==review.frozen_scientific_trace_sha256||await digest(scientificSources)!==review.frozen_scientific_sources_sha256)throw Error('独审来源或冻结轨迹 SHA 不匹配');
 for(let i=0;i<4;i++){const c=data.cases[i],r=review.case_acceptance[i],s=sources.cases[i];if(r.condition!==c.id||s.condition!==c.id||r.accepted!==true||r.source_case_id!==c.source_case_id||r.original_outcome!==c.original_outcome||r.independent_review_SHA256!==s.independent_acceptance_SHA256||r.original_case_seal_SHA256!==s.original_case_seal_SHA256||r.original_RESULT_SHA256!==s.original_RESULT_SHA256||r.derived_video.path!==c.video||r.derived_video.sha256!==s.derived_video.sha256||!/^[a-f0-9]{64}$/.test(r.independent_review_SHA256))throw Error('四路独审来源未接受或视频绑定不匹配');}
 document.querySelector('.eyebrow').textContent=data.published?'固定指令机械诊断 · 已发布':'固定指令机械诊断 · 未发布的静态候选';document.title='机械诊断：四路固定指令对照'+(data.published?' · 已发布':' · 私有候选');
 for(const c of data.cases){
  const card=el('article','card');card.dataset.condition=c.id;const top=el('div','card-top');top.append(el('h2','',c.id),el('strong','outcome-'+c.original_outcome,'原完整记录 '+c.original_outcome));card.append(top,el('p','source',`arm7：${c.arm7_source==='expert'?'专家 E':'模型 L'} / hand6：${c.hand6_source==='expert'?'专家 E':'模型 L'}`),el('p','caseid',c.source_case_id));
  const v=el('video');v.src=safe(c.video);v.muted=true;v.playsInline=true;v.preload='metadata';v.setAttribute('aria-label',`${c.id}固定命令诊断：${c.arm7_source} arm7，${c.hand6_source} hand6，原${c.original_outcome}`);card.append(v);
  const vs=el('div','video-state',''),task=el('div','task');task.append(el('strong','','完整高层任务说明（非 Planner 输出）'),el('span','',c.task_text));card.append(vs,task);
  const physical=el('div','physical',''),metrics=el('div','metrics',''),retention=el('div','retention','');card.append(physical,metrics,retention,el('p','finding',findings[c.id]));
  const downloads=el('p','downloads'),a=el('a','','下载完整15Hz诊断视频');a.href=safe(c.video);a.download=c.filename;downloads.append(a,document.createTextNode(` · 原记录${c.original_elapsed_sim_seconds.toFixed(3)}s / ${c.original_source_camera_frames}帧；本页717帧`));card.append(downloads);$('cards').append(card);
  v.addEventListener('error',()=>{vs.textContent='本路视频读取失败，已暂停四路；请核查源 SHA 清单';freeze();$('error').textContent=c.id+' 视频加载失败，不能继续把其余视频当作同步对照。';errors.push(c.id+' video error');});players.push({c,v,physical,metrics,retention,vs});
 }
 const rows=data.cases[0].events.map(e=>e.id);for(const id of rows){const tr=el('tr'),first=data.cases[0].events.find(e=>e.id===id);tr.append(el('th','',first.label));for(const c of data.cases){const e=c.events.find(x=>x.id===id),td=el('td');if(e.tick===null)td.append(el('span','event-absent','本窗口无'));else{const b=el('button','',`${e.seconds.toFixed(3)}s · t${e.tick}`);b.dataset.event=id;b.dataset.condition=c.id;b.title='定位到事件后首个相机帧 f'+e.first_camera_frame_at_or_after;b.addEventListener('click',()=>seekFrame(e.first_camera_frame_at_or_after));td.append(b);}tr.append(td);}$('events').querySelector('tbody').append(tr);}
 for(const t of data.limits)$('limits').append(el('li','',t));
 $('seek').addEventListener('input',()=>seekFrame($('seek').value));$('play').addEventListener('click',play);$('pause').addEventListener('click',()=>freeze());$('restart').addEventListener('click',()=>{seekFrame(0);play();});$('prev').addEventListener('click',()=>seekFrame(frame-1));$('next').addEventListener('click',()=>seekFrame(frame+1));$('speed').addEventListener('change',()=>{const was=playing;freeze();rate=Number($('speed').value);if(was)play();});
 const appendix=await read('evidence/classifier/completion_handoff.json');if(appendix.population_SR!==false||appendix.cases.length!==4)throw Error('分类器附录契约不匹配');for(const c of appendix.cases){const tr=el('tr');for(const value of[c.title,c.original_whole_success?'原S':'原F',sec(c.physical95_seconds),sec(c.restore_seconds),sec(c.delay_seconds),c.maximum_pour_completion_score===null?'无':Number(c.maximum_pour_completion_score).toFixed(4),c.actual_H30_first_frame===null?'未覆盖':`f${c.actual_H30_first_frame}`])tr.append(el('td','',value));$('classifier-table').querySelector('tbody').append(tr);}for(const t of appendix.limits)$('classifier-limits').append(el('li','',t));
 window.mechanicalViewer=Object.freeze({seekFrame,play,pause:freeze,snapshot:()=>({frame,native_tick:frame*8,native_seconds:frame/15,playing,errors:[...errors],cards:players.map(p=>({id:p.c.id,time:p.v.currentTime,paused:p.v.paused,ready:p.v.readyState,physical:p.physical.textContent,task:p.c.task_text,source:p.c.arm7_source+'/'+p.c.hand6_source}))})});
 render();for(const id of['play','pause','restart','prev','next'])$(id).disabled=false;$('playback-state').textContent='四路证据已加载；点击同步播放或拖动共享帧';
}catch(e){freeze();$('error').textContent='证据加载失败：'+e.message;$('playback-state').textContent='无法完成四路对照';}
})();
