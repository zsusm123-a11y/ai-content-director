import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createStateStore } from "../scripts/database.mjs";

test("SQLite store persists account, ideas, projects, viral analyses, events and selection state", async () => {
  const path = join(tmpdir(), `ai-content-director-${Date.now()}.db`);
  const state = {
    account: { id: "account_1", brandName: "测试账号", updatedAt: "2026-09-16T00:00:00.000Z" },
    ideas: [{ id: "idea_1", accountId: "account_1", title: "测试选题", updatedAt: "2026-09-16T00:00:01.000Z" }],
    projects: [{ id: "project_1", ideaId: "idea_1", title: "测试项目", updatedAt: "2026-09-16T00:00:02.000Z" }],
    viralAnalyses: [{ id: "analysis_1", videoUrl: "https://example.com/video", createdAt: "2026-09-16T00:00:02.500Z", shots: [] }],
    events: [{ event: "create_idea", payload: { ideaId: "idea_1" }, createdAt: "2026-09-16T00:00:03.000Z" }],
    selectedIdeaId: "idea_1",
    selectedProjectId: "project_1",
  };

  const store = await createStateStore(path);
  assert.equal(store.readState(), null);
  store.writeState(state);
  assert.deepEqual(store.readState(), state);
  assert.deepEqual(store.health(), { path, accounts: 1, ideas: 1, projects: 1, viralAnalyses: 1, events: 1 });
  store.close();
  assert.equal(existsSync(path), true);

  const reopened = await createStateStore(path);
  assert.deepEqual(reopened.readState(), state);
  reopened.close();
  rmSync(path, { force: true });
});
