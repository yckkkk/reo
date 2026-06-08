import type { WorkspaceRecentExpressionItem } from './workspaceApi';

export const GALLERY_CONFIG = {
  cardHeight: 140,
  cardWidth: 330,
  density: 10,
  radius: 800,
  rows: 5,
  speed: 35,
  vGap: 1.6,
  zoom: 1,
} as const;

export const GALLERY_VISUAL_ARC = Math.PI * 1.5;
export const BASE_GAP_DEGREES = 7;
export const SPEED_FACTOR = 0.000006;
export const GALLERY_HALF_ARC = GALLERY_VISUAL_ARC / 2;
export const GALLERY_ORBIT_COLUMNS = GALLERY_CONFIG.density;
export const GALLERY_COLUMN_ROTATION_STEP = GALLERY_VISUAL_ARC / GALLERY_ORBIT_COLUMNS;
export const GALLERY_PHYSICAL_SLOTS = GALLERY_CONFIG.rows * GALLERY_ORBIT_COLUMNS;
export const GALLERY_HIT_DEPTH_THRESHOLD = 0;

const COVER_LOAD_OPACITY = 0.46;

export type GalleryExpression = WorkspaceRecentExpressionItem & {
  readonly contentKind: 'audio' | 'note';
};

export type GalleryNode = {
  readonly columnIndex: number;
  readonly phi: number;
  readonly rowIndex: number;
  readonly thetaOffset: number;
};

export type GallerySlot =
  | {
      readonly expression: GalleryExpression;
      readonly kind: 'expression';
    }
  | {
      readonly id: string;
      readonly kind: 'skeleton';
    };

export type GalleryRowItem = {
  readonly index: number;
  readonly node: GalleryNode;
  readonly slot: GallerySlot;
};

export type GallerySurfaceBounds = {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
};

export type GalleryCoverFallbackTarget = {
  readonly dataset: {
    galleryCoverFallbackApplied?: string | undefined;
    galleryCoverFallbackSrc?: string | undefined;
    galleryCoverLoaded?: string | undefined;
  };
  src: string;
};

export type GalleryCardHitTarget = {
  readonly depth: number;
  readonly height: number;
  readonly index: number;
  readonly left: number;
  readonly rowIndex: number;
  readonly top: number;
  readonly width: number;
};

export type GalleryNodeVisualState = {
  readonly depth: number;
  readonly opacity: number;
  readonly visible: boolean;
  readonly zIndex: number;
};

export function isGalleryExpression(
  item: WorkspaceRecentExpressionItem
): item is GalleryExpression {
  return item.contentKind === 'audio' || item.contentKind === 'note';
}

function gallerySlotSkeletonId(slotIndex: number) {
  const rowIndex = slotIndex % GALLERY_CONFIG.rows;
  const columnIndex = Math.floor(slotIndex / GALLERY_CONFIG.rows) % GALLERY_ORBIT_COLUMNS;
  return `gallery-skeleton-${rowIndex}-${columnIndex}`;
}

