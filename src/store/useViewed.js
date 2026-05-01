// Tracks which topics the user has actually opened (viewed for >= 30s).
// This is metadata layered on top of the existing 3-state status system —
// it doesn't change status semantics, but lets the UI show a subtle
// "started but not yet marked Done/Revise" indicator.

import { useCallback, useState } from "react";

const LS_KEY = (ns) => `prep_viewed_${ns}`;

function load(ns) {
  try {
    const raw = localStorage.getItem(LS_KEY(ns));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function save(ns, set) {
  try {
    localStorage.setItem(LS_KEY(ns), JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function useViewed(namespace) {
  const [viewed, setViewed] = useState(() => load(namespace));

  const markViewed = useCallback(
    (topicId) => {
      setViewed((prev) => {
        if (prev.has(topicId)) return prev;
        const next = new Set(prev);
        next.add(topicId);
        save(namespace, next);
        return next;
      });
    },
    [namespace],
  );

  const isViewed = useCallback(
    (topicId) => viewed.has(topicId),
    [viewed],
  );

  return { markViewed, isViewed, viewed };
}
