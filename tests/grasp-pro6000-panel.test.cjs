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
  assert.doesNotMatch(container.textContent, /原端尚未确认停止|尚未执行/);
  const activeJobs = snapshot.pipeline.jobs.filter(j => ['RUNNING', 'PENDING'].includes(j.status));
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
  assert.equal(data.pipeline.active_registered_jobs, data.pipeline.jobs.filter(j => ['RUNNING', 'PENDING'].includes(j.status)).length);
  assert.equal(data.pipeline.jobs.find(j => j.tag.startsWith('dev-b50-')).status, 'FAILED');
  const {container} = render(data);
  assert.match(data.pipeline.jobs.find(j => j.tag === 'dev-b50-rest-reset-20261026cc').progress_note, /0个有效测试trial/);
  assert.match(container.textContent, /0 \/ 21/);
  assert.match(container.textContent, /77\.3%/);
  assert.match(container.textContent, /继续挂起/);
});

test('historical and new model rows retain independent scores and denominators', () => {
  const data = copy();
  data.objects.find(o => o.object === 'funnel').DP.SR = 99;
  const old = data.runs.find(r => r.candidate === 'pro6000-eval-m6-dp-funnel-20261025cc');
  const latest = data.runs.find(r => r.candidate === 'pro6000-eval-m6rgb-dp-funnel-20261027cc');
  assert.ok(latest);
  const smoke = JSON.parse(JSON.stringify(latest));
  smoke.candidate = 'test-only-five-trial-diagnostic';
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

test('only the new snapshot adds browser versions; every existing dataset remains wired', () => {
  const script = fs.readFileSync(path.join(root, 'grasp.js'), 'utf8');
  const files = [...script.matchAll(/'results\/(grasp_[^']+\.json)'/g)].map(match => match[1]);
  assert.equal(new Set(files).size, 27); // 26 original datasets plus the Pro6000 snapshot
  assert.ok(files.includes('grasp_matched_and_original_eval_native_v86.json'));
  assert.ok(files.includes('grasp_pro6000_current.json'));
  for (const file of files) assert.ok(fs.existsSync(path.join(root, 'results', file)), file);
  assert.ok(snapshot.runs.every(r => r.current_native === false && r.cases.length === 0));
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
