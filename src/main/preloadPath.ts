import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolvePreloadPath(mainModuleUrl: string): string {
  return path.join(path.dirname(fileURLToPath(mainModuleUrl)), '../preload/index.cjs');
}
