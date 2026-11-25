# UR5e beaker grasp

Grasp and lift the 100 mL glass beaker with the UR5e and Robotiq 2F-85. The 100 unique native successes use six arm joints followed by the Robotiq finger driver. Action is commanded and state is measured in radians. Raw head, chest, and third cameras share the 30 Hz clock. The object and end effector use world XYZ in metres and WXYZ quaternions. The full-episode peak is the maximum force norm over hand-link and target pairs at 120 Hz. Its gate is 25 N. Terminal object position tolerance is 20 mm and unexpected contact reporting threshold is 1 N. The WillowTable is kinematic in both collection and evaluation, matching the accepted FR3 press scene. The UR5e base overlaps the desktop by 36.978 mm (FR3 47.010 mm). The approach is aligned to the measured beaker pose. The first and final recorded poses of both the table and mounted base must agree with the nominal scene within 0.01 mm and 0.01 degrees after normalizing quaternions. Source poses are retained. User review pending.

## 采集通过率与初始位姿覆盖

截至 2026 年 11 月 25 日。主集含 100 条唯一、逐条通过技术验收的示范，待用户终审。以领取种子为分母，230 次尝试中有 100 次入集（43.48%）。216 次产生原生终态判定，其中 100 次入集（46.30%）。14 次进程以 -11 退出，其中 13 次未留下初始位姿，1 次已进入抓取阶段。所有已领取种子均有终态收据。零次有证据明确指向逆解失败。

| 批次 | 尝试 | 入集 | 仅姿态或倾转超限 | 仅力超 25 N | 姿态和力均超限 | 进程 -11 |
|---|---:|---:|---:|---:|---:|---:|
| 原分片 A | 26 | 11 | 8 | 2 | 5 | 0 |
| 原分片 B | 28 | 11 | 5 | 3 | 6 | 3 |
| 原分片 C | 27 | 9 | 10 | 1 | 6 | 1 |
| 原分片 D | 29 | 15 | 7 | 2 | 2 | 3 |
| 原四分片合计 | 110 | 46 | 30 | 8 | 19 | 7 |
| 四个续作合计 | 120 | 54 | 33 | 5 | 21 | 7 |
| 合计 | 230 | 100 | 63 | 13 | 40 | 14 |

三个力或姿态失败列互斥；“仅”限于力和姿态这两个判据。姿态包括终态姿态、整段倾角或累计偏转。116 个有原生判定的失败回合全部到时结束，其中 31 条还触发过全程水平偏移门槛，1 条终点误差超 20 mm。53 条超过 25 N，其中 38 条峰值发生在抬升、15 条发生在闭合。逐物理步复算显示，116 条均有过双侧手指接触，且最高抬升至少 117.97 mm；47 条抬离 5 mm 后至少有一个物理步单侧接触降至 0.15 N 或以下。在这些失败回合里，闭合开始前两侧手指均无超过 1 N 的杯接触，全程无超过 1 N 的非预期接触。0.15 N 只用于描述接触持续性。

### 杯子离底座越远，这批样本的通过率越低

距离为复位杯中心到底座的水平距离。分界取原批 103 条有终态的起点距离四分位，直接用于续作。每格为入集数 / 有原生终态的回合数。

| 初始水平距离 | 原四分片 | 续作 | 合计 | 合计入集率 |
|---|---:|---:|---:|---:|
| <476.8 mm | 15/26 | 14/27 | 29/53 | 54.7% |
| 476.8–493.3 mm | 12/25 | 13/27 | 25/52 | 48.1% |
| 493.3–503.7 mm | 12/26 | 13/24 | 25/50 | 50.0% |
| ≥503.7 mm | 7/26 | 14/35 | 21/61 | 34.4% |

以最初的远距四分位为界，61/216 个有效起点属于远侧，100 条入集示范中只有 21 条属于远侧。采样区域划为 3×3 个 20 mm 平面格后，九格均有成功例。并未覆盖随机杯朝向；本配方只随机化平面位置。按杯子相对底座正前方的水平角分为四档，从负角到正角，入集数/有效尝试为 25/47、28/57、26/57、21/55。入集率描述专家在本批起点上的表现；100 条示范本身均通过原有数值和固定物门槛。

| 世界 Y 范围（mm）／世界 X 范围（mm） | −1173 至 −1153 | −1153 至 −1133 | −1133 至 −1113 |
|---|---:|---:|---:|
| −5322 至 −5302 | 8/23 | 5/13 | 9/30 |
| −5302 至 −5282 | 13/22 | 16/27 | 10/32 |
| −5282 至 −5262 | 10/18 | 18/32 | 11/19 |

后续复验将分别统计近、远侧相同种子的原配方与修正配方。修正候选在接触区减慢合指，并在抬升前保持开度。8 个实测起点通过 CPU 指令检查，实际合格率需要仿真验证。本主集来自原配方。
