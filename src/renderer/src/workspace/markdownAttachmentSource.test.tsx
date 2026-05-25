import { describe, expect, it } from 'vitest';
import {
  resolveMarkdownImageSource,
  type MarkdownAttachmentContext,
} from './markdownAttachmentSource';

const segmentAttachmentContext: MarkdownAttachmentContext = {
  kind: 'segment',
  workspaceId: 'ws_1',
  segmentId: 'seg_1',
};

describe('resolveMarkdownImageSource', () => {
  it('maps note attachment references to the readonly attachment protocol', () => {
    expect(resolveMarkdownImageSource('attachments/cake.png', segmentAttachmentContext)).toBe(
      'reo-attachment://ws_1/segments/seg_1/cake.png'
    );
  });

  it('encodes attachment filenames before building protocol URLs', () => {
    expect(
      resolveMarkdownImageSource('attachments/cake plan#1.png', segmentAttachmentContext)
    ).toBe('reo-attachment://ws_1/segments/seg_1/cake%20plan%231.png');
  });

  it('does not turn unsupported image schemes into loadable renderer sources', () => {
    expect(
      resolveMarkdownImageSource('https://example.test/cake.png', segmentAttachmentContext)
    ).toBeNull();
    expect(resolveMarkdownImageSource('/tmp/cake.png', segmentAttachmentContext)).toBeNull();
    expect(resolveMarkdownImageSource('file:///tmp/cake.png', segmentAttachmentContext)).toBeNull();
  });
});
