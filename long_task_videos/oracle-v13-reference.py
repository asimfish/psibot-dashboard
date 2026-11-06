"""SafeLab-Eval-v1.3-lenient: task7 counts four distinct cups on their weighing target.
CPU only. No sequential return-to-pad requirement; no start-pad credit.
Height is diagnostic only when measured support contact is available. User explicitly confirmed contact authority.
Physics truncation is retained. This module never changes a policy or simulator.
"""
import math
PROTOCOL="SafeLab-Eval-v1.3-lenient"
PARAMETERS=dict(base_xy_tolerance_m=.025,xy_multiplier=3.,nearest_target_gap_m=.005,
 upright_cos_min=.80,height_tolerance_m=.015,debounce_ticks=1,physics_hz=120,
 robot_contact_allowed=True,require_order=False,require_end_revalidation=False,
 completed_unit="distinct_object_once_on_weighing_pan",N=4,half_task_k=2,
 support_rule="MEASURED target support contact authoritative; explicit user clarification 2026-11-06",
 additional_numeric_weigh_threshold=None,original_truncated_future_recovered=False)
def upright(q):
 n=sum(float(x)**2 for x in q)**.5
 if len(q)!=4 or not math.isfinite(n) or abs(n-1)>=.001:raise ValueError("invalid quaternion")
 w,x,y,z=[float(a)/n for a in q];return 1-2*(x*x+y*y)
class PlacementFour:
 def __init__(self,profile,origin):
  self.profile=profile;self.origin=list(origin);self.last_tick=124
  self.supports={k:list(map(float,v)) for k,v in profile["scene"]["supports"].items()}
  distances=[math.dist(a[:2],b[:2]) for i,a in enumerate(self.supports.values()) for j,b in enumerate(self.supports.values()) if j>i]
  self.minimum_target_spacing_m=min(distances)
  self.xy_tolerance_m=min(.025*3,.5*self.minimum_target_spacing_m-.005)
  if self.xy_tolerance_m<=0:raise ValueError("invalid target spacing")
  self.done=set();self.events=[];self.phase=0;self.first_success_tick=None
  self.accepted_height_only_with_robot_touch=0
 def conditions(self,key,pose,contacts):
  p=[float(pose[j])-self.origin[j] for j in range(3)]+list(pose[3:])
  target=self.supports["pan"];bottom=self.profile["scene"].get("object_bottom_offsets",{}).get(key,self.profile["scene"]["half_height"])
  d={name:math.hypot(p[0]-xyz[0],p[1]-xyz[1]) for name,xyz in self.supports.items()}
  closest=min(d,key=d.get);height_error=abs(p[2]-target[2]-bottom);up=upright(p[3:])
  cc=[x for x in contacts if x["object"]==key and x["contact_count"]>0]
  support=any("/Balance/" in x["actor"] for x in cc)
  hand=any("/Robot/" in x["actor"] or x["actor"].endswith("/Robot") for x in cc)
  height=height_error<=.015
  passed=closest=="pan" and d["pan"]<=self.xy_tolerance_m and up>=.80 and support
  return dict(passed=passed,object=key,target="pan",nearest_target=closest,
   xy_error_m=d["pan"],nearest_target_error_m=d[closest],xy_tolerance_m=self.xy_tolerance_m,
   upright_cos=up,height_error_m=height_error,support_contact=support,height_supported=height,
   robot_contact=hand,height_only_with_robot_touch=height and hand and not support)
 def observe(self,tick,poses,contacts):
  if type(tick)!=int or tick!=self.last_tick+1:raise ValueError("120Hz physical clock gap")
  if len(poses)!=4 or any(len(p)!=7 for p in poses):raise ValueError("invalid poses")
  if not isinstance(contacts,list):raise ValueError("contacts missing")
  self.last_tick=tick;conditions={}
  for i,key in enumerate("ABCD"):
   if key in self.done:continue
   c=self.conditions(key,poses[i],contacts);conditions[key]=c
   if c["passed"]:
    self.done.add(key);self.events.append(dict(object=key,target="pan",tick=tick,conditions=c))
    self.accepted_height_only_with_robot_touch+=int(c["height_only_with_robot_touch"])
  self.phase=len(self.done)
  if self.phase==4 and self.first_success_tick is None:self.first_success_tick=tick
  return conditions
 def finish(self):
  return dict(protocol_version=PROTOCOL,success=self.phase==4,completed_phases=self.phase,
   completed_objects=sorted(self.done),N=4,half_task_k=2,events=self.events,
   first_success_tick=self.first_success_tick,last_tick=self.last_tick,
   minimum_target_spacing_m=self.minimum_target_spacing_m,xy_tolerance_m=self.xy_tolerance_m,
   accepted_height_only_with_robot_touch=self.accepted_height_only_with_robot_touch,
   parameter_semantics="4 unique cups ever correctly placed on pan; ordered 7-stage metrics kept separately")
