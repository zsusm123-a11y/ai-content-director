const DEFAULT_PROVIDER = "deepseek";
const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_BAILIAN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_BAILIAN_VIDEO_MODEL = "qwen3.5-omni-plus";

const string = { type: "string" };
const stringArray = { type: "array", items: string };

const schemas = {
  generateIdeas: {
    name: "idea_candidates",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["ideas"],
      properties: {
        ideas: {
          type: "array",
          minItems: 1,
          maxItems: 50,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "logline", "storyType", "format", "emotion", "targetAudience", "commercialTags", "visualHook", "preferredStructure"],
            properties: {
              title: string,
              logline: string,
              storyType: string,
              format: string,
              emotion: string,
              targetAudience: string,
              commercialTags: stringArray,
              visualHook: string,
              preferredStructure: { type: "string", enum: ["rule", "mystery", "emotion", "documentary", "comedy"] },
            },
          },
        },
      },
    },
  },
  scoreIdea: {
    name: "idea_score",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["scores", "reasons", "verdict", "strengths", "weaknesses", "risk", "optimizations"],
      properties: {
        scores: scoreObject("integer"),
        reasons: scoreObject("string"),
        verdict: string,
        strengths: stringArray,
        weaknesses: stringArray,
        risk: string,
        optimizations: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "title", "description"],
            properties: {
              id: { type: "string", enum: ["sharpen", "stakes", "visual", "series"] },
              title: string,
              description: string,
            },
          },
        },
      },
    },
  },
  optimizeIdea: {
    name: "optimized_idea",
    schema: objectSchema(["title", "logline", "visualHook", "preferredStructure"], {
      title: string,
      logline: string,
      visualHook: string,
      preferredStructure: { type: "string", enum: ["rule", "mystery", "emotion", "documentary", "comedy"] },
    }),
  },
  createProject: {
    name: "project_brief",
    schema: objectSchema(["coreTheme", "protagonist", "coreDesire", "coreConflict", "ending", "visualHook", "commercialTheme", "timeLevel", "productionLevel", "structure"], {
      coreTheme: string,
      protagonist: string,
      coreDesire: string,
      coreConflict: string,
      ending: string,
      visualHook: string,
      commercialTheme: string,
      timeLevel: { type: "string", enum: ["T1", "T2", "T3", "T4"] },
      productionLevel: { type: "string", enum: ["A", "B", "C"] },
      structure: { type: "string", enum: ["rule", "mystery", "emotion", "documentary", "comedy"] },
    }),
  },
  generateBeats: {
    name: "beat_sheet",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["beats"],
      properties: {
        beats: {
          type: "array",
          minItems: 5,
          maxItems: 8,
          items: objectSchema(["purpose", "action", "dialogue", "visual", "emotion", "duration"], {
            purpose: string,
            action: string,
            dialogue: string,
            visual: string,
            emotion: string,
            duration: { type: "integer", minimum: 3, maximum: 120 },
          }),
        },
      },
    },
  },
  generateScript: {
    name: "formal_script",
    schema: objectSchema(["content", "productionNotes"], {
      content: string,
      productionNotes: stringArray,
    }),
  },
  analyzeViralVideo: {
    name: "viral_video_shot_breakdown",
    schema: objectSchema(["summary", "openingHook", "structure", "retentionMechanics", "replicable", "cautions", "shots"], {
      summary: string,
      openingHook: string,
      structure: string,
      retentionMechanics: stringArray,
      replicable: stringArray,
      cautions: stringArray,
      shots: {
        type: "array",
        minItems: 3,
        maxItems: 16,
        items: objectSchema(["timeRange", "visual", "shotSizeCamera", "action", "audioText", "narrativeFunction", "retentionPoint"], {
          timeRange: string,
          visual: string,
          shotSizeCamera: string,
          action: string,
          audioText: string,
          narrativeFunction: string,
          retentionPoint: string,
        }),
      },
    }),
  },
};

function objectSchema(required, properties) {
  return { type: "object", additionalProperties: false, required, properties };
}

function scoreObject(valueType) {
  const keys = ["hook", "emotion", "freshness", "story", "visualAi", "visualMemory", "discussion", "commercial", "series", "costEfficiency"];
  const maximum = { hook: 15, emotion: 15, freshness: 10, story: 10, visualAi: 10, visualMemory: 10, discussion: 10, commercial: 10, series: 5, costEfficiency: 5 };
  return {
    type: "object",
    additionalProperties: false,
    required: keys,
    properties: Object.fromEntries(keys.map((key) => [key, valueType === "integer" ? { type: "integer", minimum: 1, maximum: maximum[key] } : string])),
  };
}

