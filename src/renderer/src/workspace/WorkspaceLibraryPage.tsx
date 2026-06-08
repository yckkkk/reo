import { FileText } from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import {
  applyGalleryCoverFallback,
  buildGalleryRows,
  buildSampledGallerySlots,
  cardStaticTransform,
  findGalleryCardHit,
  GALLERY_CONFIG,
  GALLERY_PHYSICAL_SLOTS,
  generateGalleryNodes,
  galleryNodeVisualState,
  isGalleryExpression,
  normalizeEquivalentRotation,
  resolveGallerySurfaceBounds,
  rowIndexFromPointerPosition,
  shouldLoadInitialCover,
  SPEED_FACTOR,
  type GalleryCardHitTarget,
  type GalleryExpression,
  type GalleryNode,
  type GalleryRowItem,
  type GallerySlot,
} from './galleryModel';
import {
  resolveDefaultCoverTemplate,
  resolveSegmentCoverImageSource,
} from './covers/memoryCoverSource';
import { shouldLoadGalleryCoverImage } from './galleryCoverLoading';
import type { WorkspaceRecentExpressionItem } from './workspaceApi';

type WorkspaceLibraryStatus = 'error' | 'loading' | 'ready';

type WorkspaceLibraryPageProps = {
  readonly expressions?: readonly WorkspaceRecentExpressionItem[] | undefined;
  readonly expressionsStatus?: WorkspaceLibraryStatus | undefined;
  readonly skippedCount?: number | undefined;
  readonly onOpenExpression?: ((expression: WorkspaceRecentExpressionItem) => void) | undefined;
};

type GalleryCardStyle = CSSProperties & {
  readonly width: string;
  readonly height: string;
};

type GalleryPointerSnapshot = {
  readonly clientX: number;
  readonly clientY: number;
  readonly currentTarget: HTMLElement;
};

function createGallerySampleSeed() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const MAX_FRAME_DELTA_MS = 48;
const DRAG_ROTATION_FACTOR = 0.003;
const WHEEL_ROTATION_FACTOR = 0.002;
const WHEEL_LINE_DELTA_PX = 16;
const WHEEL_PAGE_DELTA_PX = 360;
const COVER_LOAD_BATCH_SIZE = 6;
const COVER_LOAD_INTERVAL_MS = 80;
const COVER_PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
const DEFAULT_PREVIEW = '暂无正文摘要';
const AUDIO_WAVEFORM_LEVELS = [42, 76, 54, 88, 46, 68, 36];
const IS_TEST_ENVIRONMENT = import.meta.env.MODE === 'test' || Boolean(import.meta.env['VITEST']);
const CARD_PRESS_DRAG_THRESHOLD_PX = 8;

function galleryCardStyle(node: GalleryNode): GalleryCardStyle {
  const visualState = galleryNodeVisualState(node);
  return {
    width: `${GALLERY_CONFIG.cardWidth}px`,
    height: `${GALLERY_CONFIG.cardHeight}px`,
    backfaceVisibility: 'hidden',
    contain: 'layout paint style',
    opacity: visualState.opacity,
    transform: cardStaticTransform(node),
    visibility: visualState.visible ? 'visible' : 'hidden',
    zIndex: visualState.zIndex,
  };
}

function expressionKindLabel(kind: GalleryExpression['contentKind']) {
  return kind === 'audio' ? '录音' : '笔记';
}

function resolveExpressionCoverSource({
  cover,
  segmentId,
  workspaceId,
}: {
  readonly cover?: GalleryExpression['cover'] | undefined;
  readonly segmentId: string;
  readonly workspaceId: string;
}) {
  return resolveSegmentCoverImageSource({
    segment: { cover, segmentId },
    workspaceId,
  });
}

function loadCoverImage(image: HTMLImageElement) {
  const coverSrc = image.dataset['galleryCoverSrc'];
  if (!coverSrc || !shouldLoadGalleryCoverImage(image)) {
    return;
  }
  image.src = coverSrc;
  image.dataset['galleryCoverLoaded'] = 'true';
}

function GalleryAudioMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-20 w-28 shrink-0 items-center justify-center gap-[2px]"
    >
      {AUDIO_WAVEFORM_LEVELS.map((level, index) => (
        <span
          key={index}
          className="block w-[3px] rounded-full bg-current"
          style={{ height: `${Math.round(20 * (level / 100))}px` }}
        />
      ))}
    </span>
  );
}

