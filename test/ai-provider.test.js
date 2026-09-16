import test from "node:test";
import assert from "node:assert/strict";

import { aiConfiguration, buildRequest } from "../scripts/ai-provider.mjs";

test("defaults to the official DeepSeek-compatible endpoint", () => {
  const config = aiConfiguration({});
  assert.deepEqual(config, {
    configured: false,
    provider: "deepseek",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com",
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

test("builds a grounded shot-by-shot viral video analysis request", () => {
  const request = buildRequest("analyzeViralVideo", {
    videoUrl: "https://v.douyin.com/example/",
    title: "反转短片",
    duration: "35",
    analysisFocus: "镜头节奏与剪辑",
    materials: "00:00-00:03 近景：人物直视镜头并抛出问题。\n00:03-00:08 切到门外脚步声。\n00:08-00:15 人物发现桌上照片。",
  }, { model: "deepseek-v4-flash", maxTokens: 4096 });
  assert.match(request.messages[0].content, /不可声称已观看链接视频/);
  assert.match(request.messages[0].content, /retentionPoint/);
  assert.match(request.messages[1].content, /00:03-00:08/);
});
