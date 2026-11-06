"""Task7 visualization repair v2: frozen support-contact oracle replay; conservative release evidence.
Wrong-target requires a debounced release, named nearest support, >oracle XY tolerance
from the per-cup expected target, no phase advance during that grasp/release, and no
later correction. Success/unknown kept separate. Timeout marker is last progress.
"""
from pathlib import Path
import sys,json,hashlib,math,collections,concurrent.futures,time,importlib.util,random
W=Path(__file__).parent;ROOT=W.parent;OUT=W/'task7_scan_v2r2';OUT.mkdir(exist_ok=True)
SOURCE=Path('/project_a02012413/public/liyufeng/safelab_mem0_7weigh_eval_20261027/eval_v13_lenient_cpu_20261106/support_contact_authoritative_v2')
ORACLE_SHA='84da94e16d3290b869ef2f713dbdab96bc00169f682a33a4f0fa65502179080d'
p=SOURCE/'oracle_v13.py';assert hashlib.sha256(p.read_bytes()).hexdigest()==ORACLE_SHA
spec=importlib.util.spec_from_file_location('task7_frozen_v13',p);oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle)
from failure_rules import LABELS
INPUTS=json.loads(Path('/project_a02012413/public/liyufeng/safelab_mem0_7weigh_eval_20261027/oracle_margin_audit_20261105/policy_main200_v1/INPUTS.json').read_text())
SCENES={r['case_id']:r['scene']['file']for r in INPUTS['cases']if r.get('scene')}
AUTH={r['case_id']:r for r in json.loads((SOURCE/'MAIN_COMPLETE.json').read_text())['rows']if r['kind']=='main'}
AUTH.update({r['case_id']:r for r in json.loads((SOURCE/'PI05_COMPLETE.json').read_text())['rows']if r['horizon']==8})
def nearest(poses,i,o):
 p=[poses[i][j]-o.origin[j]for j in range(3)]
 ds={k:math.dist(p[:2],xyz[:2])for k,xyz in o.supports.items()};return p,ds,min(ds,key=ds.get)
def supported(actors,target):
 return any(('/Balance/'in a if target=='pan'else a.endswith('/'+target)or('/'+target+'/')in a)for a in actors)
