"""Check the public snapshot against the registry and accepted source evidence."""
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from PIL import Image

W = Path(__file__).resolve().parents[1]
def load(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    data = load(W / 'results/astra/formal_accepted_20261012.json')
    old = load(W / 'results/astra/formal_accepted_20261011.json')
    with (W / 'results/astra/trial_schedule_v6.csv').open() as f:
        registry = {(r['task'], int(r['seed']), r['condition']) for r in csv.DictReader(f)}
    assert len(registry) == 1000
    assert len(data['records']) == 47 and sum(r['requests'] for r in data['records']) == 325
    assert data['success_rate'] is None and data['causal_input_conclusion'] is None
    assert data['minimum20_cohorts_complete'] == 0
    assert Counter(r['task'] for r in data['records']) == {
        'fr3_place': 36, 'psi_grasp': 6, 'psi_pick_place_100ml': 3, 'psi_roundtrip_100ml': 2}
    sources = {load(p)['trial_id']: p for p in (W / 'verification/artifacts').glob('v*/*/FORMAL_VISUAL_ACCEPTANCE_V1.json')}
    old_records = {r['trial_id']: r for r in old['records']}
    exported = 0
    for r in data['records']:
        assert (r['task'], r['seed'], r['condition']) in registry
        assert r['accepted'] and r['model'] == 'gpt-6-astra' and r['effort'] == 'xhigh'
        assert r['rate_reported'] is False and r['physical_120Hz_contiguous']
        assert r['task_retries'] is None
        expected = ['head_camera', 'chest_camera', 'third_camera']
        if r['task'] in ('fr3_place', 'psi_grasp'): expected.append('wrist_camera')
        deleted = r['condition'].removeprefix('minus_') + '_camera'
        expected = [c for c in expected if c != deleted]
        assert r['current_camera_names'] == expected
        dims = [320, 240] if r['condition'] == 'rgb_half_resolution' else [640, 480]
        assert r['input_dimensions'] == dims
        assert sum(c['shown_to_model'] for c in r['cameras']) == len(expected)
        if r['trial_id'] not in old_records:
            p = sources[r['trial_id']]
            assert sha(p) == r['acceptance_sha256']
            t = load(p.parent / 'native' / r['trial_id'] / 'NATIVE_TERMINAL.json')
            assert r['success'] == t['success'] and r['stop_reason'] == t['stop_reason']
            for k in ('requests', 'episode_wall_s', 'model_wait_s', 'paired_initial_sha256', 'source_freeze_sha256'):
                assert r[k] == t[k]
            assert r['pickup_retries'] == t['retry_events']['pickup_retries']
            inputs = load(W / r['all_inputs'])
            assert len(inputs) == r['requests']
            for entry in inputs:
                v = entry['visible_input']
                assert v['current_camera_names'] == expected and v['current_rgb_dimensions'] == dims
                if r['condition'] in ('minus_S', 'minus_J', 'minus_K', 'minus_F'):
                    assert v.get(r['condition'][-1]) is None
                if r['condition'] == 'minus_H': assert not v['previous_observations_own_actions']
                if r['condition'] == 'minus_M': assert not v['memory_from_previous_decision']
                if r['condition'] == 'minus_C': assert v['last_action_status'] is None
            for c in r['cameras']:
                assert sha(W / c['image']) == c['image_sha256']
                assert sha(W / c['video']) == c['video_sha256']
            exported += 1
        else:
            for k, v in old_records[r['trial_id']].items(): assert r[k] == v
        for c in r['cameras']:
            for k in ('image', 'video'):
                assert re.fullmatch(r'assets/astra/formal_20261011/[A-Za-z0-9_./-]+', c[k]) and '..' not in c[k]
                assert (W / c[k]).is_file()
            with Image.open(W / c['image']) as im:
                assert list(im.size) == (dims if c['shown_to_model'] else [640, 480])
    assert exported == 35
    for c in data['cohorts']:
        selected = [r for r in data['records'] if r['task'] == c['task'] and r['condition'] == c['condition']]
        assert len(selected) == c['accepted_n'] and c['required_n'] == 20
        assert sum(r['success'] for r in selected) == c['successes_observed']
        assert c['success_rate'] is None and c['causal_input_effect'] is None
        base = {r['seed']: r for r in data['records'] if r['task'] == c['task'] and r['condition'] == 'rich'}
        assert sum(r['seed'] in base for r in selected) == c['paired_with_rich_n']
        for r in selected:
            if r['seed'] in base: assert r['paired_initial_sha256'] == base[r['seed']]['paired_initial_sha256']
    assert len(data['cohorts']) == 50
    protocol = load(W / 'results/astra/protocol_executed_20261012.json')
    status = load(W / 'results/astra/supplementary_execution_status_20261012.json')
    receipt = load(W / 'execution_completion/PACKAGE_RECEIPT_v27.json')
    assert protocol['budgets']['long_task'] == receipt['gate']['budgets']['long']
    assert protocol['trial_schedule']['sha256'] == receipt['registry_sha256']
    assert status['actual_formal_trials'] == 47 and status['model_transport']['accepted_formal_native_responses'] == 325
    assert status['resource_policy']['max_concurrent_gpu_jobs'] == 1
    assert status['runtime']['long_native_qualification_passed'] is True
    assert not status['runtime']['whole_study_complete'] and status['input_effect_conclusions'] is None
    page = (W / 'astra.html').read_text()
    assert 'href="results/astra/protocol_executed_20261012.json"' in page
    assert 'href="results/astra/supplementary_execution_status_20261012.json"' in page
    assert sha(W / 'results/astra/protocol_v6.json') == protocol['historical_design_sha256']
    assert sha(W / 'results/astra/supplementary_execution_status.json') == status['historical_status_sha256']
    roundtrip = next(r for r in data['records'] if r['task'] == 'psi_roundtrip_100ml' and r['condition'] == 'minus_S')
    assert not roundtrip['success'] and roundtrip['completed_phases'] == 2 and roundtrip['total_phases'] == 4
    assert roundtrip['pickup_attempts'] == 2 and roundtrip['pickup_retries'] == 0
    public_text = [W / 'astra.html', W / 'assets/astra/research.js', W / 'results/astra/formal_accepted_20261012.json']
    public_text += [W / 'results/astra/protocol_executed_20261012.json', W / 'results/astra/supplementary_execution_status_20261012.json']
    public_text += list((W / 'assets/astra/formal_20261011').glob('*/all_inputs.json'))
    secret = re.compile(r'(?i)-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|Bearer\s+[A-Za-z0-9_.-]{20,}|sk-[A-Za-z0-9_-]{20,}|znt_[a-f0-9]{20,}')
    for p in public_text: assert not secret.search(p.read_text()), 'Possible secret in ' + str(p)
    result = {'passed': True, 'accepted': 47, 'actual_replies': 325, 'cohorts': 50,
              'new_original_cases_checked': exported, 'old_snapshot_preserved': True,
              'source_media_and_input_masks_match': True, 'no_effect_claim': True,
              'partial_roundtrip_not_success': True, 'secret_scan': 'pass'}
    (W / 'verification/PUBLIC_SNAPSHOT_VALIDATION_20261012.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))

if __name__ == '__main__': main()
