const DEFAULT_ENDPOINT = "https://douyinhuo.cn/api/data";
const CACHE_TTL_MS = 10 * 60 * 1000;

export function createDouyinTrendService({
  fetchImpl = fetch,
  endpoint = DEFAULT_ENDPOINT,
  ttlMs = CACHE_TTL_MS,
  now = () => Date.now(),
} = {}) {
  let cached = null;
  let expiresAt = 0;

  return async function getDouyinTrends() {
    if (cached && now() < expiresAt) return cached;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetchImpl(endpoint, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw trendError(`Trend source returned ${response.status}`);
      const body = await response.json();
      const platform = body.platforms?.find((item) => item.id === "douyin");
      if (!platform || !Array.isArray(platform.items)) throw trendError("Douyin trends were not found in the source response");

      const items = platform.items
        .map((item, index) => ({
          rank: Number.isInteger(Number(item.rank)) && Number(item.rank) > 0 ? Number(item.rank) : index + 1,
          title: typeof item.title === "string" ? item.title.trim().slice(0, 120) : "",
          url: safeDouyinUrl(item.url, item.title),
        }))
        .filter((item) => item.title)
        .slice(0, 50);
      if (!items.length) throw trendError("Trend source returned an empty Douyin list");

      cached = {
        source: "douyinhuo.cn",
        sourceUrl: "https://douyinhuo.cn/",
        updatedAt: body.last_update || platform.update_time || null,
        fetchedAt: new Date(now()).toISOString(),
        items,
      };
      expiresAt = now() + ttlMs;
      return cached;
    } catch (error) {
      if (error.name === "AbortError") throw trendError("Fetching Douyin trends timed out");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}

function safeDouyinUrl(url, title) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && (parsed.hostname === "douyin.com" || parsed.hostname.endsWith(".douyin.com"))) {
      return parsed.href;
    }
  } catch {
    // Fall through to an official Douyin search URL.
  }
  return `https://www.douyin.com/search/${encodeURIComponent(title || "")}`;
}

function trendError(message) {
  return Object.assign(new Error(message), { code: "TREND_UNAVAILABLE" });
}