const instructions = {
  generateIdeas: "你是AI短视频内容决策系统的选题编辑。根据账号DNA和生成条件产出互不重复、可拍摄、具备高概念钩子的中文短片选题。商业适配必须自然推动行动或转折，不能硬塞广告。严格返回结构化数据。",
  scoreIdea: "你是严格的短视频创意评审。按给定十个公开维度评分，总分只能是十项相加。理由要具体、可操作；制作性价比必须读取账号制作能力；商业适配不能因能植入广告就高分。严格返回结构化数据。",
  optimizeIdea: "你是创意开发编辑。只围绕指定优化方向改进当前选题，保留原始创意核心，提高钩子、人物选择、视觉证据或系列潜力。不要把故事扩写成完整脚本。严格返回结构化数据。",
  createProject: "你是创意导演。把通过评分的选题转为可执行立项卡，推荐独立的时长等级、制作等级和五类叙事结构。商业母题必须服务故事。严格返回结构化数据。",
  generateBeats: "你是短片编剧。根据立项卡、叙事结构和目标时长生成5到8个节拍，持续升级冲突，避免解释设定。所有duration相加应接近目标秒数。严格返回结构化数据。",
  generateScript: "你是短片编剧和制作导演。严格依据已确认Beat Sheet写正式中文脚本，保留时间段、画面、动作、对白或旁白、声音与制作提示。不要改变已确认的故事结构。严格返回结构化数据。",
  analyzeViralVideo: "你是短视频导演与剪辑分析师。你将直接收到完整视频作为多模态输入，必须实际分析视频画面和音轨，拆成3到16个连续镜头。逐镜说明时间范围、画面、景别/运镜、动作、实际听到的声音/台词/字幕、叙事功能和留存作用。分析开场钩子、结构节奏、留存机制、可迁移手法与不可照搬的部分。时间范围应依据视频真实时间轴；听不清或无法辨认时明确写无法辨认，不得编造。不得虚构播放数据。只输出符合Schema的JSON。",
};

export function aiConfiguration(env = process.env) {
  const config = resolveConfiguration(env);
  const video = resolveBailianConfiguration(env);
  return {
    configured: Boolean(config.apiKey),
    model: config.model,
    provider: config.provider,
    baseUrl: config.baseUrl,
    videoAnalysis: {
      configured: Boolean(video.apiKey),
      provider: "bailian",
      model: video.model,
      baseUrl: video.baseUrl,
    },
  };
}

