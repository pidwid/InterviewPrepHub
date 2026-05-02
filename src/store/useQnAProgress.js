/**
 * useQnAProgress — manages QnA answer state via the storage middleware.
 *
 * Replaces the inline localStorage logic that was previously inside
 * InlinePractice.jsx.
 */

import { useState, useEffect, useCallback } from "react";
import { qnaStorage, getStorageMode } from "./storageMiddleware";
import { recordStreakActivity } from "./useStreakState";

function loadLocal() {
  try {
    const raw = localStorage.getItem("qna_progress");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useQnAProgress() {
  // Sync init from localStorage for instant render, then override with Turso if needed
  const [qnaProgress, setQnAProgress] = useState(() =>
    getStorageMode() === "local" ? loadLocal() : {},
  );

  // Load from Turso on mount (only when in turso mode)
  useEffect(() => {
    if (getStorageMode() !== "turso") return;
    qnaStorage.getAll().then(setQnAProgress);
  }, []);

  const markAnswer = useCallback((questionId, result) => {
    setQnAProgress((prev) => ({ ...prev, [questionId]: result }));
    qnaStorage.set(questionId, result);
    // Answering a practice question (correct OR incorrect) is a strong
    // engagement signal — counts toward today's streak.
    recordStreakActivity();
  }, []);

  return { qnaProgress, markAnswer };
}
