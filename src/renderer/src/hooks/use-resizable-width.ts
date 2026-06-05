import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

type ResizeEdge = 'left' | 'right';

type DragState = {
  readonly pointerId: number;
  readonly startWidth: number;
  readonly startX: number;
};

type UseResizableWidthOptions = {
  readonly effectiveMaxWidth?: number;
  readonly initialWidth: number;
  readonly maxWidth: number;
  readonly minWidth: number;
  readonly resizeEdge: ResizeEdge;
  readonly step: number;
};

function clampWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(maxWidth, Math.max(minWidth, width));
}

function resolvePointerDelta(resizeEdge: ResizeEdge, startX: number, clientX: number) {
  return resizeEdge === 'left' ? startX - clientX : clientX - startX;
}

function resolveKeyboardDelta(resizeEdge: ResizeEdge, key: string, step: number) {
  if (key === 'ArrowLeft') {
    return resizeEdge === 'left' ? step : -step;
  }

  if (key === 'ArrowRight') {
    return resizeEdge === 'left' ? -step : step;
  }

  return null;
}

export function useResizableWidth({
  effectiveMaxWidth,
  initialWidth,
  maxWidth,
  minWidth,
  resizeEdge,
  step,
}: UseResizableWidthOptions) {
  const [requestedWidth, setRequestedWidth] = useState(() =>
    clampWidth(initialWidth, minWidth, maxWidth)
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const safeMaxWidth = clampWidth(effectiveMaxWidth ?? maxWidth, minWidth, maxWidth);
  const width = Math.min(safeMaxWidth, clampWidth(requestedWidth, minWidth, maxWidth));

  function setNextRequestedWidth(nextWidth: number) {
    const clampedWidth = clampWidth(nextWidth, minWidth, maxWidth);
    setRequestedWidth((currentWidth) =>
      currentWidth === clampedWidth ? currentWidth : clampedWidth
    );
  }

  function handleResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startWidth: width,
      startX: event.clientX,
    });
  }

  function handleResizePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    setNextRequestedWidth(
      dragState.startWidth + resolvePointerDelta(resizeEdge, dragState.startX, event.clientX)
    );
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = resolveKeyboardDelta(resizeEdge, event.key, step);
    if (delta === null) {
      return;
    }

    event.preventDefault();
    setNextRequestedWidth(requestedWidth + delta);
  }

  function endResize(event: PointerEvent<HTMLDivElement>) {
    if (dragState && event.pointerId === dragState.pointerId) {
      setDragState(null);
    }
  }

  return {
    isResizing: dragState !== null,
    maxWidth: safeMaxWidth,
    resizeHandleProps: {
      onKeyDown: handleResizeKeyDown,
      onLostPointerCapture: endResize,
      onPointerCancel: endResize,
      onPointerDown: handleResizePointerDown,
      onPointerMove: handleResizePointerMove,
      onPointerUp: endResize,
    },
    width,
  };
}
