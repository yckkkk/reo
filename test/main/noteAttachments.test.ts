import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createMemoryFromFileTruth,
  memorySegmentDirectory,
  resolveSegmentSupplementDirectoryInSegmentDirectory,
} from '../../src/main/memoryFiles.js';
import {
  createNoteSegmentDraft,
  createSegmentSupplementNoteDraft,
  finalizeNoteSegmentDraft,
  finalizeSegmentSupplementNoteDraft,
  writeNoteSegmentDraftBody,
  writeSegmentSupplementNoteDraftBody,
} from '../../src/main/noteDrafts.js';
import { createWorkspaceHandleStore } from '../../src/main/workspaceHandles.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';
import type {
  TrustedSenderEventAdapter,
  TrustedSenderIdentity,
} from '../../src/main/trustedSender.js';
import type { WorkspaceErrorEnvelope } from '../../src/workspace-contract/workspace-contract.js';

const expectedSession = { label: 'default-session' };
const sender: TrustedSenderIdentity = {
  processId: 7,
  frameRoutingId: 4,
  origin: 'reo-app://renderer',
  sessionKey: 'default',
};
const event: TrustedSenderEventAdapter = {
  processId: 7,
  sender: { session: expectedSession },
  senderFrame: {
    routingId: 4,
    topRoutingId: 4,
    url: 'reo-app://renderer/index.html',
  },
};
const onePixelPng = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  )
);

type AttachmentResult =
  | {
      readonly ok: true;
      readonly relativePath: string;
    }
  | WorkspaceErrorEnvelope;

type AttachmentListResult =
  | {
      readonly ok: true;
      readonly attachments: readonly {
        readonly relativePath: string;
        readonly byteLength: number;
        readonly mimeType: string;
      }[];
    }
  | WorkspaceErrorEnvelope;

type SaveSegmentAttachment = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly payload: Uint8Array;
}) => Promise<AttachmentResult>;

type SaveSegmentSupplementAttachment = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly payload: Uint8Array;
}) => Promise<AttachmentResult>;

type ListSegmentAttachments = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
}) => Promise<AttachmentListResult>;

type ListSegmentSupplementAttachments = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly memoryId: string;
  readonly segmentId: string;
  readonly supplementId: string;
}) => Promise<AttachmentListResult>;

type ResolveSegmentAttachment = (input: {
  readonly rootPath: string;
  readonly workspaceId: string;
  readonly segmentId: string;
  readonly filename: string;
}) => Promise<
  | {
      readonly ok: true;
      readonly bytes: Uint8Array;
      readonly mimeType: string;
    }
  | WorkspaceErrorEnvelope
>;

type IpcHandler = (input: {
  readonly event: TrustedSenderEventAdapter;
  readonly input: unknown;
  readonly expectedSession: unknown;
  readonly expectedSessionKey: string;
  readonly isTrustedUrl: (url: string) => boolean;
  readonly handleStore: ReturnType<typeof createWorkspaceHandleStore>;
}) => Promise<unknown>;

async function loadAttachmentApi(): Promise<{
  readonly saveNoteSegmentAttachment: SaveSegmentAttachment;
  readonly saveNoteSegmentSupplementAttachment: SaveSegmentSupplementAttachment;
  readonly listNoteSegmentAttachments: ListSegmentAttachments;
  readonly listNoteSegmentSupplementAttachments: ListSegmentSupplementAttachments;
  readonly resolveNoteSegmentAttachmentFile: ResolveSegmentAttachment;
}> {
  const module = (await import('../../src/main/' + 'noteAttachments.js')) as Record<
    string,
    unknown
  >;
  return {
    saveNoteSegmentAttachment: requireFunction<SaveSegmentAttachment>(
      module,
      'saveNoteSegmentAttachment'
    ),
    saveNoteSegmentSupplementAttachment: requireFunction<SaveSegmentSupplementAttachment>(
      module,
      'saveNoteSegmentSupplementAttachment'
    ),
    listNoteSegmentAttachments: requireFunction<ListSegmentAttachments>(
      module,
      'listNoteSegmentAttachments'
    ),
    listNoteSegmentSupplementAttachments: requireFunction<ListSegmentSupplementAttachments>(
      module,
      'listNoteSegmentSupplementAttachments'
    ),
    resolveNoteSegmentAttachmentFile: requireFunction<ResolveSegmentAttachment>(
      module,
      'resolveNoteSegmentAttachmentFile'
    ),
  };
}

