import { describe, expect, it } from 'vitest';
import { savedNoteSegmentContentFromConflict } from './finalizedNoteContentSave';
import { deriveNoteTitleFromMarkdown, readStaleNoteContentConflict } from './noteEditorModel';
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
  it('derives a note title from the first meaningful body line', () => {
    expect(
      deriveNoteTitleFromMarkdown('\n\n# Meeting recap\n\nFollow-up body.', '未命名笔记')
    ).toBe('Meeting recap');
    expect(
      deriveNoteTitleFromMarkdown('\n- [ ] Buy replacement batteries\nDetails', '未命名笔记')
    ).toBe('Buy replacement batteries');
    expect(deriveNoteTitleFromMarkdown('\n\n   \n', '未命名补充笔记')).toBe('未命名补充笔记');
  });

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
