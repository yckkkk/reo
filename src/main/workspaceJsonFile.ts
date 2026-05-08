import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { assertSameDirectoryIdentity, readSafeDirectoryIdentity } from './directoryIdentity.js';

export type WorkspaceJsonReadResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'missing' | 'invalid' }
  | { readonly status: 'read-error'; readonly error: unknown };

export async function readBoundedJsonNoFollow<T>({
  beforeFinalAssert,
  filePath,
  maxBytes,
  schema,
}: {
  readonly beforeFinalAssert?: (() => Promise<void> | void) | undefined;
  readonly filePath: string;
  readonly maxBytes: number;
  readonly schema: z.ZodType<T>;
}): Promise<WorkspaceJsonReadResult<T>> {
  let file: Awaited<ReturnType<typeof open>> | null = null;
  const directory = path.dirname(filePath);
  let directoryIdentity: Awaited<ReturnType<typeof readSafeDirectoryIdentity>>;

  try {
    directoryIdentity = await readSafeDirectoryIdentity(directory);
  } catch (error) {
    return errorCode(error) === 'ENOENT' ? { status: 'missing' } : { status: 'invalid' };
  }

  try {
    file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > maxBytes) {
      return { status: 'invalid' };
    }

    const value = schema.parse(JSON.parse(await file.readFile('utf8')));
    await beforeFinalAssert?.();
    await assertSameDirectoryIdentity(directory, directoryIdentity);
    return { status: 'ok', value };
  } catch (error) {
    const code = errorCode(error);
    if (code === 'ENOENT') {
      return { status: 'missing' };
    }
    if (code === 'ELOOP' || error instanceof SyntaxError || error instanceof z.ZodError) {
      return { status: 'invalid' };
    }
    return { status: 'read-error', error };
  } finally {
    await file?.close().catch(() => {});
  }
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}
