"""Offline trial metrics; missing retry logs remain null, calls are never retries."""
import math
import statistics


def wilson(k, n):
    if n == 0:
        return None
    z = 1.959963984540054; p = k/n; d = 1+z*z/n
    center = (p+z*z/(2*n))/d
    half = z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return [center-half, center+half]


def task_retries(events):
    if events is None:
        return None
    if not isinstance(events, list):
        raise ValueError('events must be an original event list')
    attempts = {}; failures = set(); terminals = set(); retries = 0; starts = {}
    last_sequence = -1
    for event in events:
        seq = event.get('sequence')
        if type(seq) is not int or seq <= last_sequence:
            raise ValueError('event sequence must be strictly increasing')
        last_sequence = seq
        kind = event.get('kind')
        if kind not in {'attempt_start', 'attempt_failed', 'attempt_succeeded', 'model_call', 'network_retry', 'action_rejected', 'reset'}:
            raise ValueError('unknown event kind')
        if kind not in {'attempt_start', 'attempt_failed', 'attempt_succeeded'}:
            continue
        aid, subgoal = event.get('attempt_id'), event.get('subgoal_id')
        if not isinstance(aid, str) or not aid or not isinstance(subgoal, str) or not subgoal:
            raise ValueError('original attempt and subgoal identities required')
        if kind == 'attempt_start':
            if aid in attempts:
                raise ValueError('duplicate attempt identity')
            previous = starts.get(subgoal)
            if previous:
                if previous not in failures:
                    raise ValueError('restart without a recorded failed predecessor')
                retries += 1
            attempts[aid] = subgoal; starts[subgoal] = aid
        else:
            if attempts.get(aid) != subgoal or starts.get(subgoal) != aid:
                raise ValueError('terminal without matching active attempt')
            if aid in terminals:
                raise ValueError('duplicate attempt terminal')
            terminals.add(aid)
            if kind == 'attempt_failed':
                failures.add(aid)
    return retries


def cohort_summary(records, expected_ids):
    """Aggregate observed attempt records only; schedule rows are not outcomes.

    Each record must explicitly assert attempted=True from its original runner
    receipt. This flag alone is not a native qualification or provenance check.
    """
    if len(set(expected_ids)) != len(expected_ids):
        raise ValueError('duplicate registered identity')
    registered = set(expected_ids); seen = set()
    valid, retry_values, success = [], [], 0
    for r in records:
        if r.get('attempted') is not True or r.get('status') in {'not_run','planned','pending'}:
            raise ValueError('observed attempted records required; schedule rows rejected')
        rid = r['trial_id']
        if rid not in registered or rid in seen:
            raise ValueError('unregistered or duplicate trial')
        seen.add(rid)
        native = r.get('native_success')
        if native is not None and type(native) is not bool:
            raise ValueError('native success must be bool or null')
        if type(native) is bool:
            valid.append(r); success += native
        retries = task_retries(r.get('retry_events'))
        if retries is not None:
            retry_values.append(retries)
    n = len(valid)
    return {'successes':success, 'registered_n':len(expected_ids), 'observed_n':len(seen),
            'valid_n':n,'interruptions':len(records)-n,'not_run_n':len(registered-seen),
            'success_ci95_valid':wilson(success,n),
            'success_ci95_attempted':wilson(success,len(records)),
            'success_ci95_registered':wilson(success,len(expected_ids)) if len(seen)==len(registered) else None,
            'completed_20_valid':n>=20 and len(seen)==len(registered),
            'task_retries_median':statistics.median(retry_values) if retry_values else None,
            'task_retry_coverage_n':len(retry_values)}
