'use strict';
const $=s=>document.querySelector(s),names={mem0:'Mem-0',ours:'Ours'},outcomes={success:'成功',failure:'失败',unknown:'未裁定',pending:'待完成'};
let report,examples=[],exampleSerial=0;
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el}
function renderCases(){
 const body=$('#cases');body.replaceChildren();
 for(const c of report.cases){
  if([['method',c.method],['horizon',String(c.horizon)],['outcome',c.outcome]].some(([k,v])=>$('#'+k).value!=='all'&&$('#'+k).value!==v))continue;
  const tr=node('tr'),td=node('td'),detail=node('details'),summary=node('summary');
  tr.append(node('td',names[c.method]+' / '+c.horizon+'步'),node('td','EP '+String(c.roster_index+1).padStart(3,'0')+' / '+c.roster_index),node('td',c.side+' / '+c.scene_seed),node('td',outcomes[c.outcome],c.outcome));
  const d=c.sr_diagnostics;summary.textContent=d?'任务事件 '+d.task_event_ticks.length+'/3 · '+(d.legacy_first_rejection?.reason||'此前缀无旧规则拒绝'):(c.unscored_reason||'尚无闭环审计');
  detail.append(summary,node('pre',JSON.stringify({episode_id:c.episode_id,raw_status:c.raw_status,result_sha256:c.result_sha256,unscored_reason:c.unscored_reason,sr_diagnostics:d},null,2)));td.append(detail);tr.append(td);body.append(tr);
 }
}
fetch('data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('审计数据HTTP '+r.status);return r.json()}).then(d=>{
 report=d;if(d.target!==400||d.cases.length!==400||d.cells.length!==4)throw Error('评测基数不完整');
 $('#state').textContent=d.complete?'400条任务SR记录已全部汇总；每方法、每步数100条。未裁定仍保留在分母内。':'评测进行中：尚未测完，当前数字不是最终成功率。较早完成的案例存在时长偏差，请等待完整100条。';
 $('#updated').textContent='源记录时间：'+new Date(d.source_epoch*1000).toLocaleString()+' · 本页面为已发布快照，刷新不会产生新评测。';
 $('#progress').value=d.accounted;$('#coverage').textContent='已归档 '+d.accounted+' / 400 条（含未裁定）'+(d.complete?'；全部评测结束。':'；其余继续执行。');
 for(const c of d.cells){const tr=node('tr'),old=d.historical_strict_rates.find(v=>v.method===c.method&&v.horizon===c.horizon);tr.append(node('td',names[c.method]),node('td',c.horizon),node('td',c.success,'success'),node('td',c.failure,'failure'),node('td',c.unknown,'unknown'),node('td',c.pending,'pending'),node('td',c.complete?(100*c.confirmed_success_rate).toFixed(0)+'%':'待完成'),node('td',c.unscored_sensitivity_bounds?c.unscored_sensitivity_bounds.map(v=>(v*100).toFixed(0)+'%').join('–'):'待完成'),node('td',old.success+'%（U='+old.unknown+'）'),node('td',c.SR_success_with_legacy_rejection));$('#rates').append(tr)}
 $('#source').textContent=JSON.stringify({metric:d.evaluation_metric,source_manifest_sha256:d.source_manifest_sha256,plan_identities:d.plan_identities,protocol:d.protocol,caveats:d.caveats},null,2);
 for(const id of ['method','horizon','outcome'])$('#'+id).onchange=renderCases;renderCases();loadExamples().catch(e=>$('#error').textContent='视频案例载入失败：'+e.message);
}).catch(e=>{$('#state').textContent='数据载入失败，未显示成功率。';$('#error').textContent=e.message});
async function get(url){const r=await fetch(url);if(!r.ok)throw Error(url+' HTTP '+r.status);return r.json()}
function link(text,url){const a=node('a',text);a.href=url;a.download='';return a}
async function chooseExample(id){
 const token=++exampleSerial,c=examples.find(c=>c.episode_id===id);if(!c)return;
 const video=$('#exampleVideo');video.pause();video.ontimeupdate=null;video.removeAttribute('src');video.load();$('#exampleFrames').replaceChildren();$('#exampleInstruction').textContent='载入完整子任务指令…';$('#exampleDownloads').replaceChildren();
 $('#exampleMeta').textContent=names[c.method]+' · Episode '+String(c.roster_index+1).padStart(3,'0')+' · '+c.horizon+'步 · '+outcomes[c.outcome]+' · 场景种子 '+c.scene_seed;
 const t=await get(c.media.timeline);if(token!==exampleSerial)return;
 if(t.source_result_sha256!==c.result_sha256||t.episode_id!==c.episode_id)throw Error('案例来源不一致');
 let selectedSignature='';function update(){const f=Math.min(t.video_frames-1,Math.max(0,Math.floor(video.currentTime*15+1e-6)));const s=t.segments.filter(s=>s.frame<=f).at(-1);$('#exampleInstruction').textContent='frame '+f+' · Planner指令位置 '+(s.stage+1)+'：'+s.instruction;
  const selected=t.selections.filter(s=>s.released_at<=f&&s.first_logged_frame<=f);const signature=JSON.stringify(selected.map(s=>s.source_subtask_id));if(signature===selectedSignature)return;selectedSignature=signature;const box=$('#exampleFrames');box.replaceChildren();
  if(c.method==='mem0'){box.append(node('p','Mem-0采用锚点/FIFO记忆；没有同类离散选帧日志。'));return}
  box.append(node('p',selected.length?'以下为已释放的真实关键帧：':'当前尚无已释放关键帧。'));for(const s of selected){box.append(node('p','来源指令位置 '+(s.source_subtask_id+1)+' · frame '+s.released_at+' 释放'));for(const im of s.images){const image=node('img');image.src=c.media.timeline.replace('timeline.json',im.url);image.alt='实际选帧 '+im.frame;image.style.cssText='width:150px;max-width:45%;margin:4px';box.append(image)}}
 }
 video.ontimeupdate=update;video.onerror=()=>{if(token===exampleSerial)$('#error').textContent='本轮视频读取失败：'+c.media.filename};video.src=c.media.annotated;
 $('#exampleDownloads').append(link(c.media.filename,c.media.annotated),document.createTextNode(' · '),link('原始录像',c.media.original),document.createTextNode(' · '),link('本次指令/选帧/源哈希',c.media.timeline));update();
}
async function loadExamples(){const d=await get('examples.json');examples=d.examples;if(d.count!==8||examples.length!==8)throw Error('案例列表不完整');for(const c of examples){const option=node('option',names[c.method]+' · '+c.horizon+'步 · EP'+String(c.roster_index+1).padStart(3,'0')+' · '+outcomes[c.outcome]);option.value=c.episode_id;$('#example').append(option)}$('#example').onchange=()=>chooseExample($('#example').value).catch(e=>$('#error').textContent=e.message);await chooseExample(examples[0].episode_id)}
get('resources.json').then(d=>{if(!d.verified||d.jobs.length!==3||!d.jobs.every(j=>j.status==='SUCCEEDED'&&j.ended_at>j.created_at))throw Error('资源终态证据不完整');$('#resourceState').textContent='3个四卡低优任务均SUCCEEDED，均有平台结束时间；本轮12卡任务已结束。';for(const [i,j]of d.jobs.entries()){const p=d.GPU_profiles.find(p=>p.shard===i),tr=node('tr');tr.append(node('td',j.job_id),node('td',j.status),node('td',p.mean_utilization_percent.toFixed(1)+'%'),node('td',p.median_utilization_percent.toFixed(1)+'%'),node('td',(p.peak_memory_used_MiB/1024).toFixed(1)+' GiB'));$('#resources').append(tr)}}).catch(e=>$('#resourceState').textContent='资源证据未载入：'+e.message);
