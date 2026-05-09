export function isSafeWorkspaceDirectoryName(value: string): boolean {
  return (
    value.trim() === value &&
    value.length > 0 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('\0')
  );
}
