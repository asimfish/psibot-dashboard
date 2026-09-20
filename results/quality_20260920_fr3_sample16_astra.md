# Astra FR3 sample16 视频独立复核

**总体 FAIL；正式数据 0。** 相比 sample15，-75°配方把诊断推进了约一个控制步（spill 在 step409，而 sample15 在 step408），但仍在 pour 中因不可逆粒子 spill gate 终止，未进入 `pour_hold`、`return`、`release` 或 `retreat`。未见强化夹持导致的脱杯；也没有完整倒液或释放证据。

三路 MP4 均 640×480、30fps；sample16 各409/410帧，约13.63/13.67秒。实际通过 view_image 查看三机位均匀抽帧（0–13.5s每1.5s）、pour加密（10.2–13.6s每0.3s）及spill末段（13.0–13.6s每约0.067s）。抽样仍不能排除瞬时碰撞、微滑移或不可见液体流。

| 项目 | 判定 | 视频证据 |
|---|---|---|
| 透明材质 | PASS（局部外观） | 源烧杯边缘与红色内容物在侧视/俯视可见，未变成不透明实心；不能外推全资产或液体物理。 |
| lift/transport抓持 | PASS（抽样） | 约6–10s源杯离桌并随夹爪移动；未见sample13式脱夹。 |
| -75°倾倒姿态 | PASS（动作执行，非任务通过） | 10.8s左右进入pour，之后源杯逐步侧倾，13.0–13.6s仍在夹爪上；姿态与配方一致。 |
| 滑杯/脱离 | UNDETERMINED（未见明确脱离） | 末段三机位仍显示杯子连接夹爪；微小相对滑移无法由640px视频定量。 |
| 接收杯/液体转移 | FAIL/UNDETERMINED | 目标接收杯在胸视/俯视可见，但未见可确认液流或独立receiver cavity命中；视频在spill gate前后结束。不能宣称倒液成功，也不能仅凭画面定位腔体偏差。 |
| 碰撞/穿模 | UNDETERMINED | 抽样未见明确障碍撞击；遮挡和透明物体限制瞬时判断。 |
| 机位 | PASS（有限） | chest最适合看源杯与目标杯相对高度；head可看机器人正面但接触被末端遮挡；third可看XY关系，不能证明Z/接触力。 |

## 日志对齐

轨迹同样为 `pour` 从 step324 开始（约10.8s），`pour` 119步。sample16 在 step409/phase pour 85/119 记录 `[PourStrictFailureGate] irreversible particle spill envs=[0]`（collection.log约第10213行），随后原生0/1，`PLAY_LOOP_EXIT ... sim_step=410`；视频正好只覆盖spill终止附近。sample15 对应 spill 在 step408、sim_step409，因此 -75°只带来约1步延迟，未解决外溢门。

末段独立分区仍显示 `native_receiver_exclusive=0`，`outside_cavity_and_native_receiver`约38/630（约6.0%），但日志明确 `quality_verdict=observation only; no formal qualification`，且 receiver boundary 是待独立测量的native mask，不能把该统计当作真实接收杯腔体命中或失败的唯一证据。`PROCESS_EXIT.json` 为 returncode0、formal_credit0、diagnostic_only_not_formal；退出码仅表示清理结束。

## 最小下一修改建议

先不要继续只调倾角。保留 -75°，增加一个单变量的**粒子—几何观测修复**：逐 physics step 同时记录源杯口、目标接收杯内腔（真实碰撞几何，而非actor-centered cylinder）、粒子位置/速度和源杯姿态，并将 spill gate 拆分为“源杯外溢”“接收杯腔命中”“未归类”三类。这样可区分是接收杯目标/腔体偏置、粒子发射/流体离散，还是实际轨迹导致的外溢。仅在该区分完成后再调整 pour offset/角度；释放与撤手必须等 spill 不触发且 `pour_hold` 完整运行后才验收。

未改源码、资产、作业、日志或视频。
