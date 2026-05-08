export function isSafeWorkspaceDirectoryName(directoryName: string): boolean {
  return (
    directoryName.trim() === directoryName &&
    directoryName.length > 0 &&
    directoryName !== '.' &&
    directoryName !== '..' &&
    !/[\\/\0]/.test(directoryName)
  );
}
