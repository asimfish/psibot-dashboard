# Astra UR5e fix1 sample6 三机位独立视频复核

**视频行为结论：限定 PASS；正式验收结论：FAIL（formal credit=0）。** 这次 fix1 画面中未复现 sample2 的 release_hold 腕部大跳或量筒倾倒：量筒在落地后保持直立，夹爪平稳撤离。视频仍不能独立证明瞬时碰撞/穿模，且日志本身将本 run 的正式 credit 置为0，因此不能把它计入正式数据集。

来源目录：`/home/liyufeng/ops/safelab_quality_recovery_20260918/resume_20260920/ur5e_fix1_sample6/runs/ur5e_camera_glass_fix1_remote_sample6/diagnostic_videos/`。三路均640×480、30fps、650帧、21.6667s。实际 view_image 检查均匀帧（约0–19.5s每2.167s）、release/末段加密帧（19.2–21.6s），并按三机位对照。

## 判定

| 项目 | 判定 | 证据与限制 |
|---|---|---|
| 透明量筒外观 | PASS（局部外观） | head 0–10.8s、chest 0–19.5s可见透明筒壁、刻度/背景透射；不能由视频证明全部材质配置。 |
| 抓起/运输 | PASS（抽样可见） | 约6.5–10.8s量筒离桌并随夹爪运动，未见掉落。 |
| release_hold 后末端跳变 | PASS（未观察到） | chest 19.2–21.6s夹爪姿态连续，未见sample2中19.567s同类腕部横甩；third同步显示末端XY小幅后撤。图像抽样不能证明每个physics子步无跳变。 |
| 量筒直立与释放 | PASS（视频行为） | chest 19.2s量筒已在目标处近竖直，至21.6s仍直立；夹爪逐步远离。head因腕部遮挡部分细节，third显示量筒/目标相对位置稳定。 |
| 场景/夹爪/量筒碰撞或穿模 | UNDETERMINED | 三路未见明确撞击或穿模；透明物体、腕部遮挡及非逐帧全覆盖不足以排除瞬时碰撞。 |
| 机位可审性 | PASS（有限） | chest最适合判断直立和撤手；third适合平面目标对齐；head在接触区被腕部/关节遮挡，不能独立证明接触。 |
| 正式验收资格 | FAIL | collection.log虽有1/1原生结果，但该 run 的诊断视频/输出未赋 formal credit；用户指定 formal credit=0。视觉PASS不能覆盖数据门。 |

## 日志对齐

collection.log 显示轨迹总计670步，含 `release_hold` 6步、`release` 22步、`retreat` 54步。末端阶段完成到控制649后 reset；`success_ids=[0]`、原生统计 `成功率:100% (1/1)`。landing predicate 在648–649维持 `landed_before=true`、物体线速度约0.0015→0.0004m/s、`post_landing_down_peak=0`，reset前 SSR force peak 14.09N。日志说明该 run 原生成功，但这不改变 formal credit=0 的外部准入结论。

视频末段约19.2s对应 release_hold/release 起点附近；约19.2–20.3s量筒在目标处稳定，20.5–21.6s夹爪继续后撤。视频结束时未见重置画面覆盖旧 episode 末态；不过逐步映射仍应以同 run frame/control trace为准。

## 最小后续建议

1. 保留 fix1 的 release_hold/撤手配方，补一份逐physics的arm execution mask、wrist joint delta、物体姿态和接触冲量 trace，确认“无跳变”覆盖全部release_hold步。
2. 增加可见接触区相机或短时局部放大，减少head腕部遮挡；保持chest/third用于直立与目标对齐。
3. 重新运行一次具有正式 credit、完整原始输出和逐physics碰撞审计的单样片；在该门通过前，当前视频只作诊断证据，不准入数据集。

本报告未修改源码、作业、日志或原始视频，仅生成独立报告与抽帧文件。
