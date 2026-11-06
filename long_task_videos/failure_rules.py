"""long-task-failure-v1: deterministic precedence, evidence required; not a causal oracle.
Precedence: successful > incomplete/unknown > topple termination > transport drop >
wrong released support > persistent held-over-target > no first lift > timeout stall > other.
Initial pad occupancy is excluded from wrong-target tests. Lift needs >=20mm rise
and robot contact. Drop needs >=30mm fall within1s, lost contact, and outside targets.
Held-over-target needs final2s contact, <=60mm XY, no support. No-lift requires full
valid trace, time_limit, phase0 and max first-object rise<20mm. Timeout alone never
proves oscillation; label 'timeout_unresolved' unless q13 stationary/reversal evidence.
"""
import math,json,hashlib,re
LABELS={'success':'整任务成功','no_grasp':'第一个物体始终没抓起','toppled':'物体倾倒终止','dropped':'搬运中掉落','wrong_target':'放错目标或顺序','no_release':'目标上方未松手','stuck':'中途卡住或反复运动超时','other':'其他 / 证据不足','unknown':'原始日志未知或校验失败'}
def scene_index(r):
 m=re.search(r'_r(\d+)(?:_|$)',r['case_id'].split('v180_')[-1]);return int(m.group(1))+(50 if r.get('order')=='4321' else 0) if m else r.get('index',0)
def classify(r,features):
 if r.get('v13',{}).get('success')is True:return 'success',None,'v1.3完整成功'
 if not features.get('sha_verified')or r.get('v13',{}).get('verdict')=='U':return 'unknown',None,'原始SHA或判定未知'
 term=r.get('original_termination','');duration=features['duration']
 if term in ('object_toppled','object_fell','physical_failure') and features.get('tilt_time')is not None:return 'toppled',features['tilt_time'],'原终止='+term+'；实测upright<cos60°'
 for key,why in [('drop_time','实测抬起后失去机器人接触，1秒内下降≥30mm且不在目标上'),('wrong_time','抬起后在非期望目标上释放并有支撑接触'),('held_time','末2秒持续机器人接触，XY距目标≤60mm但无支撑')]:
  if features.get(key)is not None:return {'drop_time':'dropped','wrong_time':'wrong_target','held_time':'no_release'}[key],features[key],why
 phase=r.get('historical_protocols',{}).get('v1.1',{}).get('phase')
 if term=='time_limit'and phase==0 and features.get('first_max_rise',1)<.02:return 'no_grasp',duration,'完整超时、v1.1阶段0，首物体最大抬升<20mm'
 if term=='time_limit'and(features.get('tail_q_range',99)<.01 or features.get('q_reversals',0)>=12):return 'stuck',max(0,duration-10),'末10秒q13范围<0.01rad，或同窗口运动反转≥12（只说明卡住/反复运动）'
 return 'other',duration,'未满足可核验专属规则；'+term
