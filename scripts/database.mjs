import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);

export async function createStateStore(databasePath = "./data/ai-content-director.db") {
  const absolutePath = resolve(databasePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const database = existsSync(absolutePath)
    ? new SQL.Database(readFileSync(absolutePath))
    : new SQL.Database();

  database.run(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      idea_id TEXT,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS viral_analyses (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ideas_account_id_idx ON ideas(account_id);
    CREATE INDEX IF NOT EXISTS projects_idea_id_idx ON projects(idea_id);
  `);
  persist();

  function writeState(state) {
    database.run("BEGIN TRANSACTION");
    try {
      const account = state.account;
      if (account?.id) {
        database.run(
          `INSERT INTO accounts (id, payload, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
          [account.id, JSON.stringify(account), account.updatedAt || new Date().toISOString()],
        );
      }
      database.run("DELETE FROM ideas");
      database.run("DELETE FROM projects");
      database.run("DELETE FROM viral_analyses");
      database.run("DELETE FROM events");
      for (const idea of state.ideas || []) {
        database.run("INSERT INTO ideas (id, account_id, payload, updated_at) VALUES (?, ?, ?, ?)", [idea.id, idea.accountId || null, JSON.stringify(idea), idea.updatedAt || idea.createdAt]);
      }
      for (const project of state.projects || []) {
        database.run("INSERT INTO projects (id, idea_id, payload, updated_at) VALUES (?, ?, ?, ?)", [project.id, project.ideaId || null, JSON.stringify(project), project.updatedAt || project.createdAt]);
      }
      for (const analysis of state.viralAnalyses || []) {
        database.run("INSERT INTO viral_analyses (id, payload, created_at) VALUES (?, ?, ?)", [analysis.id, JSON.stringify(analysis), analysis.createdAt]);
      }
      for (const event of state.events || []) {
        database.run("INSERT INTO events (event_name, payload, created_at) VALUES (?, ?, ?)", [event.event, JSON.stringify(event.payload || {}), event.createdAt]);
      }
      setSetting("selectedIdeaId", JSON.stringify(state.selectedIdeaId || null));
      setSetting("selectedProjectId", JSON.stringify(state.selectedProjectId || null));
      setSetting("initialized", "true");
      database.run("COMMIT");
      persist();
      return readState();
    } catch (error) {
      database.run("ROLLBACK");
      throw error;
    }
  }

  function readState() {
    if (!getOne("SELECT value FROM settings WHERE key = 'initialized'")) return null;
    const accountRow = getOne("SELECT payload FROM accounts ORDER BY updated_at DESC LIMIT 1");
    const settings = Object.fromEntries(getAll("SELECT key, value FROM settings").map((row) => [row.key, row.value]));
    return {
      account: accountRow ? JSON.parse(accountRow.payload) : null,
      ideas: getAll("SELECT payload FROM ideas ORDER BY updated_at ASC").map((row) => JSON.parse(row.payload)),
      projects: getAll("SELECT payload FROM projects ORDER BY updated_at ASC").map((row) => JSON.parse(row.payload)),
      viralAnalyses: getAll("SELECT payload FROM viral_analyses ORDER BY created_at ASC").map((row) => JSON.parse(row.payload)),
      events: getAll("SELECT event_name, payload, created_at FROM events ORDER BY id ASC").map((row) => ({ event: row.event_name, payload: JSON.parse(row.payload), createdAt: row.created_at })),
      selectedIdeaId: JSON.parse(settings.selectedIdeaId || "null"),
      selectedProjectId: JSON.parse(settings.selectedProjectId || "null"),
    };
  }

  function health() {
    return {
      path: absolutePath,
      accounts: count("accounts"),
      ideas: count("ideas"),
      projects: count("projects"),
      viralAnalyses: count("viral_analyses"),
      events: count("events"),
    };
  }

  function setSetting(key, value) {
    database.run(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }

  function getOne(sql, params = []) {
    const statement = database.prepare(sql);
    try {
      statement.bind(params);
      return statement.step() ? statement.getAsObject() : null;
    } finally {
      statement.free();
    }
  }

  function getAll(sql, params = []) {
    const statement = database.prepare(sql);
    const rows = [];
    try {
      statement.bind(params);
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }

  function count(table) {
    return Number(getOne(`SELECT COUNT(*) AS count FROM ${table}`).count);
  }

  function persist() {
    const temporaryPath = `${absolutePath}.tmp`;
    writeFileSync(temporaryPath, Buffer.from(database.export()));
    renameSync(temporaryPath, absolutePath);
  }

  function close() {
    persist();
    database.close();
  }

  return { readState, writeState, health, close, path: absolutePath };
}
