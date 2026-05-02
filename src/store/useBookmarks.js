import { useState, useEffect, useCallback } from "react";
import { bookmarkStorage, getStorageMode } from "./storageMiddleware";

const MIGRATION_FLAG = "prep_bookmarks_ns_migrated";

// One-time migration: bookmarks used to be keyed by bare noteFile, which
// silently collided when both SD and LLD have a file with the same name
// (README.md, soon Interview-Cheat-Sheet.md if LLD ever adds one). Because
// the old contentLoader resolved SD-first, every legacy bookmark under a
// shared name belonged to SD — so we prefix all unprefixed keys with "sd:".
// Already-prefixed keys (containing a colon outside the filename) are left
// alone so a re-run is a no-op.
function migrateBareKeysToNamespaced(map) {
  const out = {};
  let changed = false;
  for (const [key, value] of Object.entries(map || {})) {
    if (key.includes(":")) {
      out[key] = value;
    } else {
      out[`sd:${key}`] = value;
      changed = true;
    }
  }
  return { map: out, changed };
}

function loadLocal() {
  try {
    const raw = localStorage.getItem("prep_bookmarks");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistLocalMigration(migrated) {
  try {
    localStorage.setItem("prep_bookmarks", JSON.stringify(migrated));
    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch {
    /* ignore */
  }
}

function compositeKey(namespace, noteFile) {
  return `${namespace || "sd"}:${noteFile}`;
}

/**
 * Manages "study-up-to" bookmarks, one per (namespace, note file) pair.
 * Internal storage shape: { [`${namespace}:${noteFile}`]: headingId }
 *
 * Public API still takes (noteFile, headingId) for back-compat with existing
 * call sites; consumers that know their namespace pass it as the optional
 * 3rd arg (or via the namespace-aware getBookmark/hasBookmark variants).
 */
export function useBookmarks() {
  // Sync init from localStorage for instant render.
  // In turso mode, start empty and load async below.
  const [bookmarks, setBookmarks] = useState(() => {
    if (getStorageMode() !== "local") return {};
    const raw = loadLocal();
    if (localStorage.getItem(MIGRATION_FLAG) === "1") return raw;
    const { map, changed } = migrateBareKeysToNamespaced(raw);
    if (changed) persistLocalMigration(map);
    else localStorage.setItem(MIGRATION_FLAG, "1");
    return map;
  });

  // When in turso mode, fetch all bookmarks from Turso on mount.
  // Apply the same SD-prefix migration in-memory; remote rows stay as-is
  // (we don't auto-rewrite Turso rows — too aggressive). Future writes will
  // use the prefixed shape, and reads still match because we look up by
  // the prefixed key.
  useEffect(() => {
    if (getStorageMode() !== "turso") return;
    bookmarkStorage.getAll().then((data) => {
      const { map } = migrateBareKeysToNamespaced(data);
      setBookmarks(map);
    });
  }, []);

  const setBookmark = useCallback((noteFile, headingId, namespace) => {
    const key = compositeKey(namespace, noteFile);
    if (!headingId) {
      setBookmarks((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      bookmarkStorage.remove(key);
      return;
    }
    setBookmarks((prev) => ({ ...prev, [key]: headingId }));
    bookmarkStorage.set(key, headingId);
  }, []);

  const clearBookmark = useCallback((noteFile, namespace) => {
    const key = compositeKey(namespace, noteFile);
    setBookmarks((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    bookmarkStorage.remove(key);
  }, []);

  const getBookmark = useCallback(
    (noteFile, namespace) => bookmarks[compositeKey(namespace, noteFile)] ?? null,
    [bookmarks],
  );

  const hasBookmark = useCallback(
    (noteFile, namespace) => !!bookmarks[compositeKey(namespace, noteFile)],
    [bookmarks],
  );

  return { bookmarks, setBookmark, clearBookmark, getBookmark, hasBookmark };
}
