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
      (typeof snapshot.methods_formally_accepted === 'number' && snapshot.methods_formally_accepted !== snapshot.objects.reduce((n, o) => n + Number(o.DP.formal_accepted) + Number(o.ACT.formal_accepted), 0)) ||
      snapshot['5090_results_included'] !== false) {
    add(root, 'p', 'Pro6000 验收快照不一致，暂不显示通过数量。', 'note');
    return;
  }
  add(root, 'p', '核验时间：' + snapshot.updated_utc + ' · ' + snapshot.pipeline.state_note, 'muted');
  add(root, 'p', snapshot.acceptance_metric, 'note');
  if (snapshot.primary_metric_frontier?.length) {
    const current = add(root, 'details'); current.open = true;
    add(current, 'summary', '物体口径：正式验收与选模（位置分量单列）');
    const entries = add(current, 'ul');
    for (const row of snapshot.primary_metric_frontier) {
      const object = snapshot.objects.find(o => o.object === row.object);
      add(entries, 'li', `${object.name} ${row.method}：抓起${row.Native_successes}/${row.n}；物体终点20mm ${row.object_terminal20}/${row.n}；EEF补充${row.EEF_terminal20}/${row.n}。${row.role}。${row.note}`);
    }
  }
  const metrics = add(root, 'div', undefined, 'status-grid');
  for (const [title, value] of [
    ['DP + ACT 完整通过', snapshot.objects_both_methods_formally_accepted + ' / 21'],
    ['DP / ACT 方法通过', (snapshot.methods_formally_accepted || 0) + ' / 42'],
    ['已登记活跃作业（快照）', String(snapshot.pipeline.active_registered_jobs)],
    ['排队或挂起', String(snapshot.pipeline.prepared_not_submitted.length)],
    ['采集与测试主线', 'Zenith Pro6000']
  ]) {
    const item = add(metrics, 'div');
    add(item, 'span', title);
    add(item, 'strong', value);
  }
  add(root, 'p', snapshot.pipeline.progress_note || snapshot.pipeline.state_note, 'note');
  const activeJobs = (snapshot.pipeline.jobs || []).filter(job => ['RUNNING', 'PENDING', 'PROVISIONING'].includes(job.status));
  if (activeJobs.length) {
    const jobs = add(root, 'details');
    jobs.open = true;
    add(jobs, 'summary', '当前运行与平台排队（核验快照）');
    const jobTable = add(add(jobs, 'div', undefined, 'table-wrap'), 'table');
    const jobHeader = add(add(jobTable, 'thead'), 'tr');
    ['任务', '平台状态', '已核验进度'].forEach(t => add(jobHeader, 'th', t));
    const jobBody = add(jobTable, 'tbody');
    for (const job of activeJobs) {
      const row = add(jobBody, 'tr');
      add(row, 'td', job.name);
      add(row, 'td', job.status);
      add(row, 'td', job.progress_note, 'pro6000-object-note');
    }
  }
  if (snapshot.pipeline.failure_diagnosis?.length) {
    const diagnosis = add(root, 'details');
    diagnosis.open = true;
    add(diagnosis, 'summary', '为什么还没有完整通过：失败证据与下一项验证');
    const entries = add(diagnosis, 'ul');
    for (const item of snapshot.pipeline.failure_diagnosis) add(entries, 'li', item);
    if (snapshot.pipeline.failure_diagnosis_history?.length) {
      const history = add(diagnosis, 'details');
      add(history, 'summary', `历史排查记录（${snapshot.pipeline.failure_diagnosis_history.length} 条）`);
      const archived = add(history, 'ul');
      for (const item of snapshot.pipeline.failure_diagnosis_history) add(archived, 'li', item);
    }
  }
  const measured = add(root, 'details');
  measured.open = false;
  add(measured, 'summary', '版本实测（物体主口径与历史EEF口径补充）');
  const wrap = add(measured, 'div', undefined, 'table-wrap');
  const table = add(wrap, 'table');
  const header = add(add(table, 'thead'), 'tr');
  ['物体 / 方法', '论文 SR / SSR', '实测 SR', 'SSR / 位置分量（见版本口径）', '模型详情'].forEach(t => add(header, 'th', t));
  const body = add(table, 'tbody');
  for (const run of snapshot.runs) {
    const object = snapshot.objects.find(o => o.object === run.object);
    // Historical versions retain their own scores when the object's latest run changes.
    const result = run.result || {};
    const trials = run.progress.episode_num;
    const partial = Number.isInteger(run.expected_trials) && trials < run.expected_trials;
    const sr = typeof result.SR === 'number' ? result.SR : run.progress.success_rate * 100;
    const ssr = run.reported_SpatialSSR_percent;
    const row = add(body, 'tr');
    add(row, 'td', object.name + ' · ' + run.method + ' · ' + run.display_name);
    add(row, 'td', object.paper[run.method + '_SR'] + '% / ' + object.paper[run.method + '_SpatialSSR'] + '%');
    add(row, 'td', partial ? (run.current_native ? '进行中' : '未完成') + '（已核验' + trials + '/' + run.expected_trials + '，成功' + run.progress.episode_success_num + '）' :
      percent(sr) + '（' + run.progress.episode_success_num + '/' + trials + '）');
    add(row, 'td', typeof ssr === 'number' ?
      percent(ssr) + (run.formal_accepted && run.primary_metric_position === 'object' ? '（物体，正式验收通过）' : '（历史EEF，轨迹后处理，视觉待审）') :
      percent(result.success_and_terminal_dP20) + '（仅成功且终点≤20mm，非完整SSR）');
    const link = add(add(row, 'td'), 'a', '在选择器中查看');
    link.href = '#' + new URLSearchParams({object: object.paper_id, method: run.method, run: run.candidate});
    link.addEventListener('click', () => document.getElementById('browser').scrollIntoView());
  }
  add(measured, 'p', '当前漏斗 ACT：+0 / +1 / +2 / +3cm 分组 SR 为100 / 100 / 77.8 / 55.6%；其中真正框外62回合SR61.3%、SSR22.6%。DP尚未通过。', 'muted');
  add(measured, 'p', snapshot.pipeline.b50_reset_note || '研钵旧 ACT 有145/150试次表面交叉；B50旧测试重置异常须先关闭。失败试次全部保留。', 'muted');
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
    const evidence = add(row, 'td', undefined, 'pro6000-object-note');
    add(evidence, 'p', object.status_note);
    const sourceVideos = (object.source_review_videos || []).filter(video =>
      /^assets\/grasp\/[A-Za-z0-9_./-]+\.mp4$/.test(video.url) &&
      !video.url.split('/').includes('..'));
    if (sourceVideos.length) {
      const review = add(evidence, 'details');
      add(review, 'summary', '源示范三视角（抽查记录，非策略测试）');
      for (const video of sourceVideos) {
        const link = add(add(review, 'p'), 'a', video.label);
        link.href = video.url;
      }
    }
    add(row, 'td', object.object_accepted ? '通过' : '待验收');
  }
  const next = add(root, 'details');
  add(next, 'summary', '后续队列与修复证据');
  const list = add(next, 'ul');
  for (const queued of snapshot.pipeline.prepared_not_submitted) {
    const item = add(list, 'li');
    if (typeof queued === 'string') item.textContent = queued;
    else {
      add(item, 'strong', queued.name || queued.tag);
      add(item, 'p', queued.progress_note);
    }
  }
  add(next, 'p', snapshot.pipeline.DP_repair_note || 'DP 使用真实 EMA 和原始源观测的离线对比已复现图像输入差异；离线差异不能当作闭环成功率改善。');
  add(next, 'p', snapshot.pipeline.b50_reset_note || 'b50 必须通过原XY位置、2mm校验和静置检查后，才能重跑正式测试。');
  add(root, 'p', snapshot.evidence_note, 'muted');
  const source = add(root, 'a', '查看当前 Pro6000 数据快照');
  source.href = 'results/grasp_pro6000_current.json';
}
