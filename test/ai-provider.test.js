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
