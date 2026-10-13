'use strict';
const $=id=>document.getElementById(id);
const live='https://raw.githubusercontent.com/asimfish/psibot-dashboard/feature/t-537-other-task-acceptance/results/other_tasks_current.json';
const labels={SOURCE_STAGING:'正在准备与传输数据',SOURCE_STAGING_STATUS_STALE:'数据传输回执已过期 · 正在检查',SOURCE_VERIFIED_CPU_EXPORT_STARTED:'数据已校验，正在导出三路图像',SOURCE_HASHING:'正在绑定原始数据',EXPORT_COMPLETE_WAITING_FREE_GPU_NO_GPU_ALLOCATION:'数据已就绪，等待空卡',TRAINER_STARTED_PENDING_REAL_UPDATES:'训练进程已启动，等待有效更新',TRAINING_REAL_FINITE_UPDATES:'训练中 · 有效更新',ACT_PAPER_BUDGET_COMPLETED_PENDING_NATIVE50:'训练完成 · 待原生50次测试',BLOCKED_PRESERVED_EVIDENCE:'受阻 · 已保留证据',REMOTE_STATUS_UNAVAILABLE:'远端状态暂不可读'};
let current=null;
const familyOrder=['pour','press','open','close','stack','handover','bimanual_grasp','bimanul_grasp','multi_tools','long_horizon'];
function families(){return [...new Map(current.rows.map(r=>[r.task_type,r.task_label])).entries()].sort((a,b)=>{const ai=familyOrder.indexOf(a[0]),bi=familyOrder.indexOf(b[0]);return(ai<0?99:ai)-(bi<0?99:bi)||a[1].localeCompare(b[1],'zh-CN');});}
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=String(text);if(cls)e.className=cls;return e;}
function date(v){if(!v)return'未知';const d=new Date(typeof v==='number'?v*1000:v);return Number.isFinite(d.getTime())?d.toLocaleString('zh-CN',{hour12:false}):'未知';}
function percent(v){return Number.isFinite(v)?v+'%':'待核对';}
function pair(sr,ssr){return sr===null||ssr===null?'未匹配':sr+' / '+ssr;}
function options(id,values){const s=$(id),old=s.value;s.replaceChildren(node('option',id==='task-filter'?'全部类别':'全部机器人'));s.firstChild.value='all';for(const [value,title]of values){const o=node('option',title);o.value=value;s.append(o);}if([...s.options].some(o=>o.value===old))s.value=old;}
function renderCategories(){
 const root=$('category-list');root.replaceChildren();
 for(const [value,title] of [['all','全部类别'],...families()]){
  const button=node('button',null,'category-button');button.type='button';button.dataset.family=value;
  const count=current.rows.filter(r=>value==='all'||r.task_type===value).length;
  button.append(node('span',title),node('span',count,'category-count'));
  button.addEventListener('click',()=>{$('task-filter').value=value;renderRows();});root.append(button);
 }
}
function taskRow(r){
 const tr=node('tr');tr.dataset.identity=r.identity;let td=node('td');
 td.append(node('span',r.object,'object'),node('span',r.embodiment,'sub'));
 if(r.scope!=='baseline64')td.append(node('span','新增 / 历史目录','sub'));tr.append(td);
 td=node('td');td.append(node('span',r.candidate_episodes===null?'数量待核对':r.candidate_episodes+(r.target_episodes?' / '+r.target_episodes:'')+' 条','metric'),node('span',r.data_acceptance,'sub pending'));tr.append(td);
 for(const method of['dp','act']){td=node('td');td.append(node('span',labels[r[method].status]||r[method].status,'pending'),node('span','SR '+percent(r[method].sr)+' · SSR '+percent(r[method].ssr),'sub'));tr.append(td);}
 for(const method of['dp','act']){td=node('td');td.append(node('span',pair(r.paper[method+'_sr'],r.paper[method+'_ssr']),'metric'));td.append(node('span',r.paper.level==='behavior_aggregate_only'?'类别均值 · 非单项目标':r.paper.level==='instance_receiver_binding_pending'?'Table 18 · 接收容器待绑定':r.paper.table?'Table '+r.paper.table:'论文身份待绑定','sub'));tr.append(td);}
 td=node('td');td.append(node('span',r.generalization_status));
 if(r.next_required?.length){const detail=node('details'),summary=node('summary','待解决事项'),list=node('ul');for(const item of r.next_required)list.append(node('li',item));detail.append(summary,list);td.append(detail);}tr.append(td);return tr;
}
function renderRows(){
 if(!current)return;
 const family=$('task-filter').value,robot=$('robot-filter').value,search=$('search').value.trim().toLowerCase();
 const matches=current.rows.filter(r=>(family==='all'||r.task_type===family)&&(robot==='all'||r.embodiment===robot)&&(!search||r.object.toLowerCase().includes(search)));
 const root=$('task-rows');root.replaceChildren();let groupCount=0;
 for(const [value,title] of families()){
  const rows=matches.filter(r=>r.task_type===value).sort((a,b)=>a.embodiment.localeCompare(b.embodiment)||a.object.localeCompare(b.object));if(!rows.length)continue;groupCount++;
  const group=node('section',null,'task-group');group.dataset.family=value;
  const heading=node('div',null,'group-heading');heading.append(node('h3',title),node('span',rows.length+' 个条目','pill'));group.append(heading);
  const rules=[...new Set(rows.map(r=>r.ssr_rule))];group.append(node('p',rules.join('；'),'group-rule'));
  const wrap=node('div',null,'table-wrap');wrap.tabIndex=0;wrap.setAttribute('aria-label',title+'任务验收表');
  const table=node('table',null,'tasks-table'),head=node('thead'),header=node('tr');
  for(const title of ['物体 / 机器人','候选数据','DP','ACT','论文 DP · SR / SSR','论文 ACT · SR / SSR','泛化 / 待办']){const th=node('th',title);th.scope='col';header.append(th);}head.append(header);table.append(head);
  const body=node('tbody');for(const row of rows)body.append(taskRow(row));table.append(body);wrap.append(table);group.append(wrap);root.append(group);
 }
 for(const b of $('category-list').querySelectorAll('button')){const selected=b.dataset.family===family;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));}
 $('row-count').textContent=groupCount+' 类 · '+matches.length+' 个条目';$('empty').hidden=matches.length!==0;
}
function renderJobs(data){
 const root=$('jobs');root.replaceChildren();
 const complete=data.jobs.filter(j=>j.status==='ACT_PAPER_BUDGET_COMPLETED_PENDING_NATIVE50').length;
 $('job-count').textContent=data.jobs.length+' 个作业 · '+complete+' 个训练完成';
 if(!data.jobs.length){root.append(node('p','正在核对模型与就绪的数据，尚未计入有效训练。','muted'));return;}
 for(const j of data.jobs){
  const box=node('article',null,'job'),placement=j.gpu_allocated===true?'GPU '+j.gpu:j.status==='ACT_PAPER_BUDGET_COMPLETED_PENDING_NATIVE50'?'训练时 GPU '+j.gpu:'计划 GPU '+j.gpu;
  box.append(node('strong',j.identity),node('span',(j.method||'ACT').toUpperCase()+' · seed '+(j.seed??'待核对')+' · '+j.host+' · '+placement,'sub'),node('p',labels[j.status]||j.status));
  let fraction=null;
  if(Number.isFinite(j.optimizer_updates)&&j.required_updates>0){box.append(node('p',j.optimizer_updates+' / '+j.required_updates+' 次优化更新'));fraction=j.optimizer_updates/j.required_updates;}
  else if(Number.isFinite(j.completed_episodes))box.append(node('p','已导出 '+j.completed_episodes+' / 100 条'));
  else if(Number.isFinite(j.source_bytes)&&j.required_source_bytes>0){
   box.append(node('p',(j.source_bytes/1048576).toFixed(1)+' / '+(j.required_source_bytes/1048576).toFixed(1)+' MiB · 分块校验已确认'));fraction=j.source_bytes/j.required_source_bytes;
  }
  if(fraction!==null){const bar=node('div',null,'bar'),fill=node('span');fill.style.width=Math.max(0,Math.min(100,100*fraction))+'%';bar.append(fill);box.append(bar);}
  box.append(node('span','证据时间 '+date(j.at),'sub'));
  if(j.remote_observation==='unavailable')box.append(node('span','当前连接暂不可读；保留已核验的训练完成记录','sub pending'));root.append(box);
 }
}
function renderFleet(data){const root=$('fleet');root.replaceChildren();for(const host of data.fleet){const box=node('article',null,'host'),head=node('div',null,'host-head');head.append(node('strong',host.host),node('span',host.status==='observed'?date(host.observed_at):'连接暂不可读','muted'));box.append(head);if(!host.cards.length)box.append(node('p','暂时没有实时显卡读数。','offline'));else{const wrap=node('div',null,'table-wrap'),table=node('table'),thead=node('thead'),hr=node('tr');for(const title of['GPU','利用率','显存 GiB','当前作业'])hr.append(node('th',title));thead.append(hr);table.append(thead);const body=node('tbody');for(const c of host.cards){const tr=node('tr');tr.append(node('td',c.index));let td=node('td');const util=node('div',null,'util'),meter=node('span',null,'meter'),fill=node('span'),value=Number(c.utilization);fill.style.width=Number.isFinite(value)?Math.max(0,Math.min(100,value))+'%':'0%';meter.append(fill);util.append(meter,node('span',Number.isFinite(value)?value+'%':'未知'));td.append(util);tr.append(td,node('td',(Number(c.used_mib)/1024).toFixed(1)+' / '+(Number(c.total_mib)/1024).toFixed(1)),node('td',c.work));body.append(tr);}table.append(body);wrap.append(table);box.append(wrap);}root.append(box);}}
function render(data,archived){if(!data||data.schema_version!==1||!Array.isArray(data.rows)||!Array.isArray(data.fleet)||!Array.isArray(data.jobs)||!data.summary||!data.paper)throw new Error('invalid status');current=data;$('baseline').textContent=data.summary.baseline_identities;$('catalog').textContent=data.summary.catalog_identities;$('accepted').textContent=data.summary.accepted;$('paper-link').href=data.paper.url?.startsWith('https://raw.githubusercontent.com/mlresearch/')?data.paper.url:'#';$('pro-policy').textContent=data.pro6000_policy;$('evidence-time').textContent='目录原门证据快照：'+date(data.evidence_as_of);const age=(Date.now()-Date.parse(data.generated_at))/1000;$('freshness').textContent=(archived?'存档快照 · ':age>300?'更新已过期 · ':'最新读取 · ')+date(data.generated_at);options('task-filter',families());options('robot-filter',[...new Set(data.rows.map(r=>r.embodiment))].map(v=>[v,v]));renderCategories();renderRows();renderJobs(data);renderFleet(data);$('load-error').hidden=!archived;$('load-error').textContent=archived?'实时状态暂不可读，正在显示存档；存档不代表当前任务或资源状态。':'';}
async function fetchStatus(url){const controller=new AbortController(),t=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!r.ok)throw new Error('unavailable');return await r.json();}finally{clearTimeout(t);}}
async function refresh(){try{render(await fetchStatus(live),false);}catch{try{render(await fetchStatus('results/other_tasks_current.json'),true);}catch{$('load-error').hidden=false;$('load-error').textContent='进度暂不可读取；保留已显示的快照，请稍后刷新。';$('freshness').textContent='读取失败 · 当前状态未知';}}}
for(const id of['task-filter','robot-filter'])$(id).addEventListener('change',renderRows);$('search').addEventListener('input',renderRows);refresh();setInterval(refresh,60000);
