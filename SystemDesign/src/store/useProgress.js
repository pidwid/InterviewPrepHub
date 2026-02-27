import { useState, useCallback } from 'react';
import { STATUS } from '../data/topics';

function storageKey(namespace) {
  return `prep_progress_${namespace}`;
}

function loadProgress(namespace) {
  try {
    const raw = localStorage.getItem(storageKey(namespace));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(namespace, progress) {
  localStorage.setItem(storageKey(namespace), JSON.stringify(progress));
}

// namespace: 'sd' | 'cc' | 'lld'
// allTopics: flat array of topic objects for this namespace
export function useProgress(namespace, allTopics) {
  const [progress, setProgress] = useState(() => loadProgress(namespace));

  const setStatus = useCallback(
    (topicId, status) => {
      setProgress((prev) => {
        const next = { ...prev, [topicId]: status };
        saveProgress(namespace, next);
        return next;
      });
    },
    [namespace]
  );

  const getStatus = useCallback(
    (topicId) => progress[topicId] || STATUS.NOT_STARTED,
    [progress]
  );

  const resetAll = useCallback(() => {
    setProgress({});
    localStorage.removeItem(storageKey(namespace));
  }, [namespace]);

  const stats = {
    total: allTopics.length,
    done: allTopics.filter((t) => progress[t.id] === STATUS.DONE).length,
    revise: allTopics.filter((t) => progress[t.id] === STATUS.REVISE).length,
    notStarted: allTopics.filter(
      (t) => !progress[t.id] || progress[t.id] === STATUS.NOT_STARTED
    ).length,
  };

  return { progress, setStatus, getStatus, resetAll, stats };
}
