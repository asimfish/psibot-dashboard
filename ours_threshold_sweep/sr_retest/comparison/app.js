(() => {
'use strict';
const base=new URL('comparison/',location.href),M=window.HandoffModel,$=id=>document.getElementById(id);
let board,media=[],staticMedia=[],snapshot,lastIssues=null,loading=false;const players=[];
const kind=m=>/mem[ -]?0/i.test(m)?'mem0':/ours|ttc|对齐/i.test(m)?'ours':null;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
const option=(value,label)=>{const n=el('option',label);n.value=value;return n;};
async function json(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP '+r.status+' · '+url);return r.json();}
function urlLink(label,url){const a=el('a',label);const u=new URL(url,base);if(!['http:','https:'].includes(u.protocol))return el('span','无公开链接');a.href=u.href;a.target='_blank';a.rel='noopener';return a;}
function currentRows(){return board.rows.filter(r=>r.task===$('multiTask').value&&kind(r.method)&&($('multiDataset').value==='all'||r.dataset===$('multiDataset').value)&&($('multiMethod').value==='all'||kind(r.method)===$('multiMethod').value));}
function datasetFilter(){const old=$('multiDataset').value,rows=board.datasets.filter(d=>d.task===$('multiTask').value);$('multiDataset').replaceChildren(option('all','全部数据版本'),...rows.map(d=>option(d.id,d.version)));if(rows.some(r=>r.id===old))$('multiDataset').value=old;render();}
function appendEvaluation(row,e){
 const tr=el('tr'),title=el('td'),data=board.datasets.find(d=>d.id===row.dataset);title.append(el('strong',row.method),el('div',(data?.version||row.dataset)+' · '+M.CAMERAS[row.camera]+' · '+(row.step?row.step/1000+'k':'权重待核验')));
 const completed=Number.isInteger(e.completed)?e.completed:0,total=e.trials,diagnostic=e.metric_role==='diagnostic'||/诊断|候选|已知环境差异/.test(e.kind||''),verified=!diagnostic&&e.success!==null&&Number.isInteger(e.success)&&completed===total&&e.final_verified!==false;
 const count=total?completed+'/'+total+(Number.isInteger(e.audited)?' · 验收 '+e.audited:''):'待建立清单',sr=verified?(100*e.success/total).toFixed(1)+'% · '+e.success+'/'+total+(e.unknown?' · U='+e.unknown:''):(diagnostic?'诊断记录，不作正式成绩':e.status?e.status+' · 尚无正式成绩':row.state==='evaluating'?'评测中 / 尚无正式成绩':(M.STATES[row.state]||'待核验'));
 tr.append(title,el('td',e.horizon||'4 / 8（待确认）'),el('td',e.result_label||e.condition||e.kind||M.STATES[row.state]),el('td',count),el('td',sr));
 const detail=el('td'),details=el('details'),summary=el('summary','查看条件 / 数据 / 权重');details.append(summary,el('p',e.protocol||'尚未发布本配置测试协议'),el('p','数据：'+(data?.path||row.shared?.data_path||'待核验')),el('p','权重：'+(row.path||'待核验')),el('p','交付说明：'+(row.doc||'待补充')),el('p',e.note||row.note||''),el('p','本组更新时间：'+(e.updated_at||snapshot.updated_at||'未标明')));
 const seeds=e.per_seed||e.seeds;if(seeds?.length)details.append(el('pre',seeds.map(s=>'seed '+(s.evaluation_seed??s.run_seed??s.repeat)+' · '+(s.audited??s.completed??0)+'/'+(s.target||100)+(verified&&s.successes!==undefined?' · S='+s.successes:'')).join('\n')));
 detail.append(details);const source=e.report_url||row.shared?.url||(typeof e.source==='string'&&e.source.startsWith('http')?e.source:null);if(source)detail.append(urlLink('来源',source));tr.append(detail);$('multiRows').append(tr);
}
function render(){
 $('multiRows').replaceChildren();const rows=currentRows();for(const r of rows){const groups=new Map();for(const e of r.evaluations.filter(e=>[4,8,30].includes(e.horizon))){const key=e.kind==='自主闭环 · 5-seed'?JSON.stringify([e.kind,e.horizon,e.protocol?.replace(/第[1-5]组/g,'五轮汇总'),e.condition,e.metric]):e.id;const g=groups.get(key)||[];g.push(e);groups.set(key,g);}const es=[...groups.values()].map(g=>g.length===1?g[0]:({...g[0],completed:g.reduce((n,e)=>n+(e.completed||0),0),trials:g.reduce((n,e)=>n+e.trials,0),success:g.length===5&&g.every(e=>e.success!==null&&e.completed===e.trials)?g.reduce((n,e)=>n+e.success,0):null,unknown:g.reduce((n,e)=>n+(e.unknown||0),0),per_seed:g.map((e,i)=>({evaluation_seed:e.model_seed??e.run_seed??i,completed:e.completed,target:e.trials,successes:e.success})),note:g.length+'轮已发布种子结果汇总。'+(g[0].note||'')}));if(!es.length)appendEvaluation(r,{success:null,horizon:null,protocol:r.shared?.protocol,kind:M.STATES[r.state]});else for(const e of es)appendEvaluation(r,e);
 for(const h of [4,8,30])if(r['h'+h]?.reported){const s=r['h'+h];appendEvaluation(r,{horizon:h,success:s.success,trials:s.trials,completed:s.trials,unknown:s.unknown,kind:'团队填报（原始证据见交接单）',protocol:s.protocol,report_url:r.shared.url});}}
 if(!rows.length){const tr=el('tr'),td=el('td','暂无已登记配置；不会用其他任务的成绩填充。');td.colSpan=6;tr.append(td);$('multiRows').append(tr);}for(const p of players)p.refresh();
}
function makePlayer(method){
 const wrap=el('article');wrap.className='compare-view';const left=el('div'),right=el('div'),select=el('select'),video=el('video'),canvas=el('canvas'),caption=el('p'),status=el('p'),cursor=el('p'),links=el('p'),title=el('h3',method==='ours'?'Ours / TTC':'Mem-0');
 select.setAttribute('aria-label',title.textContent+'视频案例');canvas.setAttribute('aria-label',title.textContent+'切换分数曲线');video.controls=true;video.playsInline=true;video.preload='metadata';left.append(title,select,caption,video,links);right.append(el('h3','切换分数 · 实际切换 · 播放位置'),canvas,cursor,status);wrap.append(left,right);$('multiViewers').append(wrap);
 let rows=[],chosen=null,serial=0,fps=15,threshold=null,maxFrame=1;
 function draw(){const w=Math.max(260,canvas.clientWidth||500),h=230,dpr=devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);const x=f=>35+f/maxFrame*(w-50),y=v=>15+(1-v)*180;c.fillStyle='#afbdcd';c.font='11px system-ui';for(const v of [0,.25,.5,.75,1]){c.strokeStyle='#405063';c.beginPath();c.moveTo(35,y(v));c.lineTo(w-15,y(v));c.stroke();c.fillText(v,2,y(v)+4);}if(Number.isFinite(threshold)){c.strokeStyle='#f4cf80';c.setLineDash([5,4]);c.beginPath();c.moveTo(35,y(threshold));c.lineTo(w-15,y(threshold));c.stroke();c.setLineDash([]);}c.strokeStyle='#94cfff';c.beginPath();let prior=null;for(const r of rows){if(!Number.isFinite(r.completion_score)){prior=null;continue;}if(prior===null||prior!==r.input_position)c.moveTo(x(r.frame),y(r.completion_score));else c.lineTo(x(r.frame),y(r.completion_score));prior=r.input_position;}c.stroke();for(const r of rows.filter(r=>r.actual_switch)){c.strokeStyle='#ffabb4';c.beginPath();c.moveTo(x(r.frame),15);c.lineTo(x(r.frame),195);c.stroke();}const f=Math.max(0,(video.currentTime-(chosen?.offset||0))*fps);c.strokeStyle='#ffffff';c.beginPath();c.moveTo(x(Math.min(f,maxFrame)),15);c.lineTo(x(Math.min(f,maxFrame)),195);c.stroke();c.fillStyle='#afbdcd';c.fillText('0 s',35,220);c.fillText((maxFrame/fps).toFixed(1)+' s',w-70,220);const r=rows.filter(r=>r.frame<=f).at(-1);cursor.textContent='播放 '+video.currentTime.toFixed(2)+' s'+(r?' · frame '+r.frame+' · 分数 '+(Number.isFinite(r.completion_score)?r.completion_score.toFixed(5):'缺失')+' · 指令位置 '+((r.input_position??0)+1):' · 没有逐帧分数');}
 async function choose(){const token=++serial;video.pause();video.removeAttribute('src');video.load();rows=[];chosen=media.find(c=>c.id===select.value);caption.textContent='';links.replaceChildren();status.textContent='';threshold=null;maxFrame=1;draw();if(!chosen)return;const c=chosen;caption.textContent=c.label+' · '+c.outcome+' · '+(c.step?c.step/1000+'k':'权重待核验')+' / '+(c.horizon?c.horizon+'步':'步数待核验')+'。'+c.protocol;video.src=new URL(c.video,base);links.append(urlLink('原录像',c.video),document.createTextNode(' · '),urlLink('来源',c.source));video.onerror=()=>{if(token===serial)caption.textContent=c.label+' · 视频加载失败，请检查原录像链接。'+c.protocol;};try{if(c.trace){const d=await json(new URL(c.trace,base));if(token!==serial)return;rows=d.rows||[];const hasScores=rows.some(r=>Number.isFinite(r.completion_score));threshold=hasScores?(c.threshold??rows.find(r=>Number.isFinite(r.threshold))?.threshold):null;status.textContent=hasScores?'蓝线：真实完成分数（跨指令断线）；黄虚线：阈值；红线：实际切换；白线：播放位置。缺失分数不补零。'+(c.trace_note||''):'原日志没有数值完成分数；只显示真实切换事件（红线）和播放位置（白线），不构造分数曲线。';links.append(document.createTextNode(' · '),urlLink('逐帧分数 JSON',c.trace));}else if(c.timeline){const d=await json(new URL(c.timeline,base));if(token!==serial)return;fps=d.fps||15;rows=(d.segments||[]).map((s,i)=>({frame:s.frame,input_position:s.stage,completion_score:null,actual_switch:i>0}));status.textContent='该录像已发布指令切换时间，尚未发布逐帧分数；仅画真实切换事件，不构造分数曲线。';links.append(document.createTextNode(' · '),urlLink('真实指令时间轴',c.timeline));}else status.textContent='本页尚未接入该录像的逐帧切换分数；保留空图。';maxFrame=Math.max(1,...rows.map(r=>r.frame),Number.isFinite(video.duration)?Math.round(video.duration*fps):1);draw();}catch(e){if(token===serial)status.textContent='分数/时间轴读取失败：'+e.message;}}
 function refresh(){const ids=new Set(currentRows().filter(r=>kind(r.method)===method).map(r=>r.record?.id||r.key));const cases=media.filter(c=>($('multiMethod').value==='all'||$('multiMethod').value===method)&&c.task===$('multiTask').value&&c.method===method&&(ids.has(c.record)||c.identity_verified===false));const old=select.value;select.replaceChildren(...cases.map(c=>option(c.id,c.label)));if(!cases.length)select.append(option('','本页尚无对应配置录像'));if(cases.some(c=>c.id===old))select.value=old;else if(method==='ours'&&cases.some(c=>c.trace))select.value=cases.find(c=>c.trace).id;const next=media.find(c=>c.id===select.value);if(chosen&&next&&chosen.id===next.id&&chosen.video===next.video&&chosen.trace===next.trace)return;choose();}
 video.ontimeupdate=draw;video.onloadedmetadata=()=>{maxFrame=Math.max(maxFrame,Math.round(video.duration*fps));draw();};select.onchange=choose;canvas.onclick=e=>{if(!chosen||!Number.isFinite(video.duration))return;const f=Math.max(0,Math.min(1,(e.offsetX-35)/(canvas.clientWidth-50)))*maxFrame;video.currentTime=Math.min(video.duration,f/fps+(chosen.offset||0));draw();};new ResizeObserver(draw).observe(canvas);return {refresh};
}
const progressBase='https://asimfish.github.io/safelab-handoff/';
function syncMedia(data){
 const found=[];let unrecognized=0;
 for(const campaign of data.campaigns||[])for(const ex of campaign.examples||[]){
  if(campaign.id!=='task10-new-variants-20261102'){unrecognized++;continue;}
  const m=/^task10_(mem0_weak|ours_aligned)_(off|stable_grasp_fixed_joint_v2_solver128)_s(\d+)_h(4|8|30)_o(12345|54321)_seed(\d+)$/.exec(ex.case_id||'');
  if(!m||typeof ex.relative_url!=='string'||ex.method!==m[1]||ex.execution_horizon!==Number(m[4])||ex.seed!==Number(m[6])||ex.grasp_attachment!==m[2]||!['chest','third'].includes(ex.camera)){unrecognized++;continue;}
  const source=campaign.report_url||progressBase+'reports/'+campaign.id+'.html';
  const video=new URL(ex.relative_url,new URL('reports/'+campaign.id+'.json',progressBase));
  if(video.origin!==new URL(progressBase).origin||!video.pathname.startsWith('/safelab-handoff/videos/')){unrecognized++;continue;}
  const attached=m[2]!=='off',record='10-'+(m[1]==='mem0_weak'?'mem0-weak':'ours-aligned')+(attached?'-attach':'');
  if(!data.records.some(r=>r.id===record&&r.weights.some(w=>w.step===Number(m[3])))){unrecognized++;continue;}
  found.push({id:ex.case_id+'_'+ex.camera,task:'10',record,method:m[1]==='mem0_weak'?'mem0':'ours',step:Number(m[3]),horizon:Number(m[4]),outcome:ex.success===true?'success':ex.success===false?'failure':'unknown',label:(m[1]==='mem0_weak'?'Mem-0 削弱版':'Ours 对齐loss')+' · '+(attached?'稳抓附着 v2':'原接触')+' · '+(ex.camera==='chest'?'chest策略输入':'第三人称旁观')+' · seed '+ex.seed,video:video.href,source,protocol:'随进度站更新的代表案例；不替代整组正式成绩。策略使用chest，第三人称仅旁观。'+(attached?'附着条件：原生固定关节 v2 / 求解器128。':'原物理接触。')+'失败记录：'+(ex.failure_reason||'未注明'),source_video_sha256:ex.sha256,identity_verified:true});
 }
 const unique=new Map();for(const c of [...staticMedia,...found])unique.set(c.id,c);media=[...unique.values()];return {added:found.length,unrecognized};
}
async function readIssues(){
 const all=[];for(let page=1;page<=5;page++){const batch=await json('https://api.github.com/repos/asimfish/safelab-handoff/issues?state=all&per_page=100&page='+page);if(!Array.isArray(batch))throw Error('交接单格式无效');all.push(...batch);if(batch.length<100)return all;}throw Error('交接单分页超过上限');
}
async function load(){
 if(loading)return;loading=true;const button=$('multiRefresh');button.disabled=true;$('multiError').textContent='';
 try{
  const results=await Promise.allSettled([json(progressBase+'data.json'),readIssues()]);let data,issues;const warnings=[];
  if(results[0].status==='fulfilled')data=results[0].value;else{data=await json(new URL('snapshot.json',base));warnings.push('进度站暂不可达，使用本页进度快照');}
  if(results[1].status==='fulfilled'){issues=results[1].value;lastIssues=issues;}else{issues=lastIssues||await json(new URL('issues.json',base));warnings.push('交接单暂不可达，保留最近记录；进度数据独立同步');}
  if(data.schema_version!==1||!Array.isArray(data.records)||!Array.isArray(data.evaluations))throw Error('进度站数据格式不正确');
  snapshot=data;const edits=issues.map(M.parseIssue).filter(Boolean);board=M.buildBoard(data,edits);
  // Explicitly requested, unapproved handoffs are inventory only. Canonical
  // published records supersede matching handoff documents without duplicate rows.
  for(const e of edits.filter(e=>[17,18,19,20,21].includes(e.issue)&&!e.trusted)){
   if(board.rows.some(r=>r.shared?.issue===e.issue||r.task===e.task&&r.dataset===e.dataset&&r.method===e.method&&r.step===e.step&&(r.doc===e.doc||r.path===e.path)))continue;
   board.rows.push({key:'inventory-'+e.issue,record:null,task:e.task,dataset:e.dataset,camera:e.camera,method:e.method,step:e.step,path:'',doc:e.doc,state:'verify',evaluations:[],shared:{...e,h4:'',h8:'',h30:''},note:'用户指定交接入口；相机、实际权重和运行结果待核验。'+e.note});
  }
  const assets=syncMedia(data);$('multiStatus').textContent=(results[0].status==='fulfilled'?'已同步进度站':'本页进度快照')+' · 数据时间 '+data.updated_at+' · 共 '+board.rows.filter(r=>kind(r.method)&&['3','5','7','10'].includes(r.task)).length+' 个方法/权重配置。每5分钟或手动同步配置、成绩、状态及进度站案例；当前接入'+assets.added+'段进度站新录像。只有全部完成且有正式成绩的评测显示成功率。';
  if(assets.unrecognized)warnings.push(assets.unrecognized+'条新素材的配置映射尚待核验，未混入案例');$('multiError').textContent=warnings.join('；');datasetFilter();
 }catch(e){$('multiError').textContent='配置载入失败：'+e.message;}
 finally{loading=false;button.disabled=false;}
}
(async()=>{const d=await json(new URL('media.json',base));staticMedia=d.cases;media=staticMedia;players.push(makePlayer('ours'),makePlayer('mem0'));$('multiTask').onchange=datasetFilter;for(const id of ['multiDataset','multiMethod'])$(id).onchange=render;$('multiRefresh').onclick=load;await load();setInterval(()=>{if(!document.hidden)load();},300000);})().catch(e=>$('multiError').textContent=e.message);
})();
