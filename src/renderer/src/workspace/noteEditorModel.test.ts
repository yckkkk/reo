import { describe, expect, it } from 'vitest';
import { savedNoteSegmentContentFromConflict } from './finalizedNoteContentSave';
import { readStaleNoteContentConflict } from './noteEditorModel';
import type { WorkspaceSession } from './workspaceApi';

const bodyTiptapJson = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Disk body', marks: [{ type: 'highlight' }] }],
    },
  ],
};

const workspaceSession = {
  workspaceHandle: 'workspace-handle',
  workspaceId: 'ws_note',
} as WorkspaceSession;

describe('noteEditorModel', () => {
  it('preserves Tiptap JSON on stale note content conflict accept', () => {
    const conflict = readStaleNoteContentConflict({
      code: 'ERR_SEGMENT_CONTENT_STALE',
      message: 'Note content changed on disk',
      currentBodyMarkdown: '==Disk body==',
      currentBodyTiptapJson: bodyTiptapJson,
      currentBaselineContentHash: 'a'.repeat(64),
      currentBaselineTiptapContentHash: 'b'.repeat(64),
    });

    expect(conflict).toEqual({
      currentBodyMarkdown: '==Disk body==',
      currentBodyTiptapJson: bodyTiptapJson,
      currentBaselineContentHash: 'a'.repeat(64),
      currentBaselineTiptapContentHash: 'b'.repeat(64),
    });

    expect(
      savedNoteSegmentContentFromConflict({
        conflict: conflict!,
        memoryId: 'mem_note',
        segmentId: 'seg_note',
        title: 'Note',
        workspaceSession,
      })
    ).toMatchObject({
      bodyMarkdown: '==Disk body==',
      bodyTiptapJson,
      baselineContentHash: 'a'.repeat(64),
      baselineTiptapContentHash: 'b'.repeat(64),
    });
  });
});
