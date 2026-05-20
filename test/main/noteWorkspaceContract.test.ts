import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_CREATE_NOTE_SEGMENT_DRAFT_CHANNEL,
  WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_NOTE_SEGMENT_DRAFT_CHANNEL,
  WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL,
  WORKSPACE_IPC_CHANNELS,
  WORKSPACE_READ_SEGMENT_CONTENT_CHANNEL,
  WORKSPACE_READ_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL,
  WORKSPACE_WRITE_NOTE_SEGMENT_DRAFT_BODY_CHANNEL,
  WORKSPACE_WRITE_SEGMENT_CONTENT_CHANNEL,
  WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL,
  WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_BODY_CHANNEL,
} from '../../src/workspace-contract/workspace-channels.js';
import {
  workspaceCreateNoteSegmentDraftRequestSchema,
  workspaceCreateNoteSegmentDraftResponseSchema,
  workspaceCreateSegmentSupplementNoteDraftRequestSchema,
  workspaceCreateSegmentSupplementNoteDraftResponseSchema,
  workspaceFinalizeNoteSegmentDraftRequestSchema,
  workspaceFinalizeNoteSegmentDraftResponseSchema,
  workspaceFinalizeSegmentSupplementNoteDraftRequestSchema,
  workspaceFinalizeSegmentSupplementNoteDraftResponseSchema,
  workspaceReadSegmentContentRequestSchema,
  workspaceReadSegmentContentResponseSchema,
  workspaceReadSegmentSupplementContentRequestSchema,
  workspaceWriteNoteSegmentDraftBodyRequestSchema,
  workspaceWriteNoteSegmentDraftBodyResponseSchema,
  workspaceWriteSegmentContentRequestSchema,
  workspaceWriteSegmentContentResponseSchema,
  workspaceWriteSegmentSupplementContentRequestSchema,
  workspaceWriteSegmentSupplementNoteDraftBodyRequestSchema,
} from '../../src/workspace-contract/workspace-contract.js';

const workspaceHandle = 'workspace-handle';
const workspaceId = 'ws_note';
const memoryId = 'mem_note';
const segmentId = 'seg_note';
const supplementId = 'sup_note';
const baselineContentHash = 'a'.repeat(64);
const timestamp = '2026-05-19T12:00:00.000Z';
const memorySummary = {
  audioByteLength: 0,
  audioDurationMs: 0,
  audioSegmentCount: 0,
  createdAt: timestamp,
  hasAnyNote: true,
  hasAudioTranscript: false,
  memoryId,
  noteSegmentCount: 1,
  segmentCount: 1,
  supplementCount: 1,
  title: 'Memory',
  updatedAt: timestamp,
};
const noteSegment = {
  bodyByteLength: 7,
  createdAt: timestamp,
  memoryId,
  segmentId,
  supplementCount: 0,
  supplements: [],
  title: 'Note',
  type: 'note',
  updatedAt: timestamp,
  workspaceId,
};
const audioSegment = {
  audioByteLength: 1,
  createdAt: timestamp,
  durationMs: 1000,
  lastTranscriptionAttempt: 'never',
  memoryId,
  segmentId,
  supplementCount: 0,
  supplements: [],
  title: 'Audio',
  transcript: { exists: false },
  type: 'audio',
  updatedAt: timestamp,
  workspaceId,
};
const noteSupplement = {
  bodyByteLength: 15,
  createdAt: timestamp,
  memoryId,
  segmentId,
  supplementId,
  title: 'Supplement note',
  type: 'note',
  updatedAt: timestamp,
  workspaceId,
};
const audioSupplement = {
  audioByteLength: 1,
  createdAt: timestamp,
  durationMs: 1000,
  lastTranscriptionAttempt: 'never',
  memoryId,
  segmentId,
  supplementId,
  title: 'Supplement audio',
  transcript: { exists: false },
  type: 'audio',
  updatedAt: timestamp,
  workspaceId,
};

