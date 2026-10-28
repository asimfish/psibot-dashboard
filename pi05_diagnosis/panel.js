'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const ids = ['a', 'b'];
  const keys = ['live', 'rgb_only', 'q_only', 'both'];
  let data, scene, cases = {}, frame = 0, playing = false, ready = false, generation = 0, animation = 0;

  function el(tag, text, cls) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }
  function link(text, href, download = false) {
    const a = el('a', text); a.href = href;
    if (download) a.download = href.split('/').pop();
    return a;
  }
  function fail(error) {
    if (error.name === 'AbortError') return;
    $('#error').className = 'error';
    $('#error').textContent = '载入或播放失败：' + error.message + '。可使用下载链接打开原视频。';
    console.error(error);
  }
  const video = id => $('#video-' + id);
  const card = id => $('#card-' + id);
  const lastFrame = c => c.video_frames - 1;
  const maxFrame = () => Math.max(...ids.map(id => lastFrame(cases[id])));
  const selectedKey = id => $('#config-' + id).value;

  function pause() {
    playing = false;
    cancelAnimationFrame(animation);
    ids.forEach(id => video(id).pause());
    $('#play').textContent = '▶ 同步播放';
  }
  function renderTime() {
    $('#seek').value = frame;
    $('#clock').textContent = (frame / data.fps).toFixed(2) + '秒 · frame ' + frame;
    ids.forEach(id => {
      const c = cases[id], box = card(id), f = Math.min(frame, lastFrame(c));
      const passed = c.phase_seconds.length && f / data.fps >= c.phase_seconds[0];
      box.querySelector('.timebadge').textContent = (f / data.fps).toFixed(2) + 's · f' + f;
      box.querySelector('.physical').textContent = passed ? '物理阶段1：稳定抓取已通过，倾倒尚未验收' : '物理阶段0：尚未通过稳定抓取';
      box.querySelector('.ended').textContent = frame >= lastFrame(c)
        ? (c.prefix_only ? '12秒诊断前缀已结束，保持末帧；没有测完整任务。' : '75秒原始闭环轨迹已结束，保持末帧。')
        : (c.prefix_only ? '记录观测干预：仅用于定位抓取机制。' : '实时图像与实测关节，原始闭环执行。');
    });
  }
  async function moveVideo(v, time) {
    if (Math.abs(v.currentTime - time) < 0.001 && v.readyState >= 2 && !v.seeking) return;
    await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); v.removeEventListener('seeked', done); v.removeEventListener('error', bad); };
      const done = () => { cleanup(); resolve(); };
      const bad = () => { cleanup(); reject(Error('无法跳转视频帧')); };
      const timer = setTimeout(() => { cleanup(); reject(Error('视频跳转超时')); }, 30000);
      v.addEventListener('seeked', done, { once: true }); v.addEventListener('error', bad, { once: true });
      v.currentTime = time;
    });
  }
  async function seek(f, resume = false) {
    if (!ready) return;
    pause();
    const token = generation;
    frame = Math.max(0, Math.min(maxFrame(), Math.round(f)));
    renderTime();
    await Promise.all(ids.map(id => {
      const v = video(id); v.dataset.frozen = frame >= lastFrame(cases[id]) ? 'yes' : '';
      return moveVideo(v, (Math.min(frame, lastFrame(cases[id])) + 0.2) / data.fps);
    }));
    if (token === generation && resume) await play();
  }
  async function play() {
    if (!ready) return;
    if (frame >= maxFrame()) await seek(0);
    const token = generation;
    playing = true; $('#play').textContent = '❚❚ 同步暂停';
    try {
      await Promise.all(ids.filter(id => frame < lastFrame(cases[id])).map(id => video(id).play()));
      if (token !== generation || !playing) return;
      animation = requestAnimationFrame(tick);
    } catch (error) {
      if (token === generation && playing) { pause(); fail(error); }
    }
  }
  function tick() {
    if (!playing || !ready) return;
    const master = ids.reduce((a, b) => cases[b].video_frames > cases[a].video_frames ? b : a);
    const seconds = video(master).currentTime;
    frame = Math.min(maxFrame(), Math.floor(seconds * data.fps + 1e-6));
    ids.forEach(id => {
      const v = video(id), last = lastFrame(cases[id]);
      if (frame >= last) {
        v.pause();
        if (v.dataset.frozen !== 'yes') { v.currentTime = (last + 0.2) / data.fps; v.dataset.frozen = 'yes'; }
      } else {
        v.dataset.frozen = '';
        if (id !== master && !v.seeking && Math.abs(v.currentTime - seconds) > 2 / data.fps) v.currentTime = seconds;
      }
    });
    renderTime();
    if (frame >= maxFrame()) pause();
    else animation = requestAnimationFrame(tick);
  }
  async function loadVideo(v, src) {
    if (v.cancelLoad) v.cancelLoad();
    await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); v.removeEventListener('loadedmetadata', done); v.removeEventListener('error', bad); v.cancelLoad = null; };
      const done = () => { cleanup(); resolve(); };
      const bad = () => { cleanup(); reject(Error('视频载入失败：' + src)); };
      const timer = setTimeout(() => { cleanup(); reject(Error('视频元数据载入超时：' + src)); }, 40000);
      v.cancelLoad = () => { cleanup(); reject(new DOMException('配置已切换', 'AbortError')); };
      v.addEventListener('loadedmetadata', done, { once: true }); v.addEventListener('error', bad, { once: true });
      v.src = src; v.load();
    });
  }
  function renderCard(id) {
    const key = selectedKey(id), cfg = data.configurations[key], c = cases[id], box = card(id);
    box.querySelector('h3').textContent = cfg.name;
    const outcome = box.querySelector('.outcome');
    outcome.textContent = c.stable_pickup_passed ? '稳定抓取通过 · 诊断' : '尚未通过稳定抓取';
    outcome.className = 'outcome ' + (c.stable_pickup_passed ? 'success' : 'pending');
    box.querySelector('.inputs').textContent = cfg.description;
    box.querySelector('.instruction').textContent = data.global_task;
    const downloads = box.querySelector('.downloads');
    const full = el('button', '全屏', 'fullscreen'); full.type = 'button';
    full.onclick = () => video(id).requestFullscreen().catch(fail);
    downloads.replaceChildren(link('下载原始录像', c.video, true), link('公开结果数据', 'data.json', true), full);
    const p = box.querySelector('.provenance');
    p.replaceChildren(el('p', '模型图像：' + cfg.rgb + '；模型关节：' + cfg.q),
      el('p', c.phase_seconds.length ? '原始稳定抓取验收：' + c.phase_seconds[0].toFixed(3) + '秒。' : '该观察时段内没有通过稳定抓取。'),
      el('p', '仿真时长 ' + c.simulation_seconds + '秒 · 原视频 ' + c.video_frames + '帧 · 15fps。'),
      el('p', '未宣称完整任务成功；不计入正式100条成绩。'),
      el('p', '视频 SHA256：' + c.video_sha256, 'source'), el('p', '物理审计 SHA256：' + c.audit_sha256, 'source'));
  }
  async function choose() {
    pause(); ready = false; $('#play').disabled = true; const token = ++generation;
    scene = data.scenes.find(s => s.id === $('#scene').value);
    cases = Object.fromEntries(ids.map(id => [id, scene.cases[selectedKey(id)]]));
    frame = 0;
    $('#pairmeta').textContent = scene.label + ' · 训练场景 E' + scene.training_episode + ' · 模型种子 ' + scene.model_seed + ' · 30k · 预测10步/执行8步 · 原始验收阈值保留';
    $('#error').textContent = ''; $('#error').className = '';
    ids.forEach(renderCard); renderTime();
    document.querySelectorAll('#cases tr').forEach(row => row.classList.toggle('selected-row', row.dataset.scene === scene.id && row.dataset.key === selectedKey('b')));
    await Promise.all(ids.map(id => loadVideo(video(id), cases[id].video)));
    if (token !== generation) return;
    ids.forEach(id => { video(id).playbackRate = Number($('#speed').value); });
    ready = true; $('#seek').max = maxFrame(); $('#play').disabled = false;
    await seek(0);
  }
  function cellRow(values) { const tr = el('tr'); values.forEach(x => tr.append(el('td', x))); return tr; }
  function renderTables() {
    $('#formal-conditions').textContent = data.formal_conditions;
    $('#diagnostic-conditions').textContent = data.diagnostic_conditions;
    data.formal.forEach(r => $('#formal').append(cellRow([r.execution_horizon + '步', r.confirmed_success + '/' + r.total, r.confirmed_failure, r.unadjudicated, '0%'])));
    keys.forEach(key => {
      const c = data.configurations[key], rows = data.scenes.map(s => s.cases[key]);
      $('#interventions').append(cellRow([c.rgb, c.q, rows.filter(x => x.stable_pickup_passed).length + '/2', rows[0].simulation_seconds + '秒', key === 'live' ? '源场景实时反馈诊断' : '记录观测干预诊断']));
    });
    data.scenes.forEach(s => keys.forEach(key => {
      const c = s.cases[key];
      const tr = cellRow([s.label + ' · E' + s.training_episode, data.configurations[key].name,
        c.stable_pickup_passed ? '通过 · 诊断' : '未通过', c.phase_seconds.length ? c.phase_seconds[0].toFixed(3) + '秒' : '—', c.simulation_seconds + '秒']);
      tr.dataset.case = s.id + '_' + key; tr.dataset.scene = s.id; tr.dataset.key = key;
      tr.tabIndex = 0; tr.setAttribute('aria-label', '查看' + s.label + data.configurations[key].name);
      const td = el('td'); const a = link('下载原片', c.video, true); a.onclick = e => e.stopPropagation(); td.append(a); tr.append(td);
      const select = () => { $('#scene').value = s.id; $('#config-a').value = 'live'; $('#config-b').value = key; choose().catch(fail); $('#player').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      tr.onclick = select; tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } };
      $('#cases').append(tr);
    }));
    const labels = { arm_rmse8: '前8步机械臂角度RMSE（rad）', hand_rmse8: '前8步手部角度RMSE（rad）', arm_acceleration: '机械臂目标加速度RMS（rad/s²）' };
    data.padding.forEach(r => $('#padding').append(cellRow([labels[r.key], r.native.toFixed(6), r.constrained.toFixed(6), r.improved_pairs + '/' + r.total_pairs])));
  }
  function validate(d) {
    if (d.schema !== 'pi05_diagnosis_public_v1' || d.fps !== 15 || d.scenes.length !== 2 || d.full_task_fix_verified !== false) throw Error('页面数据契约不匹配');
    for (const s of d.scenes) for (const key of keys) {
      const c = s.cases[key];
      if (!/^media\/(left|right)_(live|oracle|rgb_only|q_only)\.mp4$/.test(c.video) || c.video_frames !== c.simulation_seconds * 15 + 1 || c.complete_task_success_claimed !== false) throw Error('录像来源或诊断标签不匹配');
    }
  }
  async function main() {
    const r = await fetch('data.json', { cache: 'no-cache' });
    if (!r.ok) throw Error('data.json HTTP ' + r.status);
    data = await r.json(); validate(data);
    ids.forEach(id => keys.forEach(key => { const option = el('option', data.configurations[key].name); option.value = key; $('#config-' + id).append(option); }));
    $('#config-a').value = 'live'; $('#config-b').value = 'q_only';
    renderTables();
    ['scene', 'config-a', 'config-b'].forEach(id => $('#' + id).onchange = () => choose().catch(fail));
    $('#swap').onclick = () => { const old = $('#config-a').value; $('#config-a').value = $('#config-b').value; $('#config-b').value = old; choose().catch(fail); };
    $('#play').onclick = () => { if (playing) pause(); else play().catch(fail); };
    $('#seek').oninput = () => seek(Number($('#seek').value)).catch(fail);
    $('#prev-frame').onclick = () => seek(frame - 1).catch(fail);
    $('#next-frame').onclick = () => seek(frame + 1).catch(fail);
    $('#speed').onchange = () => ids.forEach(id => { video(id).playbackRate = Number($('#speed').value); });
    $('#jump-pickup').onclick = () => seek(Math.round(9.5 * data.fps)).catch(fail);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    await choose();
  }
  main().catch(fail);
})();
