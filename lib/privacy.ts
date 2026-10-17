"use client";

import { useSyncExternalStore } from "react";

/*
 * Private mode: the eye in the top bar swaps every balance for
 * dots. It is a per-viewer preference, so it lives in this browser only,
 * with an in-memory fallback when storage is unavailable.
 */

const KEY = "sanwo.private";
const EVENT = "sanwo:private";
let memory = false;

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return memory;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function usePrivateMode(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function setPrivateMode(on: boolean): void {
  memory = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Storage blocked: the in-memory value still applies for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** "1,234.50" → "••••.••" for hidden amounts. */
export function maskAmount(formatted: string): string {
  return formatted.replace(/,/g, "").replace(/\d/g, "•");
}