const GalleryCard = memo(function GalleryCard({
  expression,
  node,
  onOpenExpression,
  active,
  paused,
  registerCardElement,
  registerCoverImage,
  registerSlotElement,
  slotIndex,
}: {
  readonly active: boolean;
  readonly expression: GalleryExpression;
  readonly node: GalleryNode;
  readonly onOpenExpression?: ((expression: WorkspaceRecentExpressionItem) => void) | undefined;
  readonly paused: boolean;
  readonly registerCardElement: (slotIndex: number, element: HTMLButtonElement | null) => void;
  readonly registerCoverImage: (slotIndex: number, element: HTMLImageElement | null) => void;
  readonly registerSlotElement: (slotIndex: number, element: HTMLElement | null) => void;
  readonly slotIndex: number;
}) {
  const coverSource = resolveExpressionCoverSource({
    cover: expression.cover,
    segmentId: expression.segmentId,
    workspaceId: expression.workspaceId,
  });
  const fallbackCoverSource = resolveDefaultCoverTemplate(expression.segmentId);
  const kindLabel = expressionKindLabel(expression.contentKind);
  const preview = expression.preview?.trim() || DEFAULT_PREVIEW;
  const loadInitialCover = shouldLoadInitialCover(node);
  const style = galleryCardStyle(node);

  return (
    <button
      ref={(element) => {
        registerCardElement(slotIndex, element);
        registerSlotElement(slotIndex, element);
      }}
      type="button"
      aria-label={`打开内容 ${expression.title}`}
      className={`pointer-events-none absolute left-1/2 top-1/2 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-[14px] overflow-hidden rounded-lg p-[14px] text-left text-card-foreground shadow-none outline-none ring-1 transition-[background-color,ring-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        active ? 'bg-secondary ring-foreground/10' : 'bg-card ring-border/45'
      }`}
      data-gallery-card-active={active ? 'true' : undefined}
      data-gallery-column-index={node.columnIndex}
      data-gallery-card="true"
      data-gallery-card-index={slotIndex}
      data-gallery-expression-id={expression.id}
      data-gallery-memory-id={expression.memoryId}
      data-gallery-row-index={node.rowIndex}
      data-gallery-segment-id={expression.segmentId}
      data-gallery-supplement-id={
        expression.objectType === 'supplement' ? expression.supplementId : undefined
      }
      data-gallery-workspace-id={expression.workspaceId}
      data-row-paused={paused ? 'true' : undefined}
      onClick={() => onOpenExpression?.(expression)}
      style={style}
    >
      <span
        className="block size-[96px] self-center overflow-hidden rounded-md bg-secondary"
        data-gallery-card-cover="true"
      >
        <img
          ref={(element) => registerCoverImage(slotIndex, element)}
          alt=""
          aria-hidden="true"
          className="size-full object-cover"
          data-gallery-cover-loaded={loadInitialCover ? 'true' : undefined}
          data-gallery-cover-fallback-src={fallbackCoverSource}
          data-gallery-cover-src={coverSource}
          decoding="async"
          draggable={false}
          loading="lazy"
          onError={(event) => {
            applyGalleryCoverFallback(event.currentTarget);
          }}
          src={loadInitialCover ? coverSource : COVER_PLACEHOLDER_SRC}
        />
      </span>
      <span className="grid h-[96px] min-w-0 grid-rows-[16px_40px_32px] gap-[4px] overflow-hidden pr-[2px]">
        <span className="flex min-w-0 items-center gap-6 overflow-hidden text-ui-xs font-bold leading-[16px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-6">
            {expression.contentKind === 'audio' ? (
              <GalleryAudioMark />
            ) : (
              <FileText aria-hidden="true" className="size-16 shrink-0" strokeWidth={1.9} />
            )}
            <span className="truncate">{kindLabel}</span>
          </span>
        </span>
        <span
          className="line-clamp-2 min-w-0 overflow-hidden break-words text-body-lg font-bold leading-[20px] text-foreground [overflow-wrap:anywhere]"
          data-gallery-card-title="true"
        >
          {expression.title}
        </span>
        <span
          className="line-clamp-2 min-w-0 overflow-hidden break-words text-ui-sm font-medium leading-[16px] text-muted-foreground [overflow-wrap:anywhere]"
          data-gallery-card-preview="true"
        >
          {preview}
        </span>
      </span>
    </button>
  );
});