function hashGallerySampleKey(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sampleGalleryExpressions(
  expressions: readonly GalleryExpression[],
  sampleSeed: string
): readonly GalleryExpression[] {
  if (expressions.length <= GALLERY_PHYSICAL_SLOTS) {
    return expressions;
  }

  return expressions
    .map((expression, index) => ({
      expression,
      index,
      rank: hashGallerySampleKey(`${sampleSeed}:${expression.id}:${index}`),
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, GALLERY_PHYSICAL_SLOTS)
    .map(({ expression }) => expression);
}

export function buildSampledGallerySlots(
  expressions: readonly WorkspaceRecentExpressionItem[],
  sampleSeed: string
): readonly GallerySlot[] {
  const sampledExpressions = sampleGalleryExpressions(
    expressions.filter(isGalleryExpression),
    sampleSeed
  );

  return Array.from({ length: GALLERY_PHYSICAL_SLOTS }, (_, slotIndex) => {
    const expression = sampledExpressions[slotIndex];
    return expression
      ? { expression, kind: 'expression' }
      : { id: gallerySlotSkeletonId(slotIndex), kind: 'skeleton' };
  });
}

export function generateGalleryNodes(count = GALLERY_PHYSICAL_SLOTS): readonly GalleryNode[] {
  const nodes: GalleryNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const rowIndex = index % GALLERY_CONFIG.rows;
    const columnIndex = Math.floor(index / GALLERY_CONFIG.rows) % GALLERY_ORBIT_COLUMNS;
    const staggerOffset = (rowIndex % 2) * (GALLERY_COLUMN_ROTATION_STEP / 2);
    const basePhi = (rowIndex - (GALLERY_CONFIG.rows - 1) / 2) * BASE_GAP_DEGREES;
    nodes.push({
      columnIndex,
      rowIndex,
      phi: (basePhi * GALLERY_CONFIG.vGap * Math.PI) / 180,
      thetaOffset: columnIndex * GALLERY_COLUMN_ROTATION_STEP - GALLERY_HALF_ARC + staggerOffset,
    });
  }
  return nodes;
}

export function buildGalleryRows(
  gallerySlots: readonly GallerySlot[],
  galleryNodes: readonly GalleryNode[]
): readonly (readonly GalleryRowItem[])[] {
  const rows: GalleryRowItem[][] = Array.from({ length: GALLERY_CONFIG.rows }, () => []);
  gallerySlots.forEach((slot, index) => {
    const node = galleryNodes[index];
    if (node) {
      rows[node.rowIndex]?.push({ index, node, slot });
    }
  });
  return rows;
}

export function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

export function normalizeEquivalentRotation(rotation: number) {
  return positiveModulo(rotation + GALLERY_HALF_ARC, GALLERY_VISUAL_ARC) - GALLERY_HALF_ARC;
}

function visibleTheta(rawTheta: number) {
  return normalizeEquivalentRotation(rawTheta);
}

function initialNodeOpacity(node: GalleryNode) {
  const theta = visibleTheta(node.thetaOffset);
  const depthRatio = Math.cos(theta) * Math.cos(node.phi);
  return Math.max(0, depthRatio * 1.6 - 0.2);
}

export function shouldLoadInitialCover(node: GalleryNode) {
  return initialNodeOpacity(node) >= COVER_LOAD_OPACITY;
}

export function applyGalleryCoverFallback(image: GalleryCoverFallbackTarget) {
  const fallbackSrc = image.dataset.galleryCoverFallbackSrc;
  if (!fallbackSrc || image.dataset.galleryCoverFallbackApplied === 'true') {
    return false;
  }

  image.dataset.galleryCoverFallbackApplied = 'true';
  image.dataset.galleryCoverLoaded = 'true';
  image.src = fallbackSrc;
  return true;
}

export function rowVerticalOffset(rowIndex: number) {
  const phi =
    ((rowIndex - (GALLERY_CONFIG.rows - 1) / 2) *
      BASE_GAP_DEGREES *
      GALLERY_CONFIG.vGap *
      Math.PI) /
    180;
  return GALLERY_CONFIG.radius * Math.sin(phi);
}

export function cardStaticTransform(node: GalleryNode, rowRotation = 0) {
  const theta = visibleTheta(node.thetaOffset + rowRotation);
  const x = GALLERY_CONFIG.radius * Math.sin(theta) * Math.cos(node.phi);
  const y = GALLERY_CONFIG.radius * Math.sin(node.phi);
  const z = GALLERY_CONFIG.radius * Math.cos(theta) * Math.cos(node.phi) - GALLERY_CONFIG.radius;
  const depth = galleryNodeDepth(node, rowRotation);
  const scale = Math.max(0.5, 0.85 + depth * 0.15);
  return `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(
    1
  )}px, ${z.toFixed(1)}px) rotateY(${theta.toFixed(4)}rad) rotateX(${(-node.phi).toFixed(
    4
  )}rad) scale(${scale.toFixed(3)})`;
}

export function galleryNodeDepth(node: GalleryNode, rowRotation = 0) {
  const theta = visibleTheta(rowRotation + node.thetaOffset);
  return Math.cos(theta) * Math.cos(node.phi);
}

export function galleryNodeVisualState(node: GalleryNode, rowRotation = 0): GalleryNodeVisualState {
  const depth = galleryNodeDepth(node, rowRotation);
  const opacity = Math.min(1, Math.max(0, depth * 1.6 - 0.2));
  const visible = opacity > 0.05;
  if (!visible) {
    return { depth, opacity: 0, visible: false, zIndex: 0 };
  }

  return {
    depth,
    opacity,
    visible: true,
    zIndex: Math.round(depth * 1000),
  };
}

export function resolveGallerySurfaceBounds({
  rect,
  viewport,
}: {
  readonly rect: Pick<DOMRectReadOnly, 'height' | 'left' | 'top' | 'width'>;
  readonly viewport: { readonly height: number; readonly width: number };
}): GallerySurfaceBounds {
  return {
    height: rect.height || viewport.height || 1,
    left: rect.width ? rect.left : 0,
    top: rect.height ? rect.top : 0,
    width: rect.width || viewport.width || 1,
  };
}

export function rowIndexFromPointerPosition({
  bounds,
  clientX,
  clientY,
}: {
  readonly bounds: GallerySurfaceBounds;
  readonly clientX: number;
  readonly clientY: number;
}): number | null {
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const horizontalReach = Math.min(
    bounds.width / 2,
    GALLERY_CONFIG.radius + GALLERY_CONFIG.cardWidth / 2
  );
  if (Math.abs(clientX - centerX) > horizontalReach) {
    return null;
  }

  let bestRow = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  const rowCenters = Array.from({ length: GALLERY_CONFIG.rows }, (_, rowIndex) => {
    const rowCenter = centerY + rowVerticalOffset(rowIndex);
    const distance = Math.abs(clientY - rowCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRow = rowIndex;
    }
    return rowCenter;
  });
  const minRowGap = rowCenters
    .slice(1)
    .reduce(
      (minimum, rowCenter, index) =>
        Math.min(minimum, Math.abs(rowCenter - (rowCenters[index] ?? rowCenter))),
      Number.POSITIVE_INFINITY
    );
  const activationRadius = Math.max(GALLERY_CONFIG.cardHeight * 0.72, minRowGap / 2);
  return bestDistance <= activationRadius ? bestRow : null;
}

export function findGalleryCardHit({
  clientX,
  clientY,
  targets,
}: {
  readonly clientX: number;
  readonly clientY: number;
  readonly targets: readonly GalleryCardHitTarget[];
}): GalleryCardHitTarget | null {
  let bestTarget: GalleryCardHitTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (
      target.width <= 0 ||
      target.height <= 0 ||
      target.depth < GALLERY_HIT_DEPTH_THRESHOLD ||
      clientX < target.left ||
      clientX > target.left + target.width ||
      clientY < target.top ||
      clientY > target.top + target.height
    ) {
      continue;
    }

    const centerX = target.left + target.width / 2;
    const centerY = target.top + target.height / 2;
    const distance = Math.hypot(clientX - centerX, clientY - centerY);
    const depthWins = !bestTarget || target.depth > bestTarget.depth + 0.03;
    const distanceWins =
      bestTarget && Math.abs(target.depth - bestTarget.depth) <= 0.03 && distance < bestDistance;
    if (depthWins || distanceWins) {
      bestDistance = distance;
      bestTarget = target;
    }
  }

  return bestTarget;
}
