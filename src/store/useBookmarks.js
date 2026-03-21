import { useState, useEffect, useCallback } from "react";
import { bookmarkStorage, getStorageMode } from "./storageMiddleware";

function loadLocal() {
  try {
    const raw = localStorage.getItem("prep_bookmarks");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Manages "study-up-to" bookmarks, one per note file.
 * bookmarks shape: { [noteFile: string]: headingId: string }
 */
export function useBookmarks() {
  // Sync init from localStorage for instant render.
  // In turso mode, start empty and load async below.
  const [bookmarks, setBookmarks] = useState(() =>
    getStorageMode() === "local" ? loadLocal() : {},
  );

  // When in turso mode, fetch all bookmarks from Turso on mount
  useEffect(() => {
    if (getStorageMode() !== "turso") return;
    bookmarkStorage.getAll().then(setBookmarks);
  }, []);

  const setBookmark = useCallback((noteFile, headingId) => {
    if (!headingId) {
      // Treat null / undefined / '' as a clear
      setBookmarks((prev) => {
        const next = { ...prev };
        delete next[noteFile];
        return next;
      });
      bookmarkStorage.remove(noteFile);
      return;
    }
    setBookmarks((prev) => ({ ...prev, [noteFile]: headingId }));
    bookmarkStorage.set(noteFile, headingId);
  }, []);

  const clearBookmark = useCallback((noteFile) => {
    setBookmarks((prev) => {
      const next = { ...prev };
      delete next[noteFile];
      return next;
    });
    bookmarkStorage.remove(noteFile);
  }, []);

  const getBookmark = useCallback(
    (noteFile) => bookmarks[noteFile] ?? null,
    [bookmarks],
  );

  const hasBookmark = useCallback(
    (noteFile) => !!bookmarks[noteFile],
    [bookmarks],
  );

  return { bookmarks, setBookmark, clearBookmark, getBookmark, hasBookmark };
}
