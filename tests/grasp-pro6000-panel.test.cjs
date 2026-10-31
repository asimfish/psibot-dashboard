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
  assert.equal(created.filter(n => n.tag === 'tr').length, 2 + (activeJobs.length ? 1 : 0) + activeJobs.length + snapshot.runs.length + 21);
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
  for (const run of snapshot.runs.filter(r => r.current_native)) {
    const job = snapshot.pipeline.jobs.find(j => j.job_id === run.job_id);
    assert.ok(job && ['RUNNING', 'PENDING', 'PROVISIONING'].includes(job.status));
    assert.equal(run.expected_trials, 150);
    assert.ok(run.progress.episode_num < run.expected_trials);
    assert.equal(run.result.SR, null);
    assert.equal(run.formal_accepted, false);
  }
  const incomplete=snapshot.runs.find(r => r.job_id === 'job-2jpayc841pti');
  assert.equal(incomplete.expected_trials, 150);
  assert.equal(incomplete.result.formal_evaluation_status, 'FAILED_INCOMPLETE');
  assert.equal(incomplete.progress.episode_num, 23);
  const references=snapshot.runs.flatMap(r => r.cases);
  const media=[...new Map(references.map(c => [c.url,c])).values()];
  for (const c of references) assert.equal(media.find(m => m.url===c.url).SHA256,c.SHA256);
  assert.equal(media.length, 120);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_Mortar_paired_source5_20261029/')).length, 6);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_Mortar_source5_20261029/')).length, 3);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_fresh_B100_20261027/')).length, 6);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_formal_B100_20261028/')).length, 6);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_ClearL_source15_20261028/')).length, 6);
  assert.equal(media.filter(clip => clip.url.includes('/pro6000_BrownV_formal150_20261028/')).length, 3);
  for (const clip of media) {
    assert.match(clip.url, /^assets\/grasp\/(?:pro6000_fresh_B100_20261027\/trial(?:02|06)_s\d+_(?:chest|head|third)_camera|pro6000_formal_B100_20261028\/formal150_trial(?:000|001)_s26121921_(?:success|failure)_(?:chest|head|third)|pro6000_ClearL_source15_20261028\/clearL_ACT_source15_s26121921_ep(?:001|003)_(?:chest|head|third)_camera|pro6000_BrownV_formal150_20261028\/formal150_trial001_s26121921_(?:chest|head|third)_camera|pro6000_Mortar_source5_20261029\/source42_s26121921_failure_(?:chest|head|third)|pro6000_Mortar_paired_source5_20261029\/(?:state_noise|clean_control)_source42_s26121921_failure_(?:chest|head|third)|pro6000_F500_source15_20261029\/(?:terminal_failure_s26121921_ep005|terminal_pass_s26121925_ep002)_(?:chest|head|third)|pro6000_F500_DP100_source15_20261029\/(?:dropped_terminal|held_terminal_error)_(?:chest|head|third)|pro6000_F500_context_source20_20261029\/(?:initial_current|current_current_control)_(?:chest|head|third)|pro6000_F1000_ACT32_source15_20261029\/(?:minimum_terminal_error|maximum_terminal_error)_(?:chest|head|third)|pro6000_F500_raw_goal_pair_20261030\/(?:raw_predicted|fixed_mean)_(?:minimum_terminal_error|maximum_terminal_error)_(?:chest|head|third)|pro6000_F500_FK_aux_pair_20261030\/(?:FK_aux|FK_zero_control)_(?:minimum_terminal_error|maximum_terminal_error)_(?:chest|head|third)|pro6000_B50_source_physics_20261030\/B50_source_physics_(?:minimum_terminal_error|maximum_terminal_error)_(?:chest|head|third)|pro6000_hold_and_DP_closed_20261030\/(?:B50_ACT_hold|B50_DP_original|F1000_DP100|B50_DP_hold|F500_ACT_anchor|F500_ACT_zero_control)_(?:minimum_terminal_error|maximum_terminal_error|terminal_drop|paired_first_position)_(?:chest|head|third)|pro6000_B50_formal_firsttrial_20261030\/first_formal_(?:chest|head|third)|pro6000_B50_original_ACT_firsttrial_20261030\/first_ACT_(?:chest|head|third)_camera)\.mp4$/);
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

test('paired Mortar continuations keep seed21 and five failures each without formal credit', () => {
  const runs=snapshot.runs.filter(r => r.candidate.startsWith('pro6000-dev-A10warm-'));
  assert.equal(runs.length, 2);
  for (const run of runs) {
    assert.equal(run.development, true);
    assert.equal(run.formal_accepted, false);
    assert.equal(run.protocol.seed, 26121921);
    assert.equal(run.expected_trials, 5);
    assert.equal(run.progress.episode_num, 5);
    assert.equal(run.progress.episode_success_num, 0);
    assert.equal(run.result.success_terminal20mm, 0);
    assert.equal(run.cases.length, 3);
    assert.ok(run.cases.every(c => c.success === false && c.frames === 720));
  }
});


test('F500 source lift success stays separate from terminal error and formal acceptance', () => {
 const r=snapshot.runs.find(r => r.candidate==='pro6000-dev-A32-f500B-source15-20261029cc');
 assert.equal(r.development,true);assert.equal(r.result.successes,15);
 assert.equal(r.result.success_terminal20mm,3);assert.equal(r.result.SpatialSSR,null);
 assert.equal(r.formal_accepted,false);assert.equal(r.cases.length,6);
 assert.ok(r.cases.every(c => c.frames===719 && c.full_original_decode_passed && !c.full_trajectory_visual_acceptance));
 assert.equal(r.cases.filter(c => c.terminal_translation_passed).length,3);
 assert.equal(snapshot.objects_both_methods_formally_accepted,0);
});


test('B50 recovery retains all127 originals and only budgets23 new unique identities', () => {
 const original=snapshot.runs.find(r => r.job_id==='job-pr3typucmhkb');
 const recovery=snapshot.runs.find(r => r.candidate==='pro6000-eval-D50-b50-fixed240-formal150-20261030cc-r2');
 assert.equal(original.progress.episode_num,127);assert.equal(original.progress.episode_success_num,124);
 assert.equal(original.result.completed_success_terminal20mm,47);assert.equal(original.result.SR,null);
 assert.equal(original.current_native,false);assert.equal(original.cases.length,3);
 assert.ok(original.cases.every(c => c.episode===1 && c.terminal_translation_passed===false));
 assert.equal(recovery.result.reused_verified_trials,127);assert.equal(recovery.result.new_native_trial_budget,23);
 assert.equal(recovery.progress.episode_num,150);assert.equal(recovery.progress.episode_success_num,145);
 assert.equal(recovery.result.completed_success_terminal20mm,56);assert.equal(recovery.result.SR,145/150*100);
 assert.equal(recovery.current_native,false);assert.equal(recovery.result.SpatialSSR,null);
 assert.equal(recovery.cases.length,3);assert.deepEqual(recovery.cases.map(c => c.url),original.cases.map(c => c.url));
 assert.equal(recovery.expected_trials,150);assert.equal(recovery.formal_accepted,false);
 assert.equal(snapshot.pipeline.training_GPU_cap,8);assert.equal(snapshot.pipeline.allocated_training_GPUs,8);
 const proof=JSON.parse(fs.readFileSync(path.join(root,snapshot.pipeline.current_recovery_evidence_url),'utf8'));
 assert.equal(proof.B50_recovery.original3_task_failures_preserved,true);
 assert.equal(proof.first_actual_fullscene.original_events,2877);
 assert.equal(proof.first_actual_fullscene.nonadjacent_strict_crossing_pair_events,0);
 assert.equal(proof.full_SpatialSSR,null);
 const {container}=render(copy());assert.match(container.textContent,/已核验127\/150，成功124/);
 assert.equal(snapshot.objects_both_methods_formally_accepted,0);
});

test('new source-only results and sealed training never imply formal acceptance', () => {
 const third=snapshot.runs.find(r => r.job_id==='job-pvsqyiclu02k');
 assert.equal(third.result.trials,5);assert.equal(third.result.success_terminal20mm,5);
 assert.equal(third.development,true);assert.equal(third.protocol.independent_OOD,false);
 assert.equal(third.unmodified_original_DP_or_ACT,false);assert.equal(third.result.SpatialSSR,null);
 assert.equal(third.cases.length,0); // Earlier seed videos must not be relabeled as seed25.
 const all3=snapshot.objects.find(r => r.object==='clear_volumetric_flask_500ml').declared_variant_source15;
 assert.deepEqual([all3.trials,all3.Native_successes,all3.success_terminal20mm],[15,15,15]);
 assert.equal(all3.independent_OOD,false);assert.equal(all3.full_SpatialSSR,null);
 const funnel=snapshot.runs.find(r => r.job_id==='job-im1j77njl697');
 assert.deepEqual([funnel.result.trials,funnel.result.successes,funnel.result.success_terminal20mm],[15,8,0]);
 assert.equal(funnel.unmodified_original_DP_or_ACT,true);assert.equal(funnel.formal_accepted,false);
 const evidence=JSON.parse(fs.readFileSync(path.join(root,snapshot.pipeline.sealed_continuation_evidence_url),'utf8'));
 assert.equal(evidence.ACT_recovery.all4_CPU_gate_and_producer_seal_and_external_model_bytes_equal,true);
 assert.deepEqual(evidence.training.fixed_DP_budgets,[100000,100000,100000,200000]);
 assert.equal(evidence.training.full_paper_epoch_budget,false);
 assert.equal(evidence.training.allocated_GPUs,8);assert.equal(evidence.training.observed_optimizer_GPUs,7);
 assert.equal(evidence.B50_geometry.full_SpatialSSR,null);
 assert.equal(snapshot.objects_both_methods_formally_accepted,0);
});

test('original B50 ACT fresh150 stays pending without inheriting variant or development scores', () => {
 const run=snapshot.runs.find(r=>r.job_id==='job-u4q8qmb7otrk');
 assert.equal(run.expected_trials,150);assert.equal(run.development,false);
 assert.equal(run.unmodified_original_DP_or_ACT,true);assert.equal(run.protocol.chunk_size,4);
 assert.equal(run.result.SR,null);assert.equal(run.result.SpatialSSR,null);assert.equal(run.formal_accepted,false);
 const development=snapshot.runs.find(r=>r.job_id==='job-qx7yual0xdxv');
 assert.deepEqual([development.result.trials,development.result.successes,development.result.success_terminal20mm],[15,15,3]);
 assert.equal(development.protocol.independent_OOD,false);
 const evidence=JSON.parse(fs.readFileSync(path.join(root,snapshot.pipeline.original_ACT150_OOD_integrity_evidence_url),'utf8'));
 assert.equal(evidence.fresh_original_ACT_formal150.distinct_new_XY,150);
 assert.equal(evidence.fresh_original_ACT_formal150.fixed_hold_or_goal_anchor,false);
 assert.equal(evidence.fresh_original_ACT_formal150.max_live_per_GPU,1);
 assert.equal(evidence.actual_GPU_result_seal_smoke.technical_repeat_of_existing_five_not_new_acceptance_data,true);
 assert.equal(evidence.failure_quarantine_CPU.CPU_storage_and_numeric_fixtures,true);
 assert.equal(evidence.failure_quarantine_CPU.failed_or_inconsistent_output_never_generates_success_receipt,true);
});

test('F500 new outside-source stress exposes generalization failure with its actual distinct-position count', () => {
 const run=snapshot.runs.find(r=>r.job_id==='job-hkbj62j3rnh6');
 assert.deepEqual([run.result.trials,run.result.successes,run.result.success_terminal20mm],[15,10,3]);
 assert.equal(run.protocol.independent_OOD,true);assert.equal(run.protocol.distinct_new_positions,5);
 assert.equal(run.protocol.models_per_position,3);assert.equal(run.protocol.all_positions_strictly_outside_collection_3cm_box,true);
 assert.equal(run.unmodified_original_DP_or_ACT,false);
 assert.equal(run.declared_variant_counts_toward_original_baseline_acceptance,false);
 assert.equal(run.result.SpatialSSR,null);assert.equal(run.formal_accepted,false);
 assert.match(render(copy()).container.textContent,/源外15次仅10次抓起/);
});

test('inconsistent Funnel derived artifacts stay quarantined despite a retained producer aggregate', () => {
 const run=snapshot.runs.find(r=>r.job_id==='job-im1j77njl697');
 assert.equal(run.result.successes,8);assert.equal(run.result.usable_for_acceptance,false);
 assert.equal(run.result.integrity_status,'QUARANTINED_RAW_TRACE_COMPONENTS_MANIFEST_MISMATCH');
 assert.match(run.metric_note,/原始轨迹与汇总不一致/);
 assert.equal(run.formal_accepted,false);assert.equal(snapshot.objects_both_methods_formally_accepted,0);
});

test('zero-completion technical failure and first5 recovery keep the same150 denominator', () => {
 const failed=snapshot.runs.find(r=>r.job_id==='job-u4q8qmb7otrk');
 assert.equal(failed.current_native,false);assert.equal(failed.result.completed_trials,0);
 assert.equal(failed.result.SR,null);assert.equal(failed.result.policy_SR,null);
 assert.equal(failed.result.formal_evaluation_status,'TECHNICAL_FAILURE_ZERO_COMPLETED_TRIALS');
 const phase=snapshot.runs.find(r=>r.job_id==='job-yruc5cgfxgz4');
 assert.equal(phase.expected_trials,150);assert.equal(phase.maximum_current_phase_native_trials,5);
 assert.equal(phase.reuses_original_frozen150_campaign,true);assert.equal(phase.result.SR,null);
 assert.equal(phase.formal_accepted,false);assert.match(phase.metric_note,/不与计划150相加成155/);
 const proof=JSON.parse(fs.readFileSync(path.join(root,snapshot.pipeline.firstcell_recovery_evidence_url),'utf8'));
 assert.equal(proof.original_formal_failure.policy_SR,null);
 assert.equal(proof.CPU_diagnostics.zero_completed_trials_reports_SR_null,true);
 assert.equal(proof.CPU_diagnostics.actual_readiness_guard_with_real_recorded_GPU_binding_bytes_passed,true);
 assert.equal(proof.cloud_jobs_cancelled_or_restarted,0);
 assert.equal(proof.B50_all150_handtarget_CPU.full_SpatialSSR,null);
});

test('sealed ACT first5 and remaining145 share150 with actual first-trial media and no borrowed SR', () => {
 const first=snapshot.runs.find(r=>r.job_id==='job-yruc5cgfxgz4');
 const rest=snapshot.runs.find(r=>r.job_id==='job-o28y91g8tv56');
 assert.deepEqual([first.progress.episode_num,first.progress.episode_success_num,first.result.completed_success_terminal20mm],[5,5,2]);
 assert.equal(first.current_native,false);assert.equal(rest.current_native,true);
 assert.equal(rest.result.reused_verified_trials,5);assert.equal(rest.result.new_native_trial_budget,145);
 for(const run of [first,rest]) {
  assert.equal(run.expected_trials,150);assert.equal(run.result.SR,null);assert.equal(run.result.SpatialSSR,null);
  assert.equal(run.unmodified_original_DP_or_ACT,true);assert.equal(run.formal_accepted,false);
  assert.equal(run.cases.length,3);
  for(const clip of run.cases) {
   assert.equal(clip.global_trial,1);assert.equal(clip.source_job_id,first.job_id);
   assert.equal(clip.success,true);assert.equal(clip.terminal_translation_passed,false);
   assert.equal(clip.eef_translation_error_mm,23.41863537047959);
  }
 }
 assert.deepEqual(rest.cases,first.cases);
 const failed=snapshot.runs.find(r=>r.job_id==='job-u4q8qmb7otrk');assert.equal(failed.cases.length,0);
 const proof=JSON.parse(fs.readFileSync(path.join(root,snapshot.pipeline.original_ACT_first5_media_evidence_url),'utf8'));
 assert.equal(proof.first5.external_primary_metadata_and_trace_checks_passed,true);
 assert.equal(proof.sampled_visual_review.all150_or_full_trajectory_visual_passed,false);
 assert.equal(proof.remaining145.extra_cohort_trials,0);assert.equal(proof.full_SpatialSSR,null);
});

test('paired source diagnosis and failed CPU sidecar never become policy acceptance', () => {
 const job=snapshot.pipeline.jobs.find(j=>j.job_id==='job-qsij36r8zmr9');
 assert.equal(job.status,'RUNNING');assert.match(job.progress_note,/20条开发源示范/);
 const proof=JSON.parse(fs.readFileSync(path.join(root,snapshot.pipeline.source_pose_paired20_evidence_url),'utf8'));
 assert.deepEqual(proof.source_grasp.grasp_offset,[-.1326,-.0395,-.025]);
 assert.deepEqual(proof.source_protocol_recorded_Main_registry_grasp.grasp_offset,[-.11324,-.0393,.013]);
 assert.equal(proof.paired_source20.policy_training_or_formal_auto_release,false);
 assert.equal(proof.mounted_CPU_child_result.returncode,1);
 assert.equal(proof.local_CPU_resume.cloud_jobs_changed,false);
 assert.equal(proof.actual_checked_transfer_CPU_gate.actual_short_HTTP_body_rejected,true);
 assert.equal(proof.actual_checked_transfer_CPU_gate.old_verified_path_preserved_on_failed_transfer,true);
 assert.equal(proof.BOS_original_corruption_established,false);
 assert.equal(proof.full_SpatialSSR,null);assert.equal(proof.formal_accepted_objects,0);
 assert.equal(snapshot.runs.some(r=>r.job_id===job.job_id),false);
});
