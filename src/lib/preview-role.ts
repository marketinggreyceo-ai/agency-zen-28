import { useSyncExternalStore } from "react";
import type { Role } from "@/lib/auth";

const KEY = "preview_role";
const listeners = new Set<() => void>();

function read(): Role | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  if (v === "owner" || v === "production" || v === "creative" || v === "va") return v;
  return null;
}

export function setPreviewRole(role: Role | null) {
  if (typeof window === "undefined") return;
  if (role && role !== "owner") window.localStorage.setItem(KEY, role);
  else window.localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function usePreviewRole(): Role | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => null,
  );
}
