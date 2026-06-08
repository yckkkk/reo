export const APP_PERMISSION_IDS = ['microphone', 'camera', 'accessibility'] as const;

export type AppPermissionRowId = (typeof APP_PERMISSION_IDS)[number];

export function isAppPermissionRowId(value: unknown): value is AppPermissionRowId {
  return APP_PERMISSION_IDS.includes(value as AppPermissionRowId);
}
