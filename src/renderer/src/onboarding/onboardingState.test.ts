import { beforeEach, describe, expect, it } from 'vitest';
import {
  ONBOARDING_STATE_STORAGE_KEY,
  clearPermissionRestartRequired,
  markFirstRunGuideSkipped,
  readOnboardingStartupTarget,
  writePermissionRestartRequired,
} from './onboardingState';

describe('onboardingState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts in the first-run permission guide when no state exists', () => {
    expect(readOnboardingStartupTarget()).toEqual({
      kind: 'permission-guide',
      reason: 'first-run',
    });
  });

  it('enters the app after the first-run guide is skipped', () => {
    markFirstRunGuideSkipped();

    expect(readOnboardingStartupTarget()).toEqual({ kind: 'app' });
    expect(window.localStorage.getItem(ONBOARDING_STATE_STORAGE_KEY)).toContain(
      '"hasSeenFirstRun":true'
    );
  });

  it('reopens the permission guide when a permission requires restart', () => {
    markFirstRunGuideSkipped();
    writePermissionRestartRequired('microphone');

    expect(readOnboardingStartupTarget()).toEqual({
      kind: 'permission-guide',
      focusItem: 'microphone',
      reason: 'permission-restart-required',
    });
  });

  it('clears the restart-required marker after the focused permission is granted', () => {
    markFirstRunGuideSkipped();
    writePermissionRestartRequired('microphone');

    clearPermissionRestartRequired('microphone');

    expect(readOnboardingStartupTarget()).toEqual({ kind: 'app' });
    expect(window.localStorage.getItem(ONBOARDING_STATE_STORAGE_KEY)).not.toContain(
      'permissionRestartRequired'
    );
  });

  it('keeps a different restart-required marker when clearing a non-focused permission', () => {
    markFirstRunGuideSkipped();
    writePermissionRestartRequired('accessibility');

    clearPermissionRestartRequired('microphone');

    expect(readOnboardingStartupTarget()).toEqual({
      kind: 'permission-guide',
      focusItem: 'accessibility',
      reason: 'permission-restart-required',
    });
  });

  it('fails closed to first-run when stored state is invalid', () => {
    window.localStorage.setItem(ONBOARDING_STATE_STORAGE_KEY, '{');

    expect(readOnboardingStartupTarget()).toEqual({
      kind: 'permission-guide',
      reason: 'first-run',
    });
  });
});