def fix(c):
 dest=OUT/(c['case_id']+'.json')
 if dest.exists():return json.loads(dest.read_text())
 c=dict(c);r=AUTH[c['case_id']];c['classification_version']='long-task-failure-v2';c['oracle_sha256']=ORACLE_SHA
 if not c.get('source_raw'):
  c['trace']=[];c['reason']='unknown';c['reason_label']=LABELS['unknown'];dest.write_text(json.dumps(c));return c
 raw=Path(c['source_raw']['file']);scene=Path(SCENES[c['case_id']])if c['case_id']in SCENES else raw.parent/'SCENE_CONTRACT.json';contract=json.loads(scene.read_text());o=oracle.PlacementFour(contract['source_profile'],contract['env_origins'][0]);events11=r['historical_protocols']['v1.1']['summary'].get('events',[]);events13=r['v13']['summary'].get('events',[])
 progress=[(e['tick'],e.get('object'),11)for e in events11]+[(e['tick'],e.get('object'),13)for e in events13];last_progress=max([t for t,_,_ in progress],default=125)
 h=hashlib.sha256();trace=[];initial=None;lift=[False]*4;previous_robot=[False]*4;grasp_start=[None]*4;pending={};wrong={};release_log=[];drop={};last_height=[None]*4;last_tilt=[None]*4;tail=collections.deque(maxlen=1201);prev_q=None;deltas=collections.deque(maxlen=1200);held_since=[None]*4;firstmax=0;origin=None;n=0;phase11=0;oldj=0;lastphase=(-1,-1)
 for b in raw.open('rb'):
  h.update(b);z=json.loads(b);tick=z['tick'];origin=tick if origin is None else origin;t=(tick-origin)/120;n+=1;poses=z['poses'];cc=z['contacts'];initial=initial or [p[2]for p in poses];before=set(o.done);o.observe(tick,poses,cc)
  while oldj<len(events11)and events11[oldj]['tick']<=tick:oldj+=1
  phase11=oldj
  if n%8==1 or (phase11,o.phase)!=lastphase:
   trace.append({'t':round(t,6),'tick':tick,'phase11':phase11,'phase13':o.phase});lastphase=(phase11,o.phase)
  for i,key in enumerate('ABCD'):
   actors=[a['actor']for a in cc if a['object']==key and a.get('contact_count',0)>0];robot=any('/Robot/'in a or a.endswith('/Robot')for a in actors);p,ds,near=nearest(poses,i,o);up=oracle.upright(poses[i][3:]);rise=poses[i][2]-initial[i];lift[i]=lift[i]or(robot and rise>=.02)
   if i==int(r['order'][0])-1:firstmax=max(firstmax,rise)
   expected='pad_'+key if key in o.done else 'pan'
   if up<.5:last_tilt[i]=last_tilt[i]if last_tilt[i]is not None else tick
   else:last_tilt[i]=None
   # A later actual correct placement cancels any earlier wrong release/drop for that cup.
   if supported(actors,expected)and near==expected and ds[expected]<=o.xy_tolerance_m and up>=.8:
    wrong.pop(key,None);drop.pop(key,None)
   if key in o.done-before:wrong.pop(key,None);drop.pop(key,None)
   if robot:wrong.pop(key,None);drop.pop(key,None)
   if robot and not previous_robot[i]:grasp_start[i]=tick;pending.pop(key,None)
   if not robot and previous_robot[i]and lift[i]:
    expected_release='pad_'+key if key in before else 'pan'
    pending[key]={'object':key,'tick':tick,'t':t,'grasp_start':grasp_start[i]or tick,'expected':expected_release,'done_before':sorted(before),'pose_local':p,'nearest':near,'distances':ds,'actors':actors,'phase11':phase11,'phase13':o.phase}
   if not robot and key in pending and tick-pending[key]['tick']>=30:
    e=pending.pop(key);advanced=[(a,k,v)for a,k,v in progress if e['grasp_start']<=a<=tick and (v==11 or k==key)]
    expected=e['expected'];e.update(confirm_tick=tick,confirmation_nearest=near,confirmation_distances=ds,confirmation_actors=actors,progress_during_release=advanced,oracle_tolerance=o.xy_tolerance_m)
    e['wrong_candidate']=not advanced and near!=expected and ds[expected]>o.xy_tolerance_m and supported(actors,near) and up>=.8
    release_log.append(e)
    if e['wrong_candidate']:wrong[key]=e
   if robot:last_height[i]=(tick,poses[i][2])
   elif lift[i]and last_height[i]and tick-last_height[i][0]<=120 and last_height[i][1]-poses[i][2]>=.03 and min(ds.values())>o.xy_tolerance_m and not any(supported(actors,k)for k in o.supports):
    drop[key]={'tick':tick,'t':t,'object':key,'drop_m':last_height[i][1]-poses[i][2]};last_height[i]=None
   held=robot and ds[expected]<=o.xy_tolerance_m and not supported(actors,expected)
   held_since[i]=held_since[i]if held and held_since[i]is not None else tick if held else None
   previous_robot[i]=robot
  q=z.get('q13')
  if q:
   tail.append(q)
   if prev_q is not None:deltas.append([a-b for a,b in zip(q,prev_q)])
   prev_q=q
 if not trace or trace[-1]['tick']!=tick:trace.append({'t':t,'tick':tick,'phase11':phase11,'phase13':o.phase})
 assert h.hexdigest()==c['source_raw']['sha256'],'raw SHA mismatch'
 assert o.phase==r['v13']['phase'],'final oracle phase mismatch'
 assert o.events==events13,'frozen oracle event mismatch'
 assert max(x['phase13']for x in trace)==r['v13']['phase'],'trace maximum mismatch'
 assert r['v13'].get('verdict')!='S'or trace[-1]['phase13']==4,'successful trace incomplete'
 # Final irreversible event, rather than the first historical transient.
 decisive=[];term=r.get('original_termination','');tilts=[x for x in last_tilt if x is not None]
 if term in ('object_toppled','object_fell','physical_failure')and tilts:decisive.append((max(tilts),'toppled','原始终止='+term+'；最后未恢复的实测upright<0.5'))
 decisive.extend((e['tick'],'dropped','抬升后失去手接触、下降≥30mm且在所有目标之外；之后未纠正')for e in drop.values())
 decisive.extend((e['tick'],'wrong_target','稳定释放到非期望的最近命名支撑；未推进v1.1/v1.3且之后未纠正')for e in wrong.values())
 ranges=max((max(v)-min(v)for v in zip(*tail)),default=99);rev=sum(any(a*b<0 and abs(a)>.0002 and abs(b)>.0002 for a,b in zip(x,y))for x,y in zip(deltas,list(deltas)[1:]))
 if r['v13'].get('success'):reason,failtick,evidence='success',None,'v1.3冻结oracle完整成功'
 elif r['v13'].get('verdict')=='U':reason,failtick,evidence='unknown',None,'原评测结局未知，不补为失败'
 elif decisive:failtick,reason,evidence=max(decisive,key=lambda x:x[0])
 elif any(x is not None and tick-x>=240 for x in held_since):reason,failtick,evidence='no_release',last_progress,'末2秒仍在逐杯期望目标上方持握且无该支撑；标记最后有效进展'
 elif term=='time_limit'and phase11==0 and firstmax<.02:reason,failtick,evidence='no_grasp',last_progress,'完整超时、v1.1阶段0、首物体最大抬升不足20mm；标记最后有效进展'
 elif term=='time_limit'and(ranges<.01 or rev>=12):reason,failtick,evidence='stuck',last_progress,'末10秒关节停滞或反向运动；标记超时前最后有效进展，不推断模型根因'
 else:reason,failtick,evidence='other',last_progress,'无可核验的决定性专属事件；标记最后有效进展；'+term
 c.update(trace=trace,reason=reason,reason_label=LABELS[reason],failure_time=(failtick-origin)/120 if failtick is not None else None,evidence=evidence,features={'sha_verified':True,'duration':t,'first_max_rise':firstmax,'tail_q_range':ranges,'q_reversals':rev,'oracle_replayed':True,'phase13_max':o.phase,'last_progress_tick':last_progress},release_audit=release_log,unresolved_wrong=list(wrong.values()),classification_version='long-task-failure-v2',oracle_sha256=ORACLE_SHA)
 c['source_scene']={'file':str(scene),'sha256':hashlib.sha256(scene.read_bytes()).hexdigest()};dest.write_text(json.dumps(c,separators=(',',':')));return c
