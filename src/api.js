import { SCORE_DIMENSIONS, TIME_LEVELS, createId } from "./domain.js";

export async function loadBackend() {
  const [stateResult, configResult] = await Promise.all([
    request("/api/state"),
    request("/api/config"),
  ]);
  return { state: stateResult.initialized ? stateResult.state : null, config: configResult };
}

export function saveBackendState(state) {
  return request("/api/state", { method: "PUT", body: JSON.stringify({ state }) });
}

export function loadDouyinTrends() {
  return request("/api/trends/douyin").then((result) => ({
    source: result.source,
    sourceUrl: result.sourceUrl,
    updatedAt: result.updatedAt,
    fetchedAt: result.fetchedAt,
    items: result.items,
  }));
}

export async function aiGenerateIdeas(account, options) {
  const result = await ai("generateIdeas", { account, options });
  const now = new Date().toISOString();
  return result.data.ideas.map((raw) => ({
    id: createId("idea"),
    accountId: account.id,
    title: raw.title,
    logline: raw.logline,
    source: options.trendTopics?.length ? "抖音热点启发" : "AI生成",
    storyType: raw.storyType,
    format: raw.format,
    emotion: raw.emotion,
    targetAudience: raw.targetAudience,
    commercialTags: raw.commercialTags,
    visualHook: raw.visualHook,
    preferredStructure: raw.preferredStructure,
    status: "待评分",
    scoreHistory: [],
    versions: [{ version: 1, title: raw.title, logline: raw.logline, reason: "大模型初始版本", createdAt: now }],
    createdAt: now,
    updatedAt: now,
    ai: metadata(result),
  }));
}

export async function aiScoreIdea(idea, account, previousScore = null) {
  const result = await ai("scoreIdea", {
    account,
    idea,
    rubric: Object.fromEntries(SCORE_DIMENSIONS.map((item) => [item.key, { label: item.label, max: item.max }])),
  });
  const raw = result.data;
  const details = SCORE_DIMENSIONS.map((dimension) => ({
    ...dimension,
    value: raw.scores[dimension.key],
    reason: raw.reasons[dimension.key],
  }));
  const total = details.reduce((sum, item) => sum + item.value, 0);
  return {
    id: createId("score"),
    total,
    details,
    verdict: raw.verdict,
    diagnosis: { strengths: raw.strengths, weaknesses: raw.weaknesses, risk: raw.risk },
    optimizations: raw.optimizations,
    delta: previousScore ? total - previousScore.total : 0,
    changes: previousScore ? details.map((item) => ({ label: item.label, delta: item.value - (previousScore.details.find((old) => old.key === item.key)?.value || 0) })).filter((item) => item.delta !== 0) : [],
    createdAt: new Date().toISOString(),
    ai: metadata(result),
  };
}

export async function aiOptimizeIdea(idea, account, optimization) {
  const result = await ai("optimizeIdea", { account, idea, optimization });
  const now = new Date().toISOString();
  const version = (idea.versions?.length || 0) + 1;
  return {
    ...idea,
    ...result.data,
    status: "待评分",
    versions: [...(idea.versions || []), { version, title: result.data.title, logline: result.data.logline, reason: optimization.title, createdAt: now }],
    updatedAt: now,
    ai: metadata(result),
  };
}

export async function aiCreateProject(idea, account, localProject) {
  const result = await ai("createProject", { account, idea, score: idea.scoreHistory?.at(-1) });
  return { ...localProject, ...result.data, ai: metadata(result), updatedAt: new Date().toISOString() };
}

export async function aiGenerateBeats(project, account) {
  const result = await ai("generateBeats", {
    account,
    project,
    targetSeconds: TIME_LEVELS[project.timeLevel]?.seconds || 90,
  });
  const targetSeconds = TIME_LEVELS[project.timeLevel]?.seconds || 90;
  const rawTotal = result.data.beats.reduce((sum, beat) => sum + beat.duration, 0) || targetSeconds;
  const durations = result.data.beats.map((beat) => Math.max(3, Math.round(beat.duration * targetSeconds / rawTotal)));
  durations[durations.length - 1] += targetSeconds - durations.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return result.data.beats.map((beat, index) => {
    const start = cursor;
    cursor += durations[index];
    return { id: createId("beat"), order: index + 1, start, end: cursor, purpose: beat.purpose, action: beat.action, dialogue: beat.dialogue, visual: beat.visual, emotion: beat.emotion, ai: metadata(result) };
  });
}

export async function aiGenerateScript(project, account) {
  const result = await ai("generateScript", { account, project });
  return {
    id: createId("script"),
    version: (project.scriptVersions?.length || 0) + 1,
    content: `${result.data.content}\n\n【制作提示】\n${result.data.productionNotes.join("\n")}`,
    estimatedDuration: project.beats.reduce((sum, beat) => sum + Math.max(0, beat.end - beat.start), 0),
    createdAt: new Date().toISOString(),
    ai: metadata(result),
  };
}

export async function aiAnalyzeViralVideo(input) {
  const result = await ai("analyzeViralVideo", {
    videoUrl: input.videoUrl,
    title: input.title,
    duration: input.duration,
    materials: input.materials,
    analysisFocus: input.analysisFocus,
  });
  return { ...result.data, ai: metadata(result) };
}

async function ai(task, body) {
  return request(`/api/ai/${task}`, { method: "POST", body: JSON.stringify(body) });
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({ ok: false, error: { message: "服务器返回了无效响应" } }));
  if (!response.ok || !body.ok) {
    const error = new Error(body.error?.message || `Request failed with ${response.status}`);
    error.code = body.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return body;
}

function metadata(result) {
  return { provider: result.provider, model: result.model, responseId: result.responseId };
}
