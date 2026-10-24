"use strict";
(()=>{
const LIVE="https://raw.githubusercontent.com/asimfish/psibot-dashboard/refs/heads/feature/t-535-long-collection/results/long_collection_current.json", SNAP="results/long_collection_current.json";
const $=id=>document.getElementById(id), states={accepted:"完整验收通过",running:"正在采集",failed:"上轮已失败",closed_pending_review:"等待整条验收",awaiting_status:"状态待核",unavailable:"来源不可用"};
let latest=null,busy=false,connectionMode={cached:false,failed:false};
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const number=x=>Number.isInteger(x)&&x>=0;
function validate(d){
 if(!d||d.schema_version!==1||!Array.isArray(d.tasks)||d.tasks.length!==3||new Set(d.tasks.map(t=>t.task)).size!==3)throw Error("Invalid source");
 for(const t of d.tasks){if(!["T3","T5","T7"].includes(t.task)||!number(t.accepted_count)||!number(t.completed_phases)||!Array.isArray(t.phases)||t.completed_phases>t.phases.length||!states[t.state]||!Array.isArray(t.accepted_records)||t.accepted_records.length!==t.accepted_count||!Array.isArray(t.initial_images)||t.initial_images.length!==3||t.whole_accepted&&(!t.accepted_count||t.unknown_usage!==0))throw Error("Invalid task");
  for(const i of t.initial_images)if(!/^media\/long-collection\/t[357]-collect\d+-(head|chest|third)_camera\.png$/.test(i.url)||!/^collect_\d+$/.test(i.run)||!/^[a-f0-9]{64}$/.test(i.sha256))throw Error("Invalid photo");
 }
 if(!d.totals||d.totals.required_tasks!==3||d.totals.accepted_tasks!==d.tasks.filter(t=>t.accepted_count>0).length||d.totals.accepted_episodes!==d.tasks.reduce((n,t)=>n+t.accepted_count,0)||!Number.isFinite(Date.parse(d.published_at))||!Number.isFinite(Date.parse(d.source_updated_at)))throw Error("Invalid totals");return d;
}
function rootQuality(t){
 if(t.task!=="T3"||Object.prototype.hasOwnProperty.call(t,"motion_visual_quality_qualified_count"))return null;
 const title=/本轮新质量(\d+)\/100$/.exec(t.title||""),note=/新质量合格(\d+)\/100：左(\d+)\/50、右(\d+)\/50[。；]/.exec(t.note||"");
 if(!title||!note)return null;
 const total=Number(title[1]),left=Number(note[2]),right=Number(note[3]);
 return total===Number(note[1])&&left<=50&&right<=50&&left+right===total&&total<=100?{total,left,right}:null;
}
// Optional quality fields qualify the display; historical validation/counts stay unchanged.
const hasQuality=t=>Object.prototype.hasOwnProperty.call(t,"motion_visual_quality_qualified_count")||rootQuality(t)!==null;
const qualityCount=t=>rootQuality(t)?.total??(number(t.motion_visual_quality_qualified_count)?t.motion_visual_quality_qualified_count:null);
const qualityHold=t=>hasQuality(t)&&t.whole_accepted===false&&t.new_collection_enabled===false;
function renderQualitySummary(tasks){
 const reported=tasks.some(hasQuality),unknown=tasks.some(t=>qualityCount(t)===null&&(hasQuality(t)||t.accepted_count>0));
 $("qualityEpisodes").textContent=reported&&!unknown?tasks.reduce((n,t)=>n+(qualityCount(t)||0),0)+" 条":"待复核";
 const held=tasks.filter(qualityHold).map(t=>t.task);
 $("qualityNotice").hidden=!held.length;
 $("qualityNotice").textContent=held.length?`${held.join("、")} 暂停采集，动作与画面质量复核中。历史物理记录保留，不表示当前质量合格。`:"";
}
const date=x=>x?new Date(x).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false}):"暂不可用";
function metric(parent,label,value){const row=el("div",undefined,"metric");row.append(el("span",label),el("strong",value));parent.append(row);}
function freshness(cached,failed){if(arguments.length)connectionMode={cached:!!cached,failed:!!failed};cached=connectionMode.cached;failed=connectionMode.failed;if(!latest)return;const age=Date.now()-Date.parse(latest.source_updated_at),publicationAge=Date.now()-Date.parse(latest.published_at);$("connection").textContent=failed?"更新连接暂不可用，保留上次状态":age>600000||publicationAge>600000?"状态记录已过期，请核查采集与发布器":cached?"显示已发布快照，等待自动更新":"自动更新已连接";$("timestamps").textContent=`源记录：${date(latest.source_updated_at)} · 网页发布：${date(latest.published_at)}（北京时间）`;}
function render(d){validate(d);latest=d;$("loadError").hidden=true;$("complete").textContent=d.totals.accepted_tasks+" / 3";$("episodes").textContent=d.totals.accepted_episodes+" 条";renderQualitySummary(d.tasks);$("taskCards").replaceChildren();$("sceneCards").replaceChildren();
 for(const t of d.tasks){const rq=rootQuality(t),held=qualityHold(t),card=el("article",undefined,"task");card.dataset.task=t.task;const head=el("div",undefined,"task-head");head.append(el("span",t.task,"task-id"),el("span",rq?(rq.total===100?"本轮100条验收完成":"本轮质量采集中"):held?"暂停采集 · 质量复核中":states[t.state],"badge "+(rq&&rq.total<100?"running":held?"quality-hold":t.state)));card.append(head,el("h3",t.title));if(hasQuality(t)){const q=el("div",undefined,"quality-line"),n=qualityCount(t);q.append(el("span","当前动作与画面质量合格"),el("strong",n===null?"待复核":rq?`${n} / 100 条`:n+" 条","quality-count"));card.append(q);if(rq){metric(card,"源烧杯初始在左侧",`${rq.left} / 50`);metric(card,"源烧杯初始在右侧",`${rq.right} / 50`);}}const count=el("div");count.append(el("span",String(t.accepted_count),"count"),el("span","条历史物理验收记录","count-label"));card.append(count,el("p",`${rq?"历史轨迹记录":"当前记录"}：${t.run||"待确认"}`,"runline"));metric(card,held||rq?"历史物理阶段":"完成阶段",`${t.completed_phases} / ${t.phases.length}`);const bar=el("progress");bar.max=t.phases.length;bar.value=t.completed_phases;bar.setAttribute("aria-label",t.task+(held?"历史物理阶段":"阶段完成进度"));if(held)bar.className="historical-progress";card.append(bar,el("p",t.phase_basis,"muted"));const phases=el("ol",undefined,"phases");t.phases.forEach((label,i)=>phases.append(el("li",label,i<t.completed_phases?(held?"historical-done":"done"):"")));card.append(phases);metric(card,rq?"历史轨迹模型动作":"已执行模型动作",t.executed==null?"待核":String(t.executed));metric(card,rq?"历史轨迹仿真时间":"原生仿真时间",t.sim_s==null?"待核":Number(t.sim_s).toFixed(1)+" 秒");metric(card,rq?"历史用量未知项":"使用量未知项",t.unknown_usage==null?"待核":String(t.unknown_usage));card.append(el("p",t.note),el("p",(rq?"历史轨迹记录：":"本任务记录：")+date(t.updated_at),"muted"));
  if(t.latest_failed){const f=t.latest_failed,details=el("details");details.append(el("summary",(rq?"历史失败轮次 · ":"最近失败轮次 · ")+f.run),el("p",`完成 ${f.completed_phases}/${f.total_phases} 阶段 · ${f.sim_s.toFixed(1)} 秒 · ${f.executed} 次动作`),el("p",f.reason),el("p","整条失败，已排除于完整验收计数。"),el("p","复核记录 SHA-256："+f.proof_sha256,"proof"));card.append(details);}
  if(t.accepted_records.length){const details=el("details");details.append(el("summary","历史物理验收记录"));for(const r of t.accepted_records)details.append(el("p",r.run+" · "+r.sim_s+" 秒 · "+r.executed+" 次动作"),el("p","清单 SHA-256："+r.proof_sha256,"proof"));card.append(details);}$("taskCards").append(card);
  const scene=el("article",undefined,"scene");scene.append(el("h3",t.task+" · "+t.title),el("p","照片轮次："+t.initial_images[0].run+" · 初始帧 · 640 × 480","muted"));const views=el("div",undefined,"views");for(const i of t.initial_images){const figure=el("figure"),a=el("a"),img=el("img");a.href=i.url;a.target="_blank";a.rel="noopener";img.src=i.url;img.alt=t.task+" "+i.run+" 初始场景 · "+i.view;img.width=640;img.height=480;img.loading="lazy";a.append(img);figure.append(a,el("figcaption",i.view));views.append(figure);}scene.append(views);$("sceneCards").append(scene);
 }$("next").textContent=d.next&&d.next.task?`原队列下一任务：${d.next.task} / ${d.next.run} · ${d.next.native_born?"已启动":"尚未启动"}。${d.next.note}`:"";freshness(false,false);}
async function fetchData(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(url+(url.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store",signal:controller.signal});if(!response.ok)throw Error("Source unavailable");return validate(await response.json());}finally{clearTimeout(timer);}}
async function refresh(){if(busy)return;busy=true;$("refresh").disabled=true;try{render(await fetchData(LIVE));}catch(e){if(latest){freshness(false,true);}else{try{render(await fetchData(SNAP));freshness(true);}catch(e){$("loadError").hidden=false;$("connection").textContent="状态来源不可用";}}}finally{busy=false;$("refresh").disabled=false;}}
$("refresh").addEventListener("click",refresh);refresh();setInterval(refresh,60000);setInterval(()=>{if(latest&&!busy)freshness();},30000);
})();
