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
// Keep zero-count injection fixtures free of the separately tested optional diagnostic image.
if (baseline.render_quality) delete baseline.render_quality.oven_static_diagnostic_preview1521;
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
    const e = {tag, children: [], disabled: false, events: {}, style: {},
      append(...xs) {this.children.push(...xs);}, replaceChildren(...xs) {this.children = xs;},
      addEventListener(name, callback) {this.events[name] = callback;}};
    let ownText = '';
    Object.defineProperty(e, 'textContent', {
      get() {return ownText + e.children.map(child => child.textContent || '').join('');},
      set(value) {ownText = String(value); e.children = [];}
    });
    Object.defineProperty(e, 'innerHTML', {set() {throw Error('Unsafe HTML sink');}});
    created.push(e); return e;
  }
  for (const id of ['t563-total','t563-freshness','t563-notice','t563-cards','t563-diagnostic','t563-refresh']) nodes.set(id, element(id === 't563-diagnostic' ? 'p' : 'div'));
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

// Synthetic DOM fixtures only: no1521 result or image availability is asserted.
const staticPrefix = 'assets/diagnostics/t573-oven-static1521/';
const comparisonPNG = staticPrefix + 'NO_ROOM_TABLE_OLD1486_OLD_vs_CANDIDATE_DIAGNOSTIC.png';
const candidatePNG = staticPrefix + 'NO_ROOM_TABLE_OLD1486_CANDIDATE_THIRD_DIAGNOSTIC.png';
const walk = node => [node, ...node.children.flatMap(walk)];
function withStaticImages(images) {
  const d = copy(published);
  d.render_quality = {...d.render_quality, oven_static_diagnostic_preview1521: {images}};
  return d;
}
function staticNodes(h, tag) {
  return walk(h.nodes.get('t563-diagnostic')).filter(node => node.tag === tag);
}
test('one exact diagnostic PNG is an escaped native link/image with an honest fixed scope', async () => {
  const label = '<img src=x onerror=alert(1)> synthetic comparison';
  const d = withStaticImages([{url: comparisonPNG, label}]);
  const h = harness([d]); await h.settle();
  const links = staticNodes(h, 'a'), images = staticNodes(h, 'img');
  assert.equal(links.length, 1); assert.equal(images.length, 1);
  assert.equal(links[0].href, comparisonPNG); assert.equal(images[0].src, comparisonPNG);
  assert.equal(links[0].target, '_blank'); assert.equal(links[0].rel, 'noopener noreferrer');
  assert.equal(images[0].alt, label); assert.equal(images[0].loading, 'lazy');
  assert.equal(links[0].children[0], images[0]);
  const notice = h.nodes.get('t563-diagnostic').textContent;
  assert.ok(notice.includes(d.diagnostic_note));
  assert.match(notice, /相机构图诊断.*先前采集的初始姿态.*未包含房间和桌面.*完整场景与画质仍待验收/);
  assert.ok(notice.includes(label));
  assert.ok(walk(h.nodes.get('t563-diagnostic')).every(node => ['p', 'span', 'a', 'img'].includes(node.tag)));
  assert.equal(h.created.some(node => node.tag === 'script'), false);
  assert.equal(h.nodes.get('t563-cards').children.length, 4);
  assert.match(h.nodes.get('t563-total').textContent, /114 \/ 400/);
});
test('the two whitelisted distinct PNGs are supported but empty, duplicate and over-budget lists are rejected', async () => {
  const h = harness([withStaticImages([{url: comparisonPNG}, {url: candidatePNG}])]); await h.settle();
  assert.equal(staticNodes(h, 'img').length, 2);
  for (const images of [[], [{url: comparisonPNG}, {url: comparisonPNG}],
    [{url: comparisonPNG}, {url: candidatePNG}, {url: candidatePNG}]]) {
    const denied = harness([withStaticImages(images)]); await denied.settle();
    assert.equal(staticNodes(denied, 'img').length, 0);
    assert.match(denied.nodes.get('t563-total').textContent, /114 \/ 400/);
  }
});
test('external, traversal, encoded, query, fragment and unknown paths never reach a DOM URL sink', async () => {
  const basename = comparisonPNG.slice(staticPrefix.length);
  const badURLs = [
    'https://example.com/' + comparisonPNG, 'https://asimfish.github.io/psibot-dashboard/' + comparisonPNG,
    'http://example.com/a.png', '//example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA',
    '/' + comparisonPNG, './' + comparisonPNG, staticPrefix + '../' + basename,
    staticPrefix + './' + basename, staticPrefix + '%2e%2e/' + basename,
    staticPrefix + '%2E%2E%2F' + basename, staticPrefix + '%252e%252e%252f' + basename,
    staticPrefix + '%2f' + basename, staticPrefix + '%5c' + basename,
    staticPrefix + basename.replace('_OLD_vs_', '%5fOLD_vs_'),
    comparisonPNG + '?x=1', comparisonPNG + '#x', comparisonPNG + '%3fx=1',
    comparisonPNG + '%23x', ' ' + comparisonPNG, comparisonPNG + '\n',
    comparisonPNG.replaceAll('/', '\\'), staticPrefix + 'UNKNOWN.png',
    comparisonPNG.replace('.png', '.PNG'), comparisonPNG + '\0', '', null, 9
  ];
  for (const url of badURLs) {
    const h = harness([withStaticImages([{url: comparisonPNG}, {url}])]); await h.settle();
    assert.equal(staticNodes(h, 'a').length, 0, String(url));
    assert.equal(staticNodes(h, 'img').length, 0, String(url));
    assert.match(h.nodes.get('t563-total').textContent, /114 \/ 400/);
  }
});
test('malformed optional metadata fails closed locally without hiding published progress', async () => {
  for (const value of [null, [], 'wrong', {images: null}, {images: 'wrong'},
    {images: [null]}, {images: [{url: comparisonPNG, label: 7}]},
    {images: [{url: comparisonPNG, label: 'x'.repeat(161)}]}]) {
    const d = copy(published); d.render_quality.oven_static_diagnostic_preview1521 = value;
    const h = harness([d]); await h.settle();
    assert.equal(staticNodes(h, 'a').length, 0); assert.equal(staticNodes(h, 'img').length, 0);
    assert.match(h.nodes.get('t563-total').textContent, /114 \/ 400/);
  }
});
test('absent optional field preserves original notes and refresh removes a previous diagnostic preview', async () => {
  const without = copy(published); delete without.render_quality.oven_static_diagnostic_preview1521;
  const plain = harness([without]); await plain.settle();
  const note = [without.diagnostic_note, without.cloud_status?.note].filter(Boolean).join(' ');
  assert.equal(plain.nodes.get('t563-diagnostic').textContent, note);
  assert.equal(staticNodes(plain, 'img').length, 0);
  const first = withStaticImages([{url: comparisonPNG}]);
  const h = harness([first, without]); await h.settle();
  assert.equal(staticNodes(h, 'img').length, 1);
  await h.refresh(); await h.settle();
  assert.equal(staticNodes(h, 'img').length, 0);
  assert.equal(h.nodes.get('t563-diagnostic').textContent, note);
  assert.equal(h.nodes.get('t563-cards').children.length, 4);
});