export async function runAiTask(task, payload) {
  if (task === "analyzeViralVideo") return runBailianVideoAnalysis(payload);
  const config = resolveConfiguration(process.env);
  if (!config.apiKey) {
    const error = new Error("AI_API_KEY is not configured");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }
  const definition = schemas[task];
  if (!definition) throw new Error(`Unknown AI task: ${task}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildRequest(task, payload, config)),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error?.message || `${config.provider} request failed with ${response.status}`);
      error.code = body.error?.code || "AI_REQUEST_FAILED";
      throw error;
    }
    const outputText = body.choices?.[0]?.message?.content;
    if (!outputText) throw invalidResponse(`${config.provider} response did not contain message content`);
    const data = parseJson(outputText);
    validateSchema(data, definition.schema);
    return { data, provider: config.provider, model: body.model || config.model, responseId: body.id };
  } finally {
    clearTimeout(timeout);
  }
}

async function runBailianVideoAnalysis(payload) {
  const config = resolveBailianConfiguration(process.env);
  if (!config.apiKey) {
    const error = new Error("BAILIAN_API_KEY is not configured");
    error.code = "BAILIAN_NOT_CONFIGURED";
    throw error;
  }
  const definition = schemas.analyzeViralVideo;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildBailianVideoRequest(payload, config)),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(body.error?.message || `百炼视频分析请求失败 (${response.status})`);
      error.code = body.error?.code || "BAILIAN_VIDEO_REQUEST_FAILED";
      throw error;
    }
    const outputText = await readStreamedText(response);
    const data = parseJson(outputText);
    validateSchema(data, definition.schema);
    return { data, provider: "bailian", model: config.model };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildBailianVideoRequest(payload, config = resolveBailianConfiguration(process.env)) {
  const videoUrl = String(payload.videoUrl || "").trim();
  let parsedUrl;
  try { parsedUrl = new URL(videoUrl); } catch { throw Object.assign(new Error("请填写有效的视频 URL"), { code: "INVALID_VIDEO_URL" }); }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) throw Object.assign(new Error("视频 URL 必须使用 HTTP 或 HTTPS"), { code: "INVALID_VIDEO_URL" });
  const taskPrompt = `${instructions.analyzeViralVideo}\n分析重点：${payload.analysisFocus || "完整拉片"}\n视频标题：${payload.title || "未提供"}\n视频时长（秒）：${payload.duration || "请根据视频判断"}\n请按以下 JSON Schema 输出且只输出 JSON：\n${JSON.stringify(schemas.analyzeViralVideo.schema)}`;
  return {
    model: config.model,
    messages: [{
      role: "user",
      content: [
        { type: "video_url", video_url: { url: videoUrl, fps: 1 } },
        { type: "text", text: taskPrompt },
      ],
    }],
    response_format: { type: "json_object" },
    max_tokens: config.maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    modalities: ["text"],
  };
}

async function readStreamedText(response) {
  const reader = response.body?.getReader();
  if (!reader) throw invalidResponse("百炼未返回流式响应");
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const chunk = line.slice(5).trim();
      if (!chunk || chunk === "[DONE]") continue;
      try {
        const event = JSON.parse(chunk);
        const delta = event.choices?.[0]?.delta?.content;
        if (typeof delta === "string") content += delta;
        else if (Array.isArray(delta)) content += delta.map((part) => part.text || "").join("");
      } catch { /* Ignore non-JSON SSE comment lines. */ }
    }
    if (done) break;
  }
  if (buffer.startsWith("data:")) {
    const chunk = buffer.slice(5).trim();
    if (chunk && chunk !== "[DONE]") {
      try {
        const event = JSON.parse(chunk);
        const delta = event.choices?.[0]?.delta?.content;
        if (typeof delta === "string") content += delta;
        else if (Array.isArray(delta)) content += delta.map((part) => part.text || "").join("");
      } catch { /* Ignore incomplete final SSE lines. */ }
    }
  }
  if (!content.trim()) throw invalidResponse("百炼没有返回分析文本");
  return content;
}

export function buildRequest(task, payload, config = resolveConfiguration(process.env)) {
  const definition = schemas[task];
  if (!definition) throw new Error(`Unknown AI task: ${task}`);
  const trendGuidance = task === "generateIdeas" && (payload.options?.trendTopics?.length || payload.options?.viralExamples?.trim())
    ? "本次选题必须参考用户勾选的抖音热点标题和爆款案例观察，再与账号 DNA 交叉筛选。热点只是灵感信号：提炼其中的情绪、冲突、人物关系或视觉形式，转化为原创剧情，不复述新闻事实、不照搬原视频。用户贴入的视频链接不代表你已观看；只依据用户提供的文字观察，不得编造播放量、点赞量或视频细节。每条候选都要尽量说明与热点的关联，并避免强行蹭无关热点。"
    : "";
  return {
    model: config.model,
    messages: [
      {
        role: "system",
        content: `${instructions[task]}${trendGuidance ? `\n${trendGuidance}` : ""}\n只输出一个有效 JSON 对象，不要输出 Markdown。JSON 必须符合以下 Schema：\n${JSON.stringify(definition.schema)}`,
      },
      { role: "user", content: JSON.stringify(payload) },
    ],
    response_format: { type: "json_object" },
    max_tokens: config.maxTokens,
    stream: false,
  };
}

function resolveConfiguration(env) {
  const provider = env.AI_PROVIDER?.trim() || DEFAULT_PROVIDER;
  const baseUrl = (env.AI_BASE_URL?.trim() || env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return {
    provider,
    baseUrl,
    model: env.AI_MODEL?.trim() || env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL,
    apiKey: env.AI_API_KEY?.trim() || env.DEEPSEEK_API_KEY?.trim() || "",
    timeoutMs: positiveInteger(env.AI_TIMEOUT_MS, 60000),
    maxTokens: positiveInteger(env.AI_MAX_TOKENS, 8192),
  };
}

function resolveBailianConfiguration(env) {
  return {
    apiKey: env.BAILIAN_API_KEY?.trim() || "",
    baseUrl: (env.BAILIAN_BASE_URL?.trim() || DEFAULT_BAILIAN_BASE_URL).replace(/\/+$/, ""),
    model: env.BAILIAN_VIDEO_MODEL?.trim() || DEFAULT_BAILIAN_VIDEO_MODEL,
    timeoutMs: positiveInteger(env.BAILIAN_TIMEOUT_MS, 300000),
    maxTokens: positiveInteger(env.BAILIAN_MAX_TOKENS, 8192),
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseJson(text) {
  const normalized = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(normalized);
  } catch {
    throw invalidResponse("Model response was not valid JSON");
  }
}

function validateSchema(value, schema, path = "$") {
  if (schema.enum && !schema.enum.includes(value)) throw invalidResponse(`${path} must be one of ${schema.enum.join(", ")}`);
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidResponse(`${path} must be an object`);
    for (const key of schema.required || []) {
      if (!(key in value)) throw invalidResponse(`${path}.${key} is required`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in value) validateSchema(value[key], child, `${path}.${key}`);
    }
    return;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) throw invalidResponse(`${path} must be an array`);
    if (schema.minItems != null && value.length < schema.minItems) throw invalidResponse(`${path} has too few items`);
    if (schema.maxItems != null && value.length > schema.maxItems) throw invalidResponse(`${path} has too many items`);
    value.forEach((item, index) => validateSchema(item, schema.items, `${path}[${index}]`));
    return;
  }
  if (schema.type === "string" && typeof value !== "string") throw invalidResponse(`${path} must be a string`);
  if (schema.type === "integer") {
    if (!Number.isInteger(value)) throw invalidResponse(`${path} must be an integer`);
    if (schema.minimum != null && value < schema.minimum) throw invalidResponse(`${path} is below minimum`);
    if (schema.maximum != null && value > schema.maximum) throw invalidResponse(`${path} exceeds maximum`);
  }
}

function invalidResponse(message) {
  return Object.assign(new Error(message), { code: "AI_RESPONSE_INVALID" });
}
