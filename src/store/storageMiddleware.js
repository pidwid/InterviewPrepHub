/**
 * storageMiddleware.js
 *
 * Single source of truth for all persistence in the app.
 * Supports two backends: 'local' (localStorage) and 'turso' (Turso libSQL).
 *
 * Turso uses a single table:
 *
 *   user_data(type, key, value, misc, updated_at)
 *
 *   type  — domain: 'progress' | 'bookmark' | 'qna'
 *   key   — namespaced identifier:
 *             progress → '{namespace}:{topicId}'  e.g. 'sd:load-balancers'
 *             bookmark → noteFile                 e.g. '08-Load-Balancers.md'
 *             qna      → questionId               e.g. 'q-1-3'
 *   value — the main value (status / headingId / result)
 *   misc  — nullable JSON TEXT for future additions
 *
 * Config (mode, Turso URL/token) is always kept in localStorage — it is
 * device config, not user data.
 */

import { createClient } from "@libsql/client/web";

// ── localStorage keys for config ────────────────────────────────────────────
export const STORAGE_MODE_KEY = "prep_storage_mode"; // 'local' | 'turso'
export const TURSO_URL_KEY = "turso_db_url";
export const TURSO_TOKEN_KEY = "turso_auth_token";

// ── localStorage keys for data (local mode) ─────────────────────────────────
const PROGRESS_LS_KEY = (ns) => `prep_progress_${ns}`;
const BOOKMARKS_LS_KEY = "prep_bookmarks";
const QNA_LS_KEY = "qna_progress";

// ── Turso row type constants ─────────────────────────────────────────────────
const T_PROGRESS = "progress";
const T_BOOKMARK = "bookmark";
const T_QNA = "qna";

// ── Config: read/write ───────────────────────────────────────────────────────

export function getStorageMode() {
  return localStorage.getItem(STORAGE_MODE_KEY) || "local";
}

export function saveStorageMode(mode) {
  localStorage.setItem(STORAGE_MODE_KEY, mode);
}

export function getTursoConfig() {
  return {
    url: localStorage.getItem(TURSO_URL_KEY) || "",
    token: localStorage.getItem(TURSO_TOKEN_KEY) || "",
  };
}

export function saveTursoConfig(url, token) {
  localStorage.setItem(TURSO_URL_KEY, url.trim());
  localStorage.setItem(TURSO_TOKEN_KEY, token.trim());
  _resetClient();
}

// ── Turso client (cached, recreated when config changes) ─────────────────────

let _client = null;
let _clientKey = null;

function _getClient() {
  const { url, token } = getTursoConfig();
  if (!url || !token) return null;
  const key = `${url}|${token}`;
  if (_client && _clientKey === key) return _client;
  _client = createClient({ url, authToken: token });
  _clientKey = key;
  return _client;
}

export function _resetClient() {
  _client = null;
  _clientKey = null;
}

// ── Schema bootstrap (single table, run once per session) ────────────────────

let _schemaReady = false;

async function _ensureSchema(client) {
  if (_schemaReady) return;
  await client.execute({
    sql: `CREATE TABLE IF NOT EXISTS user_data (
      type        TEXT    NOT NULL,
      key         TEXT    NOT NULL,
      value       TEXT    NOT NULL,
      misc        TEXT,
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (type, key)
    )`,
  });
  _schemaReady = true;
}

// Shared UPSERT helper
const UPSERT_SQL = `
  INSERT INTO user_data (type, key, value, updated_at)
  VALUES (?, ?, ?, unixepoch())
  ON CONFLICT(type, key)
  DO UPDATE SET value = excluded.value, updated_at = unixepoch()
`;

// ── Test connection (used in Settings UI) ────────────────────────────────────