test('note draft and content IPC channels are explicit workspace channels', () => {
  assert.ok(WORKSPACE_IPC_CHANNELS.includes(WORKSPACE_CREATE_NOTE_SEGMENT_DRAFT_CHANNEL));
  assert.ok(
    WORKSPACE_IPC_CHANNELS.includes(WORKSPACE_CREATE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL)
  );
  assert.ok(WORKSPACE_IPC_CHANNELS.includes(WORKSPACE_WRITE_NOTE_SEGMENT_DRAFT_BODY_CHANNEL));
  assert.ok(
    WORKSPACE_IPC_CHANNELS.includes(WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_BODY_CHANNEL)
  );
  assert.ok(WORKSPACE_IPC_CHANNELS.includes(WORKSPACE_FINALIZE_NOTE_SEGMENT_DRAFT_CHANNEL));
  assert.ok(
    WORKSPACE_IPC_CHANNELS.includes(WORKSPACE_FINALIZE_SEGMENT_SUPPLEMENT_NOTE_DRAFT_CHANNEL)
  );
  assert.ok(WORKSPACE_IPC_CHANNELS.includes(WORKSPACE_READ_SEGMENT_CONTENT_CHANNEL));
  assert.ok(WORKSPACE_IPC_CHANNELS.includes(WORKSPACE_WRITE_SEGMENT_CONTENT_CHANNEL));
  assert.ok(WORKSPACE_IPC_CHANNELS.includes(WORKSPACE_READ_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL));
  assert.ok(WORKSPACE_IPC_CHANNELS.includes(WORKSPACE_WRITE_SEGMENT_SUPPLEMENT_CONTENT_CHANNEL));
});

test('note draft schemas keep body markdown separate from title and file paths', () => {
  assert.deepEqual(
    workspaceCreateNoteSegmentDraftRequestSchema.parse({
      workspaceHandle,
      workspaceId,
      memoryId,
      title: 'New note',
    }),
    {
      workspaceHandle,
      workspaceId,
      memoryId,
      title: 'New note',
    }
  );
  assert.deepEqual(
    workspaceWriteNoteSegmentDraftBodyRequestSchema.parse({
      workspaceHandle,
      segmentId,
      bodyMarkdown: '# Body\n',
      revision: 1,
    }),
    {
      workspaceHandle,
      segmentId,
      bodyMarkdown: '# Body\n',
      revision: 1,
    }
  );
  const createResponse = workspaceCreateNoteSegmentDraftResponseSchema.parse({
    ok: true,
    value: { segmentId, revision: 0 },
  });
  assert.equal(createResponse.ok, true);
  assert.equal(createResponse.value.segmentId, segmentId);
  const writeResponse = workspaceWriteNoteSegmentDraftBodyResponseSchema.parse({
    ok: true,
    value: { bodyByteLength: 7, revision: 2 },
  });
  assert.equal(writeResponse.ok, true);
  assert.equal(writeResponse.value.bodyByteLength, 7);
});

test('note supplement draft schemas carry parent identity', () => {
  assert.deepEqual(
    workspaceCreateSegmentSupplementNoteDraftRequestSchema.parse({
      workspaceHandle,
      workspaceId,
      memoryId,
      segmentId,
      title: 'Supplement note',
    }),
    {
      workspaceHandle,
      workspaceId,
      memoryId,
      segmentId,
      title: 'Supplement note',
    }
  );
  assert.deepEqual(
    workspaceWriteSegmentSupplementNoteDraftBodyRequestSchema.parse({
      workspaceHandle,
      supplementId,
      bodyMarkdown: 'Supplement body',
      revision: 3,
    }),
    {
      workspaceHandle,
      supplementId,
      bodyMarkdown: 'Supplement body',
      revision: 3,
    }
  );
  const createSupplementResponse = workspaceCreateSegmentSupplementNoteDraftResponseSchema.parse({
    ok: true,
    value: { revision: 0, supplementId },
  });
  assert.equal(createSupplementResponse.ok, true);
  assert.equal(createSupplementResponse.value.supplementId, supplementId);
});

