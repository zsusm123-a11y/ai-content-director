export const SCORE_DIMENSIONS = [
  { key: "hook", label: "一句话钩子", max: 15 },
  { key: "emotion", label: "情绪强度", max: 15 },
  { key: "freshness", label: "新鲜度", max: 10 },
  { key: "story", label: "故事延展", max: 10 },
  { key: "visualAi", label: "AI视觉优势", max: 10 },
  { key: "visualMemory", label: "视觉记忆点", max: 10 },
  { key: "discussion", label: "评论讨论性", max: 10 },
  { key: "commercial", label: "商业适配", max: 10 },
  { key: "series", label: "系列化潜力", max: 5 },
  { key: "costEfficiency", label: "制作性价比", max: 5 },
];

export const TIME_LEVELS = {
  T1: { label: "T1 · 30—60秒", seconds: 45 },
  T2: { label: "T2 · 60—120秒", seconds: 90 },
  T3: { label: "T3 · 120—180秒", seconds: 150 },
  T4: { label: "T4 · 180—300秒", seconds: 240 },
};

export const STORY_STRUCTURES = {
  rule: {
    label: "规则型",
    skeleton: ["异常规则", "主人公发现", "尝试适应", "规则升级", "付出代价", "情绪或反转"],
  },
  mystery: {
    label: "谜题型",
    skeleton: ["异常出现", "主动调查", "错误答案", "更多线索", "真相显现", "二次反转"],
  },
  emotion: {
    label: "情绪型",
    skeleton: ["普通生活", "异常闯入", "关系被重看", "人物选择", "情绪落点"],
  },
  documentary: {
    label: "虚构纪录片型",
    skeleton: ["新闻钩子", "事实展示", "街访档案", "专家解释", "异常升级", "证据推翻认知"],
  },
  comedy: {
    label: "喜剧升级型",
    skeleton: ["荒诞规则", "第一次后果", "第二次升级", "第三次失控", "最后一刀笑点"],
  },
};

const IDEA_SEEDS = [
  ["父母一生只能见孩子1000次", "每次见面都会扣减全家共享的倒计时，一对父子必须决定把最后一次留给哪一天。", "现实", "高概念", "感动", "亲情 / 汽车 / 通讯", "rule"],
  ["如果周一真的是一个人", "疲惫的上班族发现周一会准时敲门，并把每件拖延的工作变成实体追着他跑。", "喜剧", "高概念", "好笑", "办公 / 饮料 / 互联网", "comedy"],
  ["全球首例不会做梦的人出现", "一名调查记者追踪全球唯一不会做梦的人，却发现其他人的梦正在被同一家公司回收。", "类型片", "虚构纪录片", "惊讶", "科技 / AI / 平台", "documentary"],
  ["城市停电后的第7分钟", "全城停电后，只有一部旧手机收到来自七分钟后的求救直播。", "类型片", "微电影", "恐惧", "汽车 / 3C / 游戏", "mystery"],
  ["如果甲方的修改意见会实体化", "每条修改意见都会变成办公室里的真实物体，直到第九十九版把整栋楼改没了。", "喜剧", "高概念", "好笑", "办公 / AI工具 / 软件", "comedy"],
  ["妈妈二十岁那年突然出现", "独居女孩开门看见二十岁的母亲，才知道妈妈也曾想逃离如今的人生。", "幻想", "微电影", "感动", "手机 / 影像 / 家电", "emotion"],
  ["三年没人睡觉的城市", "记者进入一座居民三年没有睡觉的城市，发现所有人的梦都被储存在地下。", "幻想", "虚构纪录片", "惊讶", "咖啡 / 科技 / 生活方式", "documentary"],
  ["未来的自己打来电话", "未来的自己来电警告他千万别接下一通电话，但电话那头响起了女儿的声音。", "类型片", "微电影", "恐惧", "手机 / 通讯 / AI", "mystery"],
  ["人生只能掉头三次", "每个人一生只有三次回头重选的机会，一位父亲把最后一次留在了回家的路上。", "现实", "微电影", "治愈", "汽车 / 出行", "rule"],
  ["公司今天开始回收记忆", "员工可以交出痛苦记忆换取假期，但一个普通职员发现自己最珍贵的人也随之消失。", "类型片", "连续剧情", "哲思", "办公 / AI / 招聘", "rule"],
  ["所有没说出口的话开始下雨", "一座城市突然下起由秘密组成的雨，人们必须在天晴前面对被隐藏的关系。", "幻想", "视觉奇观", "浪漫", "饮料 / 家居 / 通讯", "emotion"],
  ["电梯只停在你后悔的楼层", "深夜加班者走进一部异常电梯，每层都让他重看一次没有做出的选择。", "类型片", "POV", "哲思", "办公 / 出行 / 3C", "mystery"],
];

