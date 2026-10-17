/* Independent T563 view; never writes or merges the historical T3/T5/T7 data. */
(() => {
  "use strict";
  const IDS = ["t5_oven", "t5_obstruction", "t7_weigh", "t10_weigh"];
  const SOURCE = "https://raw.githubusercontent.com/asimfish/psibot-dashboard/refs/heads/main/results/long_collection_t563_current.json";
  const SNAPSHOT = "results/long_collection_t563_current.json";
  const byId = id => document.getElementById(id);
  const text = (tag, value, cls) => {
    const el = document.createElement(tag);
    el.textContent = value;
    if (cls) el.className = cls;
    return el;
  };
  let busy = false, last = null;
  function validate(data) {
    if (data?.schema_version !== 1 || data.task_owner !== "T-563" ||
        data.target_total !== 400 || data.position_randomization !== false ||
        !Number.isFinite(Date.parse(data.updated_at)) || !Array.isArray(data.scenes) ||
        data.scenes.length !== 4 || new Set(data.scenes.map(s => s.id)).size !== 4) {
      throw Error("Invalid T563 source");
    }
    let total = 0;
    for (const scene of data.scenes) {
      if (!IDS.includes(scene.id) || scene.target_count !== 100 ||
          !Array.isArray(scene.conditions) || scene.conditions.length !== 2 ||
          new Set(scene.conditions.map(c => c.id)).size !== 2) throw Error("Invalid scene");
      let count = 0;
      for (const condition of scene.conditions) {
        if (condition.target_count !== 50 || !Number.isInteger(condition.accepted_count) ||
            condition.accepted_count < 0 || condition.accepted_count > 50) throw Error("Invalid count");
        count += condition.accepted_count;
      }
      if (scene.accepted_count !== count) throw Error("Scene total mismatch");
      total += count;
    }
    if (data.formal_accepted !== total) throw Error("Total mismatch");
    return data;
  }
  function render(data, fallback) {
    validate(data);
    last = data;
    byId("t563-total").textContent = `正式完整验收：${data.formal_accepted} / 400 条`;
    const age = Date.now() - Date.parse(data.updated_at);
    byId("t563-freshness").textContent =
      `源记录：${new Date(data.updated_at).toLocaleString("zh-CN")} · ` +
      (fallback ? "网页快照；实时源暂不可用" : age > 180000 ? "记录尚未更新，请勿视为实时运行状态" : "已读取最新发布记录");
    byId("t563-notice").textContent = data.acceptance_note;
    const cards = byId("t563-cards");
    cards.replaceChildren();
    for (const scene of data.scenes) {
      const card = text("article", "", "task");
      card.append(text("h3", scene.title), text("p", `${scene.accepted_count} / 100 条完整验收`));
      const conditions = text("ul", "");
      for (const c of scene.conditions) conditions.append(text("li", `${c.label}：${c.accepted_count} / 50`));
      card.append(conditions, text("p", scene.note, "muted"));
      cards.append(card);
    }
    byId("t563-diagnostic").textContent = [data.diagnostic_note, data.cloud_status?.note].filter(Boolean).join(" ");
  }
  async function read(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url + "?t=" + Date.now(), {cache: "no-store", signal: controller.signal});
      if (!response.ok) throw Error("Source unavailable");
      return validate(await response.json());
    } finally { clearTimeout(timer); }
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    byId("t563-refresh").disabled = true;
    try { render(await read(SOURCE), false); }
    catch (_) {
      try { render(await read(SNAPSHOT), true); }
      catch (_) {
        byId("t563-freshness").textContent = "状态源暂不可用；上次记录不能视为当前进度。";
        if (!last) byId("t563-total").textContent = "验收数量暂无法核实";
      }
    } finally { busy = false; byId("t563-refresh").disabled = false; }
  }
  byId("t563-refresh").addEventListener("click", refresh);
  refresh();
  setInterval(refresh, 60000);
})();
