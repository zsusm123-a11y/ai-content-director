import test from "node:test";
import assert from "node:assert/strict";

import { aiConfiguration, buildBailianVideoRequest, buildRequest } from "../scripts/ai-provider.mjs";

test("defaults to the official DeepSeek-compatible endpoint", () => {
  const config = aiConfiguration({});
  assert.deepEqual(config, {
    configured: false,
    provider: "deepseek",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
    videoAnalysis: {
      configured: false,
      provider: "bailian",
      model: "qwen3.5-omni-plus",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
  });
});

test("accepts a domestic OpenAI-compatible provider configuration", () => {
  const config = aiConfiguration({
    AI_PROVIDER: "custom-cn",
    AI_API_KEY: "test-key",
    AI_BASE_URL: "https://model.example.cn/v1/",
    AI_MODEL: "model-name",
  });
  assert.deepEqual(config, {
    configured: true,
    provider: "custom-cn",
    model: "model-name",
    baseUrl: "https://model.example.cn/v1",
    videoAnalysis: {
      configured: false,
      provider: "bailian",
      model: "qwen3.5-omni-plus",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
  });
});

test("reports independent Bailian video-analysis configuration", () => {
  const config = aiConfiguration({
    BAILIAN_API_KEY: "video-key",
    BAILIAN_BASE_URL: "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/",
    BAILIAN_VIDEO_MODEL: "qwen3.5-omni-plus",
  });
  assert.deepEqual(config.videoAnalysis, {
    configured: true,
    provider: "bailian",
    model: "qwen3.5-omni-plus",
    baseUrl: "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
  });
});

test("builds JSON chat-completion requests for structured tasks", () => {
  const request = buildRequest("generateIdeas", { options: { count: 3 } }, {
    model: "deepseek-v4-flash",
    maxTokens: 4096,
  });
  assert.equal(request.model, "deepseek-v4-flash");
  assert.equal(request.response_format.type, "json_object");
  assert.equal(request.stream, false);
  assert.equal(request.max_tokens, 4096);
  assert.match(request.messages[0].content, /JSON.*Schema/s);
  assert.equal(request.messages[1].role, "user");
});

test("adds trend and creator-provided viral observations as generation context", () => {
  const request = buildRequest("generateIdeas", {
    options: {
      trendTopics: ["城市停电后的第7分钟"],
      viralExamples: "视频链接：example；开头用倒计时留住观众。",
    },
  }, { model: "deepseek-v4-flash", maxTokens: 4096 });
  const systemPrompt = request.messages[0].content;
  assert.match(systemPrompt, /提炼其中的情绪、冲突/);
  assert.match(systemPrompt, /不得编造播放量/);
  assert.match(request.messages[1].content, /开头用倒计时留住观众/);
});

test("builds a link-only multimodal Bailian video analysis request", () => {
  const request = buildBailianVideoRequest({
    videoUrl: "https://v.douyin.com/example/",
    title: "反转短片",
    analysisFocus: "镜头节奏与剪辑",
  }, { model: "qwen3.5-omni-plus", maxTokens: 4096 });
  assert.equal(request.stream, true);
  assert.deepEqual(request.modalities, ["text"]);
  assert.deepEqual(request.messages[0].content[0], {
    type: "video_url",
    video_url: { url: "https://v.douyin.com/example/", fps: 1 },
  });
  assert.match(request.messages[0].content[1].text, /必须实际分析视频画面和音轨/);
  assert.match(request.messages[0].content[1].text, /retentionPoint/);
});

test("rejects non-HTTP video inputs for Bailian analysis", () => {
  assert.throws(() => buildBailianVideoRequest({ videoUrl: "javascript:alert(1)" }), /HTTP 或 HTTPS/);
});
