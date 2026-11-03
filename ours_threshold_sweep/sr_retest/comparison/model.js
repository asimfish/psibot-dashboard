(function(root){
'use strict';
const STATES={untested:'待评测',evaluating:'评测中',results:'已有结果',training:'训练中',blocked:'阻塞',verify:'待核验'};
const CAMERAS={third_person:'第三人称',chest:'胸部相机',unknown:'相机待确认'};
const TASKS=[{id:'3',name:'三子任务',sub:'抓取 → 倾倒 → 归位',versions:['3-latest','3-v13','3-jitter']},{id:'5',name:'五子任务',sub:'遮挡任务',versions:['5-pos','5-fixed']},{id:'7',name:'七子任务',sub:'四烧杯称重',versions:['7-weigh']},{id:'10',name:'十子任务',sub:'五烧杯称重',versions:['10-weigh']}];
const VERSIONS={'3-latest':'latest / V14','3-v13':'V13 smooth','3-jitter':'早期 jitter1cm','5-pos':'1025 · pos1cm','5-fixed':'1023 · fixed','7-weigh':'v180 · 四杯','10-weigh':'v180 · 五杯'};
const key=(record,step)=>record+'@'+step;
const safeText=(x,max=1500)=>typeof x==='string'&&x.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x);
function parseScore(s){if(!s)return null;const m=/^(\d{1,7})\/(\d{1,7})$/.exec(s.trim());if(!m||+m[2]<1||+m[1]>+m[2])throw Error('成绩须为 成功数/总次数，例如 21/100');return {success:+m[1],trials:+m[2]};}
function validateEdit(x){
 if(!x||x.schema!==2||x.kind!=='checkpoint')throw Error('非交接记录');
 for(const k of ['target','task','dataset','version','data_path','camera','method','path','doc','owner','run','protocol','note','h4','h8'])if(!safeText(x[k],k==='note'?1000:1200))throw Error('字段无效：'+k);
 if(!/^(3|5|7|10|other)$/.test(x.task)||!(/^[a-z0-9][a-z0-9-]{0,79}$/).test(x.dataset))throw Error('任务或数据版本标识无效');
 if(!/^[a-zA-Z0-9@:_-]{0,160}$/.test(x.target)||!Object.hasOwn(CAMERAS,x.camera)||!Object.hasOwn(STATES,x.state))throw Error('状态、相机或关联标识无效');
 if(!Number.isInteger(x.step)||x.step<0||x.step>1000000000||!x.version.trim()||!x.method.trim())throw Error('版本、方法或步数未填写');
 if(!['training','verify','blocked'].includes(x.state)&&(!x.path.trim()||x.step<1))throw Error('已交付权重需要路径和训练步数');
 for(const h of ['h4','h8']){const score=parseScore(x[h]);const u=x[h+'unknown'];if(!Number.isInteger(u)||u<0||(!score&&u!==0)||(score&&u>score.trials-score.success))throw Error('无法判定数与成绩不一致');}
 if(x.h30!==undefined||x.h30unknown!==undefined){if(!safeText(x.h30,1200))throw Error('字段无效：h30');const score=parseScore(x.h30),u=x.h30unknown;if(!Number.isInteger(u)||u<0||(!score&&u!==0)||(score&&u>score.trials-score.success))throw Error('无法判定数与成绩不一致');}
 if((x.h4||x.h8||x.h30)&&(!x.path.trim()||x.step<1))throw Error('评测成绩必须对应明确的权重路径和训练步数');
 if((x.h4||x.h8||x.h30)&&!x.protocol.trim())throw Error('填写成绩时必须说明泛化、环境和验收条件');
 if(x.state==='results'&&!x.h4&&!x.h8&&!x.h30&&!x.target)throw Error('已有结果至少填写4步、8步或30步成绩');
 return x;
}
function parseIssue(issue){
 if(!issue||issue.pull_request||typeof issue.body!=='string'||issue.body.length>16000||!Number.isInteger(issue.number)||!issue.user?.login||!Number.isFinite(Date.parse(issue.updated_at)))return null;
 const labels=(issue.labels||[]).map(x=>typeof x==='string'?x:x.name);if(labels.includes('safelab-archived'))return null;
 const m=/```safelab-handoff\s*\n([\s\S]*?)\n```/.exec(issue.body);if(!m)return null;
 try{const edit=validateEdit(JSON.parse(m[1]));return {...edit,issue:issue.number,author:issue.user.login,updated:issue.updated_at,url:'https://github.com/asimfish/safelab-handoff/issues/'+issue.number,trusted:['OWNER','MEMBER','COLLABORATOR'].includes(issue.author_association)||labels.includes('safelab-approved')};}catch{return null;}
}
// Scores never migrate into v1 by inference. Evidence and complete denominators are required.
const PROTOCOL='SafeLab-Eval-v1';
function wilson95(success,n){
 if(!Number.isInteger(n)||n<1||!Number.isInteger(success)||success<0||success>n)return null;
 const z=1.959963984540054,p=success/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
 return {low:Math.max(0,c-h),high:Math.min(1,c+h),confidence:0.95};
}
function formalIssues(e){
 const issues=[],count=x=>Number.isInteger(x)&&x>=0;
 if(e.protocol_version!==PROTOCOL||!['A','B'].includes(e.stage))issues.push('非v1阶段A/B');
 if(![4,8].includes(e.horizon))issues.push('仅4/8步');
 if(e.metric_role==='assisted'||/诊断/.test(e.kind||''))issues.push('诊断或辅助指标');
 const n=e.stage==='B'?500:100;
 if(e.trials!==n||e.completed!==n||!count(e.success)||!count(e.unknown)||e.success+e.unknown>n)issues.push('未完成或分母无效');
 if(e.topology?.num_envs_actual!==1||!Number.isInteger(e.topology?.procs_per_gpu)||e.topology.procs_per_gpu<1||!safeText(e.topology?.gpu_type,150)||!e.topology?.gpu_type?.trim())issues.push('拓扑待核验');
 if(e.preprocess_resize?.implementation!=='training_tensor'||e.preprocess_resize?.mode!=='bilinear'||e.preprocess_resize?.antialias!==true||!e.preprocess_resize?.source)issues.push('预处理未对齐');
 if(!e.condition_version||!/^sha256:[a-f0-9]{64}$/.test(e.scene_list_hash||''))issues.push('条件版本或场景哈希缺失');
 const splits=e.lr_split,lr=splits&&[splits.left,splits.right];
 if(!lr||lr.some(x=>!x||x.trials!==n/2||!count(x.success)||!count(x.unknown)||x.success+x.unknown>x.trials)||lr.reduce((a,x)=>a+x.success,0)!==e.success||lr.reduce((a,x)=>a+x.unknown,0)!==e.unknown)issues.push('左右拆分不完整');
 const seeds=e.seed_results;
 if(!Array.isArray(seeds)||seeds.length!==(e.stage==='B'?5:1)||new Set(seeds.map(x=>x.seed)).size!==seeds.length||!seeds.some(x=>x.seed===0)||seeds.some(x=>!count(x.seed)||x.trials!==100||!count(x.success)||!count(x.unknown)||x.success+x.unknown>100)||seeds.reduce((a,x)=>a+x.success,0)!==e.success||seeds.reduce((a,x)=>a+x.unknown,0)!==e.unknown)issues.push('逐seed记录不完整');
 const hist=Object.entries(e.phase_hist||{}),total=hist.reduce((a,[,v])=>a+v,0),mean=hist.reduce((a,[k,v])=>a+Number(k)*v,0)/n;
 if(!hist.length||hist.some(([k,v])=>!/^\d+$/.test(k)||!count(v))||total!==n||!Number.isFinite(e.mean_phase)||Math.abs(mean-e.mean_phase)>1e-6)issues.push('阶段统计不完整');
 if(!['expert_replay','open_loop','render_multiframe','smoke20'].every(k=>e.admission?.[k]?.passed===true&&e.admission[k].report))issues.push('准入证据缺失');
 return issues;
}
function formalComparisons(board){
 const groups=new Map();
 for(const e of evaluationIndex(board)){
  if(formalIssues(e).length)continue;
  // Dataset, view, scene list, stage and condition are separate comparison cohorts.
  const cohort=JSON.stringify([e.task,e.dataset,e.camera,e.stage,e.condition_version,e.scene_list_hash,e.metric||'original_physical',e.preprocess_resize]);
  const key=cohort+'|'+e.method,prior=groups.get(key);
  if(!prior||e.success/e.trials>prior.success/prior.trials||e.success/e.trials===prior.success/prior.trials&&e.mean_phase>prior.mean_phase)groups.set(key,{...e,wilson95:wilson95(e.success,e.trials)});
 }
 return [...groups.values()].sort((a,b)=>Number(a.task)-Number(b.task)||a.dataset.localeCompare(b.dataset)||a.method.localeCompare(b.method)||a.stage.localeCompare(b.stage));
}
function resultFor(evaluations,horizon){
 let rows=evaluations.filter(e=>e.metric_role!=='assisted'&&e.formal_score_eligible!==false&&e.horizon===horizon&&e.success!==null&&e.completed===e.trials&&!/诊断/.test(e.kind));
 const priority=Math.max(...rows.map(e=>e.display_priority||0));rows=rows.filter(e=>(e.display_priority||0)===priority);
 if(!rows.length)return null;
 const five=rows.filter(e=>e.kind==='自主闭环 · 5-seed');
 const chosen=five.length?five:[rows.find(e=>e.id.startsWith('single-')||e.id.endsWith('-single'))||rows.find(e=>e.kind==='自主闭环')||rows[0]];
 return {success:chosen.reduce((s,e)=>s+e.success,0),trials:chosen.reduce((s,e)=>s+e.trials,0),unknown:chosen.reduce((s,e)=>s+e.unknown,0),label:five.length?five.length+'轮汇总':chosen[0].result_label||chosen[0].kind,protocol:chosen[0].protocol,rows:chosen,reported:false};
}
function progressFor(evaluations,horizon){
 const rows=evaluations.filter(e=>e.metric_role!=='assisted'&&e.formal_score_eligible!==false&&e.horizon===horizon&&e.success===null&&Number.isInteger(e.completed)&&Number.isInteger(e.trials)&&e.trials>0&&e.completed>=0&&e.completed<=e.trials);
 return rows.sort((a,b)=>(b.display_priority||0)-(a.display_priority||0)||String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0]||null;
}
function buildBoard(data,edits=[]){
 const datasets=data.datasets.map(d=>({...d,task:TASKS.find(t=>t.versions.includes(d.id))?.id||'other',version:VERSIONS[d.id]||d.label}));
 const rows=[];
 for(const record of data.records){
  for(const w of record.weights.length?record.weights:[null]){
   const evaluations=w?data.evaluations.filter(e=>e.record===record.id&&e.checkpoint===w.step):[];
   const h4=resultFor(evaluations,4),h8=resultFor(evaluations,8),h30=resultFor(evaluations,30);
   const pending=evaluations.filter(e=>e.success===null);
   let state=pending.length?'evaluating':h4||h8||evaluations.some(e=>e.success!==null)?'results':/历史.*核验/.test(w?.status||'')?'verify':w?'untested':/训练中/.test(record.delivery)?'training':'verify';
   rows.push({key:key(record.id,w?.step||0),record,dataset:record.dataset,task:datasets.find(d=>d.id===record.dataset)?.task||(['3','5','7','10'].includes(record.task_hint)?record.task_hint:'other'),camera:CAMERAS[record.camera]?record.camera:'unknown',method:record.method,step:w?.step||0,path:w?.path||'',doc:record.doc||'',state,h4,h8,h30,pending,evaluations,owner:'未指定',run:record.training?.executor_run||'',note:record.note||'',updated:data.updated_at,availability:w?.availability||record.delivery,training:record.training||{},source:record.source,shared:null});
  }
 }
 const ordered=edits.filter(e=>e.trusted).sort((a,b)=>a.updated.localeCompare(b.updated)||a.issue-b.issue);
 for(const e of ordered){
  const resolved=data.handoff_resolutions?.find(r=>r.issue===e.issue&&r.issue_updated_at===e.updated);
  if(resolved?.delivery_document===e.path&&resolved.checkpoint===e.step&&!e.h4&&!e.h8&&!e.h30){
   const canonical=rows.find(r=>r.record?.id===resolved.record&&r.step===e.step&&r.task===e.task&&r.dataset===e.dataset&&r.camera===e.camera&&r.method===e.method);
   if(canonical){Object.assign(canonical,{owner:e.owner||canonical.owner,shared:e});continue;}
  }
  if(resolved&&!e.path&&!e.h4&&!e.h8&&!e.h30&&data.records.some(r=>r.id===resolved.record&&r.weights.some(w=>w.path)))continue;
  let row=e.target?rows.find(r=>r.key===e.target):rows.find(r=>r.key==='issue-'+e.issue||e.path&&r.path===e.path&&r.dataset===e.dataset&&r.camera===e.camera&&r.method===e.method&&r.step===e.step);
  if(e.target&&!row)continue;
  const existingDataset=datasets.find(d=>d.id===e.dataset);
  if(existingDataset&&existingDataset.task!==e.task)continue;
  // Edits to evaluated identities create a new weight; original evidence stays attached.
  if(row&&(row.task!==e.task||row.dataset!==e.dataset||row.camera!==e.camera||row.method!==e.method||row.step!==e.step||row.path&&e.path!==row.path)){
   if(!row.path&&!row.evaluations.length){Object.assign(row,{dataset:e.dataset,task:e.task,camera:e.camera,method:e.method,step:e.step,path:e.path});}
   else row=rows.find(r=>r.key==='issue-'+e.issue)||null;
  }
  if(existingDataset&&e.data_path)existingDataset.path=e.data_path;
  if(!existingDataset&&e.dataset!=='unknown')datasets.push({id:e.dataset,label:e.version,version:e.version,task:e.task,path:e.data_path,episodes:null,frames:null,note:'团队新增版本，数据规模待核对',camera:e.camera});
  if(!row){row={key:'issue-'+e.issue,record:null,dataset:e.dataset,task:e.task,camera:e.camera,method:e.method,step:e.step,path:e.path,doc:e.doc,evaluations:[],pending:[],training:{},availability:'团队新增交付',source:'GitHub共享交接单',h4:null,h8:null,h30:null};rows.push(row);}
  Object.assign(row,{state:e.state,owner:e.owner||'未指定',doc:e.doc,run:e.run,note:e.note,updated:e.updated,shared:e});
  for(const h of ['h4','h8','h30'])if(e[h])row[h]={...parseScore(e[h]),unknown:e[h+'unknown'],label:'团队填报',protocol:e.protocol,rows:[],reported:true};
 }
 return {datasets,diagnostics:data.diagnostics||[],rows:rows.filter(r=>r.path||!rows.some(other=>other!==r&&other.path&&other.dataset===r.dataset&&other.camera===r.camera&&other.method===r.method))};
}
function issueBody(edit){validateEdit(edit);return '## SafeLab 共享交接记录\n\n提交后回到面板点击「同步更新」。修改本单请保留下面的数据块。不要填写密码、Token 或私钥。\n\n```safelab-handoff\n'+JSON.stringify(edit,null,2)+'\n```';}
function evaluationIndex(board){
 const index=[];
 for(const row of board.rows){
  for(const e of row.evaluations)index.push({...e,rowKey:row.key,task:row.task,camera:row.camera,method:row.method,phase:e.success===null?'progress':formalIssues(e).length?'legacy':'formal'});
  for(const horizon of [4,8,30]){const score=row['h'+horizon];if(score?.reported)index.push({id:'shared-'+row.shared.issue+'-'+horizon,rowKey:row.key,task:row.task,dataset:row.dataset,camera:row.camera,method:row.method,checkpoint:row.step,horizon,success:score.success,trials:score.trials,unknown:score.unknown,completed:score.trials,status:'团队填报',kind:'团队共享评测',phase:'reported',protocol:score.protocol,source:row.shared.url,report_url:row.shared.url,note:'团队填报成绩；原始验收证据请见共享交接单。'});}
 }
 for(const d of board.diagnostics){
  const dataset=board.datasets.find(x=>x.id===d.dataset),row=board.rows.find(r=>r.record?.id===d.record&&r.step===d.checkpoint);
  index.push({...d,phase:'diagnostic',rowKey:row?.key||null,task:dataset?.task||'other',camera:d.camera||row?.camera||'unknown'});
 }
 return index;
}
function pendingRows(board){return board.rows.filter(r=>r.path&&r.state==='untested');}
function handoffPacket(board,row){const d=board.datasets.find(d=>d.id===row.dataset);return {task:row.task,method:row.method,dataset_version:d?.version||row.dataset,training_dataset:d?.path||row.shared?.data_path||null,camera:row.camera,checkpoint_step:row.step,checkpoint_path:row.path,delivery_document:row.doc||null,training_run:row.run||null,normalization_hash:row.record?.norm||null,training_config:row.training,owner:row.owner,execution_horizons_to_test:[4,8],test_protocol:'请根据该数据版本的交付文档确认泛化、控制频率和成功验收条件，不沿用其他版本',availability:row.availability,shared_handoff:row.shared?.url||null};}
const api={PROTOCOL,wilson95,formalIssues,formalComparisons,STATES,CAMERAS,TASKS,VERSIONS,key,parseScore,validateEdit,parseIssue,resultFor,progressFor,buildBoard,issueBody,evaluationIndex,pendingRows,handoffPacket};
if(typeof module!=='undefined')module.exports=api;root.HandoffModel=api;
})(typeof window==='undefined'?globalThis:window);
