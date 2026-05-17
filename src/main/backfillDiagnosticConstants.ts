export const BACKFILL_SCAN_FAILED_ERROR_CODE = 'scan-failed';
export const BACKFILL_SCAN_DIAGNOSTIC_EVENTS = [
  'scan-completed',
  BACKFILL_SCAN_FAILED_ERROR_CODE,
  'scan-started',
] as const;
