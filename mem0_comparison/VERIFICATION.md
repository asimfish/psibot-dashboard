# T-1024: Mem-0 V13/latest paired comparison

Source: T945 V13 single-environment 200 cases and T952 latest 400 cases.
Every pair matches execution horizon, side, scene seed and model seed. Unknown observer outcomes are separate and remain in the denominator.

Verification: exact result SHA matches for 10 fetched latest cases; original video SHA and ffprobe 640x480 / 15Hz / decoded frame counts checked. Browser exercised all 10 pairs, instruction transitions, playback, terminal freeze, horizon/pattern filters, unavailable media clearing, and 390px mobile layout. JavaScript syntax and text credential scan passed.

Changes: new mem0_comparison directory and one main-sidebar link. No evaluation jobs, thresholds, model inputs, sources or old pages changed. Historical chest results remain explicitly separate.

Limits: 200 pairs have complete scores; 10 pairs have dual videos. The separate one-App/GPU control is an explicitly timestamped partial snapshot. Observed instruction-switch failures are not a proven rendering/training root cause.
