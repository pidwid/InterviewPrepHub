import { useState, useCallback } from "react";

const STORAGE_KEY = "prep_bookmarks";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Manages "study-up-to" bookmarks, one per note file.
 * bookmarks shape: { [noteFile: string]: headingId: string }
 */
export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(load);

  const setBookmark = useCallback((noteFile, headingId) => {
    if (!headingId) {
      // Treat null / undefined / "" as a clear
      setBookmarks((prev) => {
        const next = { ...prev };
        delete next[noteFile];
        persist(next);
        return next;
      });
      return;
    }
    setBookmarks((prev) => {
      const next = { ...prev, [noteFile]: headingId };
      persist(next);
      return next;
    });
  }, []);

  const clearBookmark = useCallback((noteFile) => {
    setBookmarks((prev) => {
      const next = { ...prev };
      delete next[noteFile];
      persist(next);
      return next;
    });
  }, []);

  const getBookmark = useCallback(
    (noteFile) => bookmarks[noteFile] ?? null,
    [bookmarks]
  );

  const hasBookmark = useCallback(
    (noteFile) => !!bookmarks[noteFile],
    [bookmarks]
  );

  return { bookmarks, setBookmark, clearBookmark, getBookmark, hasBookmark };
}
