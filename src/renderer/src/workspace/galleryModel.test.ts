import { describe, expect, it } from 'vitest';
import {
  applyGalleryCoverFallback,
  buildGalleryRows,
  buildSampledGallerySlots,
  findGalleryCardHit,
  GALLERY_COLUMN_ROTATION_STEP,
  GALLERY_CONFIG,
  GALLERY_ORBIT_COLUMNS,
  GALLERY_PHYSICAL_SLOTS,
  GALLERY_VISUAL_ARC,
  type GalleryCoverFallbackTarget,
  galleryNodeVisualState,
  generateGalleryNodes,
  positiveModulo,
  rowIndexFromPointerPosition,
  rowVerticalOffset,
} from './galleryModel';
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

describe('galleryModel', () => {
  it('fills every physical slot from a single expression pool with skeletons for missing data', () => {
    const slots = buildSampledGallerySlots(
      [
        recentExpression({
          id: 'note-1',
          contentKind: 'note',
          title: '唯一笔记',
        }),
      ],
      'seed-single'
    );
    const rows = buildGalleryRows(slots, generateGalleryNodes());

    expect(slots).toHaveLength(GALLERY_PHYSICAL_SLOTS);
    expect(slots.filter((slot) => slot.kind === 'expression')).toHaveLength(1);
    expect(slots.filter((slot) => slot.kind === 'skeleton')).toHaveLength(
      GALLERY_PHYSICAL_SLOTS - 1
    );
    expect(rows.map((row) => row.length)).toEqual(
      Array.from({ length: GALLERY_CONFIG.rows }, () => GALLERY_ORBIT_COLUMNS)
    );
    expect(
      rows.every((row) =>
        row.some(({ slot }) => slot.kind === 'expression' || slot.kind === 'skeleton')
      )
    ).toBe(true);
  });

  it('uses a stable random sample when the expression pool exceeds physical slots', () => {
    const expressions = Array.from({ length: 1000 }, (_, index) =>
      recentExpression({
        id: `note-${index}`,
        contentKind: 'note',
        segmentId: `seg_gallery_${index}`,
        title: `笔记${index}`,
      })
    );
    const firstSample = buildSampledGallerySlots(expressions, 'seed-large');
    const repeatedSample = buildSampledGallerySlots(expressions, 'seed-large');
    const alternateSample = buildSampledGallerySlots(expressions, 'seed-large-alt');
    const expressionIds = (slots: ReturnType<typeof buildSampledGallerySlots>) =>
      slots.flatMap((slot) => (slot.kind === 'expression' ? [slot.expression.id] : []));

    expect(firstSample).toHaveLength(GALLERY_PHYSICAL_SLOTS);
    expect(firstSample.filter((slot) => slot.kind === 'expression')).toHaveLength(
      GALLERY_PHYSICAL_SLOTS
    );
    expect(new Set(expressionIds(firstSample)).size).toBe(GALLERY_PHYSICAL_SLOTS);
    expect(expressionIds(firstSample)).toEqual(expressionIds(repeatedSample));
    expect(expressionIds(firstSample)).not.toEqual(expressionIds(alternateSample));
  });

  it('builds five stable rows with the configured visible-arc slot count per row', () => {
    const slots = buildSampledGallerySlots(
      Array.from({ length: GALLERY_PHYSICAL_SLOTS }, (_, index) =>
        recentExpression({
          id: `note-${index}`,
          contentKind: 'note',
          title: `笔记${index}`,
        })
      ),
      'seed-rows'
    );
    const rows = buildGalleryRows(slots, generateGalleryNodes());

    expect(rows).toHaveLength(GALLERY_CONFIG.rows);
    expect(rows.map((row) => row.length)).toEqual(
      Array.from({ length: GALLERY_CONFIG.rows }, () => GALLERY_ORBIT_COLUMNS)
    );
  });

  it('keeps partial expression pools in source order and fills the remaining visible slots', () => {
    const slots = buildSampledGallerySlots(
      Array.from({ length: 45 }, (_, index) =>
        recentExpression({
          id: `note-${index}`,
          contentKind: 'note',
          title: `笔记${index}`,
        })
      ),
      'seed-partial'
    );
    const rows = buildGalleryRows(slots, generateGalleryNodes());

    expect(rows.map((row) => row.filter(({ slot }) => slot.kind === 'expression').length)).toEqual(
      Array.from({ length: GALLERY_CONFIG.rows }, () => 9)
    );
    expect(
      rows.every(
        (row) => row.at(-1)?.slot.kind === 'skeleton' && row.at(-2)?.slot.kind === 'expression'
      )
    ).toBe(true);
  });

  it('preserves the configured horizontal visual spacing inside the visible arc', () => {
    expect(GALLERY_ORBIT_COLUMNS).toBe(GALLERY_CONFIG.density);
    expect(GALLERY_COLUMN_ROTATION_STEP).toBeCloseTo(GALLERY_VISUAL_ARC / GALLERY_CONFIG.density);
    expect(GALLERY_ORBIT_COLUMNS * GALLERY_COLUMN_ROTATION_STEP).toBeCloseTo(GALLERY_VISUAL_ARC);
  });

  it('distributes each row across the visible arc with an even wrap point', () => {
    const nodes = generateGalleryNodes();
    for (let rowIndex = 0; rowIndex < GALLERY_CONFIG.rows; rowIndex += 1) {
      const rowAngles = nodes
        .filter((node) => node.rowIndex === rowIndex)
        .map((node) => positiveModulo(node.thetaOffset, GALLERY_VISUAL_ARC))
        .sort((a, b) => a - b);
      const gaps = rowAngles.map((angle, index) => {
        const nextAngle = rowAngles[(index + 1) % rowAngles.length] ?? angle;
        return positiveModulo(nextAngle - angle, GALLERY_VISUAL_ARC);
      });

      expect(Math.min(...gaps)).toBeCloseTo(GALLERY_COLUMN_ROTATION_STEP);
      expect(Math.max(...gaps)).toBeCloseTo(GALLERY_COLUMN_ROTATION_STEP);
    }
  });

  it('keeps front cards visible and hides side/back cards that would visually overlap', () => {
    const middleRowNodes = generateGalleryNodes().filter(
      (node) => node.rowIndex === Math.floor(GALLERY_CONFIG.rows / 2)
    );
    const frontNode = middleRowNodes.reduce((bestNode, node) =>
      Math.abs(node.thetaOffset) < Math.abs(bestNode.thetaOffset) ? node : bestNode
    );
    const backNode = middleRowNodes.reduce((bestNode, node) =>
      galleryNodeVisualState(node).depth < galleryNodeVisualState(bestNode).depth ? node : bestNode
    );
    const sideBackNode = middleRowNodes.find((node) => {
      const state = galleryNodeVisualState(node);
      return !state.visible && state.depth > galleryNodeVisualState(backNode).depth;
    });

    expect(galleryNodeVisualState(frontNode)).toMatchObject({
      opacity: 1,
      visible: true,
    });
    expect(galleryNodeVisualState(backNode).visible).toBe(false);
    expect(galleryNodeVisualState(sideBackNode!).visible).toBe(false);
  });

  it('maps pointer position to every row without depending on card DOM hit tests', () => {
    const bounds = { height: 768, left: 0, top: 0, width: 1536 };
    const centerY = bounds.top + bounds.height / 2;

    for (let rowIndex = 0; rowIndex < GALLERY_CONFIG.rows; rowIndex += 1) {
      expect(
        rowIndexFromPointerPosition({
          bounds,
          clientX: bounds.left + bounds.width / 2,
          clientY: centerY + rowVerticalOffset(rowIndex),
        })
      ).toBe(rowIndex);
    }

    expect(
      rowIndexFromPointerPosition({
        bounds,
        clientX: bounds.left + bounds.width + 200,
        clientY: centerY,
      })
    ).toBeNull();
  });

  it('hits the nearest projected card rectangle without depending on browser event targets', () => {
    const hit = findGalleryCardHit({
      clientX: 150,
      clientY: 120,
      targets: [
        { depth: 0.6, height: 100, index: 1, left: 20, rowIndex: 0, top: 20, width: 200 },
        { depth: 0.7, height: 80, index: 2, left: 90, rowIndex: 0, top: 90, width: 180 },
      ],
    });

    expect(hit?.index).toBe(2);
    expect(
      findGalleryCardHit({
        clientX: 400,
        clientY: 400,
        targets: [
          { depth: 0.6, height: 100, index: 1, left: 20, rowIndex: 0, top: 20, width: 200 },
        ],
      })
    ).toBeNull();
  });

  it('prefers the visually front card over a deeper overlapping back card', () => {
    const hit = findGalleryCardHit({
      clientX: 150,
      clientY: 120,
      targets: [
        { depth: 0.2, height: 180, index: 1, left: 20, rowIndex: 0, top: 20, width: 260 },
        { depth: 0.9, height: 120, index: 2, left: 60, rowIndex: 0, top: 60, width: 220 },
      ],
    });

    expect(hit?.index).toBe(2);
  });

  it('applies a custom cover fallback once', () => {
    const image: GalleryCoverFallbackTarget = {
      dataset: {
        galleryCoverFallbackSrc: 'default-cover.webp',
      },
      src: 'broken-cover.webp',
    };

    expect(applyGalleryCoverFallback(image)).toBe(true);
    expect(image.src).toBe('default-cover.webp');
    expect(image.dataset.galleryCoverFallbackApplied).toBe('true');
    expect(image.dataset.galleryCoverLoaded).toBe('true');
    expect(applyGalleryCoverFallback(image)).toBe(false);
  });
});
