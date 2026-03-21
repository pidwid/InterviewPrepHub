import { useState, useEffect, useCallback } from "react";
import { STATUS } from "../data/topics";
import { progressStorage, getStorageMode } from "./storageMiddleware";

function loadLocal(namespace) {
  try {
    const raw = localStorage.getItem(`prep_progress_${namespace}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// namespace: 'sd' | 'lld'
// allTopics: flat array of topic objects for this namespace
export function useProgress(namespace, allTopics) {
  // Sync init from localStorage for instant render.
  // In turso mode, start empty and load async below.
  const [progress, setProgress] = useState(() =>
    getStorageMode() === "local" ? loadLocal(namespace) : {},
  );

  // When in turso mode, fetch all progress from Turso on mount
  useEffect(() => {
    if (getStorageMode() !== "turso") return;
    progressStorage.getAll(namespace).then(setProgress);
  }, [namespace]);

  const setStatus = useCallback(
    (topicId, status) => {
      setProgress((prev) => ({ ...prev, [topicId]: status }));
      progressStorage.set(namespace, topicId, status);
    },
    [namespace],
  );

  const getStatus = useCallback(
    (topicId) => progress[topicId] || STATUS.NOT_STARTED,
    [progress],
  );

  const resetAll = useCallback(() => {
    setProgress({});
    progressStorage.reset(namespace);
  }, [namespace]);

  const stats = {
    total: allTopics.length,
    done: allTopics.filter((t) => progress[t.id] === STATUS.DONE).length,
    revise: allTopics.filter((t) => progress[t.id] === STATUS.REVISE).length,
    notStarted: allTopics.filter(
      (t) => !progress[t.id] || progress[t.id] === STATUS.NOT_STARTED,
    ).length,
  };

  return { progress, setStatus, getStatus, resetAll, stats };
}
