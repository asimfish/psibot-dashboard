(() => {
  const url='https://raw.githubusercontent.com/asimfish/psibot-dashboard/refs/heads/feature/t-525-pick-place-live/results/pick_place_current.json';
  let busy=false, last;
  async function update(){
    if(busy)return;busy=true;
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),8000);
    try{
      const r=await fetch(url+'?v='+Date.now(),{cache:'no-store',signal:controller.signal});
      if(!r.ok)throw Error('unavailable');const d=await r.json(),t=d.totals;
      if(d.schema_version!==1||d.generation!=='paper_v4'||t.required_models!==26||t.required_cells!==104||!Number.isFinite(Date.parse(d.source_updated_at)))throw Error('invalid');
      if(last&&Date.parse(d.published_at)<Date.parse(last.published_at))return;
      last=d;
      document.getElementById('pp-home-counts').textContent=`${t.verified_models} / ${t.required_models} 模型`;
      document.getElementById('pp-home-cells').textContent=`${t.complete_cells} / ${t.required_cells} 完整测试组 · ${t.complete_trials.toLocaleString()} 次`;
      const old=Date.now()-Date.parse(d.published_at)>1200000||Date.now()-Date.parse(d.source_updated_at)>1200000;
      document.getElementById('pp-home-updated').textContent=`${old?'来源已过期':'自动同步'} · 来源 ${new Date(d.source_updated_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）`;
    }catch(_){
      const e=document.getElementById('pp-home-updated');
      if(!e.textContent.includes('连接暂不可用'))e.textContent+=' · 更新连接暂不可用，保留快照';
    }finally{clearTimeout(timer);busy=false;}
  }
  update();setInterval(update,60000);
})();
