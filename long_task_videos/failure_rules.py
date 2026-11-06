"""long-task-failure-v2 visualization rule metadata.
The executable classifier and frozen-oracle replay are in feature_extractor.py.
It checks raw SHA, exact oracle events, per-case final/max phases and release evidence.
Expected target per cup: not yet weighed -> pan; weighed -> own pad.
A debounced release that advances either protocol cannot be a wrong-target failure.
Later robot recovery or correct placement clears an earlier candidate.
Select the last uncorrected irreversible event; timeout markers show last progress.
No model-causal claim is made by an observable failure label.
"""
LABELS={'success': '整任务成功', 'no_grasp': '第一个物体始终没抓起', 'toppled': '物体倾倒终止', 'dropped': '搬运中掉落', 'wrong_target': '放错目标或顺序', 'no_release': '目标上方未松手', 'stuck': '中途卡住或反复运动超时', 'other': '其他 / 证据不足', 'unknown': '原始日志未知或校验失败'}
