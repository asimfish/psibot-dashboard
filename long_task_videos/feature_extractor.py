from pathlib import Path
import json,hashlib,math,collections,concurrent.futures,time,sys,re
from failure_rules import classify,scene_index,LABELS
ROOT=Path('/projects/a02012413/buckets/zenith-a02012413/liyufeng/safelab-public/videos-v1/long_tasks_20261106');W=ROOT/'work';OUT=W/'task7_scan';OUT.mkdir(exist_ok=True)
SOURCE=Path('/project_a02012413/public/liyufeng/safelab_mem0_7weigh_eval_20261027/eval_v13_lenient_cpu_20261106/support_contact_authoritative_v2')
def scan(r):
 out=OUT/(r['case_id']+'.json')
 if out.exists():return json.loads(out.read_text())
 if not r.get('raw'):
  result={'task':7,'method':r['variant'],'horizon':r['horizon'],'checkpoint':30000,'case_id':r['case_id'],'scene_index':scene_index(r),'seed':r.get('seed'),'reason':'unknown','reason_label':LABELS['unknown'],'failure_time':None,'evidence':'源CPU记录无可核验原始trace；不判失败','features':{'sha_verified':False},'outcomes':{'v1.1':r.get('historical_protocols',{}).get('v1.1',{}),'v1.3':r['v13']},'source_raw':None,'source_video':None,'source_video_exists':False,'video_origin_tick':None,'raw_origin_tick':None,'trace':[],'selection':[]};out.write_text(json.dumps(result));return result
 start=time.time();raw=Path(r['raw']['file']);h=hashlib.sha256();n=0;initial=None;lift=[False]*4;last=[None]*4;trace=[];tail=collections.deque(maxlen=1201);drop=None;wrong=None;tilt=None;heldstart=None;firstmax=0.;events=r['v13']['summary'].get('events',[]);old=r['historical_protocols']['v1.1']['summary'].get('events',[]);origin=None;previousq=None;reversals=0;deltas=collections.deque(maxlen=1200)
 order=[int(x)-1 for x in r['order']];supports=r['scene_supports'];firstobj=order[0]
 for b in raw.open('rb'):
  h.update(b);z=json.loads(b);tick=z['tick'];origin=tick if origin is None else origin;t=(tick-origin)/120;n+=1;poses=z['poses'];contacts=z['contacts'];initial=initial or [p[2]for p in poses];robots={c['object']for c in contacts if '/Robot/'in c['actor']and c.get('contact_count',0)>0};actual={k:[]for k in 'ABCD'}
  for c in contacts:
   if c.get('contact_count',0)>0 and '/Robot/'not in c['actor']:actual[c['object']].append(c['actor'])
  phase11=sum(e['tick']<=tick for e in old);completed={e['object']for e in events if e['tick']<=tick and e['target'].startswith('pad')};phase13=len(completed);current=order[min(phase11//2,3)];firstmax=max(firstmax,poses[firstobj][2]-initial[firstobj]);held=False
  for i,p in enumerate(poses):
   key='ABCD'[i];robot=key in robots;rise=p[2]-initial[i];lift[i]=lift[i]or rise>=.02 and robot;target='pad_'+key if phase11%2 else 'pan';targetxyz=supports[target];distance=math.dist(p[:2],targetxyz[:2]);q=p[3:];up=abs(1-2*(q[1]*q[1]+q[2]*q[2])) if len(q)==4 else 1
   if up<.5 and tilt is None:tilt=t
   if lift[i]and last[i]and not robot and last[i][1]-p[2]>=.03 and t-last[i][0]<=1 and distance>.06 and not actual[key] and drop is None:drop=t
   if robot or last[i]is None or t-last[i][0]>1:last[i]=(t,p[2])
   if i==current and lift[i]:
    if not robot and actual[key]and distance>.06 and wrong is None:
     # Only named task targets count; ground/table contact is not wrong-order proof.
     other=[a for a in actual[key]if ('pad_'in a and target not in a)or ('Balance'in a and target!='pan')]
     if other:wrong=t
    held=robot and distance<=.06 and not actual[key]
  heldstart=t if held and heldstart is None else heldstart if held else None
  if z.get('q13'):
   q=z['q13'];tail.append(q)
   if previousq is not None:deltas.append([a-b for a,b in zip(q,previousq)])
   previousq=q
  if n%8==1:trace.append({'t':round(t,4),'tick':tick,'phase11':phase11,'phase13':phase13})
 verified=h.hexdigest()==r['raw']['sha256'];ranges=max((max(v)-min(v)for v in zip(*tail)),default=99)
 reversals=sum(sum(1 for a,b in zip(x,y)if a*b<0 and abs(a)>.0002 and abs(b)>.0002)>0 for x,y in zip(deltas,list(deltas)[1:]))
 f={'sha_verified':verified,'duration':t,'first_max_rise':firstmax,'drop_time':drop,'wrong_time':wrong,'tilt_time':tilt,'held_time':heldstart if heldstart is not None and t-heldstart>=2 else None,'tail_q_range':ranges,'q_reversals':reversals}
 reason,failtime,evidence=classify(r,f);video=raw.parent/'chest.mp4';frames=raw.parent/'frames.jsonl';frame_origin=None
 if frames.exists():
  with frames.open()as fp:frame_origin=json.loads(next(fp)).get('native_tick')
 result={'task':7,'method':r['variant'],'horizon':r['horizon'],'checkpoint':30000,'case_id':r['case_id'],'scene_index':scene_index(r),'seed':r['seed'],'reason':reason,'reason_label':LABELS[reason],'failure_time':failtime,'evidence':evidence,'features':f,'outcomes':{'v1.1':r['historical_protocols']['v1.1'],'v1.3':r['v13']},'source_raw':r['raw'],'source_video':str(video),'source_video_exists':video.exists(),'video_origin_tick':frame_origin,'raw_origin_tick':origin,'trace':trace,'selection':[],'scan_seconds':time.time()-start}
 out.write_text(json.dumps(result,separators=(',',':')));return result
if __name__=='__main__':
 rs=[r for r in json.loads((SOURCE/'MAIN_COMPLETE.json').read_text())['rows']if r['kind']=='main'];result=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
  for r in pool.map(scan,rs):
   result.append(r);(W/'TASK7_SCAN_STATE.json').write_text(json.dumps({'closed':len(result),'expected':200,'epoch':time.time()}));print('closed',len(result),r['reason'],flush=True)
 (W/'TASK7_SCAN_ALL.json').write_text(json.dumps(result,separators=(',',':')))
