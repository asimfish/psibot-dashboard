# 剩余任务视角与时长核对（2026-11-14）

用户已批准重采重训：新设置已验收0项；旧视角Press ACT/DP共2项待新设置重验，原指标与证据保留。

## 已验收项目

| 项目 | 本体 | 策略实际三路输入 | 原图→策略 | 示范首末跨度：中位/最短/最长 | 评测时限 |
|---|---|---|---|---|---|
| 离心机按钮 ACT | PsiBot | head_camera / chest_camera / third_camera | 640×480→224×224 | 36.800/36.800/36.933 秒 | 40 秒 |
| 离心机按钮 DP | PsiBot | head_camera / chest_camera / third_camera | 640×480→224×224 | 36.800/36.800/36.933 秒 | 40 秒 |

时长口径：100actualHDFfirst/lasttimestampsreadback。源135已读回实际时间戳；旧RGB实际7.5Hz，不冒称30Hz。

## 可见性数字

Press：每相机45个事件样本（5条示范×9帧），整机完整0/45，按钮/接触界面可辨0/45，均为0%。全100条全程无遮挡比例仍未知。

- 两项Press实际本体均为PsiBot，非FR3；均使用head/chest/third全部三路，没有腕部相机。
- Press头部/胸前在边界裁切设备，第三视角机壳遮挡交互；135个已人工核查事件子帧中，每相机整机完整及按钮可辨均0/45。不可把该样本比例冒充全100条全帧比例。
- 旧Press实际记录7.5Hz，单条首末观测跨度约36.8秒；已直接核对source135时间戳36.9333秒。新数据30Hz是新版本要求，不能把旧文件标成30Hz。
- Handover旧示范的操作阶段，胸前相机中容器被上边界裁切，头部被双手遮挡。
- Stack100抓握阶段源杯靠头部画面右边缘；第三视角目标很小。源杯与目标位姿的全量可见率仍需绑定后计算。
- FR3开柜三路是历史接口名，不代表已有腕部视角。Raw100扩量及未提交的旧视角训练恢复暂缓；已受理或运行的作业未取消。

## Press

正式100条中的源示范135：首帧、真实按压峰值事件、末帧；640×480原始RGB。ACT和DP均用这三个视角缩放到224×224。

![Press](https://raw.githubusercontent.com/asimfish/psibot-dashboard/feature/t-537-other-task-acceptance/audits/view-duration-nov14/press.webp)

## Cabinet

当前Raw16原始回放：首帧、抓握指令阶段、末帧。抓握阶段不是独立接触证明。

![Cabinet](https://raw.githubusercontent.com/asimfish/psibot-dashboard/feature/t-537-other-task-acceptance/audits/view-duration-nov14/cabinet.webp)

## Cabinet旧训练对照

FR3旧训练图像：首帧、抓握指令阶段、末帧。含历史图像预处理，不冒充Raw16。

![Cabinet旧训练对照](https://raw.githubusercontent.com/asimfish/psibot-dashboard/feature/t-537-other-task-acceptance/audits/view-duration-nov14/cabinetlegacy.webp)

## Handover

PsiBot旧示范0：首帧、接收手抓握指令阶段、源示范末帧。画面原样保留，未改相机。

![Handover](https://raw.githubusercontent.com/asimfish/psibot-dashboard/feature/t-537-other-task-acceptance/audits/view-duration-nov14/handover.webp)

## Stack100

PsiBot真实训练VDS：首帧、抓握指令阶段、训练末帧。不是其他任务图片。

![Stack100](https://raw.githubusercontent.com/asimfish/psibot-dashboard/feature/t-537-other-task-acceptance/audits/view-duration-nov14/stack100.webp)

## 边界

- 完整无挡的全100示范逐帧比例尚未计算，不以在画面内或重投影代替无遮挡。
- 画面倾斜感不能单独证明设备物理基座倾斜；需结合基座平面与重力方向核对。
- 非Press的抓握锚点按动作指令选取，不是传感器已证明的接触时刻。

旧指标和原数据保留；新场景版本、数据和独立3×50分开登记。
