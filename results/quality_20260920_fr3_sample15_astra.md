# Astra FR3 sample15 视频独立复核

**总体：FAIL；正式数据 0。** 强化夹持后，画面显示烧杯被夹爪携带通过 lift/transport，并在 pour 阶段仍位于夹爪中；本样片在倒液过程中因粒子 spill gate 于控制 step 408 提前结束，未进入 pour_hold、return 或 release/retreat。因此无法证明完整倒液、释放和撤手。

来源：`/home/liyufeng/ops/safelab_quality_recovery_20260918/resume_20260920/fr3_sample15/`。三视频均 640×480、30fps、409 帧、13.633s。实际 view_image 查看每机位均匀抽帧（0、1.5…13.5s）、pour 加密帧（10.2–13.5s 每0.3s）和末段帧；抽帧覆盖不能排除瞬时碰撞或微小滑移。

## 画面判定

| 项目 | 判定 | 时间证据 |
|---|---|---|
| 透明材质 | PASS（局部外观） | chest 0–10s 源烧杯边缘/内部红色液体可见；pour 10.2–13.5s 杯壁仍呈透明/半透明。不能据此证明所有材质参数或液体物理正确。 |
| lift / transport 稳定夹持 | PASS（抽样） | 约6.0s起升，7.5–10.0s 杯子离桌并随夹爪移动；未见明显掉杯。 |
| pour 阶段仍夹持 | PASS（直到终止） | 10.2s（约step306）仍近竖直接近接收杯；10.8s（step324，日志 pour 起始）开始倾斜；11.4–13.5s 三视角持续看到杯子连接在夹爪上，无 sample13 那种明确脱离。 |
| 滑杯/倾倒姿态 | UNDETERMINED | 10.8–13.5s 姿态按计划逐步倾斜；没有足够像素和独立末端/杯相对位姿数据判断微小滑移。没有看到杯子从夹爪脱离。 |
| 液体倒入接收杯 | FAIL（完整任务） | 视频在约13.6s终止，尚未出现 pour_hold 完成、return、release 或 retreat；不可从可见红色粒子判断接收量。 |
| 相机视野 | PASS（有限） | chest 侧视最清楚地显示源杯/接收杯和桌面；head 正面能看见末端但腕部在部分时刻遮挡接触细节；third 俯视能看相对平面位置但不能证明高度或接触力。 |
| 碰撞/穿模 | UNDETERMINED | 抽样未见明确障碍碰撞或穿模；遮挡、透明材质和逐帧覆盖不足以排除瞬时碰撞。 |

## 日志对齐与终止

`collection.log` 的轨迹为 540 步：lift 176–226，transport_descend 268–323，pour 从 **step324** 开始。视频帧约等于控制步/30fps，故 pour 起点约10.8s，终止 step408 约13.6s。日志第10205行记录 `[PourStrictFailureGate] irreversible particle spill envs=[0]`，第10215行原生0/1，10299行 `[PLAY_LOOP_EXIT] max_episode reached ... sim_step=409`；视频保存409帧，正好只覆盖至 spill gate 附近。没有记录 release/retreat 的实际动作，因为它们尚未执行。

粒子分区日志反复标注 `quality_verdict=observation only; no formal qualification`；末段出现 `actual_cavity_source=591/630`、`outside_cavity_and_native_receiver=39/630`，是诊断观察口径，不能替代接收杯独立腔体验收。`PROCESS_EXIT.json` 标为 `returncode=0`, `formal_credit=0`, `classification=diagnostic_only_not_formal`, `cleanup_complete=true`；退出码只表示诊断清理结束。

## 最早异常与建议

最早明确的质量结论不是夹持脱离，而是**任务在 pour 中段被不可逆 spill gate 截止**：约13.6s / step408。画面中源杯仍在夹爪中，故本样片不支持“强化夹持仍然脱杯”的说法；它也没有完成释放验证。下一步应保留 spill 前后逐 physics 粒子—杯口—接收杯相对位姿、接触和速度 trace，区分液体越过源杯/接收杯腔边界、腔体定义误报与真正外溢；在 spill gate 通过且全程夹持后，才能审核 pour_hold、return、release 和撤手。

未改源码、资产、作业、日志或视频。
