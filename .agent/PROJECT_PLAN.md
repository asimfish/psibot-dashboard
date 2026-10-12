# Astra input ablation experiments

## Outcome
Determine, for actual gpt-6-astra/xhigh robot control, which available input channels affect physical task success, task retries, and elapsed time. Publish matched input images, original videos, and auditable paired statistics on the dashboard.

## Current State
As of2026-10-12:47 accepted formal outcomes (FR3 36, Psi grasp6, Psi100ml A→B3, roundtrip2), with325 actual signed Astra/xhigh responses. No condition has20 accepted matched states and no input-effect conclusion. The two new roundtrip cases are valid physical failures; minus_S completesA→B only (2/4). ControllerV6 runs one10-case registered roundtrip batch (v27), with originals retained and no automatic replay. Single GPU, original21day/210job/45600request limits, storage guards80GiB/16GiB, no training. Public47-case candidate now contains all50 cohort rows, exact inputs and matching videos; input/media/source checks and16 real-browser checks pass. Live report remains12cases pending independent review and verified deployment.

## Acceptance
- Four tasks, 1000 registered trials: FR3 13 x 20, Psi grasp 13 x 20, 100ml pick/place 12 x 20, 100ml roundtrip 12 x 20.
- Exactly matched canonical initial state across each condition at seeds 11000-11019; frozen controller, hand preset semantics, model, and task budget within each task.
- Separate S/J/K/F/H/M/C, individual camera removal, and half-resolution; inspect actual serialized model inputs for leakage and unchanged retained channels.
- Success judged by physical task oracle; invalid infrastructure attempts preserved separately and replaced with explicit new attempt IDs.
- Count task retries, calls, model latency, physical control time, and full wall time; report failed/censored cases separately from successful completion times.
- Per-condition at least 20 valid accepted cases, paired effect estimates with uncertainty; uncertainty remains a result when evidence cannot establish an effect.
- Hand library selection plus bounded refinement only; no free joint output. At most three GPU jobs concurrently; sequential batches, no training fanout.
- Input images and same-episode videos appear together with results; every video decodes and is checked for viewpoint/render/outcome quality.

## Milestones
- [x] Publish first 12 accepted original formal cases (T-001/T-002).
- [x] Preserve and audit Psi provider interruption and 100ml physical failure (T-003).
- [x] Accept remaining13 old originals and14 new native originals (39 accepted total).
- [ ] Complete bounded successor execution and all paired cohorts.
- [x] Verify first formal100ml pick/place success, original three-view videos and25 library-refined hand actions. Roundtrip remains incomplete.
- [ ] Publish paired success/retry/time analysis and per-condition evidence.

## Task Board
- [ ] T-007 - Publish readable53trial Astra input comparison panel with exact original media reuse (owner: safelab_astra_publication007)
- [ ] REV-006 - Independent review of47 accepted Astra publication snapshot (owner: snapshot47_review)
- [x] T-005 - Continue registered Astra ablations after terminal reconciliation and verify input-video comparisons (owner: safelab_astra_resume005)
- [ ] T-004 - Complete experiments and research-question coverage (owner: safelab_astra_web004, in_progress).

Historical claims and review tasks retain their own workflow records; this plan does not release or reassign them.

## T-005 continuation
Primary workflow: Pipeline (diagnose → execute → audit → report). Isolated checkout preserves old claims and originals.47 accepted/325 actual replies. Persistent ownerV6 continues one10-case batch at a time, quarantines4 interrupted IDs and retains originals. v27 has actual model and native outcomes; two closed cases individually accepted, remaining cases running. Current review phase publishes only this verified47-case snapshot, not completion of1000 trials or input-effect analysis. No full-study finish.

## T-007 publication phase
Primary workflow: Pipeline (audited reader → deduplicated media → publication gate → independent root review → GitHub publication). Publish a precise53/472 snapshot; keep47 history and the incomplete50 n20 cohorts/46 paired contrasts explicit. No changes to root T-006 execution ownership or scope.

T-007 publication result: exact53/472 fixed snapshot deployed at https://asimfish.github.io/psibot-astra-experiments/ (main b261effe2d7eb67cb41542be6090b950a0203fbc,91.52MB;350originals reused/54neworiginals,zero reencoding). Actual public bytes and36PNG/18MP4browser acceptance passed;dashboard entry PR next. This publication preserves47history and does not finish or change rootT006/scientific cohorts.