function GallerySkeletonCard({
  node,
  registerSlotElement,
  slotIndex,
}: {
  readonly node: GalleryNode;
  readonly registerSlotElement: (slotIndex: number, element: HTMLElement | null) => void;
  readonly slotIndex: number;
}) {
  const style = galleryCardStyle(node);

  return (
    <div
      ref={(element) => registerSlotElement(slotIndex, element)}
      aria-hidden="true"
      className="absolute left-1/2 top-1/2 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-[14px] overflow-hidden rounded-lg bg-card p-[14px] text-card-foreground shadow-none ring-1 ring-border/25"
      data-gallery-column-index={node.columnIndex}
      data-gallery-card="skeleton"
      data-gallery-row-index={node.rowIndex}
      data-gallery-skeleton-card="true"
      style={style}
    >
      <span
        className="block size-[96px] self-center rounded-md bg-secondary/72"
        data-gallery-card-cover="true"
      />
      <span className="grid h-[96px] min-w-0 grid-rows-[16px_40px_32px] gap-[4px] overflow-hidden pr-[2px]">
        <span className="mt-[3px] h-[10px] w-[52px] rounded-sm bg-secondary/64" />
        <span className="space-y-[6px] pt-[3px]">
          <span className="block h-[12px] w-[132px] max-w-full rounded-sm bg-secondary/72" />
          <span className="block h-[12px] w-[104px] max-w-full rounded-sm bg-secondary/60" />
        </span>
        <span className="space-y-[5px] pt-[1px]">
          <span className="block h-[9px] w-full rounded-sm bg-secondary/56" />
          <span className="block h-[9px] w-4/5 rounded-sm bg-secondary/48" />
        </span>
      </span>
    </div>
  );
}

function WorkspaceLibraryEmptyState({ status }: { readonly status: WorkspaceLibraryStatus }) {
  const text =
    status === 'loading' ? '正在加载内容' : status === 'error' ? '内容加载失败' : '暂无录音或笔记';
  return (
    <div className="sr-only" data-gallery-empty-state="true">
      {text}
    </div>
  );
}

