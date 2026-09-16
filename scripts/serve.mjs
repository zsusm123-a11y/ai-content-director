import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createStateStore } from "./database.mjs";
import { aiConfiguration, runAiTask } from "./ai-provider.mjs";
import { createDouyinTrendService } from "./trends.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadEnv(join(root, ".env"));

const port = Number(process.env.PORT || 4173);
const store = await createStateStore(process.env.DATABASE_PATH || join(root, "data", "ai-content-director.db"));
const getDouyinTrends = createDouyinTrendService({ endpoint: process.env.DOUYIN_TRENDS_URL || undefined });
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    await serveStatic(response, url.pathname);
  } catch (error) {
    if (error.code !== "AI_NOT_CONFIGURED") console.error(error);
    if (response.headersSent) return response.end();
    json(response, error.code === "AI_NOT_CONFIGURED" ? 503 : 500, {
      ok: false,
      error: { code: error.code || "INTERNAL_ERROR", message: error.message || "Internal server error" },
    });
  }
});

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    json(response, 200, { ok: true, database: store.health(), ai: aiConfiguration() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/config") {
    json(response, 200, { ok: true, ai: aiConfiguration(), database: { engine: "sqlite", ready: true } });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/trends/douyin") {
    json(response, 200, { ok: true, ...(await getDouyinTrends()) });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/state") {
    const state = store.readState();
    json(response, 200, { ok: true, initialized: Boolean(state), state });
    return;
  }
  if (request.method === "PUT" && url.pathname === "/api/state") {
    const body = await readJson(request);
    validateState(body.state);
    const state = store.writeState(body.state);
    json(response, 200, { ok: true, state });
    return;
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/ai/")) {
    const task = url.pathname.slice("/api/ai/".length);
    const body = await readJson(request);
    const result = await runAiTask(task, body);
    json(response, 200, { ok: true, ...result });
    return;
  }
  json(response, 404, { ok: false, error: { code: "NOT_FOUND", message: "API route not found" } });
}

async function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const candidate = normalize(join(root, requested));
  if (!candidate.toLowerCase().startsWith(root.toLowerCase())) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  const info = await stat(candidate);
  const file = info.isDirectory() ? join(candidate, "index.html") : candidate;
  const body = await readFile(file);
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 2_000_000) {
        reject(Object.assign(new Error("Request body is too large"), { code: "PAYLOAD_TOO_LARGE" }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON"), { code: "INVALID_JSON" }));
      }
    });
    request.on("error", reject);
  });
}

function validateState(state) {
  if (!state || typeof state !== "object") throw Object.assign(new Error("state is required"), { code: "INVALID_STATE" });
  if (!state.account?.id || !Array.isArray(state.ideas) || !Array.isArray(state.projects) || !Array.isArray(state.events)) {
    throw Object.assign(new Error("state has an invalid shape"), { code: "INVALID_STATE" });
  }
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

server.listen(port, () => {
  const ai = aiConfiguration();
  console.log(`AI Content Director running at http://localhost:${port}`);
  console.log(`SQLite database: ${store.path}`);
  console.log(`AI provider: ${ai.configured ? `${ai.provider}/${ai.model}` : "local fallback (AI_API_KEY not configured)"}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
