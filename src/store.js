const STORAGE_KEY = "ai-content-director:v1";

export function defaultState() {
  const now = new Date().toISOString();
  return {
    account: {
      id: "account_default",
      brandName: "",
      slogan: "把脑洞，拍成电影。",
      description: "每次一个没见过的设定，一部1—3分钟的小电影。",
      audiences: ["故事型观众", "创意型观众"],
      storyTypes: ["现实", "幻想", "喜剧", "类型片"],
      formats: ["高概念", "微电影", "虚构纪录片"],
      emotions: ["感动", "惊讶", "好笑", "哲思"],
      commercialCategories: ["汽车", "3C", "AI互联网"],
      productionCapabilities: ["文生图", "图生视频", "剪辑", "声音"],
      visualRules: "真实材质、克制饱和、电影级对比；封面只保留一个核心视觉主体。",
      updatedAt: now,
    },
    ideas: [],
    projects: [],
    events: [],
    selectedIdeaId: null,
    selectedProjectId: null,
  };
}

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState();
    return { ...defaultState(), ...JSON.parse(saved) };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function track(state, event, payload = {}) {
  state.events.push({ event, payload, createdAt: new Date().toISOString() });
  if (state.events.length > 500) state.events = state.events.slice(-500);
}
