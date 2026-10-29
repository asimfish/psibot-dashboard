'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'grasp-pro6000.js'), 'utf8');
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'results/grasp_pro6000_current.json'), 'utf8'));
const copy = () => JSON.parse(JSON.stringify(snapshot));

const render = data => {
  const created = [];
  const element = tag => {
    const node = {tag, children: [], events: {},
      append(...items) {this.children.push(...items);},
      replaceChildren(...items) {this.children = items;},
      addEventListener(name, callback) {this.events[name] = callback;}};
    let own = '';
    Object.defineProperty(node, 'textContent', {
      get() {return own + node.children.map(child => child.textContent).join(' ');},
      set(value) {own = String(value); node.children = [];}
    });
    Object.defineProperty(node, 'innerHTML', {set() {throw Error('Unexpected HTML sink');}});
    created.push(node);
    return node;
  };
  const container = element('section');
  const context = {URLSearchParams, document: {getElementById: () => container, createElement: element}};
  vm.runInNewContext(source, context);
  context.renderPro6000(data);
  return {container, created};
};

test('all 21 objects and retained Pro6000 versions remain unaccepted', () => {
  const {container, created} = render(copy());
  assert.match(container.textContent, /0 \/ 21/);
  assert.match(container.textContent, /为什么还没有完整通过/);
  assert.match(container.textContent, /约6–9mm初始XY偏移/);
  assert.doesNotMatch(container.textContent, /原端尚未确认停止/);
  const activeJobs = snapshot.pipeline.jobs.filter(j => ['RUNNING', 'PENDING', 'PROVISIONING'].includes(j.status));
  assert.equal(created.filter(n => n.tag === 'tr').length, 3 + activeJobs.length + snapshot.runs.length + 21);
  const links = created.filter(n => n.tag === 'a' && n.href.startsWith('#'));
  assert.equal(links.length, snapshot.runs.length);
  for (const link of links) {
    const selected = new URLSearchParams(link.href.slice(1));
    const run = snapshot.runs.find(r => r.candidate === selected.get('run'));
    assert.equal(selected.get('method'), run.method);
    assert.equal(selected.get('object'), snapshot.objects.find(o => o.object === run.object).paper_id);
  }
});

test('job states and diagnostic failures never increase acceptance or erase historical results', () => {
  const data = copy();
  assert.equal(data.pipeline.active_registered_jobs, data.pipeline.jobs.filter(j => ['RUNNING', 'PENDING', 'PROVISIONING'].includes(j.status)).length);
  assert.equal(data.pipeline.jobs.find(j => j.tag === 'dev-b50-rest-reset-20261026cc').status, 'FAILED');
  const {container} = render(data);
  assert.match(data.pipeline.jobs.find(j => j.tag === 'dev-b50-rest-reset-20261026cc').progress_note, /0个有效测试trial/);
  assert.match(container.textContent, /0 \/ 21/);
  assert.match(container.textContent, /77\.3%/);
  assert.match(container.textContent, /继续挂起/);
  assert.doesNotMatch(container.textContent, /\[object Object\]/);
  for (const queued of data.pipeline.prepared_not_submitted) {
    if (typeof queued === 'object') assert.ok(container.textContent.includes(queued.progress_note));
  }
});

test('provisioning jobs remain visible in the active work table', () => {
  const data = copy();
  const job = {...data.pipeline.jobs[0], tag: 'test-only-provisioning',
    name: '测试中的资源准备', status: 'PROVISIONING'};
  data.pipeline.jobs.push(job);
  data.pipeline.active_registered_jobs++;
  const {created} = render(data);
  assert.ok(created.some(n => n.tag === 'tr' && n.children[0]?.textContent === job.name &&
    n.children[1]?.textContent === 'PROVISIONING'));
});

test('historical and new model rows retain independent scores and denominators', () => {
  const data = copy();
  data.objects.find(o => o.object === 'funnel').DP.SR = 99;
  const old = data.runs.find(r => r.candidate === 'pro6000-eval-m6-dp-funnel-20261025cc');
  const latest = data.runs.find(r => r.candidate === 'pro6000-eval-m6rgb-dp-funnel-20261027cc');
  assert.ok(latest);
  const smoke = JSON.parse(JSON.stringify(latest));
  smoke.candidate = 'test-only-five-trial-diagnostic';
  smoke.development = true;
  smoke.expected_trials = 5;
  smoke.progress = {episode_num: 5, episode_success_num: 3, success_rate: .6};
  smoke.result.SR = 60;
  data.runs.push(smoke);
  const {created} = render(data);
  const row = run => created.find(n => n.tag === 'tr' && n.children[4]?.children[0]?.href?.includes(run.candidate));
  assert.equal(row(old).children[2].textContent, '0.0%（0/150）');
  assert.equal(row(latest).children[2].textContent, '52.0%（78/150）');
  assert.equal(row(smoke).children[2].textContent, '60.0%（3/5）');
});

