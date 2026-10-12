# T-537 — Other task acceptance panel

The panel covers the remaining project task families while existing Grasp and
PickPlace conversations keep their jobs. The inventory contains 23 baseline
dataset identities and 36 catalog entries including additions and history.

Paper Table 18 and Table 21 targets are shown for matched representative
instances. Table 2 aggregates are explicitly labeled as family averages.
Unknown identities, actual source randomization, full-trajectory SSR, native
SR, and final acceptance remain unknown until source-bound evidence exists.

Two stack ACT candidates have finite 100-episode, 36,000-frame, three-camera
inputs with 13-dimensional absolute joint actions matching recorded IK targets.
The paper ACT recipe is 5,000 epochs, batch 64, action chunk 4. Data staging
is a separate phase and contributes no optimizer updates or acceptance.
The first stream-transfer attempt is preserved for repair.

Validation: 16 real Chromium/evidence checks pass, including desktop/mobile,
filters, paper method order, unavailable and malformed live data, stale
snapshots, untrusted labels rendered as text, and privacy. Source input audits
pass for both candidates. No new full SR/SSR acceptance is claimed.

Deployment uses dedicated files, one additive homepage link, and a source-bound
public branch updater. Main is unprotected and has no active rulesets at the
checked API snapshot. No force push or existing native process intervention.

Follow-up: repair staging, verify real optimizer updates, reconcile existing DP
models, run native 50-episode evaluations, bind each task's safety constraints
and actual held-out reset support, retain data/config/checkpoint provenance.
