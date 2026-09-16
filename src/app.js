import {
  SCORE_DIMENSIONS,
  STORY_STRUCTURES,
  TIME_LEVELS,
  applyOptimization,
  beatDuration,
  createManualIdea,
  createId,
  createProject,
  generateBeats,
  generateIdeas,
  generateScript,
  projectToText,
  scoreIdea,
} from "./domain.js";
import {
  aiCreateProject,
  aiGenerateBeats,
  aiGenerateIdeas,
  aiGenerateScript,
  aiOptimizeIdea,
  aiScoreIdea,
  aiAnalyzeViralVideo,
  loadDouyinTrends,
  loadBackend,
  saveBackendState,
} from "./api.js";
import { loadState, saveState, track } from "./store.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
let state = loadState();
let runtime = { backendReady: false, database: null, ai: { configured: false, model: "本地引擎" } };
let persistenceTimer = null;
let trendFeed = { status: "idle", items: [], fetchedAt: null, updatedAt: null, error: "" };
let trendSelection = new Set();
let selectedIdeaIds = new Set();
let editingIdeaId = null;
let viralAnalysisBusy = false;

const routes = [
  ["dashboard", "总览", "⌂"],
  ["dna", "账号 DNA", "◈"],
  ["generate", "找选题", "✦"],
  ["pool", "选题池", "▦"],
  ["projects", "项目开发", "▤"],
];

