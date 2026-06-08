import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  GALLERY_PHYSICAL_SLOTS,
  generateGalleryNodes,
  rowVerticalOffset,
  shouldLoadInitialCover,
} from './galleryModel';
import { shouldLoadGalleryCoverImage } from './galleryCoverLoading';
import { WorkspaceLibraryPage } from './WorkspaceLibraryPage';
import type { WorkspaceRecentExpressionItem } from './workspaceApi';

function recentExpression(
  input: Partial<WorkspaceRecentExpressionItem> & {
    readonly id: string;
    readonly contentKind: WorkspaceRecentExpressionItem['contentKind'];
    readonly title: string;
  }
): WorkspaceRecentExpressionItem {
  return {
    workspaceId: 'ws_gallery',
    workspaceTitle: '画廊空间',
    memoryId: 'mem_gallery',
    memoryTitle: '画廊记忆',
    segmentId: 'seg_gallery',
    objectType: 'segment',
    createdAt: '2026-06-06T20:00:00.000Z',
    updatedAt: '2026-06-06T20:00:00.000Z',
    ...input,
  } as WorkspaceRecentExpressionItem;
}

function mockElementRect(
  element: Element | null,
  rect: Pick<DOMRectReadOnly, 'height' | 'left' | 'top' | 'width'>
) {
  if (!(element instanceof HTMLElement)) {
    throw new Error('Expected HTMLElement for rect mock');
  }
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        bottom: rect.top + rect.height,
        height: rect.height,
        left: rect.left,
        right: rect.left + rect.width,
        top: rect.top,
        width: rect.width,
        x: rect.left,
        y: rect.top,
      }) as DOMRect
  );
}

function mockPointerCapture(element: HTMLElement) {
  element.setPointerCapture = vi.fn();
  element.releasePointerCapture = vi.fn();
  element.hasPointerCapture = vi.fn(() => true);
}

function cardRotationFromTransform(transform: string | undefined) {
  return Number(transform?.match(/rotateY\((-?[\d.]+)rad\)/)?.[1] ?? 0);
}

