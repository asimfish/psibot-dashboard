# SafeLab Astra capability report

Refs: T-519

Published at `/psibot-dashboard/astra.html`. This panel reorganizes verified existing experiments; it does not represent a new model or simulator run.

The main robosuite matrix is 15 conditions × 20 episodes. Historical prompt versions, FR3/PsiBot pilot studies, the unfinished 20×7 campaign and the selected privileged-state collect41 example retain their separate protocols and denominators. The 405-row catalog overlaps aggregate tables; never sum those counts to claim unique benchmark coverage. The campaign snapshot is September 18, 2026, not current resource state.

`experiments.json`: grouped results and native phase criteria. `episodes.json`/`episodes.csv`: per-episode evidence catalog. `decision_traces.json`: 30 previously public episodes, 276 decisions; numerical actions, execution feedback and current RGB inputs, without private reasoning. `provenance.json`: source artifact and original published-video hashes. `next_protocol.json`: an unexecuted proposal.

New page verification covers results recounts, source-data filtering, accessible navigation/tabs, desktop/mobile layout, video metadata/playback, evidence links and preservation of all unrelated homepage bytes. Deployment is through an ordinary branch/PR followed by exact Pages and served-byte verification.
