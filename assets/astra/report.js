'use strict';
(() => {
  const $=id=>document.getElementById(id), esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={rich:'全部 S/J/K/F/H',minus_S:'去末端位姿与开口 S',minus_J:'去关节角 / 速度 J',minus_K:'去相机标定 K',minus_F:'去数值执行误差 F',minus_H:'去历史图像 / 动作 H',rgb_only:'当前 RGB＋共同文字'};
  const protocols={robosuite:'Panda / robosuite',fr3_input_dependency:'FR3 输入消融 pilot',fr3_long1:'FR3 长程案例',psibot_e3:'PsiBot E3',psibot_input_pilot:'PsiBot 输入 pilot',psibot_input_recovery:'PsiBot 恢复案例',psibot_wrist_relative:'PsiBot 相对控制',campaign20:'20×7 新批次结果', '100ml_development_demonstration':'100ml 往返开发案例'};
  const safeURL=u=>typeof u==='string'&&(/^(https:\/\/)/.test(u)||/^(assets\/astra\/|results\/astra\/)/.test(u))?u:null;
  const status=x=>x===true?'success':x===false?'failure':'interrupted';
  const statusLabel=x=>x===true?'成功':x===false?'失败':'中断 / 未有有效终态';
  const badge=x=>`<span class="status ${status(x)}">${statusLabel(x)}</span>`;
  function interval(k,n){if(!n)return '未有有效分母';const z=1.959963984540054,p=k/n,b=1+z*z/n,c=(p+z*z/(2*n))/b,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/b;return `Wilson 95% CI ${((c-h)*100).toFixed(1)}–${((c+h)*100).toFixed(1)}%`;}
  let report,episodes,traces,study='robosuite',page=0,matrixFilter=null;
  const perPage=20;
  function table(headers,rows,caption='',cls=''){return `<div class="table-wrap"><table class="${cls}">${caption?`<caption>${caption}</caption>`:''}<thead><tr>${headers.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
  function cell(r){const rate=r.successes/r.n*100;return `<button class="result-cell ${rate===0?'zero':''}" data-task="${esc(r.task)}" data-condition="${esc(r.interface+'/'+r.observation)}" aria-label="${esc(r.task)} ${r.interface}/${r.observation}：${r.successes}/${r.n}，查看这20回合"><b>${r.successes}/${r.n}</b><span class="cell-rate">${rate.toFixed(0)}%</span><span class="mini-bar"><i style="width:${rate}%"></i></span><small>95% CI ${r.ci95[0].toFixed(1)}–${r.ci95[1].toFixed(1)}%</small></button>`;}
  function drawResults(){
    let html='';
    if(study==='robosuite'){
      const conditions=[['delta','proprio'],['waypoint','none'],['waypoint','proprio'],['code','proprio'],['code','privileged']];
      html=`<h3>Panda：标准抓起、搬运与插装</h3><p class="study-meta">gpt-6-astra · medium · 服务器 prompt v3 · 每条件20回合 · 300回合主矩阵</p>`;
      html+=table(['任务','delta<br>本体输入','waypoint<br>低信息','waypoint<br>本体输入','code<br>本体输入','code<br>特权状态'],['Lift','Can','Square'].map(task=>[`<b>${task}</b><small>${{Lift:'抓起',Can:'搬运',Square:'插装'}[task]}</small>`,...conditions.map(([i,o])=>cell(report.robosuite_main_runs.find(x=>x.task===task&&x.interface===i&&x.observation===o)))]),'表 2 · SR 与 Wilson 95% 区间。点选单元格可查看对应20回合。','matrix');
      html+=`<p class="study-meta">脚本上界：三任务各20/20；随机下界：三任务各0/20。两者不属于 Astra 回合。</p><div class="study-note">低信息不等于严格纯视觉；本体输入也带标定、辅助或先验。code 允许生成控制程序，预算与短动作接口不同。早期 Mac prompt v1/v2 的70回合只保留在台账，未混入这300回合。</div>`;
    }else if(study==='e3'){
      html=`<h3>SafeLab E3：平台与任务分开统计</h3><p class="study-meta">历史聚合结果 · 保留原分母 · 推理档位有同10个seed的子集对照</p>`;
      html+=table(['平台 / 任务','推理档位','成功 / 分母','基础设施状态','分母口径'],report.historical_e3.map(x=>[`${esc(x.robot)} · ${x.task==='grasp'?'抓取 / 保持':'放置'}`,esc(x.effort),`<b>${x.successes}/${x.denominator}</b> · ${(x.successes/x.denominator*100).toFixed(0)}%<small>${interval(x.successes,x.denominator)}</small>`,x.robot==='PsiBot'?'另有4条无效与2条未运行':`${x.infrastructure_interrupted_episodes} 次中断保留在分母`,x.denominator_type==='valid_cohort'?'原有效队列':'原全部计划尝试']),'表 3 · 原 E3 成绩。不同平台任务不合并。');
      html+=`<div class="paired-chart"><h4>FR3 放置 · 同一10个seed</h4><div class="paired-row"><span>medium</span><div class="bar"><i style="width:30%"></i></div><b>3/10<small>${interval(3,10)}</small></b></div><div class="paired-row"><span>xhigh</span><div class="bar"><i style="width:90%"></i></div><b>9/10<small>${interval(9,10)}</small></b></div><p class="caption">图 3 · seed 9301–9310 的历史对照；medium 含1次网络中断。</p></div><div class="study-note">历史结果按既有核验聚合承接，本轮没有重新读取所有原始模型回执。总体 medium 6/20 与 xhigh 9/10 的样本量不同，应优先看同10个seed的子集，并保留网络中断影响。</div>`;
    }else if(study==='ablation'){
      html=`<h3>FR3：七种输入条件，两种初态</h3><p class="study-meta">xhigh · seed 9403 / 9404 · 14次尝试 · 13次有效、1次中断 · 探索性 pilot</p>`;
      html+=table(['输入条件','成功 / 有效','全部尝试','中断','Wilson 95% CI'],report.fr3_input_ablation.map(x=>[`${esc(labels[x.condition])}<br><code>${esc(x.condition)}</code>`,`<b>${x.success_n}/${x.valid_n}</b>`,x.attempt_n,x.interrupted_n,`${x.ci95[0].toFixed(1)}–${x.ci95[1].toFixed(1)}%`]),'表 4 · 有效终态作为主分母；全部尝试与中断同时保留。');
      html+=`<div class="study-note">每组只有1或2个有效样本。2/2 的95%区间仍约34–100%，不能据此宣称稳定100%能力。rgb_only 保留共同文字与分类反馈；指标和模型自己声明完成无关。</div>`;
    }else{
      html=`<h3>后续 20×7：计划与已测数量</h3><p class="study-meta">公开状态截至 2026-09-18 01:38 CST · 未完成 · 不用旧 pilot 补满新批次</p><div class="group-total"><div><strong>21 / 140</strong><span>FR3 有效 · 10成功</span></div><div><strong>6 / 140</strong><span>PsiBot 有效 · 4成功</span></div></div>`;
      const rows=['rich','minus_S','minus_J','minus_K','minus_F','minus_H','rgb_only'].map(c=>[`${esc(labels[c])}<br><code>${c}</code>`,...['FR3','PsiBot'].map(p=>{const x=report.campaign_snapshot.find(x=>x.platform===p&&x.condition===c);return x.n?`<b>${x.successes}/${x.n}</b><br><small>${interval(x.successes,x.n)}<br>有效 ${x.n}/20</small>`:'<span class="tag">尚无有效终态</span>';})]);
      html+=table(['输入条件','FR3 · 放置','PsiBot · 抓取'],rows,'表 5 · 成功 / 有效完成；计划每组20。未运行与中断不填零分。');
      html+=`<div class="study-note">原9月15日条件表23条＋9月17日四份公开 result 构成27条有效记录。两平台任务不同，14/27 不作为合并能力成功率；旧公开“暂停”也不代表今天的运行状态。</div>`;
    }
    $('results-content').innerHTML=html;
  }
  function setStudy(name){if(!['robosuite','e3','ablation','campaign'].includes(name))return;study=name;document.querySelectorAll('[role=tab]').forEach(x=>{const active=x.dataset.study===study;x.setAttribute('aria-selected',String(active));x.tabIndex=active?0:-1;});$('study-panel').setAttribute('aria-labelledby','tab-'+study);drawResults();}
  function drawCases(filter='all'){
    $('case-gallery').innerHTML=report.gallery.filter(x=>filter==='all'||status(x.success)===filter).map(x=>`<article class="episode-card" data-id="${esc(x.id)}"><div class="card-media"><img loading="lazy" src="${esc(safeURL(x.poster))}" alt="${esc(x.title)}的实际模型输入"><button class="play-case" data-video="${esc(safeURL(x.video_url))}">▶ 播放原视频</button></div><div class="card-body">${badge(x.success)}<h4>${esc(x.title)}</h4><p>${esc(x.note)}</p><div class="meta">${esc(x.condition)} · ${esc(x.id)}</div><div class="card-links"><a href="#decision-viewer" data-trace="${esc(x.id)}">查看逐轮动作 →</a><a target="_blank" rel="noopener" href="${esc(safeURL(x.video_url))}">原视频 ↗</a></div></div></article>`).join('');
  }
  function selectEpisode(id){const t=traces.find(x=>x.id===id);if(!t){$('trace-status').textContent='此回合没有本站逐轮记录，请使用原来源链接。';return;}$('trace-episode').value=t.id;$('trace-decision').innerHTML=t.decisions.map((d,i)=>`<option value="${i}">#${d.number} · 仿真 ${Number(d.sim_time||0).toFixed(2)}s</option>`).join('');drawDecision();}
  function drawDecision(){
    const t=traces.find(x=>x.id===$('trace-episode').value),i=Number($('trace-decision').value),d=t.decisions[i];
    $('trace-status').innerHTML=`${badge(t.summary.success)} <span>${esc(t.id)} · 决策 ${i+1}/${t.decisions.length} · ${esc(d.status)}${d.wall_wait!=null?' · 本轮等待 '+Number(d.wall_wait).toFixed(1)+' s':''}</span>`;
    $('trace-images').innerHTML=(d.images||[]).map(im=>`<figure>${safeURL(im.url)?`<img loading="lazy" src="${esc(safeURL(im.url))}" alt="决策${d.number}：${esc(im.camera||im.label)}实际模型输入" width="640" height="480">`:'<p>此机位没有留存输入图像</p>'}<figcaption>${esc(im.camera||im.label)} · ${esc(im.temporal_role||'current')} · 实际模型输入</figcaption></figure>`).join('')||'<p>此轮没有留存输入图像。</p>';
    $('trace-fields').innerHTML='<b>实际字段：</b> '+Object.entries(d.mask||{}).map(([k,v])=>`<span class="tag field-${v.status==='visible'?'visible':v.status==='removed_by_condition'?'removed':'unavailable'}" title="${esc(v.reason_zh)}">${esc(k)} · ${esc(v.reason_zh)}</span>`).join('')+'<p class="caption">留存观测键（可含屏蔽占位字段）：'+esc((d.visible_input_keys||[]).join(' · '))+'</p>';
    $('trace-actions').textContent=JSON.stringify({actions:d.actions??[],done:d.done??null},null,2);
    $('trace-feedback').textContent=JSON.stringify({status:d.status,execution:d.execution??[]},null,2);
    const url=safeURL(t.source_url);$('trace-source').hidden=!url;if(url)$('trace-source').href=url;
    $('decision-prev').disabled=i===0;$('decision-next').disabled=i===t.decisions.length-1;
  }
  function ledgerRows(){const protocol=$('ledger-protocol').value,query=$('ledger-search').value.toLowerCase().trim();return episodes.filter(x=>(!protocol||x.protocol===protocol)&&(!matrixFilter||(x.task===matrixFilter.task&&x.condition===matrixFilter.condition&&x.prompt_version==='v3'))&&(!query||[x.episode_id,x.robot,x.task,x.condition,x.seed].join(' ').toLowerCase().includes(query)));}
  function drawLedger(){const rows=ledgerRows(),pages=Math.max(1,Math.ceil(rows.length/perPage));page=Math.min(page,pages-1);$('ledger-count').textContent=rows.length+' 条记录'+(matrixFilter?' · 主矩阵 '+matrixFilter.task+' '+matrixFilter.condition:'');$('ledger-table').innerHTML=table(['回合 ID','平台 / 任务','输入 / 动作条件','结果','模型请求','证据'],rows.slice(page*perPage,(page+1)*perPage).map(x=>[esc(x.episode_id),`${esc(x.robot)}<br>${esc(x.task)}`,esc(x.condition),badge(x.success),esc(x.requests),`${safeURL(x.video_url)?`<a href="${esc(x.video_url)}" target="_blank" rel="noopener">原视频 ↗</a>`:'—'} ${safeURL(x.trace_url)?`<a href="${esc(x.trace_url)}" target="_blank" rel="noopener">证据 ↗</a>`:''}`]));$('ledger-page').textContent=`${page+1} / ${pages}`;$('ledger-prev').disabled=page===0;$('ledger-next').disabled=page>=pages-1;}
  function camera(name){const v=$('roundtrip-video'),time=v.currentTime,playing=!v.paused;document.querySelectorAll('[data-camera]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.camera===name)));v.pause();v.src='assets/astra/media/collect41_'+name+'.mp4';v.onloadedmetadata=()=>{v.currentTime=Math.min(time,v.duration);if(playing)v.play().catch(()=>{});};v.load();$('camera-label').textContent=({head_camera:'头部相机',chest_camera:'胸部相机',third_camera:'第三视角'}[name])+' · 完整原录像';}
  $('menu-toggle').addEventListener('click',()=>{const active=$('toc').classList.toggle('open');$('menu-toggle').setAttribute('aria-expanded',String(active));});
  $('toc').addEventListener('click',e=>{if(e.target.closest('a')){$('toc').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');}});
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){document.querySelectorAll('.toc a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+entry.target.id));}}},{rootMargin:'-15% 0px -65% 0px'});document.querySelectorAll('section[id]').forEach(x=>observer.observe(x));
  document.querySelector('[role=tablist]').addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('[role=tab]')],i=tabs.indexOf(document.activeElement),n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();if(report)setStudy(tabs[n].dataset.study);});
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-study],[data-case-filter],[data-trace],[data-task],[data-camera],[data-time],.play-case');if(!target)return;
    if(target.dataset.camera){camera(target.dataset.camera);return;}
    if(target.dataset.time){const v=$('roundtrip-video'),time=Number(target.dataset.time);const seek=()=>{v.currentTime=time;v.play().catch(()=>{});};if(v.readyState>0)seek();else{v.onloadedmetadata=seek;v.load();}return;}
    if(!report)return;
    if(target.dataset.study){setStudy(target.dataset.study);return;}
    if(target.dataset.caseFilter){document.querySelectorAll('[data-case-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===target)));drawCases(target.dataset.caseFilter);return;}
    if(target.dataset.trace){selectEpisode(target.dataset.trace);return;}
    if(target.dataset.task){matrixFilter={task:target.dataset.task,condition:target.dataset.condition};$('ledger-protocol').value='robosuite';$('ledger-search').value='';page=0;drawLedger();$('ledger-details').open=true;location.hash='ledger-details';return;}
    if(target.classList.contains('play-case')){const media=target.parentElement,img=media.querySelector('img');media.innerHTML='';const v=document.createElement('video');v.controls=true;v.playsInline=true;v.preload='metadata';v.src=target.dataset.video;if(img)v.poster=img.src;media.append(v);v.play().catch(()=>{});}
  });
  for(const id of ['ledger-protocol','ledger-search'])$(id).addEventListener(id==='ledger-search'?'input':'change',()=>{matrixFilter=null;page=0;drawLedger();});
  $('ledger-reset').addEventListener('click',()=>{$('ledger-protocol').value='';$('ledger-search').value='';matrixFilter=null;page=0;drawLedger();});
  $('ledger-prev').addEventListener('click',()=>{page--;drawLedger();});$('ledger-next').addEventListener('click',()=>{page++;drawLedger();});
  $('trace-episode').addEventListener('change',()=>selectEpisode($('trace-episode').value));$('trace-decision').addEventListener('change',drawDecision);
  for(const [id,delta] of [['decision-prev',-1],['decision-next',1]])$(id).addEventListener('click',()=>{$('trace-decision').value=String(Number($('trace-decision').value)+delta);drawDecision();});
  Promise.all(['experiments.json','episodes.json','decision_traces.json'].map(async n=>{const r=await fetch('results/astra/'+n);if(!r.ok)throw Error(n+' HTTP '+r.status);return await r.json();})).then(([r,e,t])=>{
    report=r;episodes=e;traces=t;window.astraReportReady=true;
    for(const p of [...new Set(episodes.map(x=>x.protocol))]){const o=document.createElement('option');o.value=p;o.textContent=protocols[p]||p;$('ledger-protocol').append(o);}
    for(const t of traces){const o=document.createElement('option');o.value=t.id;o.textContent=t.id+' · '+statusLabel(t.summary.success);$('trace-episode').append(o);}
    setStudy(new URLSearchParams(location.search).get('study')||'robosuite');drawCases();selectEpisode('fr3_9404_rich');drawLedger();
    const selected=new URLSearchParams(location.search).get('episode');if(selected&&traces.some(x=>x.id===selected))selectEpisode(selected);
  }).catch(error=>{$('load-error').hidden=false;$('load-error').textContent='实验数据未能载入。请刷新页面，或使用下方 JSON / CSV 下载入口。'+error.message;});
})();
