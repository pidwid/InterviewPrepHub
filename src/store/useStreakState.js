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

  const stats = useMemo(() => calcStreaks(state), [state]);

  return { state, stats, recordActivity };
}