test('mixed GPU results and unsupported acceptance counts fail visibly', () => {
  for (const mutate of [
    d => d['5090_results_included'] = true,
    d => d.objects_both_methods_formally_accepted = 1,
    d => d.objects[0].object_accepted = true,
    d => {d.objects[0].DP.formal_accepted = true; d.objects[0].ACT.formal_accepted = true;
      d.objects[0].object_accepted = true; d.objects_both_methods_formally_accepted = 1;},
    d => d.objects[1].object = d.objects[0].object
  ]) {
    const data = copy(); mutate(data);
    const {container, created} = render(data);
    assert.match(container.textContent, /暂不显示通过数量/);
    assert.equal(created.filter(n => n.tag === 'table').length, 0);
  }
});

test('names and notes are rendered as text', () => {
  const data = copy();
  data.objects[0].name = '<img src=x onerror=alert(1)>';
  const {container, created} = render(data);
  assert.match(container.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(created.some(n => n.tag === 'img' || n.tag === 'script'), false);
});

test('qualified source100 stays separate from policy acceptance and retains original source video links', () => {
  const data = copy();
  const mortar = data.objects.find(o => o.object === 'mortar');
  assert.equal(mortar.source_reference100.clean_qualified_positions, 100);
  assert.equal(mortar.source_reference100.selected_original_frames, 71918);
  assert.equal(mortar.source_reference100.source_training_allowed, true);
  assert.equal(mortar.source_reference100.development_training_allowed, true);
  assert.equal(mortar.source_reference100.production_source_admission, false);
  assert.equal(mortar.object_accepted, false);
  assert.equal(mortar.source_review_videos.length, 3);
  const {container, created} = render(data);
  assert.match(container.textContent, /0 \/ 21/);
  assert.match(container.textContent, /源示范三视角（抽查记录，非策略测试）/);
  for (const video of mortar.source_review_videos) {
    assert.ok(created.some(n => n.tag === 'a' && n.href === video.url));
    assert.ok(fs.existsSync(path.join(root, video.url)));
  }
  mortar.source_review_videos.push({label:'invalid scheme', url:'javascript:alert(1)'},
    {label:'invalid path', url:'assets/grasp/../../outside.mp4'});
  const rendered = render(data);
  assert.equal(rendered.created.some(n => n.tag === 'a' &&
    ['javascript:alert(1)', 'assets/grasp/../../outside.mp4'].includes(n.href)), false);
});

test('only the new snapshot adds browser versions; every existing dataset remains wired', () => {
  const script = fs.readFileSync(path.join(root, 'grasp.js'), 'utf8');
  const files = [...script.matchAll(/'results\/(grasp_[^']+\.json)'/g)].map(match => match[1]);
  assert.equal(new Set(files).size, 27); // 26 original datasets plus the Pro6000 snapshot
  assert.ok(files.includes('grasp_matched_and_original_eval_native_v86.json'));
  assert.ok(files.includes('grasp_pro6000_current.json'));
  for (const file of files) assert.ok(fs.existsSync(path.join(root, 'results', file)), file);
  assert.ok(snapshot.runs.every(r => r.current_native === false));
  const incomplete=snapshot.runs.find(r => r.job_id === 'job-2jpayc841pti');
  assert.equal(incomplete.expected_trials, 150);
  assert.equal(incomplete.result.formal_evaluation_status, 'FAILED_INCOMPLETE');
  assert.equal(incomplete.progress.episode_num, 23);
  const media=snapshot.runs.flatMap(r => r.cases);
  assert.equal(media.length, 24);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_Mortar_source5_20261029/')).length, 3);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_fresh_B100_20261027/')).length, 6);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_formal_B100_20261028/')).length, 6);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_ClearL_source15_20261028/')).length, 6);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_BrownV_formal150_20261028/')).length, 3);
  for (const clip of media) {
    assert.match(clip.url, /^assets\/grasp\/(?:pro6000_fresh_B100_20261027\/trial(?:02|06)_s\d+_(?:chest|head|third)_camera|pro6000_formal_B100_20261028\/formal150_trial(?:000|001)_s26121921_(?:success|failure)_(?:chest|head|third)|pro6000_ClearL_source15_20261028\/clearL_ACT_source15_s26121921_ep(?:001|003)_(?:chest|head|third)_camera|pro6000_BrownV_formal150_20261028\/formal150_trial001_s26121921_(?:chest|head|third)_camera|pro6000_Mortar_source5_20261029\/source42_s26121921_failure_(?:chest|head|third))\.mp4$/);
    const bytes=fs.readFileSync(path.join(root,clip.url));
    assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'), clip.SHA256);
  }
});

test('historical progress stays unloaded until opened, and repeated opens share one request', async () => {
  const script = fs.readFileSync(path.join(root, 'grasp.js'), 'utf8');
  const setup = script.slice(script.indexOf('function setupProgress(){'), script.indexOf('start().then(setupProgress)'));
  let calls = 0;
  const events = {}, panel = {open: false, addEventListener(name, callback) {events[name] = callback;}};
  const context = {$: () => panel, location: {hash: ''}, allObjects: [],
    loadProgress: async () => {calls++;}, window: {addEventListener() {}}, document: {getElementById() {}}};
  vm.runInNewContext(setup, context); context.setupProgress();
  assert.equal(calls, 0);
  panel.open = true; events.toggle(); events.toggle();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
});

