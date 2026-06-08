import { isAppPermissionRowId, type AppPermissionRowId } from '../app-permissions/appPermissionIds';

export const ONBOARDING_STATE_STORAGE_KEY = 'reo.onboarding.v1';

export type PermissionGuideItemId = AppPermissionRowId | 'voice';

type PersistedOnboardingState = {
  readonly hasSeenFirstRun: boolean;
  readonly permissionRestartRequired?: PermissionGuideItemId | undefined;
  readonly skippedFirstRunAt?: string | undefined;
  readonly updatedAt: string;
  readonly version: 1;
};

export type OnboardingStartupTarget =
  | { readonly kind: 'app' }
  | {
      readonly focusItem?: PermissionGuideItemId | undefined;
      readonly kind: 'permission-guide';
      readonly reason: 'action-required' | 'first-run' | 'permission-restart-required';
    };

function currentIsoTimestamp() {
  return new Date().toISOString();
}

function isPermissionGuideItemId(value: unknown): value is PermissionGuideItemId {
  return isAppPermissionRowId(value) || value === 'voice';
}

function readPersistedOnboardingState(): PersistedOnboardingState | null {
  const rawValue = window.localStorage.getItem(ONBOARDING_STATE_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (record['version'] !== 1 || typeof record['hasSeenFirstRun'] !== 'boolean') {
      return null;
    }
    const restartMarker = record['permissionRestartRequired'];
    if (restartMarker !== undefined && !isPermissionGuideItemId(restartMarker)) {
      return null;
    }

    return {
      version: 1,
      hasSeenFirstRun: record['hasSeenFirstRun'],
      updatedAt:
        typeof record['updatedAt'] === 'string' ? record['updatedAt'] : currentIsoTimestamp(),
      ...(typeof record['skippedFirstRunAt'] === 'string'
        ? { skippedFirstRunAt: record['skippedFirstRunAt'] }
        : {}),
      ...(restartMarker ? { permissionRestartRequired: restartMarker } : {}),
    };
  } catch {
    return null;
  }
}

function writePersistedOnboardingState(state: PersistedOnboardingState): void {
  window.localStorage.setItem(ONBOARDING_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function readOnboardingStartupTarget(): OnboardingStartupTarget {
  const persistedState = readPersistedOnboardingState();
  if (!persistedState?.hasSeenFirstRun) {
    return { kind: 'permission-guide', reason: 'first-run' };
  }

  if (persistedState.permissionRestartRequired) {
    return {
      kind: 'permission-guide',
      reason: 'permission-restart-required',
      focusItem: persistedState.permissionRestartRequired,
    };
  }

  return { kind: 'app' };
}

export function markFirstRunGuideSkipped(): void {
  const now = currentIsoTimestamp();
  writePersistedOnboardingState({
    version: 1,
    hasSeenFirstRun: true,
    skippedFirstRunAt: now,
    updatedAt: now,
  });
}

export function writePermissionRestartRequired(permission: PermissionGuideItemId): void {
  const persistedState = readPersistedOnboardingState();
  writePersistedOnboardingState({
    version: 1,
    hasSeenFirstRun: persistedState?.hasSeenFirstRun ?? true,
    updatedAt: currentIsoTimestamp(),
    ...(persistedState?.skippedFirstRunAt
      ? { skippedFirstRunAt: persistedState.skippedFirstRunAt }
      : {}),
    permissionRestartRequired: permission,
  });
}

export function clearPermissionRestartRequired(permission?: PermissionGuideItemId): void {
  const persistedState = readPersistedOnboardingState();
  if (!persistedState?.permissionRestartRequired) {
    return;
  }
  if (permission && persistedState.permissionRestartRequired !== permission) {
    return;
  }

  writePersistedOnboardingState({
    version: 1,
    hasSeenFirstRun: persistedState.hasSeenFirstRun,
    updatedAt: currentIsoTimestamp(),
    ...(persistedState.skippedFirstRunAt
      ? { skippedFirstRunAt: persistedState.skippedFirstRunAt }
      : {}),
  });
}
