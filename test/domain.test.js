import test from "node:test";
import assert from "node:assert/strict";

import {
  SCORE_DIMENSIONS,
  TIME_LEVELS,
  applyOptimization,
  beatDuration,
  createProject,
  generateBeats,
  generateIdeas,
  generateScript,
  scoreIdea,
} from "../src/domain.js";

const account = {
  id: "account_test",
  audiences: ["故事型观众"],
  commercialCategories: ["汽车", "3C", "AI互联网"],
  productionCapabilities: ["文生图", "图生视频", "剪辑", "声音"],
};

test("generates the requested number of structured ideas", () => {
  const ideas = generateIdeas(account, { count: 10, keyword: "时间", innovation: "平衡" });
  assert.equal(ideas.length, 10);
  assert.ok(ideas.every((idea) => idea.title && idea.logline && idea.visualHook));
  assert.ok(ideas.every((idea) => idea.status === "待评分" && idea.versions.length === 1));
});

test("score is the visible sum of ten bounded dimensions", () => {
  const idea = generateIdeas(account, { count: 1 })[0];
  const score = scoreIdea(idea, account);
  assert.equal(score.details.length, 10);
  assert.equal(score.details.reduce((sum, item) => sum + item.value, 0), score.total);
  assert.deepEqual(score.details.map((item) => item.max), SCORE_DIMENSIONS.map((item) => item.max));
  assert.ok(score.details.every((item) => item.value >= 1 && item.value <= item.max && item.reason));
});

test("optimization preserves the original version and creates a new version", () => {
  const idea = generateIdeas(account, { count: 1 })[0];
  const score = scoreIdea(idea, account);
  const optimized = applyOptimization(idea, score.optimizations[0]);
  assert.equal(optimized.versions.length, 2);
  assert.equal(optimized.versions[0].logline, idea.logline);
  assert.notEqual(optimized.logline, idea.logline);
});

test("project recommendations produce a valid 5 to 8 beat sheet within target duration", () => {
  const idea = generateIdeas(account, { count: 1 })[0];
  idea.scoreHistory.push(scoreIdea(idea, account));
  const project = createProject(idea);
  project.beats = generateBeats(project);
  assert.ok(project.beats.length >= 5 && project.beats.length <= 8);
  assert.equal(beatDuration(project.beats), TIME_LEVELS[project.timeLevel].seconds);
  assert.ok(project.beats.every((beat, index) => beat.order === index + 1 && beat.end > beat.start));
});

test("script contains every confirmed beat and production guidance", () => {
  const idea = generateIdeas(account, { count: 1 })[0];
  idea.scoreHistory.push(scoreIdea(idea, account));
  const project = createProject(idea);
  project.beats = generateBeats(project);
  const script = generateScript(project);
  assert.equal(script.version, 1);
  for (const beat of project.beats) assert.match(script.content, new RegExp(`Beat ${beat.order}`));
  assert.match(script.content, /制作提示/);
  assert.match(script.content, /AI 合成内容/);
});
