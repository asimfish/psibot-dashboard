"""Offline action compiler. Requires an actual frozen library export at integration.

Model output selects a trusted gesture and small named synergy adjustments. Only
this controller-side compiler creates joint targets. This is not a native runner.
"""
import hashlib
import json
import math
import re


def finite(value, name):
    if type(value) not in (int, float) or not math.isfinite(value):
        raise ValueError('finite numeric ' + name + ' required')
    return float(value)


class GestureCompiler:
    def __init__(self, library_bytes, expected_sha256, expected_joint_names):
        if not isinstance(library_bytes, bytes) or len(library_bytes) > 1024 * 1024:
            raise ValueError('bounded library bytes required')
        if hashlib.sha256(library_bytes).hexdigest() != expected_sha256:
            raise ValueError('library identity mismatch')
        def unique(pairs):
            d = {}
            for k, v in pairs:
                if k in d:
                    raise ValueError('duplicate library key')
                d[k] = v
            return d
        self.lib = json.loads(library_bytes, object_pairs_hook=unique)
        if self.lib.get('schema') != 'safelab.frozen_hand_gesture_library.v1':
            raise ValueError('unknown library schema')
        if not isinstance(self.lib.get('source_sha256'), str) or not re.fullmatch('[a-f0-9]{64}', self.lib['source_sha256']):
            raise ValueError('actual source identity required')
        names = self.lib.get('joint_names')
        if names != list(expected_joint_names) or not names or len(set(names)) != len(names):
            raise ValueError('runtime joint order mismatch')
        self.n = len(names)
        self.sha = expected_sha256
        self.limits = self._vector(self.lib['lower']), self._vector(self.lib['upper'])
        if any(lo >= hi for lo, hi in zip(*self.limits)):
            raise ValueError('joint limits unordered')
        self.max_refinement = finite(self.lib['max_joint_refinement_rad'], 'refinement bound')
        if not 0 < self.max_refinement <= 0.1:
            raise ValueError('refinement must be small and explicitly qualified')
        presets = self.lib.get('presets')
        if not isinstance(presets, dict) or not 1 <= len(presets) <= 128:
            raise ValueError('bounded nonempty actual gesture library required')
        for preset in presets.values():
            for key in ('open', 'closed'):
                pose = self._vector(preset[key]); self._within_limits(pose)
            synergies = preset.get('synergies', {})
            if not isinstance(synergies, dict) or len(synergies) > 12:
                raise ValueError('invalid named synergies')
            for synergy in synergies.values():
                self._vector(synergy['basis'])
                bound = finite(synergy['bound'], 'synergy bound')
                if not 0 < bound <= 0.1:
                    raise ValueError('synergy bound exceeds contract')

    def _vector(self, v):
        if not isinstance(v, list) or len(v) != self.n:
            raise ValueError('joint vector length mismatch')
        return [finite(x, 'joint') for x in v]

    def _within_limits(self, pose):
        if any(not lo <= x <= hi for x, lo, hi in zip(pose, *self.limits)):
            raise ValueError('joint limits exceeded; no silent clipping')

    def compile(self, model_action):
        if not isinstance(model_action, dict) or set(model_action) != {'gesture_id', 'closure_fraction', 'named_synergy_delta'}:
            raise ValueError('only library selection, closure and named refinement allowed')
        gesture_id = model_action['gesture_id']
        if not isinstance(gesture_id, str) or gesture_id not in self.lib['presets']:
            raise ValueError('unknown gesture')
        c = finite(model_action['closure_fraction'], 'closure')
        if not 0 <= c <= 1:
            raise ValueError('closure outside [0,1]')
        preset = self.lib['presets'][gesture_id]
        baseline = [a + c*(b-a) for a, b in zip(preset['open'], preset['closed'])]
        deltas = model_action['named_synergy_delta']
        if not isinstance(deltas, dict) or any(k not in preset.get('synergies', {}) for k in deltas):
            raise ValueError('unknown refinement axis')
        change = [0.] * self.n
        for key, raw in deltas.items():
            d = finite(raw, 'refinement'); synergy = preset['synergies'][key]
            if abs(d) > synergy['bound']:
                raise ValueError('refinement bound exceeded')
            change = [x+d*b for x, b in zip(change, synergy['basis'])]
        if any(abs(x) > self.max_refinement + 1e-12 for x in change):
            raise ValueError('combined refinement exceeds joint bound')
        pose = [a+b for a, b in zip(baseline, change)]
        self._within_limits(pose)
        return {'hand_joint_position_rad': pose, 'gesture_id': gesture_id,
                'library_sha256': self.sha, 'joint_names': self.lib['joint_names'],
                'controller_generated': True, 'native_qualified': False}
