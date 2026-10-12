import fs from 'node:fs';
const [port,out]=process.argv.slice(2);
const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
let seq=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(pending.has(m.id)){const [ok,no]=pending.get(m.id);pending.delete(m.id);m.error?no(Error(JSON.stringify(m.error))):ok(m.result);}});
await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});
const call=(method,params={})=>{const id=++seq,p=new Promise((ok,no)=>pending.set(id,[ok,no]));ws.send(JSON.stringify({id,method,params}));return p;};
async function ev(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const checks=[];function check(name,passed){checks.push({name,passed});if(!passed)throw Error(name);}
async function selectTask(task){await ev(`(()=>{const e=document.getElementById('formal-task-select');e.value=${JSON.stringify(task)};e.dispatchEvent(new Event('change'));})()`);}
async function selectCase(trial){await ev(`(()=>{const e=document.getElementById('formal-select');e.value=${JSON.stringify(trial)};e.dispatchEvent(new Event('change'));document.getElementById('formal-detail').scrollIntoView();document.querySelectorAll('#formal-cameras img').forEach(i=>i.loading='eager');})()`);}
await call('Runtime.enable');await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
await call('Page.reload',{ignoreCache:true});
const deadline=Date.now()+25000;
while(Date.now()<deadline&&!await ev('window.astraStudyReady===true'))await new Promise(r=>setTimeout(r,200));
check('report loads without error',await ev('window.astraStudyReady===true&&document.getElementById("load-error").hidden'));
check('47 accepted / 325 replies / 0 completed cohorts displayed',await ev('document.getElementById("formal-progress").textContent.includes("47 / 1000")&&document.getElementById("formal-progress").textContent.includes("325")&&document.getElementById("formal-progress").textContent.includes("0 / 50")'));
check('current protocol and progress links resolve to47-case successors',await ev(`(async()=>{const p=await(await fetch('results/astra/protocol_executed_20261012.json')).json(),s=await(await fetch('results/astra/supplementary_execution_status_20261012.json')).json();return p.budgets.long_task.max_requests===60&&p.budgets.long_task.max_action_s===90&&p.budgets.long_task.max_wall_s===7200&&s.actual_formal_trials===47&&s.model_transport.accepted_formal_native_responses===325&&s.resource_policy.max_concurrent_gpu_jobs===1&&!!document.querySelector('a[href="results/astra/protocol_executed_20261012.json"]')&&!!document.querySelector('a[href="results/astra/supplementary_execution_status_20261012.json"]');})()`));
for(const [task,n,cases] of [['fr3_place',13,36],['psi_grasp',13,6],['psi_pick_place_100ml',12,3],['psi_roundtrip_100ml',12,2]]){
 await selectTask(task);
 check(task+' complete condition rows and accepted cases',await ev(`document.querySelectorAll('#formal-matrix tbody tr').length===${n}&&document.querySelectorAll('#formal-select option').length===${cases}`));
}
await selectTask('fr3_place');await selectCase('v5-fr3_place-11001-rgb_half_resolution');
await ev('Promise.all([...document.querySelectorAll("#formal-cameras img")].map(i=>i.decode()))');
check('half-resolution actual model PNGs are320x240, four views',await ev('document.querySelectorAll("#formal-cameras img").length===4&&[...document.querySelectorAll("#formal-cameras img")].every(i=>i.naturalWidth===320&&i.naturalHeight===240)&&document.getElementById("formal-inputs").textContent.includes("320×240")'));
await selectCase('v5-fr3_place-11000-minus_wrist');
check('deleted wrist marked evaluation only; actual inputs three',await ev('document.querySelectorAll("#formal-cameras .withheld-camera").length===1&&document.getElementById("formal-inputs").textContent.includes("3 路 RGB")'));
await selectTask('psi_roundtrip_100ml');await selectCase('v5-psi_roundtrip_100ml-11000-minus_S');
await ev('Promise.all([...document.querySelectorAll("#formal-cameras img")].map(i=>i.decode()))');
check('roundtrip partial2/4 remains physical failure',await ev('document.getElementById("formal-status").textContent.includes("2/4")&&document.getElementById("formal-status").textContent.includes("失败")'));
check('Psi long task three views and hand library contract',await ev('document.querySelectorAll("#formal-cameras article").length===3&&document.getElementById("formal-inputs").textContent.includes("SafeLab 5种手势库")'));
check('normal second pickup not retry; actual time retained',await ev('document.getElementById("formal-timing").textContent.includes("2 / 0")&&document.getElementById("formal-timing").textContent.includes("36.01 分钟")'));
await ev('Promise.all([...document.querySelectorAll("#formal-cameras video")].map(v=>{v.muted=true;return v.play()}))');
await new Promise(r=>setTimeout(r,1200));
check('all three new original videos play',await ev('[...document.querySelectorAll("#formal-cameras video")].every(v=>v.videoWidth===640&&v.videoHeight===480&&v.currentTime>0&&!v.error)'));
check('input PNG and matching original video are adjacent',await ev('[...document.querySelectorAll("#formal-cameras article")].every(a=>a.querySelector("img").src.split("/").slice(-2,-1)[0]===a.querySelector("video").src.split("/").slice(-2,-1)[0])'));
await ev('document.querySelectorAll("video").forEach(v=>v.pause());document.getElementById("formal-cameras").scrollIntoView()');
let shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/report-roundtrip-desktop.png',Buffer.from(shot.data,'base64'));
await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await ev('document.getElementById("formal-detail").scrollIntoView()');
check('mobile body fits; table uses own horizontal scroll',await ev('document.documentElement.scrollWidth<=391&&document.getElementById("formal-matrix").scrollWidth>document.getElementById("formal-matrix").clientWidth'));
shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(out+'/report-roundtrip-mobile.png',Buffer.from(shot.data,'base64'));
check('no runtime exceptions',errors.length===0);
fs.writeFileSync(out+'/PUBLIC_REPORT_BROWSER_VALIDATION_20261012.json',JSON.stringify({passed:true,checks,at:new Date().toISOString(),runtime_errors:errors},null,2)+'\n');
ws.close();console.log(JSON.stringify({passed:true,checks:checks.length}));