test('note finalize and content schemas expose projections without absolute paths', () => {
  assert.deepEqual(
    workspaceFinalizeNoteSegmentDraftRequestSchema.parse({
      workspaceHandle,
      workspaceId,
      memoryId,
      segmentId,
      title: 'Final note',
    }),
    {
      workspaceHandle,
      workspaceId,
      memoryId,
      segmentId,
      title: 'Final note',
    }
  );
  assert.deepEqual(
    workspaceFinalizeSegmentSupplementNoteDraftRequestSchema.parse({
      workspaceHandle,
      workspaceId,
      memoryId,
      segmentId,
      supplementId,
      title: 'Final supplement',
    }),
    {
      workspaceHandle,
      workspaceId,
      memoryId,
      segmentId,
      supplementId,
      title: 'Final supplement',
    }
  );
  assert.deepEqual(
    workspaceReadSegmentContentRequestSchema.parse({
      workspaceHandle,
      workspaceId,
      memoryId,
      segmentId,
      requestId: 'request-1',
    }),
    {
      workspaceHandle,
      workspaceId,
      memoryId,
      segmentId,
      requestId: 'request-1',
    }
  );
  const readContentResponse = workspaceReadSegmentContentResponseSchema.parse({
    ok: true,
    value: {
      requestId: 'request-1',
      workspaceId,
      memoryId,
      segmentId,
      type: 'note',
      title: 'Final note',
      bodyMarkdown: '# Body\n',
      bodyByteLength: 7,
      baselineContentHash,
    },
  });
  assert.equal(readContentResponse.ok, true);
  assert.equal(readContentResponse.value.bodyMarkdown, '# Body\n');
  assert.deepEqual(
    workspaceWriteSegmentContentRequestSchema.parse({
      workspaceHandle,
      workspaceId,
      memoryId,
      segmentId,
      bodyMarkdown: '# Replacement\n',
      baselineContentHash,
    }),
    {
      workspaceHandle,
      workspaceId,
      memoryId,
      segmentId,
      bodyMarkdown: '# Replacement\n',
      baselineContentHash,
    }
  );
  const writeContentResponse = workspaceWriteSegmentContentResponseSchema.parse({
    ok: true,
    value: { bodyByteLength: 14, baselineContentHash, saved: true },
  });
  assert.equal(writeContentResponse.ok, true);
  assert.equal(writeContentResponse.value.saved, true);
  assert.equal(
    workspaceFinalizeNoteSegmentDraftResponseSchema.safeParse({
      ok: true,
      value: {
        memory: { memoryId },
        segment: { segmentId, type: 'note' },
        rootPath: '/tmp/reo',
      },
    }).success,
    false
  );
  assert.equal(
    workspaceFinalizeSegmentSupplementNoteDraftResponseSchema.safeParse({
      ok: true,
      value: {
        memory: { memoryId },
        segment: { segmentId, type: 'note' },
        supplement: { supplementId, type: 'note' },
        rootPath: '/tmp/reo',
      },
    }).success,
    false
  );
  assert.equal(
    workspaceFinalizeNoteSegmentDraftResponseSchema.safeParse({
      ok: true,
      value: {
        memory: memorySummary,
        segment: noteSegment,
      },
    }).success,
    true
  );
  assert.equal(
    workspaceFinalizeNoteSegmentDraftResponseSchema.safeParse({
      ok: true,
      value: {
        memory: memorySummary,
        segment: audioSegment,
      },
    }).success,
    false
  );
  assert.equal(
    workspaceFinalizeSegmentSupplementNoteDraftResponseSchema.safeParse({
      ok: true,
      value: {
        memory: memorySummary,
        segment: noteSegment,
        supplement: noteSupplement,
      },
    }).success,
    true
  );
  assert.equal(
    workspaceFinalizeSegmentSupplementNoteDraftResponseSchema.safeParse({
      ok: true,
      value: {
        memory: memorySummary,
        segment: noteSegment,
        supplement: audioSupplement,
      },
    }).success,
    false
  );
  const readSupplementRequest = workspaceReadSegmentSupplementContentRequestSchema.parse({
    workspaceHandle,
    workspaceId,
    memoryId,
    segmentId,
    supplementId,
    requestId: 'request-2',
  });
  assert.equal(readSupplementRequest.supplementId, supplementId);
  const writeSupplementRequest = workspaceWriteSegmentSupplementContentRequestSchema.parse({
    workspaceHandle,
    workspaceId,
    memoryId,
    segmentId,
    supplementId,
    bodyMarkdown: 'Replacement',
    baselineContentHash,
  });
  assert.equal(writeSupplementRequest.supplementId, supplementId);
});
