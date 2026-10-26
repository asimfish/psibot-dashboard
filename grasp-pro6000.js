'use strict';

// Keep current Pro6000 evidence separate from the existing historical browser.
function renderPro6000(snapshot) {
  const root = document.getElementById('pro6000Content');
  const add = (parent, tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    parent.append(node);
    return node;
  };
  const percent = value => typeof value === 'number' ? value.toFixed(1) + '%' : '未完成';
  root.replaceChildren();
  if (snapshot.schema !== 'grasp.pro6000.acceptance.snapshot.v1' ||
      snapshot.objects.length !== 21 || new Set(snapshot.objects.map(o => o.object)).size !== 21 ||
      snapshot.objects.some(o => o.object_accepted !== (o.DP.formal_accepted && o.ACT.formal_accepted)) ||
      snapshot.objects.some(o => o.object_accepted && !o.full_visual_passed) ||
      snapshot.objects.filter(o => o.object_accepted).length !== snapshot.objects_both_methods_formally_accepted ||
      snapshot['5090_results_included'] !== false) {
    add(root, 'p', 'Pro6000 验收快照不一致，暂不显示通过数量。', 'note');
    return;
  }
  add(root, 'p', '核验时间：' + snapshot.updated_utc + ' · ' + snapshot.pipeline.state_note, 'muted');
  const metrics = add(root, 'div', undefined, 'status-grid');
  for (const [title, value] of [
    ['DP + ACT 完整通过', snapshot.objects_both_methods_formally_accepted + ' / 21'],
    ['已登记活跃作业（快照）', String(snapshot.pipeline.active_registered_jobs)],
    ['规格就绪、尚未提交', String(snapshot.pipeline.prepared_not_submitted.length)],
    ['采集与测试主线', 'Zenith Pro6000']
  ]) {
    const item = add(metrics, 'div');
    add(item, 'span', title);
    add(item, 'strong', value);
  }
  add(root, 'p', '当前阻塞：原端尚未确认停止。接管后先跑 DP 修复版重训、合格源重采和 b50 reset 小测；不重复提交旧任务。', 'note');
  const measured = add(root, 'details');
  add(measured, 'summary', '已出测试结果：漏斗、研钵和 50ml 烧杯（均未完整验收）');
  const wrap = add(measured, 'div', undefined, 'table-wrap');
  const table = add(wrap, 'table');
  const header = add(add(table, 'thead'), 'tr');
  ['物体 / 方法', '论文 SR / SSR', '实测 SR', '已报告 SSR / 位置分量', '模型详情'].forEach(t => add(header, 'th', t));
  const body = add(table, 'tbody');
  for (const run of snapshot.runs) {
    const object = snapshot.objects.find(o => o.object === run.object);
    const result = object[run.method];
    const row = add(body, 'tr');
    add(row, 'td', object.name + ' · ' + run.method);
    add(row, 'td', object.paper[run.method + '_SR'] + '% / ' + object.paper[run.method + '_SpatialSSR'] + '%');
    add(row, 'td', percent(result.SR) + '（' + run.progress.episode_success_num + '/150）');
    add(row, 'td', typeof result.SpatialSSR_reported === 'number' ?
      percent(result.SpatialSSR_reported) + '（后处理报告，完整视觉待审）' :
      percent(result.success_and_terminal_dP20) + '（仅成功且终点≤20mm，非完整SSR）');
    const link = add(add(row, 'td'), 'a', '在选择器中查看');
    link.href = '#' + new URLSearchParams({object: object.paper_id, method: run.method, run: run.candidate});
    link.addEventListener('click', () => document.getElementById('browser').scrollIntoView());
  }
  add(measured, 'p', '漏斗 ACT：+0 / +1 / +2 / +3cm 分组 SR 为 100 / 89.7 / 69.4 / 47.2%。SR 偏高的范围复核待确认；不能据此把物体记为通过。', 'muted');
  add(measured, 'p', '研钵 ACT 有 145/150 试次表面交叉；b50 测试 reset 倾倒导致结果失效。失败试次全部保留，修复后使用新版本复测。', 'muted');
  const all = add(root, 'details');
  add(all, 'summary', '21 个物体的当前源数据、论文目标和下一步');
  const allTable = add(add(all, 'div', undefined, 'table-wrap'), 'table');
  const allHeader = add(add(allTable, 'thead'), 'tr');
  ['物体', 'DP 论文 SR / SSR', 'ACT 论文 SR / SSR', '当前证据与下一步', '完整通过'].forEach(t => add(allHeader, 'th', t));
  const allBody = add(allTable, 'tbody');
  for (const object of snapshot.objects) {
    const row = add(allBody, 'tr');
    add(row, 'td', object.name);
    add(row, 'td', object.paper.DP_SR + '% / ' + object.paper.DP_SpatialSSR + '%');
    add(row, 'td', object.paper.ACT_SR + '% / ' + object.paper.ACT_SpatialSSR + '%');
    add(row, 'td', object.status_note, 'pro6000-object-note');
    add(row, 'td', object.object_accepted ? '通过' : '待验收');
  }
  const next = add(root, 'details');
  add(next, 'summary', '接管后已准备的四份规格与修复证据');
  const list = add(next, 'ul');
  snapshot.pipeline.prepared_not_submitted.forEach(text => add(list, 'li', text));
  add(next, 'p', 'DP 使用真实 EMA 和原始源观测的离线对比已复现图像输入差异；4帧来自1个episode，不能当作闭环成功率改善。修复已通过有符号RGB回归检查，仍需重新训练及原生小测。');
  add(next, 'p', 'b50 候选只改变生成高度，保留既有XY位置并恢复2mm校验；5-trial原生小测尚未执行。节点汇总对DP关闭状态的误报另行修复，不改变原生SR。');
  add(root, 'p', snapshot.evidence_note, 'muted');
  const source = add(root, 'a', '查看当前 Pro6000 数据快照');
  source.href = 'results/grasp_pro6000_current.json';
}