export async function testTursoConnection(url, token) {
  try {
    const client = createClient({ url: url.trim(), authToken: token.trim() });
    await client.execute("SELECT 1");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Progress storage ─────────────────────────────────────────────────────────
//
// Shape: { [topicId]: 'done' | 'revise' | 'not_started' }
// Turso key format: '{namespace}:{topicId}'

export const progressStorage = {
  async getAll(namespace) {
    if (getStorageMode() === "turso") {
      const client = _getClient();
      if (!client) return {};
      try {
        await _ensureSchema(client);
        const prefix = `${namespace}:`;
        const result = await client.execute({
          sql: "SELECT key, value FROM user_data WHERE type = ? AND key LIKE ?",
          args: [T_PROGRESS, `${prefix}%`],
        });
        return Object.fromEntries(
          result.rows.map((r) => [r.key.slice(prefix.length), r.value]),
        );
      } catch {
        return {};
      }
    }
    try {
      const raw = localStorage.getItem(PROGRESS_LS_KEY(namespace));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  async set(namespace, topicId, status) {
    if (getStorageMode() === "turso") {
      const client = _getClient();
      if (!client) return;
      try {
        await _ensureSchema(client);
        await client.execute({
          sql: UPSERT_SQL,
          args: [T_PROGRESS, `${namespace}:${topicId}`, status],
        });
      } catch {
        // silently fail — in-memory state is already updated
      }
      return;
    }
    try {
      const raw = localStorage.getItem(PROGRESS_LS_KEY(namespace));
      const data = raw ? JSON.parse(raw) : {};
      data[topicId] = status;
      localStorage.setItem(PROGRESS_LS_KEY(namespace), JSON.stringify(data));
    } catch {}
  },

  async reset(namespace) {
    if (getStorageMode() === "turso") {
      const client = _getClient();
      if (!client) return;
      try {
        await _ensureSchema(client);
        await client.execute({
          sql: "DELETE FROM user_data WHERE type = ? AND key LIKE ?",
          args: [T_PROGRESS, `${namespace}:%`],
        });
      } catch {}
      return;
    }
    localStorage.removeItem(PROGRESS_LS_KEY(namespace));
  },
};

// ── Bookmark storage ─────────────────────────────────────────────────────────
//
// Shape: { [noteFile]: headingId }
// Turso key: noteFile as-is

export const bookmarkStorage = {
  async getAll() {
    if (getStorageMode() === "turso") {
      const client = _getClient();
      if (!client) return {};
      try {
        await _ensureSchema(client);
        const result = await client.execute({
          sql: "SELECT key, value FROM user_data WHERE type = ?",
          args: [T_BOOKMARK],
        });
        return Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
      } catch {
        return {};
      }
    }
    try {
      const raw = localStorage.getItem(BOOKMARKS_LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  async set(noteFile, headingId) {
    if (getStorageMode() === "turso") {
      const client = _getClient();
      if (!client) return;
      try {
        await _ensureSchema(client);
        await client.execute({
          sql: UPSERT_SQL,
          args: [T_BOOKMARK, noteFile, headingId],
        });
      } catch {}
      return;
    }
    try {
      const raw = localStorage.getItem(BOOKMARKS_LS_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data[noteFile] = headingId;
      localStorage.setItem(BOOKMARKS_LS_KEY, JSON.stringify(data));
    } catch {}
  },

  async remove(noteFile) {
    if (getStorageMode() === "turso") {
      const client = _getClient();
      if (!client) return;
      try {
        await _ensureSchema(client);
        await client.execute({
          sql: "DELETE FROM user_data WHERE type = ? AND key = ?",
          args: [T_BOOKMARK, noteFile],
        });
      } catch {}
      return;
    }
    try {
      const raw = localStorage.getItem(BOOKMARKS_LS_KEY);
      const data = raw ? JSON.parse(raw) : {};
      delete data[noteFile];
      localStorage.setItem(BOOKMARKS_LS_KEY, JSON.stringify(data));
    } catch {}
  },
};

// ── QnA progress storage ─────────────────────────────────────────────────────
//
// Shape: { [questionId]: 'correct' | 'incorrect' }
// Turso key: questionId as-is

export const qnaStorage = {
  async getAll() {
    if (getStorageMode() === "turso") {
      const client = _getClient();
      if (!client) return {};
      try {
        await _ensureSchema(client);
        const result = await client.execute({
          sql: "SELECT key, value FROM user_data WHERE type = ?",
          args: [T_QNA],
        });
        return Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
      } catch {
        return {};
      }
    }
    try {
      const raw = localStorage.getItem(QNA_LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  async set(questionId, result) {
    if (getStorageMode() === "turso") {
      const client = _getClient();
      if (!client) return;
      try {
        await _ensureSchema(client);
        await client.execute({
          sql: UPSERT_SQL,
          args: [T_QNA, questionId, result],
        });
      } catch {}
      return;
    }
    try {
      const raw = localStorage.getItem(QNA_LS_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data[questionId] = result;
      localStorage.setItem(QNA_LS_KEY, JSON.stringify(data));
    } catch {}
  },
};

// ── Data migration helpers ───────────────────────────────────────────────────

/**
 * Copy all local storage data to Turso.
 * Safe to run multiple times — uses UPSERT.
 */
export async function migrateLocalToTurso() {
  const client = _getClient();
  if (!client)
    throw new Error("Turso is not configured. Add your URL and token first.");
  await _ensureSchema(client);

  const stmts = [];

  // Progress: sd + lld
  for (const ns of ["sd", "lld"]) {
    try {
      const raw = localStorage.getItem(PROGRESS_LS_KEY(ns));
      const data = raw ? JSON.parse(raw) : {};
      for (const [topicId, status] of Object.entries(data)) {
        stmts.push({ sql: UPSERT_SQL, args: [T_PROGRESS, `${ns}:${topicId}`, status] });
      }
    } catch {}
  }

  // Bookmarks
  try {
    const raw = localStorage.getItem(BOOKMARKS_LS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    for (const [noteFile, headingId] of Object.entries(data)) {
      stmts.push({ sql: UPSERT_SQL, args: [T_BOOKMARK, noteFile, headingId] });
    }
  } catch {}

  // QnA
  try {
    const raw = localStorage.getItem(QNA_LS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    for (const [qId, result] of Object.entries(data)) {
      stmts.push({ sql: UPSERT_SQL, args: [T_QNA, qId, result] });
    }
  } catch {}

  if (stmts.length > 0) {
    await client.batch(stmts, "write");
  }

  return stmts.length;
}

/**
 * Pull all Turso data down to localStorage.
 * Overwrites local data with what's in Turso.
 */
export async function migrateTursoToLocal() {
  const client = _getClient();
  if (!client)
    throw new Error("Turso is not configured. Add your URL and token first.");
  await _ensureSchema(client);

  // Progress
  for (const ns of ["sd", "lld"]) {
    try {
      const prefix = `${ns}:`;
      const result = await client.execute({
        sql: "SELECT key, value FROM user_data WHERE type = ? AND key LIKE ?",
        args: [T_PROGRESS, `${prefix}%`],
      });
      const data = Object.fromEntries(
        result.rows.map((r) => [r.key.slice(prefix.length), r.value]),
      );
      localStorage.setItem(PROGRESS_LS_KEY(ns), JSON.stringify(data));
    } catch {}
  }

  // Bookmarks
  try {
    const result = await client.execute({
      sql: "SELECT key, value FROM user_data WHERE type = ?",
      args: [T_BOOKMARK],
    });
    const data = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
    localStorage.setItem(BOOKMARKS_LS_KEY, JSON.stringify(data));
  } catch {}

  // QnA
  try {
    const result = await client.execute({
      sql: "SELECT key, value FROM user_data WHERE type = ?",
      args: [T_QNA],
    });
    const data = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
    localStorage.setItem(QNA_LS_KEY, JSON.stringify(data));
  } catch {}
}