export function createId(prefix = "id") {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function stableHash(value) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return hash;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

export function generateIdeas(account, options = {}) {
  const keyword = (options.keyword || "").trim();
  const trendTopics = Array.isArray(options.trendTopics) ? options.trendTopics.filter((topic) => typeof topic === "string" && topic.trim()) : [];
  const requested = Number(options.count || 10);
  const count = Math.max(1, Math.min(requested, 50));
  const offset = stableHash(`${keyword}${options.innovation || "平衡"}`) % IDEA_SEEDS.length;
  const now = new Date().toISOString();

  return Array.from({ length: count }, (_, index) => {
    const seed = IDEA_SEEDS[(offset + index) % IDEA_SEEDS.length];
    const [baseTitle, baseLogline, storyType, format, emotion, commercial, structure] = seed;
    const trendTopic = trendTopics[index % Math.max(trendTopics.length, 1)];
    const title = trendTopic ? `${trendTopic}：${baseTitle}` : keyword && !baseTitle.includes(keyword) ? `${keyword}：${baseTitle}` : baseTitle;
    const logline = trendTopic ? `从抖音热点“${trendTopic}”提炼情绪或冲突，不复述原事件：${baseLogline}` : baseLogline;
    return {
      id: createId("idea"),
      accountId: account.id,
      title,
      logline,
      source: trendTopic ? "抖音热点启发" : "AI生成",
      storyType: options.storyType || storyType,
      format: options.format || format,
      emotion: options.emotion || emotion,
      targetAudience: options.audience || account.audiences?.[0] || "故事型观众",
      commercialTags: options.commercial ? [options.commercial] : commercial.split(" / "),
      visualHook: inferVisualHook(logline),
      preferredStructure: structure,
      status: "待评分",
      scoreHistory: [],
      versions: [{ version: 1, title, logline, reason: trendTopic ? `抖音热点启发：${trendTopic}` : "初始版本", createdAt: now }],
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function createManualIdea(account, input) {
  const now = new Date().toISOString();
  return {
    id: createId("idea"),
    accountId: account.id,
    title: input.title.trim(),
    logline: input.logline.trim(),
    source: "手动",
    storyType: input.storyType || "现实",
    format: input.format || "高概念",
    emotion: input.emotion || "惊讶",
    targetAudience: input.targetAudience || account.audiences?.[0] || "故事型观众",
    commercialTags: input.commercialTags || [],
    visualHook: inferVisualHook(input.logline),
    preferredStructure: recommendStructure(input),
    status: "待评分",
    scoreHistory: [],
    versions: [{ version: 1, title: input.title.trim(), logline: input.logline.trim(), reason: "手动创建", createdAt: now }],
    createdAt: now,
    updatedAt: now,
  };
}

export function scoreIdea(idea, account, previousScore = null) {
  const text = `${idea.title} ${idea.logline} ${idea.visualHook || ""}`;
  const hash = stableHash(text);
  const anomaly = includesAny(text, ["如果", "只能", "突然", "唯一", "未来", "消失", "回收", "异常", "不会", "开始"]);
  const conflict = includesAny(text, ["必须", "却", "但", "直到", "警告", "追", "选择", "发现", "决定", "最后"]);
  const visual = includesAny(text, ["城市", "雨", "电梯", "直播", "倒计时", "地下", "电话", "实体", "消失", "敲门"]);
  const relational = includesAny(text, ["父", "母", "孩子", "女儿", "家", "关系", "员工", "职员"]);
  const emotional = Boolean(idea.emotion) || relational;
  const capabilityCount = account.productionCapabilities?.length || 0;
  const commercialOverlap = idea.commercialTags?.filter((tag) => account.commercialCategories?.includes(tag)).length || 0;
  const dimensions = {
    hook: clamp(8 + (anomaly ? 4 : 0) + (conflict ? 2 : 0) + (idea.title.length <= 22 ? 1 : 0), 1, 15),
    emotion: clamp(7 + (emotional ? 4 : 0) + (relational ? 2 : 0) + (hash % 3), 1, 15),
    freshness: clamp(5 + (anomaly ? 2 : 0) + (visual ? 1 : 0) + (hash % 3), 1, 10),
    story: clamp(5 + (conflict ? 2 : 0) + (idea.logline.length >= 36 ? 2 : 0) + (hash % 2), 1, 10),
    visualAi: clamp(4 + (visual ? 3 : 0) + (["幻想", "类型片"].includes(idea.storyType) ? 1 : 0) + (hash % 2), 1, 10),
    visualMemory: clamp(4 + (idea.visualHook ? 2 : 0) + (visual ? 2 : 0) + (hash % 2), 1, 10),
    discussion: clamp(4 + (includesAny(text, ["人生", "选择", "记忆", "秘密", "关系", "工作", "梦"]) ? 3 : 0) + (hash % 3), 1, 10),
    commercial: clamp(4 + Math.min(3, idea.commercialTags?.length || 0) + Math.min(2, commercialOverlap) + (hash % 2), 1, 10),
    series: clamp(2 + (anomaly ? 1 : 0) + (["连续剧情", "虚构纪录片"].includes(idea.format) ? 1 : 0) + (hash % 2), 1, 5),
    costEfficiency: clamp(2 + Math.min(2, Math.floor(capabilityCount / 2)) + (visual && capabilityCount < 2 ? 0 : 1), 1, 5),
  };

  const reasonMap = {
    hook: anomaly ? "异常规则能在前三秒被说清，标题具备直接的认知落差。" : "设定可理解，但异常点还需要更早、更具体地出现。",
    emotion: relational ? "人物关系天然承载情绪，选择会直接改变关系结果。" : "已有明确情绪方向，可再补充人物真正害怕失去的东西。",
    freshness: visual ? "设定与可视化意象结合，区别于只换人物的旧梗。" : "核心概念成立，但视觉化的独特规则还不够鲜明。",
    story: conflict ? "主人公面对明确阻力和选择，足以展开为多段升级。" : "目前更像概念陈述，需要补充阻力、行动和代价。",
    visualAi: visual ? "包含适合 AI 低成本实现的异常环境或物体变化。" : "视觉依赖常规现实场景，AI 的独特优势尚未充分使用。",
    visualMemory: idea.visualHook ? `可用“${idea.visualHook}”作为代表整条片的核心画面。` : "需要锁定一张无需解释也能记住的关键画面。",
    discussion: relational ? "关系选择容易触发观众代入，并形成不同立场。" : "有讨论空间，可进一步增加两难选择或价值冲突。",
    commercial: (idea.commercialTags?.length || 0) >= 2 ? `可自然映射到${idea.commercialTags.slice(0, 2).join("、")}，产品可参与行动或转折。` : "商业品类较少，应寻找能自然推动剧情的产品角色。",
    series: anomaly ? "异常规则可替换人物或情境，具备连续衍生至少三条的空间。" : "目前更适合单条，需要定义可复用的母题或栏目形式。",
    costEfficiency: capabilityCount >= 3 ? "账号制作能力与主要难点匹配，投入可控。" : "制作能力配置较少，需压缩角色、场景或复杂动作。",
  };

  const details = SCORE_DIMENSIONS.map((dimension) => ({
    ...dimension,
    value: dimensions[dimension.key],
    reason: reasonMap[dimension.key],
  }));
  const total = details.reduce((sum, detail) => sum + detail.value, 0);
  const strengths = [...details].sort((a, b) => b.value / b.max - a.value / a.max).slice(0, 2).map((item) => item.label);
  const weaknesses = [...details].sort((a, b) => a.value / a.max - b.value / b.max).slice(0, 2).map((item) => item.label);
  const createdAt = new Date().toISOString();

  return {
    id: createId("score"),
    total,
    details,
    verdict: total >= 90 ? "旗舰候选，值得优先进入重点立项。" : total >= 80 ? "重点制作，建议进入主力排期。" : total >= 70 ? "适合小规模测试，先优化短板再决定投入。" : "默认暂缓，除非承担明确实验或商业目的。",
    diagnosis: { strengths, weaknesses, risk: weaknesses.includes("制作性价比") ? "制作复杂度可能吞噬传播收益。" : `主要风险集中在${weaknesses.join("与")}。` },
    optimizations: buildOptimizations(idea, weaknesses),
    delta: previousScore ? total - previousScore.total : 0,
    changes: previousScore ? details.map((item) => ({ label: item.label, delta: item.value - (previousScore.details.find((old) => old.key === item.key)?.value || 0) })).filter((item) => item.delta !== 0) : [],
    createdAt,
  };
}

function buildOptimizations(idea, weaknesses) {
  const suggestions = [];
  if (weaknesses.includes("一句话钩子") || weaknesses.includes("新鲜度")) suggestions.push({ id: "sharpen", title: "把异常提前", description: "在标题和第一句中直接写出异常规则，并增加无法轻易撤销的代价。" });
  if (weaknesses.includes("故事延展") || weaknesses.includes("情绪强度")) suggestions.push({ id: "stakes", title: "给人物一个必须选择的关系", description: "补充人物最想保住的人或事，让每次行动都使代价升级。" });
  if (weaknesses.includes("视觉记忆点") || weaknesses.includes("AI视觉优势")) suggestions.push({ id: "visual", title: "锁定代表镜头", description: `把“${idea.visualHook || "异常规则实体化"}”设为开场或反转的核心视觉证据。` });
  if (weaknesses.includes("商业适配") || weaknesses.includes("系列化潜力")) suggestions.push({ id: "series", title: "建立可复用母题", description: "让品类能力自然成为人物行动的一部分，并保留可替换人物与场景的规则。" });
  return suggestions.slice(0, 3).length ? suggestions.slice(0, 3) : [{ id: "stakes", title: "升级人物代价", description: "保留现有设定，进一步收紧人物选择和结尾后果。" }];
}

export function applyOptimization(idea, optimization) {
  const suffixes = {
    sharpen: "更关键的是，这条规则一旦触发就无法撤销。",
    stakes: "主人公必须在保住关系与解决异常之间作出不可逆的选择。",
    visual: "一个无需解释的异常画面成为真相出现的证据。",
    series: "这个规则还会在不同人物与场景中产生新的代价。",
  };
  const suffix = suffixes[optimization.id] || optimization.description;
  const now = new Date().toISOString();
  const version = (idea.versions?.length || 0) + 1;
  return {
    ...idea,
    logline: `${idea.logline.replace(/[。！？]$/, "")}；${suffix}`,
    status: "待评分",
    versions: [...(idea.versions || []), { version, title: idea.title, logline: `${idea.logline.replace(/[。！？]$/, "")}；${suffix}`, reason: optimization.title, createdAt: now }],
    updatedAt: now,
  };
}

export function recommendStructure(idea) {
  if (idea.preferredStructure && STORY_STRUCTURES[idea.preferredStructure]) return idea.preferredStructure;
  if (idea.format === "虚构纪录片") return "documentary";
  if (idea.storyType === "喜剧" || idea.emotion === "好笑") return "comedy";
  if (["感动", "治愈", "浪漫"].includes(idea.emotion)) return "emotion";
  if (["恐惧", "类型片"].includes(idea.emotion) || idea.storyType === "类型片") return "mystery";
  return "rule";
}

export function recommendTimeLevel(idea) {
  if (idea.format === "视觉奇观" || idea.storyType === "喜剧") return "T1";
  if (idea.format === "连续剧情") return "T3";
  if (["微电影"].includes(idea.format) && ["感动", "治愈"].includes(idea.emotion)) return "T3";
  return "T2";
}

export function inferVisualHook(text = "") {
  const fragments = text.split(/[，。；！？]/).map((item) => item.trim()).filter(Boolean);
  return fragments[0]?.slice(0, 28) || "异常规则第一次被看见的瞬间";
}

export function createProject(idea) {
  const latestScore = idea.scoreHistory?.at(-1);
  const timeLevel = recommendTimeLevel(idea);
  const structure = recommendStructure(idea);
  const productionLevel = latestScore?.total >= 90 ? "A" : latestScore?.total >= 80 ? "B" : "C";
  const now = new Date().toISOString();
  return {
    id: createId("project"),
    ideaId: idea.id,
    title: idea.title,
    coreTheme: idea.emotion || "惊讶",
    protagonist: "一个正在失去重要事物的普通人",
    coreDesire: "在异常规则中保住最重要的人或选择",
    coreConflict: idea.logline,
    ending: "人物作出不可逆选择，异常规则显露真正代价",
    visualHook: idea.visualHook,
    commercialTheme: idea.commercialTags?.join(" / ") || "待确认",
    targetAudience: idea.targetAudience,
    timeLevel,
    productionLevel,
    structure,
    beats: [],
    beatsConfirmed: false,
    scriptVersions: [],
    status: "开发中",
    createdAt: now,
    updatedAt: now,
  };
}

export function generateBeats(project) {
  const structure = STORY_STRUCTURES[project.structure] || STORY_STRUCTURES.rule;
  const total = TIME_LEVELS[project.timeLevel]?.seconds || 90;
  const durations = distributeDuration(total, structure.skeleton.length);
  let cursor = 0;
  return structure.skeleton.map((purpose, index) => {
    const start = cursor;
    const end = cursor + durations[index];
    cursor = end;
    return {
      id: createId("beat"),
      order: index + 1,
      start,
      end,
      purpose,
      action: beatAction(project, purpose, index),
      dialogue: index === 0 ? `“${project.title}，如果这是真的呢？”` : "",
      visual: index === 0 ? project.visualHook : `${purpose}对应的关键动作与反应特写`,
      emotion: beatEmotion(index, structure.skeleton.length, project.coreTheme),
    };
  });
}

function distributeDuration(total, count) {
  const weights = Array.from({ length: count }, (_, index) => (index === 0 ? 0.12 : index === count - 1 ? 0.18 : 0.7 / (count - 2)));
  const durations = weights.map((weight) => Math.max(5, Math.round(total * weight)));
  durations[durations.length - 1] += total - durations.reduce((sum, value) => sum + value, 0);
  return durations;
}

function beatAction(project, purpose, index) {
  const actions = [
    `用${project.visualHook || "异常画面"}直接建立规则，让主人公被迫注意。`,
    `主人公试图实现“${project.coreDesire}”，第一次行动看似有效。`,
    "规则给出更严重的后果，人物发现旧办法失效。",
    `冲突收紧到“${project.coreConflict}”，人物必须立即选择。`,
    "人物承担代价，关系或认知发生不可逆变化。",
    `用${project.ending}完成落点，并留下讨论空间。`,
  ];
  return actions[index] || actions.at(-1);
}

function beatEmotion(index, count, finalEmotion) {
  if (index === 0) return "好奇 / 紧张";
  if (index === count - 1) return finalEmotion || "余味";
  if (index >= count - 2) return "压力 / 决断";
  return "期待 / 不安";
}

export function beatDuration(beats = []) {
  return beats.reduce((sum, beat) => sum + Math.max(0, Number(beat.end) - Number(beat.start)), 0);
}

export function generateScript(project) {
  const lines = [`《${project.title}》`, `${TIME_LEVELS[project.timeLevel]?.label || project.timeLevel} · ${project.productionLevel}级制作 · ${STORY_STRUCTURES[project.structure]?.label || "叙事结构"}`, ""];
  for (const beat of project.beats) {
    lines.push(`【Beat ${beat.order}｜${beat.start}—${beat.end}秒｜${beat.purpose}】`);
    lines.push(`画面：${beat.visual}`);
    lines.push(`动作：${beat.action}`);
    if (beat.dialogue) lines.push(`对白/旁白：${beat.dialogue}`);
    lines.push(`情绪：${beat.emotion}`, "");
  }
  const productionRisk = project.productionLevel === "A"
    ? "旗舰完成度要求高，先锁定角色与关键资产。"
    : "控制角色与场景数量，优先保证钩子和情绪落点。";
  lines.push(
    "【制作提示】",
    `核心视觉：${project.visualHook}`,
    `主要风险：${productionRisk}`,
    "虚构或 AI 合成内容发布时，请按平台要求清晰标识。",
  );
  return {
    id: createId("script"),
    version: (project.scriptVersions?.length || 0) + 1,
    content: lines.join("\n"),
    estimatedDuration: beatDuration(project.beats),
    createdAt: new Date().toISOString(),
  };
}

export function projectToText(project, idea) {
  const script = project.scriptVersions?.at(-1);
  return [
    `项目：${project.title}`,
    `状态：${project.status}`,
    `来源想法：${idea?.logline || ""}`,
    `时长：${TIME_LEVELS[project.timeLevel]?.label || project.timeLevel}`,
    `制作等级：${project.productionLevel}`,
    `叙事结构：${STORY_STRUCTURES[project.structure]?.label || project.structure}`,
    `核心主题：${project.coreTheme}`,
    `主人公：${project.protagonist}`,
    `核心欲望：${project.coreDesire}`,
    `核心冲突：${project.coreConflict}`,
    `结尾：${project.ending}`,
    `视觉记忆点：${project.visualHook}`,
    "",
    script?.content || "尚未生成脚本。",
  ].join("\n");
}
