import unittest,json,hashlib
from pathlib import Path
W=Path(__file__).parent;P=W;D=json.loads((P/'data.json').read_text())
class RepairRegression(unittest.TestCase):
 def test_version_and_frozen_oracle(self):
  self.assertEqual(D.get('classification_status'),'corrected-v2');self.assertEqual(D.get('oracle_sha256'),'84da94e16d3290b869ef2f713dbdab96bc00169f682a33a4f0fa65502179080d')
 def test_success_traces_reach_four(self):
  for c in D['tasks']['7']['cases']:
   b=(P/c['trace']).read_bytes();self.assertEqual(hashlib.sha256(b).hexdigest(),c['trace_sha256']);rows=json.loads(b)['rows'];self.assertTrue(rows)
   self.assertTrue(all(b['t']>a['t']for a,b in zip(rows,rows[1:])))
   if c['verdict13']=='S':self.assertEqual(rows[-1]['phase13'],4);self.assertEqual(max(r['phase13']for r in rows),4)
 def test_all_300_slots_and_per_case_phase(self):
  a=json.loads((P/'classification-audit.json').read_text());self.assertEqual(a['planned_slots'],300);self.assertEqual(len(a['case_checks']),300);known=[r for r in a['case_checks']if r['raw_available']];self.assertEqual(len(known),285)
  for r in known:self.assertEqual(r['trace_max_phase13'],r['source_phase13']);self.assertTrue(r['oracle_events_match']);self.assertTrue(r['raw_sha_verified'])
 def test_no_hidden_unknown(self):
  gs=D['tasks']['7']['groups'];self.assertEqual([g['failure_counts'].get('unknown',0)for g in gs],[0,1,14]);self.assertEqual([g['success13']for g in gs],[5,11,0])
  for g in gs:self.assertEqual(sum(g['failure_counts'].values()),100)
 def test_independent_release_audit(self):
  a=json.loads((P/'independent-checks.json').read_text());self.assertTrue(a['passed']);counts=sum(g['failure_counts'].get('wrong_target',0)for g in D['tasks']['7']['groups']);self.assertEqual(a['wrong_release_sample_count'],min(20,counts))
  self.assertTrue(all(c['passed']for c in a['sample_checks']))
  for c in a['reported_case_regressions']:self.assertIsNot(c['first_progress_release_wrong'],True)
 def test_no_borrowed_media_or_old_overlay(self):
  cs=D['tasks']['7']['cases'];self.assertEqual(len(cs),len({c['case_id']for c in cs}))
  for c in cs:self.assertIn('/7/repair_v2/',c['video']['url']);self.assertTrue(c['video']['PUT_GET_SHA_verified']);self.assertTrue(2_000_000<=c['video']['bytes']<=8_000_000)
if __name__=='__main__':unittest.main()
