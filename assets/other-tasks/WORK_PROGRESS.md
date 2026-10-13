# T-537 — Other task acceptance panel

This panel covers 23 baseline identities and 36 catalog entries outside Grasp
and PickPlace. Nine task categories have a sidebar, separate tables and domain
summaries. Within each category, rows are ordered by embodiment and object.
Desktop buttons and the mobile selector share one filter; robot and object
filters apply within the selected categories. Seed job details are collapsed
by default. Existing Grasp and PickPlace files are not changed.

Paper Tables 18 and 21 references are shown for matched representative
instances. Table 2 aggregates remain labeled as category averages. Unknown
native SR/SSR, actual reset coverage and final acceptance remain unknown.

Both PsiBot stack sources have 100 episodes / 36,000 frames / three real RGB
cameras and 13-dimensional IK target actions. All six independently seeded
ACT runs completed 5,000 epochs / 10,000 optimizer updates. Both hosts were
read directly; model, config, normalizer and optimizer state for all six runs
were independently checked against their completion SHA manifests on
persistent storage. No formal native50 SR/SSR result has been produced.

A connection failure preserves a source-matched immutable training completion
receipt while separately labeling current connection status as unavailable.
Transient optimizer progress is never promoted to completed training.
Multi-seed task rows aggregate all seeds rather than displaying only the last
read seed. These changes do not create native acceptance credit.

Validation: 24 real Chromium checks cover category grouping/order/navigation, robot and object
filters, mobile layout, paper method order, unavailable/malformed/stale data,
untrusted text, privacy and independent seed labels. Dedicated files are
published with a task-scoped conventional commit and ordinary PR.

Next frontier: bind original per-task safety calibrations and actual held-out
reset support, repair isolated native metric implementations, prepare a
qualified DP recipe and execute native50 tests with frozen checkpoint hashes.
Pro6000 received no new training jobs. Full task acceptance remains open.

Completed workers show their historical training GPU; released cards are not
shown as current or planned allocations.
