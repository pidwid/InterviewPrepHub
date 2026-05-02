import { useCallback, useEffect, useMemo, useState } from "react";
import { streakStorage, getStorageMode } from "./storageMiddleware";

// Daily activity log + streak calculations, persisted via storageMiddleware
// (localStorage in 'local' mode, Turso DB in 'turso' mode).
// Shape: { "YYYY-MM-DD": activityCount }
const MAX_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

// Format as YYYY-MM-DD using LOCAL time (not UTC) so date keys agree
// across users in any timezone and across local-midnight rollovers.
export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const todayKey = localDateKey;

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem("prep_streak") || "{}");
  } catch {
    return {};
  }
}

function pruneOld(state) {
  const cutoff = todayKey(new Date(Date.now() - MAX_DAYS * DAY_MS));
  const out = {};
  for (const [k, v] of Object.entries(state)) {
    if (k >= cutoff) out[k] = v;
  }
  return out;
}

function calcStreaks(state) {
  const days = Object.keys(state).sort(); // ascending
  if (days.length === 0) return { current: 0, longest: 0, total: 0 };

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    if (prev === null) {
      run = 1;
    } else {
      const diff = Math.round((Date.parse(d) - Date.parse(prev)) / DAY_MS);
      run = diff === 1 ? run + 1 : 1;
    }
    if (run > longest) longest = run;
    prev = d;
  }

  // Current = streak ending today or yesterday (single missed day breaks)
  const today = todayKey();
  const yesterday = todayKey(new Date(Date.now() - DAY_MS));
  const last = days[days.length - 1];
  const current = last === today || last === yesterday ? run : 0;

  return { current, longest, total: days.length };
}

// Components anywhere in the tree can fire an activity without prop-drilling
// recordActivity by dispatching this CustomEvent. useStreakState subscribes
// once at the top of the App tree.
export const STREAK_ACTIVITY_EVENT = "prep:streak-activity";

export function recordStreakActivity() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STREAK_ACTIVITY_EVENT));
}

export function useStreakState() {
  // Sync init from localStorage (pruned) for instant render
  const [state, setState] = useState(() => pruneOld(loadLocal()));

  // In Turso mode, fetch from Turso on mount
  useEffect(() => {
    if (getStorageMode() !== "turso") return;
    streakStorage.getAll().then((data) => setState(pruneOld(data)));
  }, []);

  const recordActivity = useCallback(() => {
    const k = todayKey();
    setState((prev) => {
      const nextCount = (prev[k] || 0) + 1;
      streakStorage.set(k, nextCount);
      return { ...prev, [k]: nextCount };
    });
  }, []);

  // Listen for global activity events from anywhere in the app (bookmark,
  // Q&A answer, app-open, etc.) so we don't need to thread recordActivity
  // through the entire prop tree.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => recordActivity();
    window.addEventListener(STREAK_ACTIVITY_EVENT, handler);
    return () => window.removeEventListener(STREAK_ACTIVITY_EVENT, handler);
  }, [recordActivity]);

  // Once-per-day app-open signal: if the user opens the app at all, that
  // counts as a study activity for today. We guard with a sessionStorage
  // flag so refreshes within the same tab don't double-fire (the daily
  // dedup is implicit because the streak map is keyed by date — extra
  // calls just bump the day's counter — but we still avoid pointless
  // localStorage churn).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const FLAG = "prep_streak_app_open_today";
    const today = todayKey();
    try {
      if (sessionStorage.getItem(FLAG) === today) return;
      sessionStorage.setItem(FLAG, today);
    } catch {
      /* ignore */
    }
    recordActivity();
  }, [recordActivity]);

  const clearAll = useCallback(() => {
    setState({});
    streakStorage.clear();
  }, []);

  const stats = useMemo(() => calcStreaks(state), [state]);

  return { state, stats, recordActivity, clearAll };
}
