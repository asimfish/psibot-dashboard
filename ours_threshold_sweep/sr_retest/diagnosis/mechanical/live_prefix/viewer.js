'use strict';
(async()=>{
const $=id=>document.getElementById(id),FPS=15,players=[],errors=[];
let data,LAST=0,frame=0,playing=false,anchor=0,start=0,rate=1,raf=0,generation=0;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const safe=p=>{if(typeof p!=='string'||p.startsWith('/')||p.includes('\\')||p.includes(':')||p.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('非法静态资源路径');return p;};
const j=x=>JSON.stringify(x,null,2),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
async function read(p){const r=await fetch(safe(p));if(!r.ok)throw Error('来源缺失 '+p+' '+r.status);return r.json();}
async function readPinned(p,pin){const r=await fetch(safe(p));if(!r.ok)throw Error('来源缺失 '+p+' '+r.status);const b=await r.arrayBuffer(),h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');if(h!==pin)throw Error('附录SHA不匹配 '+p);return JSON.parse(new TextDecoder().decode(b));}
function freeze(ended=false){playing=false;cancelAnimationFrame(raf);generation++;for(const p of players)p.v.pause();$('playback-state').textContent=ended?'两案均已结束；保持各自真实末帧':'已暂停；可逐帧检查';}
function render(){
 $('seek').value=String(frame);$('clock').textContent=`共同相机帧 ${frame} · tick ${frame*8} · ${(frame/FPS).toFixed(3)}s`;
 for(const p of players){const own=Math.min(frame,p.c.last_frame),r=p.c.frames[own],held=frame>=p.c.last_frame;
  p.state.textContent=held?`记录已结束：${p.c.termination_reason} · 原 ${p.c.original_outcome}；保持真实末帧${own}（${(own/FPS).toFixed(3)}s）`:`本案相机帧${own} · ${(own/FPS).toFixed(3)}s`;
  p.state.classList.toggle('held',held);p.task.textContent=r.source_subtask;
  p.stage.textContent=`子任务 stage=${r.source_stage} · 原响应帧${r.response_frame}`+(r.new_response_at_this_camera_frame?'':' · 当前图像没有新模型响应，持续显示上一响应');
  p.score.textContent=(r.completion_score===null?'原 completion：未产生分数（null）':`原 completion：${r.completion_score}`)+(r.stage_changed_at_response?' · 阶段边界：该分数可能属于上一子任务，不能当新stage完成（原数值保留；见原独审归属）':'');
  p.chunk.textContent=`原 chunk 预测帧${r.chunk_prediction_frame} · 消费行${r.chunk_row_consumed} / H8（从0计） · P30`;
  p.phase.textContent=`adapter=${r.adapter_phase} · hand6始终实时NN`+(r.mechanism_uncovered?' · 机制未覆盖':'');
  p.applied.textContent=r.returned_for_original_servo?'该响应端点已交给原控制器执行':`该响应端点被拒绝，未执行：${r.refusal_reason}`;
  p.details.textContent=j({completion_attribution_note:r.completion_attribution_note,original_executor_status:r.source_executor_status,original_dag_selection:r.source_dag_selection,original_planner_terminal:r.source_planner_terminal,original_done:r.source_done,original_success:r.source_success,raw_NN_endpoint13_rad:r.raw_NN_endpoint13_rad,actual_endpoint13_rad:r.actual_endpoint13_rad,source_status_SHA256:r.original_response_status_sha256,source_pins:r.source_pins});
 }
}
function seekFrame(n){freeze();frame=Math.max(0,Math.min(LAST,Math.round(Number(n)||0)));for(const p of players)p.v.currentTime=Math.min(frame,p.c.last_frame)/FPS;render();}
function animate(token){if(!playing||token!==generation)return;const target=Math.min(LAST/FPS,start+(performance.now()-anchor)/1000*rate);frame=Math.min(LAST,Math.floor(target*FPS+1e-5));for(const p of players){const ownTarget=Math.min(target,p.c.last_frame/FPS);if(frame>=p.c.last_frame){p.v.pause();if(Math.abs(p.v.currentTime-ownTarget)>.0001)p.v.currentTime=ownTarget;}else if(Math.abs(p.v.currentTime-ownTarget)>1/FPS+.01)p.v.currentTime=Math.min(frame,p.c.last_frame)/FPS;}render();if(target>=LAST/FPS){freeze(true);return;}raf=requestAnimationFrame(()=>animate(token));}
async function play(){if(frame>=LAST)seekFrame(0);freeze();const token=++generation;try{const live=players.filter(p=>frame<p.c.last_frame);for(const p of players){p.v.currentTime=Math.min(frame,p.c.last_frame)/FPS;p.v.playbackRate=rate;}await Promise.all(live.map(p=>p.v.play()));if(token!==generation){for(const p of players)p.v.pause();return;}start=frame/FPS;anchor=performance.now();playing=true;$('playback-state').textContent='两案共享原始时钟；已结束的案保持真实末帧';raf=requestAnimationFrame(()=>animate(token));}catch(e){freeze();$('error').textContent='同步播放失败：'+e.message;errors.push(String(e));}}
try{
 const response=await fetch('data.json');if(!response.ok)throw Error('data.json 来源缺失 '+response.status);const rawData=await response.arrayBuffer(),dataSHA=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',rawData))).map(x=>x.toString(16).padStart(2,'0')).join('');data=JSON.parse(new TextDecoder().decode(rawData));const sources=await read('sources.json');if(sources.data_sha256!==dataSHA)throw Error('逐帧数据来源 SHA 不匹配');
 const closure=await readPinned('evidence/run_closure.json',sources.public_run_closure_sha256);if(closure.accepted!==true||closure.population_or_autonomous_SR!==false||closure.canary_excluded_from_scientific_pair!==true||closure.history_pending_flags_resolved_by_separate_final_review!==true)throw Error('最终独立清场附录不匹配');
 if(data.schema!=='T947-live-prefix-two-way-v1'||data.diagnostic_only!==true||data.population_SR!==false||data.canary_excluded!==true||data.no_event_warp!==true||data.frame_hz!==15||data.native_hz!==120||data.cases?.length!==2||sources.cases?.length!==2)throw Error('正式双案诊断契约不匹配');
 const ids=['t947_live_prefix_ep000_expert_arm_v1','t947_live_prefix_ep000_NN_sham_v1'];
 for(let i=0;i<2;i++){const c=data.cases[i],s=sources.cases[i];
  if(c.id!==['A','B'][i]||c.source_case_id!==ids[i]||s.source_case_id!==ids[i]||c.source_episode!==0||!['S','F','U'].includes(c.original_outcome)||c.video_frames!==c.frames.length||c.last_frame!==c.frames.length-1||c.last_native_tick!==c.last_frame*8||Math.abs(c.last_native_seconds-c.last_frame/FPS)>1e-9||c.frames.length<2||c.frames.length>1126||!/^media\/[A-Za-z0-9_.-]+\.mp4$/.test(c.video)||c.frames.some((r,f)=>r.frame!==f||r.native_tick!==f*8||Math.abs(r.seconds-f/FPS)>1e-9||typeof r.source_subtask!=='string'||r.response_frame>f||!hex(r.original_response_status_sha256)))throw Error('正式身份、逐帧时钟或可变时长不匹配');
  if(s.all_source_members_full_SHA_verified!==true||!hex(s.original_case_seal_sha256)||!hex(s.original_result_sha256)||!hex(s.independent_review_sha256)||s.derived_video?.path!==c.video||!hex(s.derived_video?.sha256))throw Error('独审和完整来源绑定缺失');
 }
 LAST=Math.max(...data.cases.map(c=>c.last_frame));if(data.last_common_frame!==LAST)throw Error('共享末时钟必须来自实际最长案');$('seek').max=String(LAST);
 for(const c of data.cases){const card=el('article','card');card.dataset.condition=c.id;const top=el('div','card-top');top.append(el('h2','',c.id==='A'?'A 专家机械臂前缀＋实时NN':'B 原实时NN对照'),el('strong','outcome-'+c.original_outcome,'原 '+c.original_outcome));card.append(top,el('p','caseid',c.source_case_id));
  const v=el('video');v.src=safe(c.video);v.muted=true;v.playsInline=true;v.preload='metadata';v.setAttribute('aria-label',`${c.id} EP000 ${c.original_outcome} 实时模型完整子任务视频`);card.append(v);
  const state=el('div','video-state'),taskBox=el('div','task'),task=el('span');taskBox.append(el('strong','','模型完整原子任务指令'),task);
  const stage=el('div','stage'),score=el('div','score'),chunk=el('div','chunk'),phase=el('div','phase'),applied=el('div','applied'),detail=el('details'),details=el('pre');detail.append(el('summary','','当前原响应、DAG、端点与来源详情'),details);card.append(state,taskBox,stage,score,chunk,phase,applied,detail);
  const reviewBox=el('details'),reviewText=el('pre');reviewText.textContent=j({independent_physical_summary:c.independent_physical_summary,independent_mechanical_readout:c.independent_mechanical_readout,original_review_runwide_cleanup_verified:c.review_runwide_cleanup_verified,original_review_limits:c.review_limits});reviewBox.append(el('summary','','原独审物理结果与实际证据限制'),reviewText);card.append(reviewBox);
  const links=el('p','downloads'),a=el('a','','下载本案完整原时长标注视频');a.href=safe(c.video);a.download=c.filename;links.append(a);card.append(links);$('cards').append(card);players.push({c,v,state,task,stage,score,chunk,phase,applied,details});
  v.addEventListener('error',()=>{freeze();$('error').textContent=c.id+' 视频失败：停止两路，不能继续当作同步对照。';errors.push(c.id+' video error');});
  const tr=el('tr');for(const x of[c.id,c.original_outcome,c.termination_reason,`${c.last_frame} / ${c.last_native_seconds.toFixed(3)}s`,c.mechanism_uncovered?'未覆盖（不得宣称机制已验证）':'未标记未覆盖',j(c.bridge_qualification)])tr.append(el('td','',x));$('outcomes').querySelector('tbody').append(tr);
 }
 const pair=data.selected_pair_addendum;if(pair?.case_order?.join(',')!==ids.join(',')||pair.formal_pair_only!==true||pair.resource_canary_excluded!==true)throw Error('选定实验原附录不匹配');
 $('pair-summary').textContent='在这个选定EP000实验中，A完成任务，B滑转/失握后75s超时。它支持继续检验抓取前缀机制，不能推算总体成功率，也不能证明单一原因。两案之后各自使用真实NN反馈，并非相同固定后缀。';
 const init=pair.first_input_comparison;$('initial-summary').textContent=`首帧RGB MAE=${init.RGB_pixel_MAE_0to255}/255；逐位相同=${init.RGB_bitwise_equal}。q13逐位相同=${init.q13_bitwise_equal}；名义初态表与initial241收据相同，但没有完整pre-recorder 241行轨迹。独立App渲染/settle差异仍是限制。`;
 $('pair-details').textContent=j(pair);
 for(const item of pair.per_frame_score_summaries){const label=item.case===ids[0]?'A':'B';for(const r of item.stage_score_summaries){const tr=el('tr');for(const x of[`${label} / stage${r.stage}`,r.scored_later_frames,r.maximum,r.maximum_frame,j(r.frames_ge_0975)])tr.append(el('td','',String(x)));$('scores').querySelector('tbody').append(tr);}}
 $('closure-status').textContent=`T-1065 最终独审已接受：原55项全局payload和保留tar SHA闭合，guardian与六个自有进程世代已结束；未向外来进程发信号。两个正式App＋三模型共同正采样${closure.resource_evidence.formal_two_native_plus_three_models_joint_samples}次；${closure.resource_evidence.reserve_samples}次显存观测，GPU0/1最小空闲${closure.resource_evidence.sampled_minimum_free_mib['0']}/${closure.resource_evidence.sampled_minimum_free_mib['1']} MiB。采样并非连续上界或未来容量保证。`;
 $('closure-details').textContent=j(closure);
 for(const t of data.limits)$('limits').append(el('li','',t));
 $('seek').addEventListener('input',()=>seekFrame($('seek').value));$('play').addEventListener('click',play);$('pause').addEventListener('click',()=>freeze());$('restart').addEventListener('click',()=>{seekFrame(0);play();});$('prev').addEventListener('click',()=>seekFrame(frame-1));$('next').addEventListener('click',()=>seekFrame(frame+1));$('speed').addEventListener('change',()=>{const was=playing;freeze();rate=Number($('speed').value);if(was)play();});
 window.livePrefixViewer=Object.freeze({seekFrame,play,pause:freeze,snapshot:()=>({frame,last_frame:LAST,native_tick:frame*8,seconds:frame/FPS,playing,errors:[...errors],cards:players.map(p=>({id:p.c.id,actual_frame:Math.min(frame,p.c.last_frame),last_frame:p.c.last_frame,time:p.v.currentTime,held:frame>=p.c.last_frame,paused:p.v.paused,task:p.task.textContent,score:p.score.textContent,phase:p.phase.textContent,stop:p.state.textContent}))})});render();for(const id of['play','pause','restart','prev','next','seek'])$(id).disabled=false;$('playback-state').textContent='正式双案完整来源已加载；点击同步播放或逐帧检查';
}catch(e){freeze();$('error').textContent='证据加载失败：'+e.message;$('playback-state').textContent='拒绝展示不完整或未绑定的正式对照';}
})();
