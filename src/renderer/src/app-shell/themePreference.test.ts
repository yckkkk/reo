import { beforeEach, describe, expect, it } from 'vitest';
import {
  cycleThemePreference,
  readThemePreference,
  resolveEffectiveTheme,
  THEME_PREFERENCE_STORAGE_KEY,
  writeThemePreference,
} from './themePreference';

describe('themePreference', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('readThemePreference', () => {
    it('defaults to "system" when storage is empty', () => {
      expect(readThemePreference()).toBe('system');
    });

    it('falls back to "system" when stored value is not a known preference', () => {
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'sepia');
      expect(readThemePreference()).toBe('system');
    });

    it('returns the persisted preference for each known value', () => {
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'light');
      expect(readThemePreference()).toBe('light');
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark');
      expect(readThemePreference()).toBe('dark');
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'system');
      expect(readThemePreference()).toBe('system');
    });
  });

  describe('writeThemePreference', () => {
    it('persists the preference to localStorage', () => {
      writeThemePreference('dark');
      expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark');
      writeThemePreference('system');
      expect(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('system');
    });
  });

  describe('resolveEffectiveTheme', () => {
    it('returns the explicit preference when not "system"', () => {
      expect(resolveEffectiveTheme('light', true)).toBe('light');
      expect(resolveEffectiveTheme('dark', false)).toBe('dark');
    });

    it('follows the system dark signal when preference is "system"', () => {
      expect(resolveEffectiveTheme('system', true)).toBe('dark');
      expect(resolveEffectiveTheme('system', false)).toBe('light');
    });
  });

  describe('cycleThemePreference', () => {
    it('cycles light → dark → system → light', () => {
      expect(cycleThemePreference('light')).toBe('dark');
      expect(cycleThemePreference('dark')).toBe('system');
      expect(cycleThemePreference('system')).toBe('light');
    });
  });
});
