"""Offline synthetic oracles. No model request, simulator, or gesture qualification."""
import hashlib
import json
import unittest

from gesture_adapter_v5 import GestureCompiler
from trial_metrics_v5 import cohort_summary, task_retries, wilson


def fixture():
    return {'schema':'safelab.frozen_hand_gesture_library.v1',
            'source_sha256':'0'*64,'joint_names':['fixture_a','fixture_b'],
            'lower':[-1.,-1.],'upper':[1.,1.],'max_joint_refinement_rad':.1,
            'presets':{'fixture_grasp':{'open':[0.,0.],'closed':[.8,.6],
                'synergies':{'fixture_axis':{'basis':[1.,.5],'bound':.1},
                             'fixture_axis2':{'basis':[1.,0.],'bound':.1}}}}}


def compiler(lib=None):
    b=json.dumps(lib or fixture()).encode()
    return GestureCompiler(b,hashlib.sha256(b).hexdigest(),['fixture_a','fixture_b'])


def action(**changes):
    a={'gesture_id':'fixture_grasp','closure_fraction':.5,'named_synergy_delta':{}}
    a.update(changes);return a


def event(seq,kind,aid='a',sg='lift'):
    return {'sequence':seq,'kind':kind,'attempt_id':aid,'subgoal_id':sg}


class ActionContract(unittest.TestCase):
    def test_library_interpolation(self):
        out=compiler().compile(action(named_synergy_delta={'fixture_axis':.1}))
        self.assertEqual(out['hand_joint_position_rad'],[.5,.35])
        self.assertTrue(out['controller_generated']);self.assertFalse(out['native_qualified'])

    def test_direct_joint_or_free_vector_rejected(self):
        for k in ['hand_joint_position_rad','absolute_hand_joint_angles','free_joint_delta_vector']:
            with self.assertRaises(ValueError):compiler().compile(action(**{k:[0.,0.]}))

    def test_unknown_gesture_and_axis(self):
        for a in [action(gesture_id='new'),action(named_synergy_delta={'free':0})]:
            with self.assertRaises(ValueError):compiler().compile(a)

    def test_combined_axis_bound(self):
        with self.assertRaises(ValueError):
            compiler().compile(action(named_synergy_delta={'fixture_axis':.08,'fixture_axis2':.08}))

    def test_no_accumulating_drift(self):
        c=compiler();a=action(named_synergy_delta={'fixture_axis':.05})
        self.assertEqual(c.compile(a),c.compile(a))

    def test_finite_and_closure_bounds(self):
        for x in [float('nan'),float('inf'),True,-.1,1.1]:
            with self.assertRaises(ValueError):compiler().compile(action(closure_fraction=x))

    def test_joint_order_hash_and_duplicate_json(self):
        b=json.dumps(fixture()).encode();h=hashlib.sha256(b).hexdigest()
        for raw,sha,order in [(b,h,['fixture_b','fixture_a']),(b+' '.encode(),'1'*64,['fixture_a','fixture_b']),
                              (b'{"schema":1,"schema":2}',hashlib.sha256(b'{"schema":1,"schema":2}').hexdigest(),[])]:
            with self.assertRaises(ValueError):GestureCompiler(raw,sha,order)

    def test_unknown_library_and_bad_source(self):
        for field,value in [('schema','other'),('source_sha256','unknown'),('max_joint_refinement_rad',.11)]:
            lib=fixture();lib[field]=value
            with self.assertRaises(ValueError):compiler(lib)

    def test_joint_limit_overflow_rejected(self):
        lib=fixture();lib['presets']['fixture_grasp']['closed']=[1.,1.]
        with self.assertRaises(ValueError):compiler(lib).compile(action(closure_fraction=1,named_synergy_delta={'fixture_axis':.1}))


class MetricContract(unittest.TestCase):
    def test_calls_and_network_not_task_retry(self):
        self.assertEqual(task_retries([event(i,k) for i,k in enumerate(['model_call','model_call','network_retry','reset','action_rejected'])]),0)

    def test_failed_then_restart(self):
        self.assertEqual(task_retries([event(0,'attempt_start'),event(1,'attempt_failed'),event(2,'attempt_start','b'),event(3,'attempt_succeeded','b')]),1)

    def test_missing_vs_zero(self):
        self.assertIsNone(task_retries(None));self.assertEqual(task_retries([]),0)

    def test_no_restart_before_failure(self):
        for events in [[event(0,'attempt_start'),event(1,'attempt_start','b')],
                       [event(0,'attempt_start'),event(1,'attempt_succeeded'),event(2,'attempt_start','b')]]:
            with self.assertRaises(ValueError):task_retries(events)

    def test_terminal_identity_and_sequence(self):
        for events in [[event(0,'attempt_failed')],[event(0,'attempt_start'),event(0,'attempt_failed')],
                       [event(0,'attempt_start'),event(1,'attempt_failed'),event(2,'attempt_succeeded')]]:
            with self.assertRaises(ValueError):task_retries(events)

    def test_attempt_ids_have_no_sentinel_collision(self):
        self.assertEqual(task_retries([event(0,'attempt_start','a::terminal','g1'),event(1,'attempt_succeeded','a::terminal','g1'),
                                     event(2,'attempt_start','a','g2'),event(3,'attempt_succeeded','a','g2')]),0)

    def test_partial_cohort_not_20(self):
        s=cohort_summary([{'attempted':True,'trial_id':'a','native_success':True}],['a','b'])
        self.assertFalse(s['completed_20_valid']);self.assertEqual(s['not_run_n'],1)
        self.assertIsNone(s['success_ci95_registered']);self.assertIsNone(s['task_retries_median'])

    def test_unrun_schedule_shape_rejected(self):
        for attempted in [None, False, True]:
            r={'trial_id':'a','status':'not_run','native_success':None}
            if attempted is not None:r['attempted']=attempted
            with self.assertRaises(ValueError):cohort_summary([r],['a'])
        with self.assertRaises(ValueError):cohort_summary([{'trial_id':'a','native_success':True}],['a'])

    def test_interruption_does_not_become_valid_failure(self):
        s=cohort_summary([{'attempted':True,'trial_id':'a','native_success':True},{'attempted':True,'trial_id':'b','native_success':None}],['a','b'])
        self.assertEqual((s['successes'],s['valid_n'],s['observed_n'],s['interruptions']),(1,1,2,1))
        self.assertNotEqual(s['success_ci95_valid'],s['success_ci95_attempted'])

    def test_full_20_cohort_and_retry_coverage(self):
        ids=[str(i) for i in range(20)]
        s=cohort_summary([{'attempted':True,'trial_id':i,'native_success':i!='0','retry_events':[]} for i in ids],ids)
        self.assertTrue(s['completed_20_valid']);self.assertEqual(s['successes'],19)
        self.assertEqual(s['task_retry_coverage_n'],20);self.assertEqual(s['task_retries_median'],0)

    def test_duplicates_unknown_and_non_bool(self):
        for rs,ids in [([{'attempted':True,'trial_id':'x'}],['a']),([{'attempted':True,'trial_id':'a'},{'attempted':True,'trial_id':'a'}],['a']),
                       ([{'attempted':True,'trial_id':'a','native_success':1}],['a']),([],['a','a'])]:
            with self.assertRaises(ValueError):cohort_summary(rs,ids)

    def test_wilson_known_zero_and_full(self):
        self.assertIsNone(wilson(0,0))
        self.assertAlmostEqual(wilson(20,20)[0],.838874841947,places=9)
        self.assertAlmostEqual(wilson(0,20)[1],.161125158053,places=9)


if __name__=='__main__':unittest.main()
