export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_PREFERENCE_STORAGE_KEY = 'reo.themePreference.v1';
export const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const PREFERENCE_VALUES: readonly ThemePreference[] = ['light', 'dark', 'system'];

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (PREFERENCE_VALUES as readonly string[]).includes(value);
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readThemePreference(): ThemePreference {
  const storage = browserStorage();
  if (!storage) {
    return 'system';
  }
  try {
    const raw = storage.getItem(THEME_PREFERENCE_STORAGE_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function writeThemePreference(preference: ThemePreference): void {
  const storage = browserStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // Preference is best-effort renderer state; in-memory value still drives the current session.
  }
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  isSystemDark: boolean
): ThemeMode {
  if (preference === 'system') {
    return isSystemDark ? 'dark' : 'light';
  }
  return preference;
}

export function cycleThemePreference(current: ThemePreference): ThemePreference {
  const index = PREFERENCE_VALUES.indexOf(current);
  const nextIndex = (index + 1) % PREFERENCE_VALUES.length;
  return PREFERENCE_VALUES[nextIndex] ?? 'system';
}