export function WorkspaceLibraryPage({
  expressions = [],
  expressionsStatus = 'ready',
  skippedCount = 0,
  onOpenExpression,
}: WorkspaceLibraryPageProps) {
  const cardElementsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const coverImagesRef = useRef<Array<HTMLImageElement | null>>([]);
  const slotElementsRef = useRef<Array<HTMLElement | null>>([]);
  const rowRotationsRef = useRef<number[]>([]);
  const pausedRowsRef = useRef(new Set<number>());
  const hoveredRowRef = useRef<number | null>(null);
  const pendingHoverFrameRef = useRef<number | null>(null);
  const pendingHoverPointerRef = useRef<GalleryPointerSnapshot | null>(null);
  const dragStateRef = useRef<{
    readonly pointerId: number;
    readonly startRowRotations: readonly number[];
    readonly startX: number;
  } | null>(null);
  const cardPressRef = useRef<{
    readonly pointerId: number;
    readonly slotIndex: number;
    readonly startRowRotations: readonly number[];
    readonly startX: number;
    readonly startY: number;
  } | null>(null);
  const gallerySampleSeedRef = useRef(createGallerySampleSeed());
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const galleryExpressions = useMemo(() => expressions.filter(isGalleryExpression), [expressions]);
  const gallerySlots = useMemo<readonly GallerySlot[]>(() => {
    return buildSampledGallerySlots(galleryExpressions, gallerySampleSeedRef.current);
  }, [galleryExpressions]);
  const galleryNodes = useMemo(() => generateGalleryNodes(GALLERY_PHYSICAL_SLOTS), []);
  const galleryRows = useMemo<readonly (readonly GalleryRowItem[])[]>(
    () => buildGalleryRows(gallerySlots, galleryNodes),
    [galleryNodes, gallerySlots]
  );
  const visibleCoverKey = useMemo(
    () =>
      gallerySlots
        .flatMap((slot) => (slot.kind === 'expression' ? [slot.expression.id] : []))
        .join('|'),
    [gallerySlots]
  );
  const registerCoverImage = useCallback((slotIndex: number, element: HTMLImageElement | null) => {
    coverImagesRef.current[slotIndex] = element;
  }, []);
  const registerCardElement = useCallback(
    (slotIndex: number, element: HTMLButtonElement | null) => {
      cardElementsRef.current[slotIndex] = element;
    },
    []
  );
  const registerSlotElement = useCallback((slotIndex: number, element: HTMLElement | null) => {
    slotElementsRef.current[slotIndex] = element;
  }, []);

  useEffect(() => {
    cardElementsRef.current = cardElementsRef.current.slice(0, galleryNodes.length);
    coverImagesRef.current = coverImagesRef.current.slice(0, galleryNodes.length);
    slotElementsRef.current = slotElementsRef.current.slice(0, galleryNodes.length);
    rowRotationsRef.current = Array.from(
      { length: GALLERY_CONFIG.rows },
      (_, index) => rowRotationsRef.current[index] ?? 0
    );
  }, [galleryNodes.length]);

  useEffect(() => {
    if (IS_TEST_ENVIRONMENT || galleryExpressions.length === 0) {
      return undefined;
    }

    let stopped = false;
    let timeoutId = 0;

    const loadCoverBatch = () => {
      if (stopped) {
        return;
      }

      const unloadedImages = coverImagesRef.current.filter((image): image is HTMLImageElement =>
        Boolean(image && shouldLoadGalleryCoverImage(image))
      );
      unloadedImages.slice(0, COVER_LOAD_BATCH_SIZE).forEach(loadCoverImage);
      if (unloadedImages.length > COVER_LOAD_BATCH_SIZE) {
        timeoutId = window.setTimeout(loadCoverBatch, COVER_LOAD_INTERVAL_MS);
      }
    };

    timeoutId = window.setTimeout(loadCoverBatch, COVER_LOAD_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearTimeout(timeoutId);
    };
  }, [galleryExpressions.length, visibleCoverKey]);

  useEffect(() => {
    if (!window.matchMedia) {
      return undefined;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  function applySlotVisualState(slotIndex: number, node: GalleryNode, rowRotation: number) {
    const element = slotElementsRef.current[slotIndex];
    if (!element) {
      return;
    }

    const visualState = galleryNodeVisualState(node, rowRotation);
    const opacity = visualState.opacity.toFixed(2);
    const transform = cardStaticTransform(node, rowRotation);
    const visibility = visualState.visible ? 'visible' : 'hidden';
    const zIndex = String(visualState.zIndex);
    const signature = `${opacity}|${transform}|${visibility}|${zIndex}`;
    if (element.dataset['galleryVisualSignature'] === signature) {
      return;
    }

    element.dataset['galleryVisualSignature'] = signature;
    element.style.opacity = opacity;
    element.style.transform = transform;
    element.style.visibility = visibility;
    element.style.zIndex = zIndex;
  }

  function applyRowVisualState(rowIndex: number, rowRotation: number) {
    for (const item of galleryRows[rowIndex] ?? []) {
      applySlotVisualState(item.index, item.node, rowRotation);
    }
  }

  useEffect(() => {
    if (IS_TEST_ENVIRONMENT || galleryNodes.length === 0) {
      return undefined;
    }

    let frameId = 0;
    let lastTime = performance.now();

    const renderLoop = (time: number) => {
      const dt = Math.min(time - lastTime, MAX_FRAME_DELTA_MS);
      lastTime = time;
      const rowRotations = [...rowRotationsRef.current];

      if (!reduceMotion) {
        for (let rowIndex = 0; rowIndex < GALLERY_CONFIG.rows; rowIndex += 1) {
          if (!pausedRowsRef.current.has(rowIndex)) {
            const direction = rowIndex % 2 === 0 ? 1 : -1;
            rowRotations[rowIndex] =
              (rowRotations[rowIndex] ?? 0) + direction * dt * GALLERY_CONFIG.speed * SPEED_FACTOR;
          }
        }
      }

      for (let rowIndex = 0; rowIndex < GALLERY_CONFIG.rows; rowIndex += 1) {
        const normalizedRotation = normalizeEquivalentRotation(rowRotations[rowIndex] ?? 0);
        rowRotations[rowIndex] = normalizedRotation;
        applyRowVisualState(rowIndex, normalizedRotation);
      }
      rowRotationsRef.current = rowRotations;

      frameId = window.requestAnimationFrame(renderLoop);
    };

    frameId = window.requestAnimationFrame(renderLoop);
    return () => window.cancelAnimationFrame(frameId);
  }, [galleryNodes, galleryRows, reduceMotion]);

  useEffect(
    () => () => {
      if (pendingHoverFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingHoverFrameRef.current);
      }
    },
    []
  );

  function setPausedRow(rowIndex: number | null) {
    if (hoveredRowRef.current === rowIndex) {
      return;
    }
    hoveredRowRef.current = rowIndex;
    pausedRowsRef.current.clear();
    if (rowIndex !== null) {
      pausedRowsRef.current.add(rowIndex);
    }
    setHoveredRow(rowIndex);
  }

  function expressionForSlotIndex(slotIndex: number) {
    const slot = gallerySlots[slotIndex];
    return slot?.kind === 'expression' ? slot.expression : null;
  }

  function galleryCardHitTargets(rowIndex: number | null): readonly GalleryCardHitTarget[] {
    if (rowIndex === null) {
      return [];
    }
    const candidateRows = [rowIndex - 1, rowIndex, rowIndex + 1].filter(
      (candidateRow) => candidateRow >= 0 && candidateRow < GALLERY_CONFIG.rows
    );
    return candidateRows.flatMap((candidateRow): GalleryCardHitTarget[] => {
      const rowRotation = rowRotationsRef.current[candidateRow] ?? 0;
      return (galleryRows[candidateRow] ?? []).flatMap(({ index, node, slot }) => {
        if (slot.kind !== 'expression') {
          return [];
        }
        const card = cardElementsRef.current[index];
        if (!card) {
          return [];
        }
        const visualState = galleryNodeVisualState(node, rowRotation);
        if (!visualState.visible) {
          return [];
        }
        const rect = card.getBoundingClientRect();
        return [
          {
            depth: visualState.depth,
            height: rect.height,
            index,
            left: rect.left,
            rowIndex: node.rowIndex,
            top: rect.top,
            width: rect.width,
          },
        ];
      });
    });
  }

  function pointerSnapshot(
    event: ReactMouseEvent<HTMLElement> | ReactPointerEvent<HTMLElement>
  ): GalleryPointerSnapshot {
    return {
      clientX: event.clientX,
      clientY: event.clientY,
      currentTarget: event.currentTarget,
    };
  }

  function cardHitForPointer(
    pointer: GalleryPointerSnapshot,
    rowIndex = rowIndexForPointer(pointer)
  ) {
    return findGalleryCardHit({
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      targets: galleryCardHitTargets(rowIndex),
    });
  }

  function rowIndexForPointer(pointer: GalleryPointerSnapshot) {
    const bounds = resolveGallerySurfaceBounds({
      rect: pointer.currentTarget.getBoundingClientRect(),
      viewport: {
        height: window.innerHeight,
        width: window.innerWidth,
      },
    });
    return rowIndexFromPointerPosition({
      bounds,
      clientX: pointer.clientX,
      clientY: pointer.clientY,
    });
  }

  function capturePointer(element: HTMLElement, pointerId: number) {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Synthetic events and some assistive input paths can have no active pointer to capture.
    }
  }

  function releasePointerCapture(element: HTMLElement, pointerId: number) {
    try {
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    } catch {
      // Keep pointer cleanup best-effort for the same browser boundary cases as capture.
    }
  }

  function updateHoveredRowFromPointer(pointer: GalleryPointerSnapshot) {
    if (dragStateRef.current) {
      return;
    }
    const rowIndex = rowIndexForPointer(pointer);
    const cardHit = cardHitForPointer(pointer, rowIndex);
    setHoveredSlotIndex(cardHit?.index ?? null);
    setPausedRow(cardHit?.rowIndex ?? rowIndex);
  }

  function scheduleHoveredRowUpdate(
    event: ReactMouseEvent<HTMLElement> | ReactPointerEvent<HTMLElement>
  ) {
    pendingHoverPointerRef.current = pointerSnapshot(event);
    if (pendingHoverFrameRef.current !== null) {
      return;
    }
    pendingHoverFrameRef.current = window.requestAnimationFrame(() => {
      pendingHoverFrameRef.current = null;
      const pointer = pendingHoverPointerRef.current;
      pendingHoverPointerRef.current = null;
      if (pointer) {
        updateHoveredRowFromPointer(pointer);
      }
    });
  }

  function clearPendingHoveredRowUpdate() {
    pendingHoverPointerRef.current = null;
    if (pendingHoverFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingHoverFrameRef.current);
      pendingHoverFrameRef.current = null;
    }
  }

  function applyRowRotationOffset(startRowRotations: readonly number[], offset: number) {
    const nextRowRotations = Array.from(
      { length: GALLERY_CONFIG.rows },
      (_, rowIndex) => (startRowRotations[rowIndex] ?? 0) + offset
    );

    for (let rowIndex = 0; rowIndex < GALLERY_CONFIG.rows; rowIndex += 1) {
      const normalizedRotation = normalizeEquivalentRotation(nextRowRotations[rowIndex] ?? 0);
      nextRowRotations[rowIndex] = normalizedRotation;
      applyRowVisualState(rowIndex, normalizedRotation);
    }

    rowRotationsRef.current = nextRowRotations;
  }

  function applyDragRotation(deltaX: number) {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }
    applyRowRotationOffset(dragState.startRowRotations, deltaX * DRAG_ROTATION_FACTOR);
  }

  function wheelDeltaInPixels(event: ReactWheelEvent<HTMLElement>) {
    const rawDelta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return rawDelta * WHEEL_LINE_DELTA_PX;
    }
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return rawDelta * WHEEL_PAGE_DELTA_PX;
    }
    return rawDelta;
  }

  function handleWheel(event: ReactWheelEvent<HTMLElement>) {
    const delta = wheelDeltaInPixels(event);
    if (delta === 0) {
      return;
    }
    event.preventDefault();
    clearPendingHoveredRowUpdate();
    setHoveredSlotIndex(null);
    setPausedRow(null);
    applyRowRotationOffset(rowRotationsRef.current, -delta * WHEEL_ROTATION_FACTOR);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    const pointer = pointerSnapshot(event);
    const cardHit = cardHitForPointer(pointer);
    if (cardHit && expressionForSlotIndex(cardHit.index)) {
      event.preventDefault();
      setHoveredSlotIndex(cardHit.index);
      setPausedRow(cardHit.rowIndex);
      cardPressRef.current = {
        pointerId: event.pointerId,
        slotIndex: cardHit.index,
        startRowRotations: [...rowRotationsRef.current],
        startX: event.clientX,
        startY: event.clientY,
      };
      capturePointer(event.currentTarget, event.pointerId);
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest('[data-gallery-card="true"]')) {
      return;
    }
    event.preventDefault();
    setPausedRow(null);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startRowRotations: [...rowRotationsRef.current],
      startX: event.clientX,
    };
    capturePointer(event.currentTarget, event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const cardPress = cardPressRef.current;
    if (cardPress && cardPress.pointerId === event.pointerId) {
      const movedDistance = Math.hypot(
        event.clientX - cardPress.startX,
        event.clientY - cardPress.startY
      );
      if (movedDistance > CARD_PRESS_DRAG_THRESHOLD_PX) {
        cardPressRef.current = null;
        dragStateRef.current = {
          pointerId: event.pointerId,
          startRowRotations: cardPress.startRowRotations,
          startX: cardPress.startX,
        };
        applyDragRotation(event.clientX - cardPress.startX);
        setHoveredSlotIndex(null);
        setPausedRow(null);
        return;
      }
      scheduleHoveredRowUpdate(event);
      return;
    }

    const dragState = dragStateRef.current;
    if (dragState && dragState.pointerId === event.pointerId) {
      applyDragRotation(event.clientX - dragState.startX);
      return;
    }
    scheduleHoveredRowUpdate(event);
  }

  function handleMouseMove(event: ReactMouseEvent<HTMLElement>) {
    if (cardPressRef.current || dragStateRef.current) {
      return;
    }
    scheduleHoveredRowUpdate(event);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLElement>) {
    const cardPress = cardPressRef.current;
    if (cardPress && cardPress.pointerId === event.pointerId) {
      cardPressRef.current = null;
      releasePointerCapture(event.currentTarget, event.pointerId);
      const movedDistance = Math.hypot(
        event.clientX - cardPress.startX,
        event.clientY - cardPress.startY
      );
      const pointer = pointerSnapshot(event);
      const cardHit =
        movedDistance <= CARD_PRESS_DRAG_THRESHOLD_PX ? cardHitForPointer(pointer) : null;
      const expression = expressionForSlotIndex(
        cardHit?.index === cardPress.slotIndex ? cardHit.index : cardPress.slotIndex
      );
      if (movedDistance <= CARD_PRESS_DRAG_THRESHOLD_PX && expression) {
        onOpenExpression?.(expression);
      }
      setHoveredSlotIndex(cardHit?.index ?? null);
      setPausedRow(cardHit?.rowIndex ?? rowIndexForPointer(pointer));
      return;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    applyDragRotation(event.clientX - dragState.startX);
    dragStateRef.current = null;
    releasePointerCapture(event.currentTarget, event.pointerId);
    setPausedRow(rowIndexForPointer(pointerSnapshot(event)));
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLElement>) {
    if (cardPressRef.current?.pointerId === event.pointerId) {
      cardPressRef.current = null;
    }
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }
    releasePointerCapture(event.currentTarget, event.pointerId);
    clearPendingHoveredRowUpdate();
    setHoveredSlotIndex(null);
    setPausedRow(null);
  }

  function handlePointerLeave(event: ReactPointerEvent<HTMLElement>) {
    const cardPress = cardPressRef.current;
    const dragState = dragStateRef.current;
    if (cardPress) {
      releasePointerCapture(event.currentTarget, cardPress.pointerId);
    }
    if (dragState) {
      releasePointerCapture(event.currentTarget, dragState.pointerId);
    }
    cardPressRef.current = null;
    dragStateRef.current = null;
    clearPendingHoveredRowUpdate();
    setHoveredSlotIndex(null);
    setPausedRow(null);
  }

  return (
    <section
      aria-label="录音和笔记"
      className="relative flex min-h-0 flex-1 cursor-grab overflow-hidden bg-background active:cursor-grabbing"
      data-gallery-drag-surface="true"
      onMouseMove={handleMouseMove}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onWheel={handleWheel}
    >
      {skippedCount > 0 ? <p className="sr-only">部分记忆空间暂不可读</p> : null}

      {galleryExpressions.length === 0 || expressionsStatus === 'error' ? (
        <WorkspaceLibraryEmptyState status={expressionsStatus} />
      ) : null}

      {expressionsStatus !== 'error' ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background:
                'radial-gradient(ellipse 68% 78% at center, transparent 38%, var(--background) 100%)',
              maskImage: 'radial-gradient(ellipse 72% 82% at center, transparent 42%, black 100%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 72% 82% at center, transparent 42%, black 100%)',
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 z-0 h-full w-full -translate-x-1/2 -translate-y-1/2"
            style={{ perspective: '1400px', transformStyle: 'preserve-3d' }}
          >
            <div
              className="relative flex size-full items-center justify-center"
              style={{
                transformStyle: 'preserve-3d',
                transform: `scale(${GALLERY_CONFIG.zoom}) rotateX(0deg) rotateY(0deg)`,
              }}
            >
              {galleryRows.map((items, rowIndex) => (
                <div
                  key={rowIndex}
                  className="absolute left-1/2 top-1/2 size-0"
                  data-gallery-row={rowIndex}
                  style={{
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {items.map(({ index, node, slot }) =>
                    slot.kind === 'skeleton' ? (
                      <GallerySkeletonCard
                        key={slot.id}
                        node={node}
                        registerSlotElement={registerSlotElement}
                        slotIndex={index}
                      />
                    ) : (
                      <GalleryCard
                        key={slot.expression.id}
                        expression={slot.expression}
                        node={node}
                        onOpenExpression={onOpenExpression}
                        active={hoveredSlotIndex === index}
                        paused={hoveredRow === node.rowIndex}
                        registerCardElement={registerCardElement}
                        registerCoverImage={registerCoverImage}
                        registerSlotElement={registerSlotElement}
                        slotIndex={index}
                      />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
