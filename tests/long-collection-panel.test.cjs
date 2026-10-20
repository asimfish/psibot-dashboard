'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'assets/long-collection/t563-panel.js'), 'utf8');
const published = JSON.parse(fs.readFileSync(path.join(root, 'results/long_collection_t563_current.json'), 'utf8'));
// Deterministic zero-count fixture; published progress and timestamps change over time.
const baseline = JSON.parse(JSON.stringify(published));
baseline.updated_at = '2026-10-18T00:00:00Z';
baseline.formal_accepted = 0;
for (const scene of baseline.scenes) {
  scene.accepted_count = 0;
  for (const condition of scene.conditions) condition.accepted_count = 0;
}
const copy = value => JSON.parse(JSON.stringify(value));
function harness(responses) {
  const nodes = new Map(), created = [], requests = [];
  function element(tag) {
    const e = {tag, textContent: '', children: [], disabled: false, events: {},
      append(...xs) {this.children.push(...xs);}, replaceChildren(...xs) {this.children = xs;},
      addEventListener(name, callback) {this.events[name] = callback;}};
    Object.defineProperty(e, 'innerHTML', {set() {throw Error('Unsafe HTML sink');}});
    created.push(e); return e;
  }
  for (const id of ['t563-total','t563-freshness','t563-notice','t563-cards','t563-diagnostic','t563-refresh']) nodes.set(id, element('div'));
  const context = {document: {getElementById: id => nodes.get(id), createElement: element},
    AbortController, Date, setTimeout, clearTimeout, setInterval() {},
    async fetch(url) {requests.push(url); const value = responses.shift(); if (value instanceof Error || value === undefined) throw value || Error('No response'); return {ok: true, async json() {return copy(value);}};}};
  vm.runInNewContext(script, context);
  const settle = async () => {for (let i=0;i<8;i++) await new Promise(resolve => setImmediate(resolve)); assert.equal(nodes.get('t563-refresh').disabled, false);};
  return {nodes, created, requests, settle, refresh: () => nodes.get('t563-refresh').events.click()};
}
test('four scenes/eight fixed conditions and 0/400 are displayed as plain text', async () => {
  const d = copy(baseline); d.scenes[0].title = '<img src=x onerror=alert(1)>';
  const h = harness([d]); await h.settle();
  assert.match(h.nodes.get('t563-total').textContent, /0 \/ 400/);
  const cards = h.nodes.get('t563-cards').children;
  assert.equal(cards.length, 4);
  assert.equal(cards.reduce((n,c) => n+c.children.find(x=>x.tag==='ul').children.length,0),8);
  assert.equal(cards[0].children[0].textContent,d.scenes[0].title);
  assert.equal(h.created.some(x=>x.tag==='img'||x.tag==='script'),false);
});
test('unknown conditions, inconsistent counts and wrong action counts fail closed', async () => {
  for (const mutate of [d=>d.formal_accepted=1,d=>d.scenes[0].conditions[0].id='wrong_order',d=>d.scenes[2].action_count=7,d=>d.scenes[0].conditions[0].accepted_count=51,d=>d.scenes[0].conditions[1].id='AB']) {
    const d=copy(baseline); mutate(d); const h=harness([d,d]);await h.settle();
    assert.equal(h.nodes.get('t563-total').textContent,'验收数量暂无法核实');
    assert.equal(h.nodes.get('t563-cards').children.length,0);
  }
});
test('network failure uses the same-site valid snapshot', async () => {
  const h=harness([Error('network'),baseline]);await h.settle();
  assert.equal(h.requests.length,2);assert.match(h.requests[1],/^results\/long_collection_t563_current\.json\?/);
  assert.match(h.nodes.get('t563-freshness').textContent,/网页快照/);
  assert.equal(h.nodes.get('t563-cards').children.length,4);
});
test('older fallback and older primary source cannot roll back a newer displayed record', async () => {
  const newer=copy(baseline);newer.updated_at='2026-10-19T00:00:00Z';
  // Synthetic fixture only, never written to public snapshot.
  newer.formal_accepted=1;newer.scenes[0].accepted_count=1;newer.scenes[0].conditions[0].accepted_count=1;
  const h=harness([newer,Error('network'),baseline,baseline,baseline]);await h.settle();
  await h.refresh();await h.settle();assert.match(h.nodes.get('t563-total').textContent,/1 \/ 400/);
  assert.match(h.nodes.get('t563-freshness').textContent,/保留上次发布记录/);
  await h.refresh();await h.settle();assert.match(h.nodes.get('t563-total').textContent,/1 \/ 400/);
});
test('newer corrected publication can replace a prior record', async () => {
  const old=copy(baseline);old.updated_at='2026-10-17T00:00:00Z';
  const h=harness([old,baseline]);await h.settle();await h.refresh();await h.settle();
  assert.doesNotMatch(h.nodes.get('t563-freshness').textContent,/保留上次发布记录/);
});

test('current published progress renders without assuming zero accepted episodes', async () => {
  const h = harness([published]); await h.settle();
  assert.equal(h.nodes.get('t563-total').textContent, `正式完整验收：${published.formal_accepted} / 400 条`);
  assert.equal(h.nodes.get('t563-cards').children.length, 4);
  assert.equal(h.nodes.get('t563-notice').textContent, published.acceptance_note);
});
