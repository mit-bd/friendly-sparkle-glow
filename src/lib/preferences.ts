import { useCallback, useEffect, useState } from "react";
import type { RangePreset } from "./analytics";

/**
 * User Preferences — lightweight, per-device, persisted in localStorage.
 *
 * Kept deliberately client-side so it never touches the financial schema or
 * RLS. Defaults are safe; every consumer reads through `usePreferences()` and
 * receives live updates across tabs via the `storage` event plus an in-page
 * custom event.
 */

export type PageSize = 10 | 25 | 50 | 100;

export interface UserPreferences {
  defaultRange: RangePreset;
  pageSize: PageSize;
  /** Show in-app notification toasts. */
  notifyToasts: boolean;
  /** Show live toasts for incoming notifications (approvals, submissions…). */
  notifyInApp: boolean;
  /** Play the subtle chime when a new notification arrives. */
  notifySound: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultRange: "this_month",
  pageSize: 25,
  notifyToasts: true,
  notifyInApp: true,
  notifySound: true,
};

const STORAGE_KEY = "ems-preferences";
const EVENT = "ems-preferences-change";

export function readPreferences(): UserPreferences {
  if (typeof localStorage === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writePreferences(prefs: UserPreferences) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPrefs(readPreferences());
    const sync = () => setPrefs(readPreferences());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<UserPreferences>) => {
    const next = { ...readPreferences(), ...patch };
    writePreferences(next);
    setPrefs(next);
  }, []);

  const reset = useCallback(() => {
    writePreferences(DEFAULT_PREFERENCES);
    setPrefs(DEFAULT_PREFERENCES);
  }, []);

  return { prefs, update, reset };
}
