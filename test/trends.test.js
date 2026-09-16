import test from "node:test";
import assert from "node:assert/strict";

import { createDouyinTrendService } from "../scripts/trends.mjs";

test("loads only Douyin trend titles and safe Douyin search links", async () => {
  const service = createDouyinTrendService({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        last_update: "2026-09-16 15:00:00",
        platforms: [{ id: "douyin", items: [
          { rank: 1, title: "热点一", url: "https://so.douyin.com/s?keyword=热点一" },
          { rank: 2, title: "热点二", url: "javascript:alert(1)" },
          { rank: 3, title: " " },
        ] }],
      }),
    }),
    now: () => 1790000000000,
  });

  const feed = await service();
  assert.equal(feed.source, "douyinhuo.cn");
  assert.equal(feed.updatedAt, "2026-09-16 15:00:00");
  assert.deepEqual(feed.items, [
    { rank: 1, title: "热点一", url: "https://so.douyin.com/s?keyword=%E7%83%AD%E7%82%B9%E4%B8%80" },
    { rank: 2, title: "热点二", url: "https://www.douyin.com/search/%E7%83%AD%E7%82%B9%E4%BA%8C" },
  ]);
});

test("caches feed responses for the configured interval", async () => {
  let requests = 0;
  let now = 1000;
  const service = createDouyinTrendService({
    fetchImpl: async () => {
      requests += 1;
      return { ok: true, json: async () => ({ platforms: [{ id: "douyin", items: [{ rank: 1, title: `趋势${requests}` }] }] }) };
    },
    now: () => now,
    ttlMs: 600000,
  });

  const first = await service();
  const cached = await service();
  assert.equal(requests, 1);
  assert.equal(first.items[0].title, "趋势1");
  assert.equal(cached.items[0].title, "趋势1");
  now += 600001;
  const next = await service();
  assert.equal(requests, 2);
  assert.equal(next.items[0].title, "趋势2");
});