describe('WorkspaceLibraryPage', () => {
  it('renders audio and note cards with segment covers and filters artifacts', () => {
    const onOpenExpression = vi.fn();
    const audioExpression = recentExpression({
      id: 'audio-1',
      contentKind: 'audio',
      title: '访谈录音',
      preview: '录音转写摘要',
      cover: { source: 'custom', filename: 'voice.webp', version: '177-42' },
    });
    const { container } = render(
      <WorkspaceLibraryPage
        expressions={[
          audioExpression,
          recentExpression({
            id: 'note-1',
            contentKind: 'note',
            title: '产品笔记',
            preview: '笔记正文摘要',
          }),
          recentExpression({
            id: 'artifact-1',
            contentKind: 'artifact',
            title: '互动作品',
          }),
        ]}
        onOpenExpression={onOpenExpression}
      />
    );

    expect(container.querySelector('[aria-label="录音和笔记"]')).toBeInstanceOf(HTMLElement);
    const audioCard = container.querySelector(
      '[aria-label="打开内容 访谈录音"]'
    ) as HTMLButtonElement | null;
    const noteCard = container.querySelector(
      '[aria-label="打开内容 产品笔记"]'
    ) as HTMLButtonElement | null;
    expect(audioCard).toHaveTextContent('录音转写摘要');
    expect(noteCard).toHaveTextContent('笔记正文摘要');
    expect(container).not.toHaveTextContent('互动作品');
    const audioCover = audioCard?.querySelector('img');
    expect(audioCover).toHaveAttribute(
      'data-gallery-cover-src',
      'reo-attachment://ws_gallery/segments/seg_gallery/cover/voice.webp?v=177-42'
    );
    expect(audioCover).toHaveAttribute('alt', '');

    audioCard?.click();
    expect(onOpenExpression).toHaveBeenCalledWith(audioExpression);
  });

  it('keeps expensive cover work off non-front cards', () => {
    const nodes = generateGalleryNodes();
    const backIndex = nodes.findIndex((node) => !shouldLoadInitialCover(node));
    const frontIndex = nodes.findIndex(shouldLoadInitialCover);
    const expressions = Array.from({ length: GALLERY_PHYSICAL_SLOTS }, (_, index) =>
      recentExpression({
        id: `note-${index}`,
        contentKind: 'note',
        segmentId: `seg_gallery_${index}`,
        title:
          index === backIndex ? '背面笔记' : index === frontIndex ? '前景笔记' : `笔记 ${index}`,
        cover: {
          source: 'custom',
          filename: `cover-${index}.webp`,
          version: '177-42',
        },
      })
    );

    const { container } = render(<WorkspaceLibraryPage expressions={expressions} />);

    expect(document.querySelectorAll('[data-gallery-row]')).toHaveLength(5);
    const backCard = container.querySelector(
      '[aria-label="打开内容 背面笔记"]'
    ) as HTMLButtonElement | null;
    const frontCard = container.querySelector(
      '[aria-label="打开内容 前景笔记"]'
    ) as HTMLButtonElement | null;
    const backImage = backCard?.querySelector('img');
    const frontImage = frontCard?.querySelector('img');

    expect(backCard?.className).not.toContain('backdrop-blur');
    expect(backImage).not.toHaveAttribute(
      'src',
      `reo-attachment://ws_gallery/segments/seg_gallery_${backIndex}/cover/cover-${backIndex}.webp?v=177-42`
    );
    expect(frontImage).toHaveAttribute(
      'src',
      `reo-attachment://ws_gallery/segments/seg_gallery_${frontIndex}/cover/cover-${frontIndex}.webp?v=177-42`
    );
  });

  it('reloads a reused cover image when its loaded marker belongs to a stale source', () => {
    const image = document.createElement('img');
    image.dataset['galleryCoverLoaded'] = 'true';
    image.dataset['galleryCoverSrc'] =
      'reo-attachment://ws_gallery/segments/seg_next/cover/cover.webp?v=2';
    image.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=');

    expect(shouldLoadGalleryCoverImage(image)).toBe(true);

    image.setAttribute('src', 'reo-attachment://ws_gallery/segments/seg_next/cover/cover.webp?v=2');

    expect(shouldLoadGalleryCoverImage(image)).toBe(false);
  });

  it('fills missing gallery positions with skeleton cards', () => {
    const { container } = render(
      <WorkspaceLibraryPage
        expressions={[
          recentExpression({
            id: 'note-1',
            contentKind: 'note',
            title: '产品笔记',
          }),
        ]}
      />
    );

    expect(container.querySelectorAll('[data-gallery-skeleton-card="true"]')).toHaveLength(
      GALLERY_PHYSICAL_SLOTS - 1
    );
  });

  it('uses fixed multiline tracks for long title and preview text', () => {
    const { container } = render(
      <WorkspaceLibraryPage
        expressions={[
          recentExpression({
            id: 'note-1',
            contentKind: 'note',
            title: 'E2E 自动补充 已重命名后的超长标题',
            preview: '这是一段用于验证卡片内部摘要不会挤压标题和封面的较长正文摘要',
          }),
        ]}
      />
    );

    const card = container.querySelector('[data-gallery-card="true"]') as HTMLButtonElement | null;
    expect(card).toBeInstanceOf(HTMLButtonElement);
    const title = card?.querySelector('[data-gallery-card-title="true"]');
    const preview = card?.querySelector('[data-gallery-card-preview="true"]');

    expect(title).toHaveClass('line-clamp-2');
    expect(title).not.toHaveClass('truncate');
    expect(preview).toHaveClass('line-clamp-2');
    expect(preview).not.toHaveClass('truncate');
  });

  it('opens a projected card from the gallery surface instead of relying on native card hit tests', () => {
    const onOpenExpression = vi.fn();
    const expressions = Array.from({ length: 33 }, (_, index) =>
      recentExpression({
        id: `note-${index}`,
        contentKind: 'note',
        segmentId: `seg_gallery_${index}`,
        title: `笔记 ${index}`,
        preview: `笔记正文 ${index}`,
      })
    );
    const { container } = render(
      <WorkspaceLibraryPage expressions={expressions} onOpenExpression={onOpenExpression} />
    );
    const surface = container.querySelector(
      '[data-gallery-drag-surface="true"]'
    ) as HTMLElement | null;
    const card = Array.from(container.querySelectorAll('[data-gallery-card="true"]')).find(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element.style.visibility !== 'hidden'
    );
    const targetExpression = expressions.find(
      (expression) => expression.id === card?.dataset['galleryExpressionId']
    );

    expect(surface).toBeInstanceOf(HTMLElement);
    expect(card).toBeInstanceOf(HTMLElement);
    expect(targetExpression).toBeDefined();
    const cardElement = card as HTMLElement;
    const pointerY = 400 + rowVerticalOffset(Number(cardElement.dataset['galleryRowIndex'] ?? 0));
    mockPointerCapture(surface as HTMLElement);
    mockElementRect(surface, { height: 800, left: 0, top: 0, width: 1200 });
    mockElementRect(cardElement, { height: 140, left: 780, top: pointerY - 70, width: 330 });

    fireEvent.pointerDown(surface as HTMLElement, {
      clientX: 900,
      clientY: pointerY,
      pointerId: 11,
    });
    fireEvent.pointerUp(surface as HTMLElement, {
      clientX: 900,
      clientY: pointerY,
      pointerId: 11,
    });

    expect(onOpenExpression).toHaveBeenCalledWith(targetExpression!);
  });

  it('turns a card press into carousel drag after the movement threshold', () => {
    const onOpenExpression = vi.fn();
    const expressions = Array.from({ length: 20 }, (_, index) =>
      recentExpression({
        id: `note-${index}`,
        contentKind: 'note',
        segmentId: `seg_gallery_${index}`,
        title: `笔记 ${index}`,
      })
    );
    const { container } = render(
      <WorkspaceLibraryPage expressions={expressions} onOpenExpression={onOpenExpression} />
    );
    const surface = container.querySelector(
      '[data-gallery-drag-surface="true"]'
    ) as HTMLElement | null;
    const card = Array.from(container.querySelectorAll('[data-gallery-card="true"]')).find(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element.style.visibility !== 'hidden'
    );

    expect(surface).toBeInstanceOf(HTMLElement);
    expect(card).toBeInstanceOf(HTMLElement);
    const cardElement = card as HTMLElement;
    const pointerY = 400 + rowVerticalOffset(Number(cardElement.dataset['galleryRowIndex'] ?? 0));
    const beforeTransform = cardElement.style.transform;
    mockPointerCapture(surface as HTMLElement);
    mockElementRect(surface, { height: 800, left: 0, top: 0, width: 1200 });
    mockElementRect(cardElement, { height: 140, left: 720, top: pointerY - 70, width: 330 });

    fireEvent.pointerDown(surface as HTMLElement, {
      clientX: 860,
      clientY: pointerY,
      pointerId: 31,
    });
    fireEvent.pointerMove(surface as HTMLElement, {
      clientX: 940,
      clientY: pointerY,
      pointerId: 31,
    });
    fireEvent.pointerUp(surface as HTMLElement, {
      clientX: 940,
      clientY: pointerY,
      pointerId: 31,
    });

    expect(onOpenExpression).not.toHaveBeenCalled();
    expect(cardElement.style.transform).not.toBe(beforeTransform);
  });

  it('rotates rows from trackpad wheel input without changing rendered cards', () => {
    const { container } = render(
      <WorkspaceLibraryPage
        expressions={Array.from({ length: 12 }, (_, index) =>
          recentExpression({
            id: `note-${index}`,
            contentKind: 'note',
            title: `笔记 ${index}`,
          })
        )}
      />
    );
    const surface = container.querySelector(
      '[data-gallery-drag-surface="true"]'
    ) as HTMLElement | null;
    const cards = Array.from(container.querySelectorAll('[data-gallery-card]')).filter(
      (element): element is HTMLElement => element instanceof HTMLElement
    );
    const firstCard =
      cards.find((card) => Math.abs(cardRotationFromTransform(card.style.transform)) < 1) ??
      cards[0] ??
      null;

    expect(surface).toBeInstanceOf(HTMLElement);
    expect(firstCard).toBeInstanceOf(HTMLElement);
    const beforeTransform = firstCard?.style.transform;
    const beforeRotation = cardRotationFromTransform(beforeTransform);
    const beforeCards = container.querySelectorAll('[data-gallery-card]').length;

    fireEvent.wheel(surface as HTMLElement, { deltaX: 120, deltaY: 0, deltaMode: 0 });

    expect(firstCard?.style.transform).not.toBe(beforeTransform);
    expect(cardRotationFromTransform(firstCard?.style.transform)).toBeLessThan(beforeRotation);
    expect(container.querySelectorAll('[data-gallery-card]')).toHaveLength(beforeCards);
  });

  it('keeps blank drag safe when pointer capture is unavailable', () => {
    const { container } = render(
      <WorkspaceLibraryPage
        expressions={[
          recentExpression({
            id: 'note-1',
            contentKind: 'note',
            title: '安全拖拽',
          }),
        ]}
      />
    );
    const surface = container.querySelector(
      '[data-gallery-drag-surface="true"]'
    ) as HTMLElement | null;
    expect(surface).toBeInstanceOf(HTMLElement);
    mockElementRect(surface, { height: 800, left: 0, top: 0, width: 1200 });
    (surface as HTMLElement).setPointerCapture = vi.fn(() => {
      throw new Error('No active pointer');
    });

    expect(() =>
      fireEvent.pointerDown(surface as HTMLElement, {
        clientX: 100,
        clientY: 100,
        pointerId: 92,
      })
    ).not.toThrow();
  });
});