function requireFunction<T extends (...args: never[]) => unknown>(
  module: Record<string, unknown>,
  name: string
): T {
  const value = module[name];
  assert.equal(typeof value, 'function', `${name} should be exported`);
  return value as T;
}

async function workspaceRoot(): Promise<string> {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-note-attachments-'));
  await initializeWorkspaceFiles({
    rootPath,
    title: 'Attachment workspace',
    description: '',
    createWorkspaceId: () => 'ws_attach',
    now: () => '2026-05-19T13:20:00.000Z',
  });
  return rootPath;
}

async function createFinalizedNoteSegment(rootPath: string): Promise<void> {
  const memory = await createMemoryFromFileTruth({
    rootPath,
    memoryId: 'mem_attach',
    title: 'Attachment memory',
    now: () => '2026-05-19T13:21:00.000Z',
  });
  assert.equal(memory.ok, true);
  const draft = await createNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_attach',
    memoryId: 'mem_attach',
    title: 'Attachment segment',
    createSegmentId: () => 'seg_attach',
    now: () => '2026-05-19T13:22:00.000Z',
  });
  assert.equal(draft.ok, true);
  const write = await writeNoteSegmentDraftBody({
    rootPath,
    segmentId: 'seg_attach',
    bodyMarkdown: 'Body before image.\n',
    revision: 0,
  });
  assert.equal(write.ok, true);
  const finalized = await finalizeNoteSegmentDraft({
    rootPath,
    workspaceId: 'ws_attach',
    memoryId: 'mem_attach',
    segmentId: 'seg_attach',
    title: 'Attachment segment',
    now: () => '2026-05-19T13:23:00.000Z',
  });
  assert.equal(finalized.ok, true, JSON.stringify(finalized));
}

async function createFinalizedNoteSupplement(rootPath: string): Promise<void> {
  await createFinalizedNoteSegment(rootPath);
  const draft = await createSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_attach',
    memoryId: 'mem_attach',
    segmentId: 'seg_attach',
    title: 'Attachment supplement',
    createSupplementId: () => 'sup_attach',
    now: () => '2026-05-19T13:24:00.000Z',
  });
  assert.equal(draft.ok, true);
  const write = await writeSegmentSupplementNoteDraftBody({
    rootPath,
    supplementId: 'sup_attach',
    bodyMarkdown: 'Supplement body.\n',
    revision: 0,
  });
  assert.equal(write.ok, true);
  const finalized = await finalizeSegmentSupplementNoteDraft({
    rootPath,
    workspaceId: 'ws_attach',
    memoryId: 'mem_attach',
    segmentId: 'seg_attach',
    supplementId: 'sup_attach',
    title: 'Attachment supplement',
    now: () => '2026-05-19T13:25:00.000Z',
  });
  assert.equal(finalized.ok, true, JSON.stringify(finalized));
}

function assertTypedError(result: unknown, code: string): void {
  assert.equal(typeof result, 'object');
  assert.notEqual(result, null);
  const candidate = result as {
    readonly ok?: unknown;
    readonly error?: { readonly code?: unknown };
  };
  assert.equal(candidate.ok, false);
  assert.equal(candidate.error?.code, code);
}

function createRegisteredHandleStore(rootPath: string) {
  const handleStore = createWorkspaceHandleStore({ createHandle: () => 'wh_attach' });
  handleStore.register({
    canonicalRoot: rootPath,
    workspaceId: 'ws_attach',
    sender,
    lock: {
      isHeld: () => true,
      isUsable: () => true,
      relocate: () => ({ ok: true }),
      release: async () => {},
    },
  });
  return handleStore;
}

function ipcOptions({
  handleStore,
  input,
  customEvent = event,
}: {
  readonly handleStore: ReturnType<typeof createWorkspaceHandleStore>;
  readonly input: unknown;
  readonly customEvent?: TrustedSenderEventAdapter;
}) {
  return {
    event: customEvent,
    input,
    expectedSession,
    expectedSessionKey: 'default',
    isTrustedUrl: (url: string) => url.startsWith('reo-app://renderer/'),
    handleStore,
  };
}

