# SafeLab Astra capability report

Refs: T-519

Published at `/psibot-dashboard/astra.html`. This panel reorganizes verified existing experiments; it does not represent a new model or simulator run.

The main robosuite matrix is 15 conditions × 20 episodes. Historical prompt versions, FR3/PsiBot pilot studies, the unfinished 20×7 campaign and the selected privileged-state collect41 example retain their separate protocols and denominators. The 405-row catalog overlaps aggregate tables; never sum those counts to claim unique benchmark coverage. The campaign snapshot is September 18, 2026, not current resource state.

`experiments.json`: grouped results and native phase criteria. `episodes.json`/`episodes.csv`: per-episode evidence catalog. `decision_traces.json`: 30 previously public episodes, 276 decisions; numerical actions, execution feedback and current RGB inputs, without private reasoning. `provenance.json`: source artifact and original published-video hashes. `next_protocol.json`: an unexecuted proposal.

New page verification covers results recounts, source-data filtering, accessible navigation/tabs, desktop/mobile layout, video metadata/playback, evidence links and preservation of all unrelated homepage bytes. Deployment is through an ordinary branch/PR followed by exact Pages and served-byte verification.

## Input and video audit revision

Refs: T-529

The report now leads with the input-dependency research question, an actual S/J/K/F/H mask matrix, same-seed outcomes and request/wall costs. Current RGB, task/budget text, model-written textual memory and categorical status are retained in all seven FR3 conditions; `minus_H` is not memory-free and `rgb_only` is not literally pixels-only. The pilot has two seeds and no stochastic replications, so necessity, dispensability and significance are not established. Other interface/input-bundle and reasoning-effort comparisons remain separate.

`input_ablation.json` reconstructs 14 paired attempts from the existing 276-decision registry, without new robot/model runs. `video_audit.json`/`video_audit.csv` contain 407 camera/missing-media rows covering 405 catalog episodes: 402 video streams (400 primary plus 2 additional collect41 cameras) and 5 episodes with no video URL. Every stream was fully decoded and hashed; actual agent visual inspection covers 1,110 Panda sample frames plus nine-frame FR3/PsiBot and native-stage samples. This is explicitly sparse visual review, not all-frame playback quality certification.

Two PsiBot recovery files contain only about 1.1 s of initial state, consistent with their source action_time_s=0; they are not mislabeled as corrupt recordings. Seven Panda samples have insufficient critical action visibility. Native metrics and visual observations remain distinct, including a Square frame with apparent geometric completion but a False original metric. Videos are unaltered; contact sheets are timestamped extracts. No private model reasoning, host/session identities or local source paths are published.

Validation includes paired-mask/outcome recounts, stream SHA and decode coverage, actual desktop/mobile browser journeys, hierarchical filters, matching pair-to-video/trace navigation and privacy-boundary checks. The terminal semantic review is conducted by another model as required by the reporting skill.
# Input requirements report v5

`input_study_v5.json` derives a task/condition matrix from the retained original episode and decision records; it does not add experimental outcomes. Camera examples in `input_image_provenance_v5.json` bind unaltered published PNG bytes. `protocol_v5.json` and `trial_schedule_v5.csv` prepare13 conditions with20 initial-state seeds per task. Every new schedule row is `not_run`, and initial-state/runtime pins remain `UNBOUND`.

`gesture_adapter_v5.py` is an offline action compiler for a trusted actual library export. It accepts preset selection, closure and bounded named refinements; it rejects model-written absolute hand angles/free joint delta vectors. The user's actual gesture library and native integration are not yet bound. `trial_metrics_v5.py` accepts only explicitly attempted outcome records, keeps missing retry events null, and never turns a normal model call into a physical task retry. `test_contracts_v5.py` uses synthetic fixtures, not native experiment results.
