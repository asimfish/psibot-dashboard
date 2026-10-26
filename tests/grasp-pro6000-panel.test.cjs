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

test('all 21 objects and all five Pro6000 aggregates remain unaccepted', () => {
  const {container, created} = render(copy());
  assert.match(container.textContent, /0 \/ 21/);
  assert.match(container.textContent, /原端尚未确认停止/);
  assert.match(container.textContent, /尚未执行/);
  assert.equal(created.filter(n => n.tag === 'tr').length, 28); // two headers, five measured rows, 21 objects
  const links = created.filter(n => n.tag === 'a' && n.href.startsWith('#'));
  assert.equal(links.length, 5);
  for (const link of links) {
    const selected = new URLSearchParams(link.href.slice(1));
    const run = snapshot.runs.find(r => r.candidate === selected.get('run'));
    assert.equal(selected.get('method'), run.method);
    assert.equal(selected.get('object'), snapshot.objects.find(o => o.object === run.object).paper_id);
  }
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
