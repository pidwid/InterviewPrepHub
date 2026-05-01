import { useCallback, useEffect, useState } from "react";
import { reviewStorage, getStorageMode } from "./storageMiddleware";

// Spaced-repetition review state per namespace, persisted via storageMiddleware
// (localStorage in 'local' mode, Turso DB in 'turso' mode).
// Stores: { topicId: { lastReviewed, dueAt, reviewCount } }
// Schedule (SM-2 lite): 1d → 3d → 7d → 14d → 30d (cap)
const INTERVALS_DAYS = [1, 3, 7, 14, 30];
const DAY_MS = 24 * 60 * 60 * 1000;

function loadLocal(namespace) {
  try {
    return JSON.parse(localStorage.getItem(`prep_review_${namespace}`) || "{}");
  } catch {
    return {};
  }
}

function nextDueAt(reviewCount) {
  const idx = Math.min(reviewCount, INTERVALS_DAYS.length - 1);
  return Date.now() + INTERVALS_DAYS[idx] * DAY_MS;
}

export function useReviewState(namespace) {
  // Sync init from localStorage for instant render. In Turso mode, the
  // remote copy loads async below.
  const [state, setState] = useState(() => loadLocal(namespace));

  // When in turso mode, fetch from Turso on mount / namespace change
  useEffect(() => {
    if (getStorageMode() !== "turso") return;
    reviewStorage.getAll(namespace).then(setState);
  }, [namespace]);

  const writeEntry = useCallback(
    (topicId, entry) => {
      setState((prev) => ({ ...prev, [topicId]: entry }));
      reviewStorage.set(namespace, topicId, entry);
    },
    [namespace],
  );

  const removeEntry = useCallback(
    (topicId) => {
      setState((prev) => {
        const { [topicId]: _, ...rest } = prev;
        return rest;
      });
      reviewStorage.remove(namespace, topicId);
    },
    [namespace],
  );

  // Initialize / re-mark a topic for review. Always sets dueAt = now so
  // the user sees immediate feedback when they flip the Revise flag.
  // (The schedule progression happens via snoozeReview after they Got-it.)
  const markForReview = useCallback(
    (topicId) => {
      setState((prev) => {
        const cur = prev[topicId];
        const entry = {
          lastReviewed: Date.now(),
          dueAt: Date.now(),
          reviewCount: cur?.reviewCount || 0,
        };
        reviewStorage.set(namespace, topicId, entry);
        return { ...prev, [topicId]: entry };
      });
    },
    [namespace],
  );

  // "Got it" — remove from queue
  const completeReview = useCallback(
    (topicId) => removeEntry(topicId),
    [removeEntry],
  );

  // "Review later" — bump to next interval
  const snoozeReview = useCallback(
    (topicId) => {
      setState((prev) => {
        const cur = prev[topicId] || { reviewCount: 0 };
        const reviewCount = (cur.reviewCount || 0) + 1;
        const entry = {
          lastReviewed: Date.now(),
          dueAt: nextDueAt(reviewCount),
          reviewCount,
        };
        reviewStorage.set(namespace, topicId, entry);
        return { ...prev, [topicId]: entry };
      });
    },
    [namespace],
  );

  // "Still confused" — reset to 1d
  const resetReview = useCallback(
    (topicId) => {
      const entry = {
        lastReviewed: Date.now(),
        dueAt: nextDueAt(0),
        reviewCount: 0,
      };
      writeEntry(topicId, entry);
    },
    [writeEntry],
  );

  const removeReview = useCallback(
    (topicId) => removeEntry(topicId),
    [removeEntry],
  );

  // Items due today (or overdue), sorted by most overdue first
  const dueTopics = Object.entries(state)
    .filter(([, v]) => v.dueAt <= Date.now())
    .sort(([, a], [, b]) => a.dueAt - b.dueAt)
    .map(([topicId, v]) => ({ topicId, ...v }));

  return {
    state,
    dueTopics,
    markForReview,
    completeReview,
    snoozeReview,
    resetReview,
    removeReview,
  };
}