if __name__=='__main__':
 rows=json.loads((W/'TASK7_SCAN_ALL.json').read_text())+json.loads((W/'PI05_SCAN_ALL.json').read_text());out=[];errors=[]
 with concurrent.futures.ProcessPoolExecutor(max_workers=4)as pool:
  fs={pool.submit(fix,c):c for c in rows}
  for f in concurrent.futures.as_completed(fs):
   try:out.append(f.result())
   except Exception as e:errors.append({'case':fs[f]['case_id'],'error':str(e)})
   (W/'TASK7_FIX_STATE.json').write_text(json.dumps({'closed':len(out),'errors':errors,'expected':len(rows),'epoch':time.time()}));print('fixed',len(out),'errors',len(errors),flush=True)
 assert not errors,errors[:5]
 (W/'TASK7_FIXED_ALL.json').write_text(json.dumps(out,separators=(',',':')))
 audit={'schema':'task7-oracle-repair-audit-v2','oracle_sha256':ORACLE_SHA,'planned_slots':300,'raw_cases':len(out),'missing_slots':300-len(out),'raw_unknown':sum(c['reason']=='unknown'for c in out),'known_phase_checks':sum(bool(c.get('source_raw'))for c in out),'phase_mismatches':0,'success_trace_final4':sum(c['reason']=='success'and c['trace'][-1]['phase13']==4 for c in out),'counts':{m:dict(collections.Counter(c['reason']for c in out if c['method']==m))for m in sorted(set(c['method']for c in out))}}
 wrong=[c for c in out if c['reason']=='wrong_target'];sample=random.Random(1263).sample(sorted(wrong,key=lambda c:c['case_id']),min(20,len(wrong)));audit['wrong_target_sample']=[{'case_id':c['case_id'],'scene_index':c['scene_index'],'method':c['method'],'raw_sha256':c['source_raw']['sha256'],'release':max(c['unresolved_wrong'],key=lambda e:e['tick'])}for c in sample];audit['sample_seed']=1263;audit['sample_size']=len(sample)
 (W/'TASK7_FIX_AUDIT.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2));print(json.dumps(audit['counts']),flush=True)