test('note segment attachment save creates attachment file truth and returns only a relative path', async () => {
  const api = await loadAttachmentApi();
  const rootPath = await workspaceRoot();
  await createFinalizedNoteSegment(rootPath);

  const saved = await api.saveNoteSegmentAttachment({
    rootPath,
    workspaceId: 'ws_attach',
    memoryId: 'mem_attach',
    segmentId: 'seg_attach',
    originalFilename: '../figure.png',
    mimeType: 'image/png',
    payload: onePixelPng,
  });

  assert.equal(saved.ok, true, JSON.stringify(saved));
  if (saved.ok) {
    assert.match(saved.relativePath, /^attachments\/[a-f0-9]{12}--figure\.png$/);
    assert.equal(saved.relativePath.includes(rootPath), false);
    assert.equal(path.isAbsolute(saved.relativePath), false);

    const segmentDirectory = await memorySegmentDirectory(rootPath, 'mem_attach', 'seg_attach');
    const filePath = path.join(segmentDirectory, saved.relativePath);
    assert.deepEqual(await readFile(filePath), Buffer.from(onePixelPng));
  }
});

test('note segment attachment save accepts a stale note body byte length manifest', async () => {
  const api = await loadAttachmentApi();
  const rootPath = await workspaceRoot();
  await createFinalizedNoteSegment(rootPath);
  const manifestPath = path.join(rootPath, '.reo', 'objects', 'segments', 'seg_attach.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    bodyByteLength: number;
  };
  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...manifest, bodyByteLength: manifest.bodyByteLength + 1 }, null, 2)}\n`
  );

  const saved = await api.saveNoteSegmentAttachment({
    rootPath,
    workspaceId: 'ws_attach',
    memoryId: 'mem_attach',
    segmentId: 'seg_attach',
    originalFilename: 'runtime-paste.png',
    mimeType: 'image/png',
    payload: onePixelPng,
  });

  assert.equal(saved.ok, true, JSON.stringify(saved));
});

test('note supplement attachment save writes under the supplement-owned attachments directory', async () => {
  const api = await loadAttachmentApi();
  const rootPath = await workspaceRoot();
  await createFinalizedNoteSupplement(rootPath);

  const saved = await api.saveNoteSegmentSupplementAttachment({
    rootPath,
    workspaceId: 'ws_attach',
    memoryId: 'mem_attach',
    segmentId: 'seg_attach',
    supplementId: 'sup_attach',
    originalFilename: 'supplement image.webp',
    mimeType: 'image/webp',
    payload: Uint8Array.from([1, 2, 3, 4]),
  });

  assert.equal(saved.ok, true, JSON.stringify(saved));
  if (saved.ok) {
    const segmentDirectory = await memorySegmentDirectory(rootPath, 'mem_attach', 'seg_attach');
    const supplementDirectory = await resolveSegmentSupplementDirectoryInSegmentDirectory({
      rootPath,
      memoryId: 'mem_attach',
      segmentDirectory,
      segmentId: 'seg_attach',
      supplementId: 'sup_attach',
    });
    assert.deepEqual(
      await readFile(path.join(supplementDirectory, saved.relativePath)),
      Buffer.from([1, 2, 3, 4])
    );
    await assert.rejects(stat(path.join(segmentDirectory, saved.relativePath)), /ENOENT/);
  }
});

test('attachment list returns metadata and never follows unsafe symlink leaves', async () => {
  const api = await loadAttachmentApi();
  const rootPath = await workspaceRoot();
  await createFinalizedNoteSegment(rootPath);
  const saved = await api.saveNoteSegmentAttachment({
    rootPath,
    workspaceId: 'ws_attach',
    memoryId: 'mem_attach',
    segmentId: 'seg_attach',
    originalFilename: 'safe.png',
    mimeType: 'image/png',
    payload: onePixelPng,
  });
  assert.equal(saved.ok, true, JSON.stringify(saved));
  const segmentDirectory = await memorySegmentDirectory(rootPath, 'mem_attach', 'seg_attach');
  const attachmentsDirectory = path.join(segmentDirectory, 'attachments');
  await symlink(
    path.join(os.tmpdir(), 'reo-unsafe-target.png'),
    path.join(attachmentsDirectory, 'bad.png')
  );

  const listed = await api.listNoteSegmentAttachments({
    rootPath,
    workspaceId: 'ws_attach',
    memoryId: 'mem_attach',
    segmentId: 'seg_attach',
  });

  if (listed.ok) {
    assert.deepEqual(listed.attachments, [
      {
        relativePath: saved.relativePath,
        byteLength: onePixelPng.byteLength,
        mimeType: 'image/png',
      },
    ]);
  } else {
    assert.equal(listed.error.code, 'ERR_WORKSPACE_UNSAFE_PATH');
  }
});

test('attachment protocol resolution does not create a missing attachments directory', async () => {
  const api = await loadAttachmentApi();
  const rootPath = await workspaceRoot();
  await createFinalizedNoteSegment(rootPath);
  const segmentDirectory = await memorySegmentDirectory(rootPath, 'mem_attach', 'seg_attach');
  const attachmentsDirectory = path.join(segmentDirectory, 'attachments');

  const resolved = await api.resolveNoteSegmentAttachmentFile({
    rootPath,
    workspaceId: 'ws_attach',
    segmentId: 'seg_attach',
    filename: 'missing.png',
  });

  assertTypedError(resolved, 'ERR_WORKSPACE_ATTACHMENT_NOT_FOUND');
  await assert.rejects(stat(attachmentsDirectory), /ENOENT/);
});

test('attachment protocol resolution returns bytes without raw filesystem paths', async () => {
  const api = await loadAttachmentApi();
  const rootPath = await workspaceRoot();
  await createFinalizedNoteSegment(rootPath);
  const saved = await api.saveNoteSegmentAttachment({
    rootPath,
    workspaceId: 'ws_attach',
    memoryId: 'mem_attach',
    segmentId: 'seg_attach',
    originalFilename: 'safe.png',
    mimeType: 'image/png',
    payload: onePixelPng,
  });
  assert.equal(saved.ok, true, JSON.stringify(saved));
  assert.equal(saved.ok && saved.relativePath.startsWith('attachments/'), true);

  const resolved = await api.resolveNoteSegmentAttachmentFile({
    rootPath,
    workspaceId: 'ws_attach',
    segmentId: 'seg_attach',
    filename: saved.ok ? path.basename(saved.relativePath) : 'missing.png',
  });

  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  if (resolved.ok) {
    assert.deepEqual(Buffer.from(resolved.bytes), Buffer.from(onePixelPng));
    assert.equal(resolved.mimeType, 'image/png');
    assert.equal('absolutePath' in resolved, false);
  }
});

test('attachment save validation returns typed error envelopes', async () => {
  const api = await loadAttachmentApi();
  const rootPath = await workspaceRoot();
  await createFinalizedNoteSupplement(rootPath);

  assertTypedError(
    await api.saveNoteSegmentAttachment({
      rootPath,
      workspaceId: 'ws_attach',
      memoryId: 'mem_attach',
      segmentId: 'seg_attach',
      originalFilename: 'vector.svg',
      mimeType: 'image/svg+xml',
      payload: Uint8Array.from([60, 115, 118, 103, 62]),
    }),
    'ERR_ATTACHMENT_UNSUPPORTED_MIME'
  );

  assertTypedError(
    await api.saveNoteSegmentAttachment({
      rootPath,
      workspaceId: 'ws_attach',
      memoryId: 'mem_attach',
      segmentId: 'seg_attach',
      originalFilename: 'unsupported.avif',
      mimeType: 'image/avif',
      payload: Uint8Array.from([1, 2, 3]),
    }),
    'ERR_ATTACHMENT_UNSUPPORTED_MIME'
  );

  assertTypedError(
    await api.saveNoteSegmentAttachment({
      rootPath,
      workspaceId: 'ws_attach',
      memoryId: 'mem_attach',
      segmentId: 'seg_attach',
      originalFilename: 'too-large.png',
      mimeType: 'image/png',
      payload: new Uint8Array(25 * 1024 * 1024 + 1),
    }),
    'ERR_ATTACHMENT_TOO_LARGE'
  );

  assertTypedError(
    await api.saveNoteSegmentSupplementAttachment({
      rootPath,
      workspaceId: 'ws_attach',
      memoryId: 'mem_attach',
      segmentId: 'seg_attach',
      supplementId: 'sup_missing',
      originalFilename: 'orphan.png',
      mimeType: 'image/png',
      payload: onePixelPng,
    }),
    'ERR_WORKSPACE_SEGMENT_SUPPLEMENT_NOT_FOUND'
  );
});

test('attachment protocol resolution rejects externally-created oversized files before reading', async () => {
  const api = await loadAttachmentApi();
  const rootPath = await workspaceRoot();
  await createFinalizedNoteSegment(rootPath);
  const segmentDirectory = await memorySegmentDirectory(rootPath, 'mem_attach', 'seg_attach');
  const attachmentsDirectory = path.join(segmentDirectory, 'attachments');
  await mkdir(attachmentsDirectory);
  const oversizedFilename = 'external-oversized.png';
  await writeFile(
    path.join(attachmentsDirectory, oversizedFilename),
    new Uint8Array(25 * 1024 * 1024 + 1)
  );

  assertTypedError(
    await api.resolveNoteSegmentAttachmentFile({
      rootPath,
      workspaceId: 'ws_attach',
      segmentId: 'seg_attach',
      filename: oversizedFilename,
    }),
    'ERR_ATTACHMENT_TOO_LARGE'
  );
});

test('attachment IPC contract exposes explicit channels and typed handler errors', async () => {
  const channels = (await import('../../src/workspace-contract/workspace-channels.js')) as Record<
    string,
    unknown
  >;
  assert.equal(
    channels['WORKSPACE_SAVE_SEGMENT_ATTACHMENT_CHANNEL'],
    'workspace:saveSegmentAttachment'
  );
  assert.equal(
    channels['WORKSPACE_LIST_SEGMENT_ATTACHMENTS_CHANNEL'],
    'workspace:listSegmentAttachments'
  );
  assert.equal(
    channels['WORKSPACE_SAVE_SEGMENT_SUPPLEMENT_ATTACHMENT_CHANNEL'],
    'workspace:saveSegmentSupplementAttachment'
  );
  assert.equal(
    channels['WORKSPACE_LIST_SEGMENT_SUPPLEMENT_ATTACHMENTS_CHANNEL'],
    'workspace:listSegmentSupplementAttachments'
  );

  const workspaceIpc = (await import('../../src/main/workspaceIpc.js')) as Record<string, unknown>;
  const saveSegment = requireFunction<IpcHandler>(
    workspaceIpc,
    'handleSaveSegmentAttachmentForTest'
  );
  const listSegment = requireFunction<IpcHandler>(
    workspaceIpc,
    'handleListSegmentAttachmentsForTest'
  );
  const rootPath = await workspaceRoot();
  await createFinalizedNoteSegment(rootPath);
  const handleStore = createRegisteredHandleStore(rootPath);

  assertTypedError(
    await saveSegment(
      ipcOptions({
        handleStore,
        input: {
          workspaceHandle: 'wh_attach',
          workspaceId: 'ws_other',
          memoryId: 'mem_attach',
          segmentId: 'seg_attach',
          originalFilename: 'wrong-workspace.png',
          mimeType: 'image/png',
          payload: onePixelPng,
        },
      })
    ),
    'ERR_WORKSPACE_HANDLE_WORKSPACE_MISMATCH'
  );

  const untrustedEvent: TrustedSenderEventAdapter = {
    ...event,
    senderFrame: {
      routingId: 4,
      topRoutingId: 4,
      url: 'https://example.com/renderer',
    },
  };
  assertTypedError(
    await listSegment(
      ipcOptions({
        handleStore,
        customEvent: untrustedEvent,
        input: {
          workspaceHandle: 'wh_attach',
          workspaceId: 'ws_attach',
          memoryId: 'mem_attach',
          segmentId: 'seg_attach',
        },
      })
    ),
    'ERR_WORKSPACE_UNTRUSTED_SENDER'
  );
});

test('attachment IPC success response returns relative metadata without raw paths', async () => {
  const workspaceIpc = (await import('../../src/main/workspaceIpc.js')) as Record<string, unknown>;
  const saveSupplement = requireFunction<IpcHandler>(
    workspaceIpc,
    'handleSaveSegmentSupplementAttachmentForTest'
  );
  const listSupplement = requireFunction<IpcHandler>(
    workspaceIpc,
    'handleListSegmentSupplementAttachmentsForTest'
  );
  const rootPath = await workspaceRoot();
  await createFinalizedNoteSupplement(rootPath);
  const handleStore = createRegisteredHandleStore(rootPath);

  const saved = await saveSupplement(
    ipcOptions({
      handleStore,
      input: {
        workspaceHandle: 'wh_attach',
        workspaceId: 'ws_attach',
        memoryId: 'mem_attach',
        segmentId: 'seg_attach',
        supplementId: 'sup_attach',
        originalFilename: 'supplement.png',
        mimeType: 'image/png',
        payload: onePixelPng,
      },
    })
  );

  assert.equal(typeof saved, 'object');
  assert.notEqual(saved, null);
  assert.equal((saved as { readonly ok?: unknown }).ok, true);
  assert.equal(JSON.stringify(saved).includes(rootPath), false);

  const listed = await listSupplement(
    ipcOptions({
      handleStore,
      input: {
        workspaceHandle: 'wh_attach',
        workspaceId: 'ws_attach',
        memoryId: 'mem_attach',
        segmentId: 'seg_attach',
        supplementId: 'sup_attach',
      },
    })
  );
  assert.equal(typeof listed, 'object');
  assert.notEqual(listed, null);
  assert.equal((listed as { readonly ok?: unknown }).ok, true);
  assert.equal(JSON.stringify(listed).includes(rootPath), false);
});
