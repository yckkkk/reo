import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeWorkspaceFileAtomic(
  filePath: string,
  data: string | Uint8Array
): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.part`
  );
  await writeFile(tempPath, data, { flag: 'wx' });
  await rename(tempPath, filePath);
}

export async function writeWorkspaceJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await writeWorkspaceFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
