import type { VerdictResult } from "./types";

const KEY = "newsverdict.history.v1";
const MAX = 25;

export function getHistory(): VerdictResult[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveToHistory(result: VerdictResult) {
  if (typeof window === "undefined") return;
  const list = [result, ...getHistory().filter((r) => r.id !== result.id)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