test('historical anchors load and reveal the old section while model links keep it collapsed', async () => {
  const script = fs.readFileSync(path.join(root, 'grasp.js'), 'utf8');
  const setup = script.slice(script.indexOf('function setupProgress(){'), script.indexOf('start().then(setupProgress)'));
  for (const [hash, expected] of [['#latestRepairs86', 1], ['#progress', 1], ['#pro6000', 0], ['#object=funnel&method=ACT', 0]]) {
    let calls = 0, scrolls = 0;
    const panel = {open: false, addEventListener() {}};
    const context = {$: () => panel, location: {hash}, allObjects: [],
      loadProgress: async () => {calls++;}, window: {addEventListener() {}},
      document: {getElementById: () => ({scrollIntoView() {scrolls++;}})}};
    vm.runInNewContext(setup, context); context.setupProgress();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, expected, hash);
    assert.equal(panel.open, Boolean(expected), hash);
    assert.equal(scrolls, expected, hash);
  }
});


test('Pro6000 development stays labeled development while original success/failure videos switch', () => {
  const script=fs.readFileSync(path.join(root,'grasp.js'),'utf8');
  const current=JSON.parse(fs.readFileSync(path.join(root,'results/grasp_acceptance_current.json'),'utf8'));
  const nodes=new Map();let scrolls=0;
  const element=()=>({innerHTML:'',textContent:'',value:'',hidden:false,
    classList:{toggle(){}},setAttribute(){},querySelectorAll(){return [];},scrollIntoView(){scrolls++;}});
  const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const candidate='pro6000-dev-A32-freshtrial-b100-val5-20261027cc';
  const run=snapshot.runs.find(r=>r.candidate===candidate);assert.ok(run);
  const context={URL,URLSearchParams,fixtureCurrent:current,fixtureRuns:[run],
    location:{href:'https://asimfish.github.io/psibot-dashboard/grasp.html'},
    window:{addEventListener(){}},document:{getElementById:node}};
  vm.runInNewContext(script.slice(0,script.indexOf('async function start()'))+
    `;current=fixtureCurrent;allObjects=current.objects;allRuns=fixtureRuns;objectId='glass_beaker_100ml';method='ACT';runId='${candidate}';render();`,context);
  assert.match(node('runDetails').innerHTML,/15 集开发试跑/);
  assert.doesNotMatch(node('runDetails').innerHTML,/3种子正式测试|SR 达到该物体论文目标/);
  assert.match(node('videos').innerHTML,/trial06_s26121923_chest_camera\.mp4/);
  assert.match(node('videos').innerHTML,/720帧/);
  node('episode').value='3';node('episode').onchange();
  assert.match(node('videos').innerHTML,/trial02_s26121921_chest_camera\.mp4/);
  assert.match(node('videos').innerHTML,/失败/);
  node('episode').value='1';node('episode').onchange();
  assert.match(node('videos').innerHTML,/trial06_s26121923_head_camera\.mp4/);
  context.location.hash='#object=glass_beaker_100ml&method=ACT&run='+candidate;context.applyHashSelection();
  assert.equal(scrolls,1,'Matching version link reveals the actual video browser');
});


test('unfinished formal150 keeps partial counts without a completed SR or pass label', () => {
  const data=copy();const run=data.runs.find(r=>r.job_id==='job-2jpayc841pti');run.current_native=true;
  run.progress={episode_num:75,episode_success_num:75,success_rate:1};
  const {created}=render(data);
  const row=created.find(n=>n.tag==='tr'&&n.children[4]?.children[0]?.href?.includes(run.candidate));
  assert.equal(row.children[2].textContent,'进行中（已核验75/150，成功75）');
  assert.equal(run.formal_accepted,false);
  const script=fs.readFileSync(path.join(root,'grasp.js'),'utf8');
  const current=JSON.parse(fs.readFileSync(path.join(root,'results/grasp_acceptance_current.json'),'utf8'));
  const nodes=new Map();const element=()=>({innerHTML:'',textContent:'',value:'',hidden:false,
    classList:{toggle(){}},setAttribute(){},querySelectorAll(){return [];},scrollIntoView(){}});
  const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const context={URL,URLSearchParams,fixtureCurrent:current,fixtureRuns:[run],
    location:{href:'https://asimfish.github.io/psibot-dashboard/grasp.html'},
    window:{addEventListener(){}},document:{getElementById:node}};
  vm.runInNewContext(script.slice(0,script.indexOf('async function start()'))+
    `;current=fixtureCurrent;allObjects=current.objects;allRuns=fixtureRuns;objectId='brown_volumetric_flask_250ml';method='ACT';runId='${run.candidate}';render();`,context);
  assert.match(node('runDetails').innerHTML,/未完成/);
  assert.doesNotMatch(node('runDetails').innerHTML,/SR 达到该物体论文目标|<strong>100\.0%<\/strong>/);
  assert.match(node('modelHistory').innerHTML,/已核验75\/150/);
});