function currentRoute() {
  return location.hash.replace(/^#\/?/, "").split("/")[0] || "dashboard";
}

function h(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function providerLabel(provider) {
  const labels = { deepseek: "DeepSeek", qwen: "通义千问", doubao: "豆包" };
  return labels[provider] || provider || "大模型";
}

function engineLabel(provider) {
  return provider === "local" ? "本地引擎" : providerLabel(provider);
}

function commit(message) {
  saveState(state);
  clearTimeout(persistenceTimer);
  persistenceTimer = setTimeout(() => {
    saveBackendState(state).then(() => {
      runtime.backendReady = true;
    }).catch(() => {
      runtime.backendReady = false;
    });
  }, 80);
  render();
  if (message) notify(message);
}

function navigate(route) {
  location.hash = `#/${route}`;
}

async function refreshDouyinTrends() {
  trendFeed = { ...trendFeed, status: "loading", error: "" };
  render();
  try {
    const feed = await loadDouyinTrends();
    const available = new Set(feed.items.map((item) => item.title));
    trendSelection = new Set([...trendSelection].filter((title) => available.has(title)));
    if (!trendSelection.size) trendSelection = new Set(feed.items.slice(0, 3).map((item) => item.title));
    trendFeed = { ...feed, status: "ready", error: "" };
  } catch (error) {
    trendFeed = { ...trendFeed, status: "error", error: `热点暂时不可用：${error.message}` };
  }
  if (currentRoute() === "generate") render();
}

function ensureDouyinTrends() {
  if (trendFeed.status === "idle") void refreshDouyinTrends();
}

function latestScore(idea) {
  return idea?.scoreStale ? null : idea?.scoreHistory?.at(-1) || null;
}

function scoreClass(total = 0) {
  return total >= 80 ? "score-high" : total >= 70 ? "score-mid" : "score-low";
}

function pageHeader(eyebrow, title, description, action = "") {
  return `<header class="page-header">
    <div><p class="eyebrow">${h(eyebrow)}</p><h1>${h(title)}</h1><p class="page-description">${h(description)}</p></div>
    ${action}
  </header>`;
}

function render() {
  const route = currentRoute();
  app.innerHTML = `<div class="shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">A</span><div><strong>AI Content</strong><small>Director</small></div></div>
      <nav>${routes.map(([key, label, icon]) => `<a href="#/${key}" class="nav-link ${route === key ? "active" : ""}"><span>${icon}</span>${label}</a>`).join("")}</nav>
      <div class="sidebar-note"><span class="pulse ${runtime.ai?.configured ? "online" : "fallback"}"></span><div><strong>${runtime.ai?.configured ? `${h(providerLabel(runtime.ai.provider))} · ${h(runtime.ai.model)}` : "本地降级引擎"}</strong><small>${runtime.backendReady ? "SQLite 已连接 · 自动保存" : "浏览器存储 · 等待后端"}</small></div></div>
    </aside>
    <main class="main"><div class="topbar"><span>${h(state.account.brandName || "未命名账号")}</span><span class="topbar-date">${new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date())}</span></div>${renderRoute(route)}</main>
  </div>`;
}

function renderRoute(route) {
  if (route === "dna") return renderDna();
  if (route === "generate") return renderGenerate();
  if (route === "pool") return state.selectedIdeaId ? renderEvaluation() : renderPool();
  if (route === "projects") return state.selectedProjectId ? renderProject() : renderProjects();
  return renderDashboard();
}

function renderDashboard() {
  const scored = state.ideas.filter((idea) => latestScore(idea));
  const passed = state.ideas.filter((idea) => latestScore(idea)?.total >= 80 && idea.status !== "已立项");
  const developing = state.projects.filter((project) => project.status === "开发中");
  const recent = [...state.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  const focus = passed.sort((a, b) => latestScore(b).total - latestScore(a).total)[0];
  const nextAction = !state.account.brandName
    ? ["先建立账号 DNA", "所有评分与推荐都会读取账号方向和制作能力。", "dna"]
    : state.ideas.length === 0
      ? ["生成第一组选题", "用十条候选快速验证账号的内容边界。", "generate"]
      : scored.length === 0
        ? ["给候选想法评分", "先筛选，再把制作资源投向高价值项目。", "pool"]
        : passed.length
          ? ["把高分想法正式立项", `${focus.title} 当前 ${latestScore(focus).total} 分。`, "pool"]
          : ["继续优化选题", "应用建议并重评，观察分数变化来自哪里。", "pool"];

  return `<section class="page">
    ${pageHeader("内容决策工作台", "今天先决定拍什么", "把创意判断、故事开发和项目沉淀放进同一条工作流。", `<button class="button primary" data-nav="generate">＋ 新建选题</button>`)}
    <div class="hero-card"><div><span class="kicker">下一步建议</span><h2>${h(nextAction[0])}</h2><p>${h(nextAction[1])}</p></div><button class="button light" data-nav="${nextAction[2]}">开始处理 <span>→</span></button></div>
    <div class="metrics">
      ${metricCard("待评分", state.ideas.filter((idea) => !latestScore(idea)).length, "进入评分引擎")}
      ${metricCard("80分以上", state.ideas.filter((idea) => latestScore(idea)?.total >= 80).length, "值得重点制作")}
      ${metricCard("开发中", developing.length, "结构与脚本")}
      ${metricCard("已归档", state.projects.filter((project) => project.status === "归档").length, "可复用资产")}
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-head"><div><p class="eyebrow">决策漏斗</p><h2>内容开发进度</h2></div></div>
        <div class="funnel">
          ${funnelRow("选题池", state.ideas.length, Math.max(1, state.ideas.length))}
          ${funnelRow("已评分", scored.length, Math.max(1, state.ideas.length))}
          ${funnelRow("已立项", state.projects.length, Math.max(1, state.ideas.length))}
          ${funnelRow("有脚本", state.projects.filter((project) => project.scriptVersions?.length).length, Math.max(1, state.ideas.length))}
        </div>
      </section>
      <section class="panel"><div class="panel-head"><div><p class="eyebrow">最近项目</p><h2>继续开发</h2></div><button class="text-button" data-nav="projects">查看全部</button></div>
        <div class="compact-list">${recent.length ? recent.map((project) => `<button class="compact-row" data-open-project="${project.id}"><span class="status-dot"></span><span><strong>${h(project.title)}</strong><small>${h(project.status)} · ${h(project.timeLevel)} · ${h(project.productionLevel)}级</small></span><span>→</span></button>`).join("") : emptyInline("尚无项目", "80分以上的选题可以正式立项。")}</div>
      </section>
    </div>
  </section>`;
}

function metricCard(label, value, detail) {
  return `<div class="metric"><span>${h(label)}</span><strong>${value}</strong><small>${h(detail)}</small></div>`;
}

function funnelRow(label, value, total) {
  const width = Math.max(value ? 8 : 0, Math.round((value / total) * 100));
  return `<div class="funnel-row"><div><span>${h(label)}</span><strong>${value}</strong></div><div class="bar"><i style="width:${width}%"></i></div></div>`;
}

function renderDna() {
  const account = state.account;
  return `<section class="page narrow">
    ${pageHeader("账号基线", "账号 DNA", "只配置一次，让后续选题、评分与制作建议持续读取同一套创意方向。")}
    <form id="dna-form" class="panel form-panel">
      <div class="section-title"><span>01</span><div><h2>品牌表达</h2><p>观众为什么记住你，品牌为什么找你。</p></div></div>
      <div class="form-grid two"><label>账号或工作室名称<input name="brandName" value="${h(account.brandName)}" placeholder="例如：异想制片厂" required /></label><label>母品牌记忆句<input name="slogan" value="${h(account.slogan)}" required /></label></div>
      <label>解释句<textarea name="description" rows="2" required>${h(account.description)}</textarea></label>
      ${checkboxGroup("目标观众", "audiences", ["故事型观众", "创意型观众", "行业/B端观众"], account.audiences)}
      <div class="section-title"><span>02</span><div><h2>三轴内容模型</h2><p>题材可以变化，创意方法保持一致。</p></div></div>
      ${checkboxGroup("故事类型", "storyTypes", ["现实", "幻想", "喜剧", "类型片"], account.storyTypes)}
      ${checkboxGroup("表达方式", "formats", ["高概念", "微电影", "POV", "虚构纪录片", "连续剧情", "视觉奇观"], account.formats)}
      ${checkboxGroup("情绪结果", "emotions", ["感动", "惊讶", "恐惧", "好笑", "浪漫", "爽感", "治愈", "哲思"], account.emotions)}
      <div class="section-title"><span>03</span><div><h2>商业与制作</h2><p>商业适配不是硬塞广告，制作建议也必须匹配真实能力。</p></div></div>
      ${checkboxGroup("商业品类", "commercialCategories", ["汽车", "3C", "快消", "家居", "AI互联网", "出行", "办公招聘"], account.commercialCategories)}
      ${checkboxGroup("制作能力", "productionCapabilities", ["文生图", "图生视频", "文生视频", "角色一致性", "复杂动作", "剪辑", "声音"], account.productionCapabilities)}
      <label>视觉规则<textarea name="visualRules" rows="3">${h(account.visualRules)}</textarea></label>
      <div class="form-actions"><span>保存后立即应用于后续评分与推荐。</span><button class="button primary" type="submit">保存账号 DNA</button></div>
    </form>
  </section>`;
}

function checkboxGroup(label, name, options, selected = []) {
  return `<fieldset><legend>${h(label)}</legend><div class="check-grid">${options.map((option) => `<label class="check-pill"><input type="checkbox" name="${name}" value="${h(option)}" ${selected.includes(option) ? "checked" : ""}/><span>${h(option)}</span></label>`).join("")}</div></fieldset>`;
}

function renderGenerate() {
  return `<section class="page">
    ${pageHeader("P2 选题生成", "找选题", "先用账号 DNA 约束方向，再生成结构化候选。生成结果会直接进入选题池。")}
    <div class="split-grid">
      <form id="generate-form" class="panel form-panel sticky-panel">
        <div class="panel-head"><div><p class="eyebrow">生成条件</p><h2>这轮想探索什么</h2></div></div>
        <section class="trend-picker" aria-label="抖音热点参考">
          <div class="trend-picker-head"><div><strong>抖音实时热点</strong><small>${trendFeed.updatedAt ? `来源更新时间：${h(trendFeed.updatedAt)}` : "热点标题用于启发，不照搬热点内容"}</small></div><button type="button" class="text-button" data-refresh-trends>${trendFeed.status === "loading" ? "刷新中…" : "刷新热点"}</button></div>
          ${trendFeed.status === "loading" && !trendFeed.items.length ? `<p class="trend-state">正在读取热点榜…</p>` : ""}
          ${trendFeed.error ? `<p class="trend-state error">${h(trendFeed.error)}</p>` : ""}
          ${trendFeed.items.length ? `<div class="trend-list">${trendFeed.items.slice(0, 12).map((item) => `<div class="trend-item"><label><input type="checkbox" name="trendTopics" value="${h(item.title)}" ${trendSelection.has(item.title) ? "checked" : ""}/><span class="trend-rank">${String(item.rank).padStart(2, "0")}</span><span class="trend-title">${h(item.title)}</span></label><a href="${h(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="在抖音搜索：${h(item.title)}" title="在抖音搜索此热点">↗</a></div>`).join("")}</div><small class="trend-attribution">榜单由第三方热点导航聚合，非抖音官方数据；只用于标题检索。${trendFeed.fetchedAt ? `抓取于 ${h(new Date(trendFeed.fetchedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }))}` : ""} · <a href="${h(trendFeed.sourceUrl || "https://douyinhuo.cn/")}" target="_blank" rel="noopener noreferrer">查看来源</a></small>` : trendFeed.status !== "loading" && !trendFeed.error ? `<p class="trend-state">点击“刷新热点”加载当前抖音趋势。</p>` : ""}
        </section>
        <label>题材关键词<input name="keyword" placeholder="可留空，例如：亲情、职场、汽车" /></label>
        <div class="form-grid two"><label>故事类型${selectField("storyType", ["读取 DNA", ...state.account.storyTypes])}</label><label>表达方式${selectField("format", ["读取 DNA", ...state.account.formats])}</label></div>
        <div class="form-grid two"><label>情绪${selectField("emotion", ["读取 DNA", ...state.account.emotions])}</label><label>商业品类${selectField("commercial", ["无指定", ...state.account.commercialCategories])}</label></div>
        <div class="form-grid two"><label>数量${selectField("count", ["10", "20", "50"], "10")}</label><label>创新程度${selectField("innovation", ["稳妥", "平衡", "激进"], "平衡")}</label></div>
        <label>爆款视频参考<textarea name="viralExamples" rows="3" placeholder="粘贴抖音视频链接，并写下你观察到的开头钩子、叙事节奏或高赞评论；系统不会自动读取视频内容。"></textarea></label>
        <button class="button primary wide" type="submit">生成结构化选题</button>
        <p class="form-hint">会结合账号 DNA 和选中的热点生成原创候选。${runtime.ai?.configured ? "配置模型后还会参考你填写的爆款观察" : "本地降级模式仅用热点标题启发，不分析爆款链接"}；热点不会被照搬。</p>
      </form>
      <section class="panel form-panel">
        <div class="panel-head"><div><p class="eyebrow">手动输入</p><h2>评估现有脑洞</h2></div></div>
        <form id="manual-form">
          <label>标题<input name="title" required placeholder="一句话标题" /></label>
          <label>Logline<textarea name="logline" rows="5" required placeholder="谁，在什么异常规则下，为了什么，遇到什么阻力？"></textarea></label>
          <div class="form-grid two"><label>故事类型${selectField("storyType", state.account.storyTypes)}</label><label>表达方式${selectField("format", state.account.formats)}</label></div>
          <div class="form-grid two"><label>情绪${selectField("emotion", state.account.emotions)}</label><label>目标观众${selectField("targetAudience", state.account.audiences)}</label></div>
          <button class="button secondary wide" type="submit">保存并立即评分</button>
        </form>
      </section>
    </div>
    <section class="panel form-panel viral-lab">
      <div class="panel-head"><div><p class="eyebrow">爆款拆解</p><h2>逐镜拉片分析</h2><p class="page-description">填写视频链接，并提供时间码字幕或画面观察，生成逐镜头拆解。</p></div></div>
      <div class="notice-box">仅粘贴链接无法观看视频。请把字幕/口播和画面按时间顺序写在下方；模型只分析你提供的材料，不会自动读取抖音视频。</div>
      <form id="viral-analysis-form" class="viral-analysis-form">
        <div class="form-grid two"><label>视频标题<input name="title" placeholder="便于回看，例如：30秒讲清一个反转故事" /></label><label>抖音视频链接<input name="videoUrl" type="url" placeholder="https://v.douyin.com/..." required /></label></div>
        <div class="form-grid two"><label>视频时长（秒）<input name="duration" type="number" min="1" max="600" placeholder="例如 35" /></label><label>分析重点<select name="analysisFocus"><option>完整拉片</option><option>开场钩子与前三秒</option><option>镜头节奏与剪辑</option><option>叙事结构与反转</option><option>字幕、配音与音效</option></select></label></div>
        <label>时间码字幕 / 画面描述<textarea name="materials" rows="7" minlength="40" maxlength="12000" required placeholder="按顺序粘贴字幕或描述画面，尽量包含时间码、景别、人物动作、字幕/口播和音效。&#10;00:00-00:03 近景：人物盯着镜头说“……”；急促切入，屏幕字幕……&#10;00:03-00:08 中景：……&#10;00:08-00:15 画面转为……"></textarea></label>
        <div class="form-actions"><small>${runtime.ai?.configured ? `当前模型：${h(providerLabel(runtime.ai.provider))} / ${h(runtime.ai.model)}` : "请先在 .env 配置可用的大模型 API，拉片分析需要模型服务"}</small><button class="button primary" type="submit" ${runtime.ai?.configured ? "" : "disabled"}>${viralAnalysisBusy ? "正在分析…" : "开始拉片分析"}</button></div>
      </form>
    </section>
    ${renderViralAnalyses()}
    <section class="idea-examples"><p class="eyebrow">内容方法</p><h2>好选题先回答三个问题</h2><div class="principle-grid"><article><span>01</span><h3>哪里不正常</h3><p>前三秒就能理解异常规则。</p></article><article><span>02</span><h3>人物会失去什么</h3><p>设定必须逼人物行动和选择。</p></article><article><span>03</span><h3>哪一幕代表全片</h3><p>先锁定视觉记忆点再扩写。</p></article></div></section>
  </section>`;
}

function renderViralAnalyses() {
  const analyses = [...(state.viralAnalyses || [])].reverse();
  if (!analyses.length) return "";
  return `<section class="viral-results"><div class="panel-head"><div><p class="eyebrow">分析档案</p><h2>已完成的拉片</h2></div></div>${analyses.map((analysis) => `<article class="panel viral-result"><header><div><h3>${h(analysis.title || "未命名视频")}</h3><small>${formatDate(analysis.createdAt)} · ${analysis.ai ? `${h(providerLabel(analysis.ai.provider))} / ${h(analysis.ai.model)}` : "AI分析"}</small></div>${safeHttpUrl(analysis.videoUrl) ? `<a class="button compact secondary" href="${h(safeHttpUrl(analysis.videoUrl))}" target="_blank" rel="noopener noreferrer">打开原视频 ↗</a>` : ""}</header><div class="viral-overview"><div><strong>开场钩子</strong><p>${h(analysis.openingHook)}</p></div><div><strong>整体结构</strong><p>${h(analysis.structure)}</p></div><div><strong>拆解摘要</strong><p>${h(analysis.summary)}</p></div></div><div class="shot-list">${analysis.shots.map((shot, index) => `<article class="shot-card"><div class="shot-time"><span>${String(index + 1).padStart(2, "0")}</span><strong>${h(shot.timeRange)}</strong></div><div class="shot-content"><h4>${h(shot.visual)}</h4><div class="shot-details"><p><strong>景别/运镜：</strong>${h(shot.shotSizeCamera)}</p><p><strong>动作：</strong>${h(shot.action)}</p><p><strong>声音/字幕：</strong>${h(shot.audioText)}</p><p><strong>叙事功能：</strong>${h(shot.narrativeFunction)}</p><p><strong>留存作用：</strong>${h(shot.retentionPoint)}</p></div></div></article>`).join("")}</div><div class="viral-takeaways"><div><strong>留存机制</strong>${renderAnalysisList(analysis.retentionMechanics)}</div><div><strong>可迁移手法</strong>${renderAnalysisList(analysis.replicable)}</div><div><strong>避免照搬</strong>${renderAnalysisList(analysis.cautions)}</div></div></article>`).join("")}</section>`;
}

function renderAnalysisList(items = []) {
  return `<ul>${items.map((item) => `<li>${h(item)}</li>`).join("")}</ul>`;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function selectField(name, options, selected = "") {
  return `<select name="${name}">${options.map((option) => `<option value="${option.startsWith("读取") || option === "无指定" ? "" : h(option)}" ${option === selected ? "selected" : ""}>${h(option)}</option>`).join("")}</select>`;
}

function renderPool() {
  const status = new URLSearchParams(location.search).get("status") || "全部";
  const ideas = [...state.ideas].sort((a, b) => (latestScore(b)?.total || 0) - (latestScore(a)?.total || 0));
  const editingIdea = state.ideas.find((idea) => idea.id === editingIdeaId);
  return `<section class="page">
    ${pageHeader("内容资产", "选题池", "把想法放在同一套标准下比较，优先开发真正值得投入的项目。", `<button class="button primary" data-nav="generate">＋ 新建选题</button>`)}
    <div class="toolbar"><div class="search-wrap"><span>⌕</span><input id="idea-search" placeholder="搜索标题、设定或标签" /></div><select id="idea-status-filter"><option>全部</option>${["待评分", "待优化", "已通过", "已立项", "暂缓", "淘汰"].map((item) => `<option ${status === item ? "selected" : ""}>${item}</option>`).join("")}</select><select id="idea-sort"><option value="score">按总分</option><option value="updated">按更新时间</option><option value="commercial">按商业适配</option><option value="series">按系列潜力</option></select></div>
    <div class="bulk-toolbar"><label><input type="checkbox" id="select-visible-ideas" /> 全选当前结果</label><span id="idea-selection-count">已选 ${selectedIdeaIds.size} 条</span><select id="bulk-idea-status" aria-label="批量设置状态"><option value="">批量设置状态…</option>${["待评分", "待优化", "已通过", "已立项", "暂缓", "淘汰"].map((item) => `<option>${item}</option>`).join("")}</select><button class="button compact secondary" data-bulk-status>应用</button><button class="button compact danger-button" data-bulk-delete>删除所选</button></div>
    <div class="table-card"><div class="idea-table-head"><span></span><span>选题</span><span>类型与来源</span><span>当前评分</span><span>状态</span><span>操作</span></div><div id="idea-list">${ideas.length ? ideas.map(renderIdeaRow).join("") : emptyInline("选题池还是空的", "生成一组选题，或手动录入第一个脑洞。", "generate")}</div></div>
    ${editingIdea ? renderIdeaEditor(editingIdea) : ""}
  </section>`;
}

function renderIdeaEditor(idea) {
  const fieldOptions = (name, values, selected) => `<select name="${name}">${values.map((value) => `<option ${value === selected ? "selected" : ""}>${h(value)}</option>`).join("")}</select>`;
  const options = (current, values = []) => [...new Set([current, ...values].filter(Boolean))];
  return `<div class="modal-backdrop" data-editor-backdrop><section class="panel idea-editor" role="dialog" aria-modal="true" aria-labelledby="idea-editor-title"><div class="panel-head"><div><p class="eyebrow">选题池</p><h2 id="idea-editor-title">修改选题</h2></div><button type="button" class="icon-button" data-cancel-edit aria-label="关闭">×</button></div><form id="idea-edit-form" data-idea-id="${h(idea.id)}"><label>标题<input name="title" required maxlength="120" value="${h(idea.title)}" /></label><label>一句话梗概<textarea name="logline" required rows="4" maxlength="1000">${h(idea.logline)}</textarea></label><div class="form-grid two"><label>故事类型${fieldOptions("storyType", options(idea.storyType, state.account.storyTypes), idea.storyType)}</label><label>表达方式${fieldOptions("format", options(idea.format, state.account.formats), idea.format)}</label></div><div class="form-grid two"><label>情绪${fieldOptions("emotion", options(idea.emotion, state.account.emotions), idea.emotion)}</label><label>目标观众${fieldOptions("targetAudience", options(idea.targetAudience, state.account.audiences), idea.targetAudience)}</label></div><div class="form-actions"><button type="button" class="button secondary" data-cancel-edit>取消</button><button class="button primary" type="submit">保存修改</button></div></form></section></div>`;
}

function renderIdeaRow(idea) {
  const score = latestScore(idea);
  const linked = state.projects.some((project) => project.ideaId === idea.id);
  return `<article class="idea-row" data-idea-row data-idea-id="${h(idea.id)}" data-search="${h(`${idea.title} ${idea.logline} ${idea.storyType} ${idea.format} ${idea.commercialTags?.join(" ")}`.toLowerCase())}" data-status="${h(idea.status)}" data-score="${score?.total || 0}" data-updated="${h(idea.updatedAt)}" data-commercial="${score?.details.find((item) => item.key === "commercial")?.value || 0}" data-series="${score?.details.find((item) => item.key === "series")?.value || 0}">
    <label class="idea-select"><input type="checkbox" data-select-idea="${h(idea.id)}" ${selectedIdeaIds.has(idea.id) ? "checked" : ""} aria-label="选择：${h(idea.title)}" /></label>
    <div class="idea-main"><strong>${h(idea.title)}</strong><p>${h(idea.logline)}</p><div class="tag-row"><span>${h(idea.emotion)}</span><span>${h(idea.targetAudience)}</span>${idea.commercialTags?.slice(0, 2).map((tag) => `<span>${h(tag)}</span>`).join("") || ""}</div></div>
    <div class="idea-meta"><strong>${h(idea.storyType)}</strong><small>${h(idea.format)} · ${h(idea.source)}</small></div>
    <div>${score ? `<button class="score-ring ${scoreClass(score.total)}" data-open-idea="${idea.id}"><strong>${score.total}</strong><small>/100</small></button>` : `<button class="button compact secondary" data-score-idea="${idea.id}">立即评分</button>`}</div>
    <div><select class="status-select" data-status-idea="${idea.id}">${["待评分", "待优化", "已通过", "已立项", "暂缓", "淘汰"].map((item) => `<option ${idea.status === item ? "selected" : ""}>${item}</option>`).join("")}</select></div>
    <div class="idea-actions"><button class="icon-button" title="查看详情" data-open-idea="${h(idea.id)}">→</button><button class="icon-button" title="修改选题" data-edit-idea="${h(idea.id)}">✎</button><button class="icon-button danger" title="${linked ? "已立项选题不可删除" : "删除选题"}" data-delete-idea="${h(idea.id)}" ${linked ? "disabled" : ""}>×</button></div>
  </article>`;
}

function renderEvaluation() {
  const idea = state.ideas.find((item) => item.id === state.selectedIdeaId);
  if (!idea) { state.selectedIdeaId = null; return renderPool(); }
  const score = latestScore(idea);
  const previous = idea.scoreHistory?.at(-2);
  return `<section class="page">
    <button class="back-button" data-close-idea>← 返回选题池</button>
    ${pageHeader("P3 评分与 P4 优化", idea.title, idea.logline, `<span class="status-badge">${h(idea.status)}</span>`)}
    ${score ? `<div class="evaluation-grid">
      <section class="score-summary panel"><div class="big-score ${scoreClass(score.total)}"><strong>${score.total}</strong><span>/ 100</span></div><div><p class="eyebrow">一句话判断</p><h2>${h(score.verdict)}</h2><p>强项：${h(score.diagnosis.strengths.join("、"))}。${h(score.diagnosis.risk)}</p>${score.ai ? `<span class="engine-badge">${h(providerLabel(score.ai.provider))} · ${h(score.ai.model)}</span>` : `<span class="engine-badge local">本地可解释引擎</span>`}${previous ? `<div class="change-summary"><p class="delta ${score.delta >= 0 ? "positive" : "negative"}">较上一版 ${score.delta >= 0 ? "+" : ""}${score.delta} 分</p>${score.changes.length ? `<div class="change-list">${score.changes.map((item) => `<span>${h(item.label)} ${item.delta > 0 ? "+" : ""}${item.delta}</span>`).join("")}</div>` : `<span class="no-change">各维度暂未变化，可继续优化核心短板。</span>`}</div>` : ""}</div></section>
      <section class="panel score-details"><div class="panel-head"><div><p class="eyebrow">10维公开评分</p><h2>分数从哪里来</h2></div><button class="button compact secondary" data-score-idea="${idea.id}">重新评分</button></div>${score.details.map((detail) => `<article class="dimension"><div class="dimension-head"><span>${h(detail.label)}</span><strong>${detail.value}<small>/${detail.max}</small></strong></div><div class="bar"><i style="width:${Math.round(detail.value / detail.max * 100)}%"></i></div><p>${h(detail.reason)}</p></article>`).join("")}</section>
      <section class="panel optimize-panel"><div class="panel-head"><div><p class="eyebrow">优化建议</p><h2>先改短板，再重评</h2></div></div><div class="optimization-list">${score.optimizations.map((item, index) => `<article><span>0${index + 1}</span><div><h3>${h(item.title)}</h3><p>${h(item.description)}</p></div><button class="button compact light" data-optimize="${h(item.id)}">应用并重评</button></article>`).join("")}</div></section>
      <section class="panel version-panel"><div class="panel-head"><div><p class="eyebrow">版本历史</p><h2>可查看、可回退</h2></div></div><div class="timeline">${[...(idea.versions || [])].reverse().map((version) => `<article><span>V${version.version}</span><div><strong>${h(version.reason)}</strong><p>${h(version.logline)}</p><small>${formatDate(version.createdAt)}</small></div>${version.version !== idea.versions.length ? `<button class="text-button" data-restore-version="${version.version}">恢复</button>` : ""}</article>`).join("")}</div></section>
    </div>` : `<section class="panel empty-score"><div class="empty-icon">100</div><h2>用十个维度判断是否值得拍</h2><p>评分会读取账号 DNA，并给出每个维度的理由、主要风险与优化方向。</p><button class="button primary" data-score-idea="${idea.id}">开始评分</button></section>`}
    ${score ? `<div class="decision-bar"><div><span>${score.total >= 80 ? "已经达到立项线" : "尚未达到重点制作线"}</span><strong>${score.total >= 80 ? "让这个想法进入结构与脚本开发" : "建议先应用优化，或按 C 级小规模测试"}</strong></div>${score.total >= 80 ? `<button class="button primary" data-promote="${idea.id}" ${idea.status === "已立项" ? "disabled" : ""}>${idea.status === "已立项" ? "已正式立项" : "正式立项 →"}</button>` : `<button class="button secondary" data-set-status="暂缓">暂缓这个想法</button>`}</div>` : ""}
  </section>`;
}

function renderProjects() {
  return `<section class="page">
    ${pageHeader("故事开发", "项目开发", "先确认结构与 Beat Sheet，再进入正式脚本，避免有设定却没有故事。")}
    <div class="project-grid">${state.projects.length ? state.projects.map((project) => {
      const idea = state.ideas.find((item) => item.id === project.ideaId);
      const score = latestScore(idea);
      return `<button class="project-card" data-open-project="${project.id}"><div class="project-cover"><span>${h(project.timeLevel)}</span><strong>${h(project.productionLevel)}级</strong><i>${score?.total || "—"}</i></div><div><span class="status-badge">${h(project.status)}</span><h2>${h(project.title)}</h2><p>${h(project.coreConflict)}</p><footer><span>${h(STORY_STRUCTURES[project.structure]?.label)}</span><span>${project.beats.length} Beats</span><span>${project.scriptVersions?.length || 0} Scripts</span></footer></div></button>`;
    }).join("") : emptyInline("还没有正式项目", "评分达到80分后，就可以把选题转为项目。", "pool")}</div>
  </section>`;
}

function renderProject() {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  if (!project) { state.selectedProjectId = null; return renderProjects(); }
  const idea = state.ideas.find((item) => item.id === project.ideaId);
  const duration = beatDuration(project.beats);
  const target = TIME_LEVELS[project.timeLevel]?.seconds || 90;
  const over = duration > target;
  const script = project.scriptVersions?.at(-1);
  return `<section class="page project-page">
    <button class="back-button" data-close-project>← 返回项目列表</button>
    ${pageHeader("P5—P8 项目开发", project.title, `来自选题：${idea?.logline || ""}`, `<div class="header-actions"><button class="button compact secondary" data-export-project="${project.id}">导出文本</button><button class="button compact ${project.status === "归档" ? "secondary" : "primary"}" data-archive-project="${project.id}">${project.status === "归档" ? "恢复开发" : "归档项目"}</button></div>`)}
    <div class="stage-tabs"><a href="#project-card">1 立项卡</a><a href="#beats">2 Beat Sheet</a><a href="#script">3 正式脚本</a></div>
    <form id="project-form" class="panel form-panel" data-project="${project.id}">
      <div class="panel-head"><div><p class="eyebrow">立项卡</p><h2>把设定变成可开发的项目</h2></div><span class="status-badge">${h(project.status)}</span></div>
      <div class="form-grid three"><label>时长等级${selectProjectOption("timeLevel", Object.entries(TIME_LEVELS).map(([key, value]) => [key, value.label]), project.timeLevel)}</label><label>制作等级${selectProjectOption("productionLevel", [["A", "A级 · 旗舰"], ["B", "B级 · 常规精品"], ["C", "C级 · 快速测试"]], project.productionLevel)}</label><label>叙事结构${selectProjectOption("structure", Object.entries(STORY_STRUCTURES).map(([key, value]) => [key, value.label]), project.structure)}</label></div>
      <div class="form-grid two"><label>主人公<input name="protagonist" value="${h(project.protagonist)}" /></label><label>核心欲望<input name="coreDesire" value="${h(project.coreDesire)}" /></label></div>
      <label>核心冲突<textarea name="coreConflict" rows="2">${h(project.coreConflict)}</textarea></label>
      <div class="form-grid two"><label>结尾<textarea name="ending" rows="2">${h(project.ending)}</textarea></label><label>视觉记忆点<textarea name="visualHook" rows="2">${h(project.visualHook)}</textarea></label></div>
      <div class="form-actions"><span>推荐基于选题类型、情绪、分数与账号制作能力。</span><button class="button secondary" type="submit">保存立项卡</button></div>
    </form>
    <section id="beats" class="panel form-panel beats-panel"><div class="panel-head"><div><p class="eyebrow">Beat Sheet</p><h2>先结构，再脚本</h2></div><div class="duration ${over ? "over" : ""}"><strong>${duration}</strong><span>/ ${target} 秒</span></div></div>
      ${over ? `<p class="warning">当前节拍超过 ${h(project.timeLevel)} 建议时长。请压缩节拍或升级时长等级。</p>` : ""}
      ${project.beats.length ? `<form id="beats-form" data-project="${project.id}" class="beats-list">${project.beats.map((beat, index) => `<article class="beat"><div class="beat-index"><span>BEAT</span><strong>${String(index + 1).padStart(2, "0")}</strong></div><div class="beat-fields"><div class="form-grid beat-top"><label>功能<input name="purpose_${beat.id}" value="${h(beat.purpose)}" /></label><label>开始<input type="number" min="0" name="start_${beat.id}" value="${beat.start}" /></label><label>结束<input type="number" min="1" name="end_${beat.id}" value="${beat.end}" /></label></div><label>动作<textarea rows="2" name="action_${beat.id}">${h(beat.action)}</textarea></label><div class="form-grid two"><label>对白/旁白<textarea rows="2" name="dialogue_${beat.id}">${h(beat.dialogue)}</textarea></label><label>视觉<textarea rows="2" name="visual_${beat.id}">${h(beat.visual)}</textarea></label></div></div><button type="button" class="icon-button danger" data-delete-beat="${beat.id}" title="删除节拍">×</button></article>`).join("")}<div class="form-actions"><button type="button" class="text-button" data-add-beat>＋ 添加节拍</button><div><button class="button secondary" type="submit">保存 Beat</button><button class="button primary" type="button" data-confirm-beats>${project.beatsConfirmed ? "已确认 · 重新确认" : "确认 Beat Sheet"}</button></div></div></form>` : `<div class="empty-section"><h3>生成 5—8 个可编辑节拍</h3><p>系统会按当前叙事结构和时长等级分配节奏。</p><button class="button primary" data-generate-beats>生成 Beat Sheet</button></div>`}
    </section>
    <section id="script" class="panel form-panel script-panel"><div class="panel-head"><div><p class="eyebrow">正式脚本</p><h2>${script ? `脚本 V${script.version}` : "从确认后的 Beat 生成"}</h2></div>${script ? `<span>${script.estimatedDuration} 秒</span>` : ""}</div>
      ${script ? `<form id="script-form" data-project="${project.id}"><textarea name="content" class="script-editor" rows="28">${h(script.content)}</textarea><div class="form-actions"><span>支持局部修改；再次生成会保留当前版本。</span><div><button class="button secondary" type="submit">保存修改</button><button class="button primary" type="button" data-generate-script>生成新版本</button></div></div></form>` : `<div class="empty-section"><h3>${project.beatsConfirmed ? "结构已确认，可以写正式脚本" : "请先生成并确认 Beat Sheet"}</h3><p>脚本会继承每个节拍的动作、对白、视觉和情绪目标。</p><button class="button primary" data-generate-script ${project.beatsConfirmed ? "" : "disabled"}>生成正式脚本</button></div>`}
    </section>
  </section>`;
}

function selectProjectOption(name, options, selected) {
  return `<select name="${name}">${options.map(([value, label]) => `<option value="${h(value)}" ${value === selected ? "selected" : ""}>${h(label)}</option>`).join("")}</select>`;
}

function emptyInline(title, description, route = "") {
  return `<div class="empty-inline"><div class="empty-icon">✦</div><strong>${h(title)}</strong><p>${h(description)}</p>${route ? `<button class="button secondary" data-nav="${route}">前往处理</button>` : ""}</div>`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

async function withAiFallback(progressMessage, aiWork, localWork) {
  notify(progressMessage);
  if (runtime.ai?.configured) {
    try {
      return { value: await aiWork(), provider: runtime.ai.provider || "ai" };
    } catch (error) {
      console.warn("Model request failed; using local fallback", error);
      runtime.lastAiError = error.message;
    }
  }
  return { value: localWork(), provider: "local" };
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-refresh-trends],[data-nav],[data-open-idea],[data-close-idea],[data-score-idea],[data-optimize],[data-restore-version],[data-promote],[data-set-status],[data-open-project],[data-close-project],[data-generate-beats],[data-add-beat],[data-delete-beat],[data-confirm-beats],[data-generate-script],[data-export-project],[data-archive-project],[data-edit-idea],[data-delete-idea],[data-bulk-status],[data-bulk-delete],[data-cancel-edit]");
  if (!target) return;
  if (target.hasAttribute("data-refresh-trends")) { await refreshDouyinTrends(); return; }
  if (target.dataset.nav) navigate(target.dataset.nav);
  if (target.dataset.openIdea) { state.selectedIdeaId = target.dataset.openIdea; commit(); navigate("pool"); }
  if (target.dataset.editIdea) { editingIdeaId = target.dataset.editIdea; render(); }
  if (target.hasAttribute("data-cancel-edit")) { editingIdeaId = null; render(); }
  if (target.dataset.deleteIdea) deleteIdeas([target.dataset.deleteIdea]);
  if (target.hasAttribute("data-bulk-status")) bulkUpdateIdeaStatus();
  if (target.hasAttribute("data-bulk-delete")) deleteIdeas([...selectedIdeaIds]);
  if (target.hasAttribute("data-close-idea")) { state.selectedIdeaId = null; commit(); }
  if (target.dataset.scoreIdea) await handleScore(target.dataset.scoreIdea);
  if (target.dataset.optimize) await handleOptimize(target.dataset.optimize);
  if (target.dataset.restoreVersion) handleRestore(Number(target.dataset.restoreVersion));
  if (target.dataset.promote) await handlePromote(target.dataset.promote);
  if (target.dataset.setStatus) updateSelectedIdeaStatus(target.dataset.setStatus);
  if (target.dataset.openProject) { state.selectedProjectId = target.dataset.openProject; commit(); navigate("projects"); }
  if (target.hasAttribute("data-close-project")) { state.selectedProjectId = null; commit(); }
  if (target.hasAttribute("data-generate-beats")) await handleGenerateBeats();
  if (target.hasAttribute("data-add-beat")) handleAddBeat();
  if (target.dataset.deleteBeat) handleDeleteBeat(target.dataset.deleteBeat);
  if (target.hasAttribute("data-confirm-beats")) handleConfirmBeats();
  if (target.hasAttribute("data-generate-script")) await handleGenerateScript();
  if (target.dataset.exportProject) handleExport(target.dataset.exportProject);
  if (target.dataset.archiveProject) handleArchive(target.dataset.archiveProject);
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  if (form.id === "viral-analysis-form") {
    if (!runtime.ai?.configured) { notify("请先在 .env 配置大模型 API"); return; }
    viralAnalysisBusy = true;
    render();
    try {
      const input = {
        title: String(data.get("title") || "").trim(),
        videoUrl: String(data.get("videoUrl") || "").trim(),
        duration: String(data.get("duration") || "").trim(),
        analysisFocus: String(data.get("analysisFocus") || "完整拉片"),
        materials: String(data.get("materials") || "").trim(),
      };
      const analysis = await aiAnalyzeViralVideo(input);
      const record = { id: createId("analysis"), ...input, ...analysis, createdAt: new Date().toISOString() };
      state.viralAnalyses ||= [];
      state.viralAnalyses.push(record);
      track(state, "analyze_viral_video", { analysisId: record.id, shotCount: record.shots.length });
      viralAnalysisBusy = false;
      commit(`拉片分析完成，共拆解 ${record.shots.length} 个镜头`);
    } catch (error) {
      viralAnalysisBusy = false;
      render();
      notify(`拉片分析失败：${error.message}`);
    }
    return;
  }
  if (form.id === "idea-edit-form") {
    const idea = state.ideas.find((item) => item.id === form.dataset.ideaId);
    if (!idea) return;
    const before = { title: idea.title, logline: idea.logline };
    Object.assign(idea, { title: String(data.get("title")).trim(), logline: String(data.get("logline")).trim(), storyType: data.get("storyType"), format: data.get("format"), emotion: data.get("emotion"), targetAudience: data.get("targetAudience"), updatedAt: new Date().toISOString(), scoreStale: true });
    if (before.title !== idea.title || before.logline !== idea.logline) {
      idea.versions ||= [];
      idea.versions.push({ version: idea.versions.length + 1, title: idea.title, logline: idea.logline, reason: "手动修改", createdAt: idea.updatedAt });
    }
    track(state, "edit_idea", { ideaId: idea.id });
    editingIdeaId = null;
    commit("选题已修改；评分已标记为过期，请重新评分");
  }
  if (form.id === "dna-form") {
    state.account = { ...state.account, brandName: data.get("brandName"), slogan: data.get("slogan"), description: data.get("description"), audiences: data.getAll("audiences"), storyTypes: data.getAll("storyTypes"), formats: data.getAll("formats"), emotions: data.getAll("emotions"), commercialCategories: data.getAll("commercialCategories"), productionCapabilities: data.getAll("productionCapabilities"), visualRules: data.get("visualRules"), updatedAt: new Date().toISOString() };
    commit("账号 DNA 已保存");
  }
  if (form.id === "generate-form") {
    const options = Object.fromEntries(data);
    options.trendTopics = data.getAll("trendTopics");
    trendSelection = new Set(options.trendTopics);
    const result = await withAiFallback(
      "正在生成结构化选题…",
      () => aiGenerateIdeas(state.account, options),
      () => generateIdeas(state.account, options),
    );
    const ideas = result.value;
    state.ideas.push(...ideas);
    ideas.forEach((idea) => track(state, "create_idea", { ideaId: idea.id, source: idea.source }));
    commit(`已由${engineLabel(result.provider)}生成 ${ideas.length} 条选题`);
    navigate("pool");
  }
  if (form.id === "manual-form") {
    const idea = createManualIdea(state.account, Object.fromEntries(data));
    const result = await withAiFallback(
      "正在评估想法…",
      () => aiScoreIdea(idea, state.account),
      () => scoreIdea(idea, state.account),
    );
    const score = result.value;
    idea.scoreHistory.push(score);
    idea.status = score.total >= 80 ? "已通过" : "待优化";
    state.ideas.push(idea);
    state.selectedIdeaId = idea.id;
    track(state, "create_idea", { ideaId: idea.id, source: "手动" });
    track(state, "score_idea", { ideaId: idea.id, total: score.total });
    commit(`想法已保存并由${engineLabel(result.provider)}完成评分`);
    navigate("pool");
  }
  if (form.id === "project-form") saveProjectForm(form, data);
  if (form.id === "beats-form") saveBeatsForm(form, data);
  if (form.id === "script-form") saveScriptForm(form, data);
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-select-idea]")) {
    const id = event.target.dataset.selectIdea;
    if (event.target.checked) selectedIdeaIds.add(id);
    else selectedIdeaIds.delete(id);
    updateIdeaSelectionUI();
  }
  if (event.target.id === "select-visible-ideas") {
    const visibleRows = [...document.querySelectorAll("[data-idea-row]")].filter((row) => !row.hidden);
    visibleRows.forEach((row) => {
      const checkbox = row.querySelector("[data-select-idea]");
      checkbox.checked = event.target.checked;
      if (event.target.checked) selectedIdeaIds.add(checkbox.dataset.selectIdea);
      else selectedIdeaIds.delete(checkbox.dataset.selectIdea);
    });
    updateIdeaSelectionUI();
  }
  if (event.target.matches('input[name="trendTopics"]')) {
    const title = event.target.value;
    if (event.target.checked) trendSelection.add(title);
    else trendSelection.delete(title);
  }
  if (event.target.matches("[data-status-idea]")) {
    const idea = state.ideas.find((item) => item.id === event.target.dataset.statusIdea);
    if (idea) { idea.status = event.target.value; idea.updatedAt = new Date().toISOString(); commit("状态已更新"); }
  }
  if (event.target.id === "idea-status-filter" || event.target.id === "idea-sort") filterIdeas();
});

document.addEventListener("input", (event) => {
  if (event.target.id === "idea-search") filterIdeas();
});

window.addEventListener("hashchange", () => {
  render();
  if (currentRoute() === "generate") ensureDouyinTrends();
});

async function handleScore(id) {
  const idea = state.ideas.find((item) => item.id === id);
  if (!idea) return;
  const previous = latestScore(idea);
  const result = await withAiFallback(
    "正在执行十维评分…",
    () => aiScoreIdea(idea, state.account, previous),
    () => scoreIdea(idea, state.account, previous),
  );
  const score = result.value;
  idea.scoreHistory.push(score);
  idea.scoreStale = false;
  idea.status = score.total >= 80 ? "已通过" : "待优化";
  idea.updatedAt = score.createdAt;
  state.selectedIdeaId = id;
  track(state, previous ? "rescore_after_optimize" : "score_idea", { ideaId: id, total: score.total, delta: score.delta });
  commit(`${engineLabel(result.provider)}评分完成：${score.total} 分`);
}

async function handleOptimize(optimizationId) {
  const index = state.ideas.findIndex((item) => item.id === state.selectedIdeaId);
  if (index < 0) return;
  const idea = state.ideas[index];
  const score = latestScore(idea);
  const optimization = score?.optimizations.find((item) => item.id === optimizationId);
  if (!optimization) return;
  const optimizationResult = await withAiFallback(
    "正在优化并重新评分…",
    () => aiOptimizeIdea(idea, state.account, optimization),
    () => applyOptimization(idea, optimization),
  );
  const optimized = optimizationResult.value;
  const scoreResult = await withAiFallback(
    "正在比较优化前后分数…",
    () => aiScoreIdea(optimized, state.account, score),
    () => scoreIdea(optimized, state.account, score),
  );
  const rescored = scoreResult.value;
  optimized.scoreHistory = [...idea.scoreHistory, rescored];
  optimized.status = rescored.total >= 80 ? "已通过" : "待优化";
  state.ideas[index] = optimized;
  track(state, "optimize_idea", { ideaId: idea.id, optimizationId });
  track(state, "rescore_after_optimize", { ideaId: idea.id, total: rescored.total, delta: rescored.delta });
  commit(`已应用优化，重新评分 ${rescored.total} 分`);
}

function handleRestore(versionNumber) {
  const idea = state.ideas.find((item) => item.id === state.selectedIdeaId);
  const version = idea?.versions.find((item) => item.version === versionNumber);
  if (!idea || !version) return;
  idea.title = version.title;
  idea.logline = version.logline;
  idea.updatedAt = new Date().toISOString();
  commit(`已恢复 V${versionNumber}，历史版本仍保留`);
}

async function handlePromote(id) {
  const idea = state.ideas.find((item) => item.id === id);
  if (!idea || latestScore(idea)?.total < 80 || state.projects.some((project) => project.ideaId === id)) return;
  const localProject = createProject(idea);
  const result = await withAiFallback(
    "正在生成立项摘要与推荐…",
    () => aiCreateProject(idea, state.account, localProject),
    () => localProject,
  );
  const project = result.value;
  state.projects.push(project);
  idea.status = "已立项";
  idea.updatedAt = new Date().toISOString();
  state.selectedProjectId = project.id;
  track(state, "promote_to_project", { ideaId: id, projectId: project.id });
  commit("已正式立项，进入项目开发");
  navigate("projects");
}

function updateSelectedIdeaStatus(status) {
  const idea = state.ideas.find((item) => item.id === state.selectedIdeaId);
  if (!idea) return;
  idea.status = status;
  idea.updatedAt = new Date().toISOString();
  commit(`选题已设为${status}`);
}

function saveProjectForm(form, data) {
  const project = state.projects.find((item) => item.id === form.dataset.project);
  if (!project) return;
  for (const key of ["timeLevel", "productionLevel", "structure", "protagonist", "coreDesire", "coreConflict", "ending", "visualHook"]) project[key] = data.get(key);
  project.beatsConfirmed = false;
  project.updatedAt = new Date().toISOString();
  track(state, "edit_ai_output", { projectId: project.id, area: "project_card" });
  commit("立项卡已保存；结构变更后请重新确认 Beat")
}

async function handleGenerateBeats() {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  if (!project) return;
  const result = await withAiFallback(
    "正在生成 Beat Sheet…",
    () => aiGenerateBeats(project, state.account),
    () => generateBeats(project),
  );
  project.beats = result.value;
  project.beatsConfirmed = false;
  project.updatedAt = new Date().toISOString();
  track(state, "generate_beats", { projectId: project.id, count: project.beats.length });
  commit(`${engineLabel(result.provider)}已生成 ${project.beats.length} 个 Beat`);
}

function handleAddBeat() {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  if (!project || project.beats.length >= 8) { notify("Beat Sheet 最多保留 8 个节拍"); return; }
  const last = project.beats.at(-1);
  project.beats.push({ id: `beat_manual_${Date.now()}`, order: project.beats.length + 1, start: last?.end || 0, end: (last?.end || 0) + 10, purpose: "新增节拍", action: "补充动作", dialogue: "", visual: "", emotion: "" });
  project.beatsConfirmed = false;
  commit("已添加一个 Beat");
}

function handleDeleteBeat(id) {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  if (!project || project.beats.length <= 5) { notify("Beat Sheet 至少保留 5 个节拍"); return; }
  project.beats = project.beats.filter((beat) => beat.id !== id).map((beat, index) => ({ ...beat, order: index + 1 }));
  project.beatsConfirmed = false;
  commit("Beat 已删除");
}

function saveBeatsForm(form, data) {
  const project = state.projects.find((item) => item.id === form.dataset.project);
  if (!project) return;
  project.beats = project.beats.map((beat, index) => ({ ...beat, order: index + 1, purpose: data.get(`purpose_${beat.id}`), start: Number(data.get(`start_${beat.id}`)), end: Number(data.get(`end_${beat.id}`)), action: data.get(`action_${beat.id}`), dialogue: data.get(`dialogue_${beat.id}`), visual: data.get(`visual_${beat.id}`) }));
  project.beatsConfirmed = false;
  project.updatedAt = new Date().toISOString();
  track(state, "edit_ai_output", { projectId: project.id, area: "beats" });
  commit("Beat Sheet 已保存，请重新确认");
}

function handleConfirmBeats() {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  if (!project || project.beats.length < 5 || project.beats.length > 8) return;
  project.beatsConfirmed = true;
  project.updatedAt = new Date().toISOString();
  commit("Beat Sheet 已确认，可以生成正式脚本");
}

async function handleGenerateScript() {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  if (!project?.beatsConfirmed) { notify("请先确认 Beat Sheet"); return; }
  const result = await withAiFallback(
    "正在生成正式脚本…",
    () => aiGenerateScript(project, state.account),
    () => generateScript(project),
  );
  const script = result.value;
  project.scriptVersions.push(script);
  project.updatedAt = script.createdAt;
  track(state, "generate_script", { projectId: project.id, version: script.version });
  commit(`${engineLabel(result.provider)}脚本 V${script.version} 已生成`);
}

function saveScriptForm(form, data) {
  const project = state.projects.find((item) => item.id === form.dataset.project);
  const script = project?.scriptVersions?.at(-1);
  if (!script) return;
  script.content = data.get("content");
  project.updatedAt = new Date().toISOString();
  track(state, "edit_ai_output", { projectId: project.id, area: "script" });
  commit("脚本修改已保存");
}

function handleArchive(id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) return;
  project.status = project.status === "归档" ? "开发中" : "归档";
  project.updatedAt = new Date().toISOString();
  if (project.status === "归档") track(state, "archive_project", { projectId: id });
  commit(project.status === "归档" ? "项目已归档" : "项目已恢复开发");
}

function handleExport(id) {
  const project = state.projects.find((item) => item.id === id);
  const idea = state.ideas.find((item) => item.id === project?.ideaId);
  if (!project) return;
  const blob = new Blob([projectToText(project, idea)], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${project.title.replace(/[\\/:*?"<>|]/g, "-")}-项目档案.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
  notify("项目文本已导出");
}

function updateIdeaSelectionUI() {
  const count = document.querySelector("#idea-selection-count");
  if (count) count.textContent = `已选 ${selectedIdeaIds.size} 条`;
  const rows = [...document.querySelectorAll("[data-idea-row]")].filter((row) => !row.hidden);
  const selectAll = document.querySelector("#select-visible-ideas");
  if (selectAll) {
    const checked = rows.filter((row) => selectedIdeaIds.has(row.dataset.ideaId)).length;
    selectAll.checked = rows.length > 0 && checked === rows.length;
    selectAll.indeterminate = checked > 0 && checked < rows.length;
  }
}

function bulkUpdateIdeaStatus() {
  const status = document.querySelector("#bulk-idea-status")?.value;
  if (!status || !selectedIdeaIds.size) { notify("请先选择选题并指定状态"); return; }
  let updated = 0;
  state.ideas.forEach((idea) => {
    if (!selectedIdeaIds.has(idea.id) || idea.status === "已立项") return;
    idea.status = status;
    idea.updatedAt = new Date().toISOString();
    updated += 1;
  });
  track(state, "bulk_update_idea_status", { status, count: updated });
  selectedIdeaIds.clear();
  commit(`已批量更新 ${updated} 条选题状态`);
}

function deleteIdeas(ids) {
  const requested = new Set(ids);
  if (!requested.size) { notify("请先选择要删除的选题"); return; }
  const linkedIds = new Set(state.projects.map((project) => project.ideaId));
  const deletable = state.ideas.filter((idea) => requested.has(idea.id) && !linkedIds.has(idea.id));
  const blocked = requested.size - deletable.length;
  if (!deletable.length) { notify("已立项选题不能删除，以免影响项目档案"); return; }
  const message = `确定删除 ${deletable.length} 条选题吗？此操作不可撤销。${blocked ? `另有 ${blocked} 条已立项选题将保留。` : ""}`;
  if (!window.confirm(message)) return;
  const deletedIds = new Set(deletable.map((idea) => idea.id));
  deletedIds.forEach((ideaId) => track(state, "delete_idea", { ideaId }));
  state.ideas = state.ideas.filter((idea) => !deletedIds.has(idea.id));
  selectedIdeaIds = new Set([...selectedIdeaIds].filter((ideaId) => !deletedIds.has(ideaId)));
  if (deletedIds.has(state.selectedIdeaId)) state.selectedIdeaId = null;
  commit(`已删除 ${deletable.length} 条选题${blocked ? `，保留 ${blocked} 条已立项选题` : ""}`);
}

function filterIdeas() {
  const search = document.querySelector("#idea-search")?.value.toLowerCase() || "";
  const status = document.querySelector("#idea-status-filter")?.value || "全部";
  const sort = document.querySelector("#idea-sort")?.value || "score";
  const list = document.querySelector("#idea-list");
  if (!list) return;
  const rows = [...list.querySelectorAll("[data-idea-row]")];
  rows.forEach((row) => { row.hidden = !row.dataset.search.includes(search) || (status !== "全部" && row.dataset.status !== status); });
  updateIdeaSelectionUI();
  const field = sort === "updated" ? "updated" : sort;
  rows.sort((a, b) => field === "updated" ? b.dataset.updated.localeCompare(a.dataset.updated) : Number(b.dataset[field]) - Number(a.dataset[field])).forEach((row) => list.append(row));
}

render();
if (currentRoute() === "generate") ensureDouyinTrends();

initializeBackend();

async function initializeBackend() {
  try {
    const backend = await loadBackend();
    runtime = { backendReady: true, database: backend.config.database, ai: backend.config.ai };
    if (backend.state) {
      const local = loadState();
      state = { ...local, ...backend.state, account: backend.state.account || local.account };
      saveState(state);
    } else {
      await saveBackendState(state);
    }
    render();
  } catch (error) {
    console.warn("Backend unavailable; continuing with browser storage", error);
    runtime.backendReady = false;
    render();
    notify("后端暂不可用，当前改动仍保存在浏览器");
  }
}
