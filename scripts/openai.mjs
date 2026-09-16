const MODEL = () => process.env.OPENAI_MODEL || "gpt-5.6-luna";

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
};

export function aiConfiguration() {
  return { configured: Boolean(process.env.OPENAI_API_KEY), model: MODEL(), provider: "openai" };
}

export async function runAiTask(task, payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY is not configured");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }
  const definition = schemas[task];
  if (!definition) throw new Error(`Unknown AI task: ${task}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.OPENAI_TIMEOUT_MS || 60000));
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL(),
        store: false,
        instructions: instructions[task],
        input: JSON.stringify(payload),
        text: { format: { type: "json_schema", name: definition.name, strict: true, schema: definition.schema } },
      }),
      signal: controller.signal,
    });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(body.error?.message || `OpenAI request failed with ${response.status}`);
      error.code = body.error?.code || "AI_REQUEST_FAILED";
      throw error;
    }
    const outputText = body.output_text || body.output
      ?.filter((item) => item.type === "message")
      .flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("OpenAI response did not contain output text");
    return { data: JSON.parse(outputText), model: body.model || MODEL(), responseId: body.id };
  } finally {
    clearTimeout(timeout);
  }
}
