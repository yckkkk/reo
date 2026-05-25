#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import WebSocket from 'ws';

const defaultPort = Number(process.env.REMOTE_DEBUGGING_PORT || 9233);
const defaultTolerance = 1.5;
const defaultMinCardWidth = 136;
const defaultMaxCardWidth = 150;
const defaultHttpTimeoutMs = 5000;
const defaultCdpCommandTimeoutMs = 10000;
const defaultMaxItems = 24;

function printHelp() {
  console.log(`Usage:
  REMOTE_DEBUGGING_PORT=9233 npm run dev
  npm run verify:memory-studio-layout -- --port 9233 --viewport 900x720 --screenshot docs/specs/.../artifacts/memory-studio-layout.png --metrics docs/specs/.../artifacts/memory-studio-layout.json

Options:
  --port <number>          Electron remote debugging port. Default: ${defaultPort}
  --host <host>            Remote debugging host. Default: 127.0.0.1
  --viewport <width>x<height>
                           Override viewport before measuring, for example 900x720.
  --interaction <mode>     Measurement interaction: click-scroll or none. Default: click-scroll
  --tolerance <px>         Allowed center alignment delta. Default: ${defaultTolerance}
  --min-card-width <px>    Minimum compact Segment card width. Default: ${defaultMinCardWidth}
  --max-card-width <px>    Maximum compact Segment card width. Default: ${defaultMaxCardWidth}
  --max-items <number>     Measure a bounded sample across rendered Segment items. Default: ${defaultMaxItems}.
  --full                   Measure every Segment item.
  --screenshot <path>      Write a viewport screenshot after measurement.
  --metrics <path>         Write machine-readable metrics JSON.
  --json                   Print metrics JSON to stdout.
`);
}

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function parseArgs(argv) {
  const options = {
    host: '127.0.0.1',
    port: defaultPort,
    tolerance: defaultTolerance,
    minCardWidth: defaultMinCardWidth,
    maxCardWidth: defaultMaxCardWidth,
    interaction: 'click-scroll',
    json: false,
    maxItems: defaultMaxItems,
  };

  const readValue = (index, option) => {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`${option} requires a value.`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--host':
        options.host = readValue(index, arg);
        index += 1;
        break;
      case '--port':
        options.port = Number(readValue(index, arg));
        index += 1;
        break;
      case '--viewport':
        options.viewport = parseViewport(readValue(index, arg));
        index += 1;
        break;
      case '--interaction':
        options.interaction = readValue(index, arg);
        index += 1;
        break;
      case '--tolerance':
        options.tolerance = Number(readValue(index, arg));
        index += 1;
        break;
      case '--min-card-width':
        options.minCardWidth = Number(readValue(index, arg));
        index += 1;
        break;
      case '--max-card-width':
        options.maxCardWidth = Number(readValue(index, arg));
        index += 1;
        break;
      case '--max-items':
        options.maxItems = Number(readValue(index, arg));
        index += 1;
        break;
      case '--full':
        options.maxItems = undefined;
        break;
      case '--screenshot':
        options.screenshot = readValue(index, arg);
        index += 1;
        break;
      case '--metrics':
        options.metrics = readValue(index, arg);
        index += 1;
        break;
      case '--json':
        options.json = true;
        break;
      default:
        fail(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(options.port) || options.port <= 0) {
    fail('--port must be a positive number.');
  }
  if (!Number.isFinite(options.tolerance) || options.tolerance < 0) {
    fail('--tolerance must be a non-negative number.');
  }
  if (!Number.isFinite(options.minCardWidth) || options.minCardWidth <= 0) {
    fail('--min-card-width must be a positive number.');
  }
  if (!Number.isFinite(options.maxCardWidth) || options.maxCardWidth < options.minCardWidth) {
    fail('--max-card-width must be greater than or equal to --min-card-width.');
  }
  if (
    options.maxItems !== undefined &&
    (!Number.isInteger(options.maxItems) || options.maxItems <= 0)
  ) {
    fail('--max-items must be a positive integer.');
  }
  if (!['click-scroll', 'none'].includes(options.interaction)) {
    fail('--interaction must be click-scroll or none.');
  }

  return options;
}

function parseViewport(value) {
  if (!value) {
    fail('--viewport requires a value like 900x720.');
  }
  const match = /^(\d+)x(\d+)$/i.exec(value);
  if (!match) {
    fail('--viewport must use <width>x<height>, for example 900x720.');
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    fail('--viewport width and height must be positive numbers.');
  }
  return { width, height };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), defaultHttpTimeoutMs);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    fail(
      `Cannot reach Electron remote debugging endpoint ${url}. Start runtime with REMOTE_DEBUGGING_PORT=<port> npm run dev. ${error.message}`
    );
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    fail(`Remote debugging endpoint ${url} returned ${response.status}.`);
  }
  return response.json();
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  const rejectPending = (error) => {
    for (const { reject, timeoutId } of pending.values()) {
      clearTimeout(timeoutId);
      reject(error);
    }
    pending.clear();
  };

  socket.on('message', (data) => {
    const message = JSON.parse(data.toString());
    if (!message.id || !pending.has(message.id)) {
      return;
    }
    const { resolve, reject, timeoutId } = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(timeoutId);
    if (message.error) {
      reject(new Error(message.error.message || JSON.stringify(message.error)));
      return;
    }
    resolve(message.result);
  });
  socket.on('error', (error) => {
    rejectPending(error);
  });
  socket.on('close', () => {
    rejectPending(new Error('CDP socket closed before pending commands completed.'));
  });

  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.close();
      reject(new Error(`CDP socket did not open within ${defaultCdpCommandTimeoutMs}ms.`));
    }, defaultCdpCommandTimeoutMs);
    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off('open', handleOpen);
      socket.off('error', handleError);
    };
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = (error) => {
      cleanup();
      reject(error);
    };
    socket.once('open', handleOpen);
    socket.once('error', handleError);
  });

  return {
    send(method, params = {}) {
      if (socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error(`CDP socket is not open for ${method}.`));
      }
      const id = nextId;
      nextId += 1;
      const payload = JSON.stringify({ id, method, params });
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pending.delete(id);
          reject(
            new Error(`CDP command timed out after ${defaultCdpCommandTimeoutMs}ms: ${method}`)
          );
        }, defaultCdpCommandTimeoutMs);
        pending.set(id, { method, resolve, reject, timeoutId });
        socket.send(payload, (error) => {
          if (error) {
            const pendingCommand = pending.get(id);
            pending.delete(id);
            if (pendingCommand) {
              clearTimeout(pendingCommand.timeoutId);
            }
            reject(error);
          }
        });
      });
    },
    close() {
      socket.close();
    },
  };
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    fail(`Runtime evaluation failed: ${result.exceptionDetails.text}`);
  }
  return result.result.value;
}

function measurementExpression(maxItems) {
  const maxMeasuredItems = maxItems === undefined ? 'null' : JSON.stringify(maxItems);
  return `(async () => {
    const studio = document.querySelector('[aria-label="Memory Studio"]');
    if (!studio) {
      return { ok: false, reason: 'Memory Studio region is not visible.' };
    }

    const appShellRoot = document.querySelector('[data-slot="app-shell-root"]');
    const appShellPanel = document.querySelector('[aria-label="记忆空间内容"]');
    const appShellPanelContent = document.querySelector('[data-slot="app-shell-panel-content"]');
    const workspaceFrame = document.querySelector('[data-slot="workspace-frame"]');
    const workspaceStageShell = document.querySelector('[data-slot="workspace-stage-shell"]');
    const workspaceStageContent = document.querySelector('[data-slot="workspace-stage-content"]');
    const workspaceFabTrack = document.querySelector('[data-slot="workspace-expression-fab-track"]');
    const workspaceRailShell = document.querySelector('[data-slot="workspace-memory-rail-shell"]');
    const studioLayout = studio.querySelector('[data-slot="memory-studio-layout"]');
    const scroll = studio.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');
    const items = Array.from(studio.querySelectorAll('[data-slot="memory-studio-segment-item"]'));
    const maxMountedItems = 96;
    if (items.length > maxMountedItems) {
      return {
        ok: false,
        reason: 'Too many mounted Segment items; Segment strip windowing is not bounded.',
        itemCount: items.length,
        maxMountedItems,
      };
    }
    const maxMeasuredItems = ${maxMeasuredItems};
    const selectMeasuredItems = () => {
      if (maxMeasuredItems === null || items.length <= maxMeasuredItems) {
        return items.map((item, index) => ({ item, index }));
      }
      const selectedIndex = items.findIndex((item) =>
        Boolean(item.querySelector('[aria-current="true"]'))
      );
      const indexes = new Set();
      const addIndex = (index) => {
        if (Number.isInteger(index) && index >= 0 && index < items.length) {
          indexes.add(index);
        }
      };
      addIndex(0);
      addIndex(items.length - 1);
      addIndex(selectedIndex);
      const visibleStart = scroll.scrollLeft;
      const visibleEnd = scroll.scrollLeft + scroll.clientWidth;
      for (let index = 0; index < items.length; index += 1) {
        if (indexes.size >= maxMeasuredItems) break;
        const item = items[index];
        if (!item) continue;
        const itemStart = item.offsetLeft;
        const itemEnd = itemStart + item.offsetWidth;
        if (itemEnd >= visibleStart && itemStart <= visibleEnd) {
          addIndex(index);
        }
      }
      let left = 0;
      let right = items.length - 1;
      while (indexes.size < maxMeasuredItems && left <= right) {
        addIndex(left);
        if (indexes.size >= maxMeasuredItems) break;
        addIndex(right);
        left += 1;
        right -= 1;
      }
      return [...indexes]
        .sort((leftIndex, rightIndex) => leftIndex - rightIndex)
        .map((index) => ({ item: items[index], index }));
    };
    const measuredItems = selectMeasuredItems();
    const nav = studio.querySelector('[aria-label="Memory 片段时间轴"]');
    const player = studio.querySelector('[data-slot="memory-studio-player"]');
    const supplementPlayer = studio.querySelector('[data-slot="memory-studio-supplement-player"]');
    const playerPlaceholder = studio.querySelector(
      '[data-slot="memory-studio-player-placeholder"]'
    );
    const playerTime = studio.querySelector('[data-slot="memory-studio-audio-player-time"]');
    const contentPanel = studio.querySelector('[data-slot="memory-studio-content-panel"]');
    const contentTabRailRow = studio.querySelector(
      '[data-slot="memory-studio-content-tab-rail-row"]'
    );
    const inlineEditor = studio.querySelector(
      '[data-slot="memory-studio-inline-markdown-editor"]'
    );
    const editorSurface = inlineEditor
      ? inlineEditor.querySelector('[data-slot="lightweight-markdown-editor-surface"]')
      : null;
    const editorToolbar = inlineEditor
      ? inlineEditor.querySelector('[data-slot="lightweight-markdown-editor-toolbar"]')
      : null;
    const editorBody = inlineEditor
      ? inlineEditor.querySelector('[data-slot="lightweight-markdown-editor-body"]')
      : null;
    const editorTextarea = inlineEditor ? inlineEditor.querySelector('textarea') : null;
    const editorActionButtonLabels = editorToolbar
      ? Array.from(editorToolbar.querySelectorAll('button')).map((button) =>
          (button.textContent || button.getAttribute('aria-label') || '').trim()
        )
      : [];
    const editorToolbarButtonStyles = editorToolbar
      ? Array.from(editorToolbar.querySelectorAll('button')).map((button) => {
          const style = getComputedStyle(button);
          return {
            label: (button.textContent || button.getAttribute('aria-label') || '').trim(),
            backgroundColor: style.getPropertyValue('background-color'),
            transitionProperty: style.getPropertyValue('transition-property'),
          };
        })
      : [];
    const activeContentTab = studio.querySelector('[role="tab"][aria-selected="true"]');
    const activeContentTabSupplementType = activeContentTab
      ? activeContentTab.getAttribute('data-supplement-type')
      : null;
    const selectedItem = items.find((item) => Boolean(item.querySelector('[aria-current="true"]')));
    const selectedSegmentKind = selectedItem
      ? selectedItem.querySelector('[data-slot="memory-studio-segment-card-duration"]')
        ? 'audio'
        : selectedItem.querySelector('[data-slot="memory-studio-segment-card-note-size"]')
          ? 'note'
          : 'unknown'
      : null;
    if (!scroll || items.length === 0) {
      return { ok: false, reason: 'Segment strip scroll owner or Segment items are missing.' };
    }

    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      };
    };

    const itemMetrics = measuredItems.map(({ item, index }) => {
      const card = item.querySelector('[data-slot="memory-studio-segment-card"]');
      const dot = item.querySelector('[data-slot="memory-studio-segment-timeline-dot"]');
      const time = item.querySelector('[data-slot="memory-studio-segment-timeline-time"]');
      const anchor = item.querySelector('[data-slot="memory-studio-segment-timeline-anchor"]');
      const itemRect = rectOf(item);
      const cardRect = card ? rectOf(card) : null;
      const dotRect = dot ? rectOf(dot) : null;
      const timeRect = time ? rectOf(time) : null;
      const anchorRect = anchor ? rectOf(anchor) : null;
      const anchorLineStyle = anchor ? getComputedStyle(anchor, '::before') : null;
      const anchorLineTop = anchorLineStyle ? Number.parseFloat(anchorLineStyle.top) : Number.NaN;
      const anchorLineHeight = anchorLineStyle
        ? Number.parseFloat(anchorLineStyle.height)
        : Number.NaN;
      const timelineLineCenterY =
        anchorRect && Number.isFinite(anchorLineTop) && Number.isFinite(anchorLineHeight)
          ? anchorRect.top + anchorLineTop + anchorLineHeight / 2
          : null;
      return {
        index,
        label: item.getAttribute('aria-label'),
        selected: Boolean(item.querySelector('[aria-current="true"]')),
        itemRect,
        cardRect,
        dotRect,
        timeRect,
        timeText: time ? time.textContent.trim() : '',
        anchorRect,
        dotToCardCenterDelta: cardRect && dotRect ? dotRect.centerX - cardRect.centerX : null,
        dotToTimelineLineCenterDelta:
          dotRect && timelineLineCenterY ? dotRect.centerY - timelineLineCenterY : null,
        timeToCardCenterDelta: cardRect && timeRect ? timeRect.centerX - cardRect.centerX : null,
        timelineLineCenterY,
        timelineBelowCard: cardRect && anchorRect ? anchorRect.top >= cardRect.bottom : false,
      };
    });

    const playerTimeStyle = playerTime ? getComputedStyle(playerTime) : null;
    const stageContentRect =
      workspaceStageContent ? rectOf(workspaceStageContent) : null;
    const stageShellRect = workspaceStageShell ? rectOf(workspaceStageShell) : null;
    const fabTrackRect = workspaceFabTrack ? rectOf(workspaceFabTrack) : null;
    const studioRect = rectOf(studio);
    const studioLayoutRect = studioLayout ? rectOf(studioLayout) : null;
    const contentPanelRect = contentPanel ? rectOf(contentPanel) : null;
    const contentTabRailRowRect = contentTabRailRow ? rectOf(contentTabRailRow) : null;
    const inlineEditorRect = inlineEditor ? rectOf(inlineEditor) : null;
    const editorSurfaceRect = editorSurface ? rectOf(editorSurface) : null;
    const editorToolbarRect = editorToolbar ? rectOf(editorToolbar) : null;
    const editorBodyRect = editorBody ? rectOf(editorBody) : null;
    const editorTextareaRect = editorTextarea ? rectOf(editorTextarea) : null;
    const supplementPlayerRect = supplementPlayer ? rectOf(supplementPlayer) : null;
    const stageContentStyle = workspaceStageContent
      ? getComputedStyle(workspaceStageContent)
      : null;
    const editorSurfaceStyle = editorSurface ? getComputedStyle(editorSurface) : null;
    const editorToolbarStyle = editorToolbar ? getComputedStyle(editorToolbar) : null;
    const editorBodyStyle = editorBody ? getComputedStyle(editorBody) : null;
    const editorTextareaStyle = editorTextarea ? getComputedStyle(editorTextarea) : null;
    const editorDefaultBorderColor = editorSurfaceStyle
      ? editorSurfaceStyle.getPropertyValue('border-top-color')
      : null;
    const editorSurfaceTransitionProperty = editorSurfaceStyle
      ? editorSurfaceStyle.getPropertyValue('transition-property')
      : null;
    const editorInitiallyFocused = document.activeElement === editorTextarea;
    const styleNumber = (style, property) => {
      if (!style) return null;
      const value = Number.parseFloat(style.getPropertyValue(property));
      return Number.isFinite(value) ? value : null;
    };

    return {
      ok: true,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      windowScrollX: window.scrollX,
      windowScrollY: window.scrollY,
      appShell: {
        rootRect: appShellRoot ? rectOf(appShellRoot) : null,
        panelRect: appShellPanel ? rectOf(appShellPanel) : null,
        panelContentRect: appShellPanelContent ? rectOf(appShellPanelContent) : null,
        rootOverflow: appShellRoot ? getComputedStyle(appShellRoot).overflow : null,
        panelOverflow: appShellPanel ? getComputedStyle(appShellPanel).overflow : null,
        panelContentOverflow: appShellPanelContent
          ? getComputedStyle(appShellPanelContent).overflow
          : null,
      },
      workspace: {
        frameRect: workspaceFrame ? rectOf(workspaceFrame) : null,
        stageShellRect,
        stageContentRect,
        fabTrackRect,
        stageContentMaxWidth: stageContentStyle ? stageContentStyle.maxWidth : null,
        stageContentLeftGutter:
          stageShellRect && stageContentRect ? stageContentRect.left - stageShellRect.left : null,
        stageContentRightGutter:
          stageShellRect && stageContentRect ? stageShellRect.right - stageContentRect.right : null,
        fabTrackLeftGutter:
          stageShellRect && fabTrackRect ? fabTrackRect.left - stageShellRect.left : null,
        fabTrackRightGutter:
          stageShellRect && fabTrackRect ? stageShellRect.right - fabTrackRect.right : null,
        railShellRect: workspaceRailShell ? rectOf(workspaceRailShell) : null,
        railMode: workspaceRailShell ? workspaceRailShell.getAttribute('data-rail-mode') : null,
        railHidden: workspaceRailShell
          ? workspaceRailShell.getAttribute('aria-hidden') === 'true'
          : null,
        frameOverflow: workspaceFrame ? getComputedStyle(workspaceFrame).overflow : null,
        stageShellOverflow: workspaceStageShell
          ? getComputedStyle(workspaceStageShell).overflow
          : null,
        railShellOverflow: workspaceRailShell ? getComputedStyle(workspaceRailShell).overflow : null,
      },
      studioRect,
      studioLayoutRect,
      contentPanelRect,
      editor: {
        activeContentTabSupplementType,
        contentTabRailRowRect,
        supplementPlayerRect,
        inlineRect: inlineEditorRect,
        surfaceRect: editorSurfaceRect,
        toolbarRect: editorToolbarRect,
        bodyRect: editorBodyRect,
        textareaRect: editorTextareaRect,
        actionButtonLabels: editorActionButtonLabels,
        initiallyFocused: editorInitiallyFocused,
        defaultBorderColor: editorDefaultBorderColor,
        surfaceTransitionProperty: editorSurfaceTransitionProperty,
        focusProbe: null,
        tabToEditorGap:
          contentTabRailRowRect && inlineEditorRect
            ? inlineEditorRect.top - contentTabRailRowRect.bottom
            : null,
        supplementPlayerToEditorGap:
          supplementPlayerRect && inlineEditorRect
            ? inlineEditorRect.top - supplementPlayerRect.bottom
            : null,
        bottomToContentPanelBottom:
          contentPanelRect && inlineEditorRect
            ? contentPanelRect.bottom - inlineEditorRect.bottom
            : null,
        expectedWidth: stageShellRect ? Math.max(0, stageShellRect.width - 80) : null,
        leftToStageShellLeft:
          stageShellRect && inlineEditorRect ? inlineEditorRect.left - stageShellRect.left : null,
        rightToStageShellRight:
          stageShellRect && inlineEditorRect ? stageShellRect.right - inlineEditorRect.right : null,
        bottomToViewportBottom: inlineEditorRect ? window.innerHeight - inlineEditorRect.bottom : null,
        surfaceBorderTopWidth: styleNumber(editorSurfaceStyle, 'border-top-width'),
        surfaceBorderRightWidth: styleNumber(editorSurfaceStyle, 'border-right-width'),
        surfaceBorderBottomWidth: styleNumber(editorSurfaceStyle, 'border-bottom-width'),
        surfaceBorderLeftWidth: styleNumber(editorSurfaceStyle, 'border-left-width'),
        surfaceBorderRadius: styleNumber(editorSurfaceStyle, 'border-top-left-radius'),
        toolbarPaddingLeft: styleNumber(editorToolbarStyle, 'padding-left'),
        toolbarPaddingRight: styleNumber(editorToolbarStyle, 'padding-right'),
        toolbarHeight: editorToolbarRect ? editorToolbarRect.height : null,
        toolbarBackgroundColor: editorToolbarStyle
          ? editorToolbarStyle.getPropertyValue('background-color')
          : null,
        toolbarTransitionProperty: editorToolbarStyle
          ? editorToolbarStyle.getPropertyValue('transition-property')
          : null,
        toolbarButtonStyles: editorToolbarButtonStyles,
        bodyPaddingLeft: styleNumber(editorBodyStyle, 'padding-left'),
        bodyPaddingRight: styleNumber(editorBodyStyle, 'padding-right'),
        bodyPaddingTop: styleNumber(editorBodyStyle, 'padding-top'),
        bodyPaddingBottom: styleNumber(editorBodyStyle, 'padding-bottom'),
        bodyBackgroundColor: editorBodyStyle
          ? editorBodyStyle.getPropertyValue('background-color')
          : null,
        bodyTransitionProperty: editorBodyStyle
          ? editorBodyStyle.getPropertyValue('transition-property')
          : null,
        textareaBackgroundColor: editorTextareaStyle
          ? editorTextareaStyle.getPropertyValue('background-color')
          : null,
        textareaTransitionProperty: editorTextareaStyle
          ? editorTextareaStyle.getPropertyValue('transition-property')
          : null,
        textareaFontSize: styleNumber(editorTextareaStyle, 'font-size'),
        textareaLineHeight: styleNumber(editorTextareaStyle, 'line-height'),
        textareaFontFamily: editorTextareaStyle ? editorTextareaStyle.fontFamily : null,
      },
      standaloneTimelineExists: Boolean(nav),
      stripScrollOwnerCount: studio.querySelectorAll('[data-slot="memory-studio-segment-strip-scroll"]').length,
      itemCount: items.length,
      measuredItemCount: measuredItems.length,
      itemSampled: measuredItems.length < items.length,
      selectedItemCount: items.filter((item) =>
        Boolean(item.querySelector('[aria-current="true"]'))
      ).length,
      selectedSegmentKind,
      scroll: {
        left: scroll.scrollLeft,
        width: scroll.scrollWidth,
        clientWidth: scroll.clientWidth,
        rect: rectOf(scroll),
      },
      player: {
        rowRect: player ? rectOf(player) : null,
        placeholderRect: playerPlaceholder ? rectOf(playerPlaceholder) : null,
        timeRect: playerTime ? rectOf(playerTime) : null,
        timeWhiteSpace: playerTimeStyle ? playerTimeStyle.whiteSpace : null,
        timeText: playerTime ? playerTime.textContent : null,
      },
      items: itemMetrics,
    };
  })()`;
}

function centerPointExpression(selector, index = 0) {
  return `(() => {
    const elements = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
    const element = elements[${index}];
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`;
}

async function probeEditorTextareaFocus(client) {
  const before = await evaluate(
    client,
    `(() => {
      const surface = document.querySelector('[data-slot="lightweight-markdown-editor-surface"]');
      const textarea = surface ? surface.querySelector('textarea') : null;
      const toolbar = surface ? surface.querySelector('[data-slot="lightweight-markdown-editor-toolbar"]') : null;
      if (!surface || !textarea) {
        return { ok: false, reason: 'Inline editor textarea is missing.' };
      }
      const rect = textarea.getBoundingClientRect();
      return {
        ok: true,
        x: rect.left + Math.min(24, Math.max(1, rect.width / 2)),
        y: rect.top + Math.min(24, Math.max(1, rect.height / 2)),
        borderColor: getComputedStyle(surface).getPropertyValue('border-top-color'),
        actionButtonLabels: toolbar
          ? Array.from(toolbar.querySelectorAll('button')).map((button) =>
              (button.textContent || button.getAttribute('aria-label') || '').trim()
            )
          : [],
      };
    })()`
  );
  if (!before.ok) {
    return { focused: false, borderColor: null, actionButtonLabels: [], reason: before.reason };
  }

  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: before.x,
    y: before.y,
    button: 'left',
    clickCount: 1,
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: before.x,
    y: before.y,
    button: 'left',
    clickCount: 1,
  });
  await evaluate(client, `new Promise((resolve) => setTimeout(resolve, 220))`);

  return await evaluate(
    client,
    `(() => {
      const surface = document.querySelector('[data-slot="lightweight-markdown-editor-surface"]');
      const textarea = surface ? surface.querySelector('textarea') : null;
      const toolbar = surface ? surface.querySelector('[data-slot="lightweight-markdown-editor-toolbar"]') : null;
      if (!surface || !textarea) {
        return { focused: false, borderColor: null, actionButtonLabels: [] };
      }
      return {
        focused: document.activeElement === textarea,
        borderColor: getComputedStyle(surface).getPropertyValue('border-top-color'),
        actionButtonLabels: toolbar
          ? Array.from(toolbar.querySelectorAll('button')).map((button) =>
              (button.textContent || button.getAttribute('aria-label') || '').trim()
            )
          : [],
      };
    })()`
  );
}

function waitExpression() {
  return `new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
  })`;
}

function assertRectInsideViewport(failures, label, rect, viewport, tolerance) {
  if (!rect) {
    failures.push(`${label} is missing.`);
    return;
  }
  if (rect.left < -tolerance || rect.right > viewport.width + tolerance) {
    failures.push(
      `${label} overflows viewport horizontally: left=${rect.left.toFixed(2)}, right=${rect.right.toFixed(2)}, viewport=${viewport.width}.`
    );
  }
  if (rect.top < -tolerance || rect.bottom > viewport.height + tolerance) {
    failures.push(
      `${label} overflows viewport vertically: top=${rect.top.toFixed(2)}, bottom=${rect.bottom.toFixed(2)}, viewport=${viewport.height}.`
    );
  }
}

function assertApprox(failures, label, actual, expected, tolerance) {
  if (actual === null || actual === undefined || !Number.isFinite(actual)) {
    failures.push(`${label} is missing.`);
    return;
  }
  if (Math.abs(actual - expected) > tolerance) {
    failures.push(`${label} expected ${expected}px; received ${actual.toFixed(2)}px.`);
  }
}

function assertMetrics(metrics, options) {
  const failures = [];
  const { tolerance, minCardWidth, maxCardWidth } = options;
  if (!metrics.ok) {
    failures.push(metrics.reason || 'Unknown measurement failure.');
    return failures;
  }
  if (metrics.standaloneTimelineExists) {
    failures.push('Standalone Memory timeline navigation still exists.');
  }
  if (metrics.stripScrollOwnerCount !== 1) {
    failures.push(
      `Expected 1 segment strip scroll owner, received ${metrics.stripScrollOwnerCount}.`
    );
  }
  if (metrics.selectedItemCount !== 1) {
    failures.push(`Expected 1 selected Segment item, received ${metrics.selectedItemCount}.`);
  }
  if (!['audio', 'note'].includes(metrics.selectedSegmentKind)) {
    failures.push(
      `Expected selected Segment kind audio or note; received ${metrics.selectedSegmentKind}.`
    );
  }
  if (metrics.windowScrollY !== 0) {
    failures.push(`Expected windowScrollY 0, received ${metrics.windowScrollY}.`);
  }
  if (metrics.windowScrollX !== 0) {
    failures.push(`Expected windowScrollX 0, received ${metrics.windowScrollX}.`);
  }
  if (metrics.documentHeight > metrics.viewport.height + 2) {
    failures.push(
      `Expected Memory Studio to fit the viewport height; document height ${metrics.documentHeight}, viewport ${metrics.viewport.height}.`
    );
  }
  if (metrics.documentWidth > metrics.viewport.width + 2) {
    failures.push(
      `Expected Memory Studio to fit the viewport width; document width ${metrics.documentWidth}, viewport ${metrics.viewport.width}.`
    );
  }

  if (metrics.appShell.rootOverflow !== 'hidden') {
    failures.push(
      `Expected AppShell root overflow hidden; received ${metrics.appShell.rootOverflow}.`
    );
  }
  if (metrics.appShell.panelOverflow !== 'hidden') {
    failures.push(
      `Expected AppShell panel overflow hidden; received ${metrics.appShell.panelOverflow}.`
    );
  }
  if (metrics.appShell.panelContentOverflow !== 'hidden') {
    failures.push(
      `Expected AppShell panel content overflow hidden; received ${metrics.appShell.panelContentOverflow}.`
    );
  }
  if (metrics.workspace.frameOverflow !== 'hidden') {
    failures.push(
      `Expected WorkspaceFrame overflow hidden; received ${metrics.workspace.frameOverflow}.`
    );
  }
  if (metrics.viewport.width < 1100 && metrics.workspace.railMode !== 'overlay') {
    failures.push(
      `Expected compact MemoryRail mode overlay below 1100px; received ${metrics.workspace.railMode}.`
    );
  }
  if (metrics.viewport.width < 1100 && metrics.workspace.railHidden !== true) {
    failures.push(
      'Expected compact MemoryRail to start hidden so it cannot squeeze Memory Studio.'
    );
  }

  assertRectInsideViewport(
    failures,
    'AppShell root',
    metrics.appShell.rootRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'AppShell panel',
    metrics.appShell.panelRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'AppShell panel content',
    metrics.appShell.panelContentRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'WorkspaceFrame',
    metrics.workspace.frameRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'Workspace stage shell',
    metrics.workspace.stageShellRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'Workspace stage content',
    metrics.workspace.stageContentRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'Workspace expression FAB track',
    metrics.workspace.fabTrackRect,
    metrics.viewport,
    tolerance
  );
  if (
    metrics.workspace.stageContentLeftGutter === null ||
    metrics.workspace.stageContentRightGutter === null ||
    Math.abs(metrics.workspace.stageContentLeftGutter - metrics.workspace.stageContentRightGutter) >
      tolerance
  ) {
    failures.push(
      `Expected Workspace stage content gutters to be symmetric; left=${metrics.workspace.stageContentLeftGutter?.toFixed(2) ?? 'missing'}, right=${metrics.workspace.stageContentRightGutter?.toFixed(2) ?? 'missing'}.`
    );
  }
  if (
    metrics.workspace.fabTrackLeftGutter === null ||
    metrics.workspace.fabTrackRightGutter === null ||
    Math.abs(metrics.workspace.fabTrackLeftGutter - metrics.workspace.fabTrackRightGutter) >
      tolerance
  ) {
    failures.push(
      `Expected Workspace FAB track gutters to match the stage content model; left=${metrics.workspace.fabTrackLeftGutter?.toFixed(2) ?? 'missing'}, right=${metrics.workspace.fabTrackRightGutter?.toFixed(2) ?? 'missing'}.`
    );
  }
  if (
    metrics.workspace.stageContentRect &&
    metrics.studioRect &&
    Math.abs(metrics.workspace.stageContentRect.width - metrics.studioRect.width) > tolerance
  ) {
    failures.push(
      `Expected Memory Studio to fill the stage content track; stage=${metrics.workspace.stageContentRect.width.toFixed(2)}px, studio=${metrics.studioRect.width.toFixed(2)}px.`
    );
  }
  if (
    metrics.studioLayoutRect &&
    metrics.studioRect &&
    Math.abs(metrics.studioLayoutRect.width - metrics.studioRect.width) > tolerance
  ) {
    failures.push(
      `Expected Memory Studio layout to fill its region; layout=${metrics.studioLayoutRect.width.toFixed(2)}px, studio=${metrics.studioRect.width.toFixed(2)}px.`
    );
  }
  if (metrics.workspace.railHidden !== true) {
    assertRectInsideViewport(
      failures,
      'Workspace MemoryRail shell',
      metrics.workspace.railShellRect,
      metrics.viewport,
      tolerance
    );
  }

  assertRectInsideViewport(
    failures,
    'Memory Studio region',
    metrics.studioRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'Memory Studio content panel',
    metrics.contentPanelRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'Memory Studio content tab rail row',
    metrics.editor.contentTabRailRowRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'Memory Studio inline markdown editor',
    metrics.editor.inlineRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'Lightweight markdown editor toolbar',
    metrics.editor.toolbarRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'Lightweight markdown editor body',
    metrics.editor.bodyRect,
    metrics.viewport,
    tolerance
  );
  assertRectInsideViewport(
    failures,
    'Lightweight markdown editor textarea',
    metrics.editor.textareaRect,
    metrics.viewport,
    tolerance
  );
  if (metrics.editor.activeContentTabSupplementType === 'audio') {
    assertRectInsideViewport(
      failures,
      'Memory Studio supplement audio player',
      metrics.editor.supplementPlayerRect,
      metrics.viewport,
      tolerance
    );
    assertApprox(
      failures,
      'Supplement audio player to editor gap',
      metrics.editor.supplementPlayerToEditorGap,
      14,
      tolerance
    );
  } else {
    assertApprox(
      failures,
      'Content tab rail to editor gap',
      metrics.editor.tabToEditorGap,
      14,
      tolerance
    );
  }
  if (
    metrics.editor.expectedWidth !== null &&
    metrics.editor.inlineRect &&
    Math.abs(metrics.editor.inlineRect.width - metrics.editor.expectedWidth) > tolerance
  ) {
    failures.push(
      `Expected inline editor width ${metrics.editor.expectedWidth.toFixed(2)}px; received ${metrics.editor.inlineRect.width.toFixed(2)}px.`
    );
  }
  assertApprox(
    failures,
    'Inline editor bottom to content panel bottom',
    metrics.editor.bottomToContentPanelBottom,
    0,
    tolerance
  );
  assertApprox(
    failures,
    'Inline editor left gutter',
    metrics.editor.leftToStageShellLeft,
    40,
    tolerance
  );
  assertApprox(
    failures,
    'Inline editor right gutter',
    metrics.editor.rightToStageShellRight,
    40,
    tolerance
  );
  assertApprox(
    failures,
    'Inline editor bottom to viewport bottom',
    metrics.editor.bottomToViewportBottom,
    32,
    tolerance
  );
  if (
    metrics.editor.surfaceRect &&
    metrics.editor.inlineRect &&
    (Math.abs(metrics.editor.surfaceRect.width - metrics.editor.inlineRect.width) > tolerance ||
      Math.abs(metrics.editor.surfaceRect.height - metrics.editor.inlineRect.height) > tolerance)
  ) {
    failures.push(
      `Expected editor surface to fill inline editor; inline=${metrics.editor.inlineRect.width.toFixed(2)}x${metrics.editor.inlineRect.height.toFixed(2)}, surface=${metrics.editor.surfaceRect.width.toFixed(2)}x${metrics.editor.surfaceRect.height.toFixed(2)}.`
    );
  }
  for (const [label, width] of [
    ['top', metrics.editor.surfaceBorderTopWidth],
    ['right', metrics.editor.surfaceBorderRightWidth],
    ['bottom', metrics.editor.surfaceBorderBottomWidth],
    ['left', metrics.editor.surfaceBorderLeftWidth],
  ]) {
    assertApprox(failures, `Editor ${label} border width`, width, 1, tolerance);
  }
  assertApprox(failures, 'Editor border radius', metrics.editor.surfaceBorderRadius, 12, tolerance);
  assertApprox(failures, 'Editor toolbar height', metrics.editor.toolbarHeight, 44, tolerance);
  assertApprox(
    failures,
    'Editor toolbar left padding',
    metrics.editor.toolbarPaddingLeft,
    12,
    tolerance
  );
  assertApprox(
    failures,
    'Editor toolbar right padding',
    metrics.editor.toolbarPaddingRight,
    12,
    tolerance
  );
  assertApprox(failures, 'Editor body left padding', metrics.editor.bodyPaddingLeft, 20, tolerance);
  assertApprox(
    failures,
    'Editor body right padding',
    metrics.editor.bodyPaddingRight,
    20,
    tolerance
  );
  assertApprox(failures, 'Editor body top padding', metrics.editor.bodyPaddingTop, 16, tolerance);
  assertApprox(
    failures,
    'Editor body bottom padding',
    metrics.editor.bodyPaddingBottom,
    16,
    tolerance
  );
  assertApprox(
    failures,
    'Editor textarea font size',
    metrics.editor.textareaFontSize,
    14,
    tolerance
  );
  assertApprox(
    failures,
    'Editor textarea line height',
    metrics.editor.textareaLineHeight,
    23.1,
    tolerance
  );
  if (!metrics.editor.textareaFontFamily?.toLowerCase().includes('mono')) {
    failures.push(
      `Expected editor textarea to use mono font family; received ${metrics.editor.textareaFontFamily ?? 'missing'}.`
    );
  }
  if (
    metrics.editor.toolbarRect &&
    metrics.editor.bodyRect &&
    Math.abs(metrics.editor.bodyRect.top - metrics.editor.toolbarRect.bottom) > tolerance
  ) {
    failures.push(
      `Expected editor body to start directly below toolbar; toolbarBottom=${metrics.editor.toolbarRect.bottom.toFixed(2)}, bodyTop=${metrics.editor.bodyRect.top.toFixed(2)}.`
    );
  }
  if (
    metrics.editor.toolbarBackgroundColor &&
    metrics.editor.toolbarBackgroundColor !== 'rgba(0, 0, 0, 0)'
  ) {
    failures.push(
      `Expected editor toolbar background to stay transparent; received ${metrics.editor.toolbarBackgroundColor}.`
    );
  }
  if (
    metrics.editor.toolbarTransitionProperty &&
    metrics.editor.toolbarTransitionProperty !== 'none'
  ) {
    failures.push(
      `Expected editor toolbar to avoid color transitions; transition-property=${metrics.editor.toolbarTransitionProperty}.`
    );
  }
  for (const buttonStyle of metrics.editor.toolbarButtonStyles ?? []) {
    if (buttonStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      failures.push(
        `Expected toolbar button ${buttonStyle.label || '(unlabelled)'} background to stay transparent; received ${buttonStyle.backgroundColor}.`
      );
    }
    if (buttonStyle.transitionProperty !== 'none') {
      failures.push(
        `Expected toolbar button ${buttonStyle.label || '(unlabelled)'} to avoid color transitions; transition-property=${buttonStyle.transitionProperty}.`
      );
    }
  }
  if (metrics.editor.initiallyFocused) {
    failures.push('Expected inline editor textarea not to be focused after Memory/tab selection.');
  }
  if (metrics.editor.actionButtonLabels?.includes('取消')) {
    failures.push('Expected inline editor cancel button to stay hidden before dirty editing.');
  }
  if (metrics.editor.actionButtonLabels?.includes('保存')) {
    failures.push('Expected inline editor save button to stay hidden before dirty editing.');
  }
  if (!metrics.editor.focusProbe?.focused) {
    failures.push('Expected clicking/focusing the inline editor textarea to focus it.');
  }
  if (
    metrics.editor.focusProbe?.borderColor &&
    metrics.editor.defaultBorderColor &&
    metrics.editor.focusProbe.borderColor === metrics.editor.defaultBorderColor
  ) {
    failures.push(
      `Expected inline editor border color to change on textarea focus; default=${metrics.editor.defaultBorderColor}, focused=${metrics.editor.focusProbe.borderColor}.`
    );
  }
  if (metrics.editor.focusProbe?.actionButtonLabels?.includes('取消')) {
    failures.push('Expected inline editor cancel button to stay hidden when focused but clean.');
  }
  if (metrics.editor.focusProbe?.actionButtonLabels?.includes('保存')) {
    failures.push('Expected inline editor save button to stay hidden when focused but clean.');
  }
  if (metrics.selectedSegmentKind === 'audio') {
    assertRectInsideViewport(
      failures,
      'Memory Studio audio player',
      metrics.player.rowRect,
      metrics.viewport,
      tolerance
    );
    if (metrics.player.timeWhiteSpace !== 'nowrap') {
      failures.push(
        `Expected audio player time to stay on one line; white-space=${metrics.player.timeWhiteSpace}.`
      );
    }
    assertRectInsideViewport(
      failures,
      'Memory Studio audio player time',
      metrics.player.timeRect,
      metrics.viewport,
      tolerance
    );
  } else if (metrics.selectedSegmentKind === 'note') {
    if (metrics.player.rowRect !== null) {
      failures.push('Expected Note Segment not to render an actionable audio player.');
    }
    assertRectInsideViewport(
      failures,
      'Memory Studio note player placeholder',
      metrics.player.placeholderRect,
      metrics.viewport,
      tolerance
    );
  }

  for (const item of metrics.items) {
    if (!item.cardRect || !item.dotRect || !item.timeRect || !item.anchorRect) {
      failures.push(`Segment item ${item.index} is missing card, dot, time, or anchor.`);
      continue;
    }
    if (item.cardRect.width < minCardWidth || item.cardRect.width > maxCardWidth) {
      failures.push(
        `Segment item ${item.index} card width ${item.cardRect.width.toFixed(2)}px is outside ${minCardWidth}-${maxCardWidth}px.`
      );
    }
    if (Math.abs(item.dotToCardCenterDelta) > tolerance) {
      failures.push(
        `Segment item ${item.index} dot is not centered under card: delta ${item.dotToCardCenterDelta.toFixed(2)}px.`
      );
    }
    if (
      item.dotToTimelineLineCenterDelta === null ||
      Math.abs(item.dotToTimelineLineCenterDelta) > tolerance
    ) {
      failures.push(
        `Segment item ${item.index} dot is not centered on timeline line: delta ${item.dotToTimelineLineCenterDelta?.toFixed(2) ?? 'missing'}px.`
      );
    }
    if (
      Math.abs(item.dotRect.width - item.dotRect.height) > tolerance ||
      item.dotRect.width < 6 ||
      item.dotRect.height < 6
    ) {
      failures.push(
        `Segment item ${item.index} timeline marker is not a visible round dot: ${item.dotRect.width.toFixed(2)}x${item.dotRect.height.toFixed(2)}px.`
      );
    }
    if (Math.abs(item.timeToCardCenterDelta) > tolerance) {
      failures.push(
        `Segment item ${item.index} time is not centered under card: delta ${item.timeToCardCenterDelta.toFixed(2)}px.`
      );
    }
    if (item.timeRect.width <= 0 || item.timeRect.height <= 0 || !item.timeText) {
      failures.push(`Segment item ${item.index} timeline time label is not visible.`);
    }
    if (!item.timelineBelowCard) {
      failures.push(`Segment item ${item.index} timeline anchor is not below the card.`);
    }
  }

  return failures;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const targets = await fetchJson(`http://${options.host}:${options.port}/json`);
  const target = targets.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl);
  if (!target) {
    fail(`No debuggable Electron page found on ${options.host}:${options.port}.`);
  }

  const client = await connectCdp(target.webSocketDebuggerUrl);
  let viewportOverrideApplied = false;
  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    if (options.viewport) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: options.viewport.width,
        height: options.viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      viewportOverrideApplied = true;
    } else {
      await client.send('Emulation.clearDeviceMetricsOverride').catch(() => undefined);
    }
    await client.send('Input.setIgnoreInputEvents', { ignore: false }).catch(() => undefined);
    await evaluate(
      client,
      `(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
        const scroll = document.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');
        if (scroll) {
          scroll.scrollTo({ left: 0, top: 0, behavior: 'auto' });
        }
        return true;
      })()`
    );
    await evaluate(client, waitExpression());

    const before = await evaluate(client, measurementExpression(options.maxItems));
    if (!before.ok) {
      fail(before.reason);
    }

    let clickedSecondItem = false;
    let scrollMethod = 'not-run';
    if (options.interaction === 'click-scroll' && before.itemCount > 1) {
      const secondItemCenter = await evaluate(
        client,
        centerPointExpression('[data-slot="memory-studio-segment-item"]', 1)
      );
      if (secondItemCenter) {
        await client.send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: secondItemCenter.x,
          y: secondItemCenter.y,
          button: 'left',
          clickCount: 1,
        });
        await client.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: secondItemCenter.x,
          y: secondItemCenter.y,
          button: 'left',
          clickCount: 1,
        });
        clickedSecondItem = true;
        await evaluate(client, waitExpression());
      }
    }

    let after = await evaluate(client, measurementExpression(options.maxItems));
    if (options.interaction === 'click-scroll') {
      const scrollCenter = await evaluate(
        client,
        centerPointExpression('[data-slot="memory-studio-segment-strip-scroll"]')
      );
      if (scrollCenter && before.scroll.width > before.scroll.clientWidth) {
        await client.send('Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          x: scrollCenter.x,
          y: scrollCenter.y,
          deltaX: 180,
          deltaY: 0,
        });
        scrollMethod = 'cdp-mouseWheel';
        await evaluate(client, waitExpression());
      }

      after = await evaluate(client, measurementExpression(options.maxItems));
      if (
        before.scroll.width > before.scroll.clientWidth &&
        after.scroll.left === before.scroll.left
      ) {
        await evaluate(
          client,
          `(() => {
          const scroll = document.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');
          if (scroll) {
            scroll.scrollTo({ left: Math.min(scroll.scrollLeft + 180, scroll.scrollWidth - scroll.clientWidth), behavior: 'auto' });
            scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
          }
          return true;
        })()`
        );
        await evaluate(client, waitExpression());
        after = await evaluate(client, measurementExpression(options.maxItems));
        scrollMethod = 'dom-scroll-fallback';
      }
    }

    const editorFocusProbe = await probeEditorTextareaFocus(client);
    after = {
      ...after,
      editor: {
        ...after.editor,
        focusProbe: editorFocusProbe,
      },
    };

    const failures = assertMetrics(after, options);
    const metrics = {
      ok: failures.length === 0,
      targetUrl: target.url,
      clickedSecondItem,
      scrollMethod,
      interaction: options.interaction,
      tolerance: options.tolerance,
      viewportOverride: options.viewport ?? null,
      cardWidthRange: {
        min: options.minCardWidth,
        max: options.maxCardWidth,
      },
      maxItems: options.maxItems ?? null,
      before,
      after,
      failures,
    };

    if (options.screenshot) {
      const screenshot = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      writeFileSync(options.screenshot, Buffer.from(screenshot.data, 'base64'));
      metrics.screenshot = options.screenshot;
    }

    if (options.metrics) {
      writeFileSync(options.metrics, `${JSON.stringify(metrics, null, 2)}\n`);
    }
    if (options.json) {
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      console.log(
        `Memory Studio layout telemetry: ${metrics.ok ? 'PASS' : 'FAIL'}; items=${after.itemCount}; measuredItems=${after.measuredItemCount}; scrollLeft=${after.scroll.left}; clickedSecondItem=${clickedSecondItem}; scrollMethod=${scrollMethod}`
      );
    }

    if (!metrics.ok) {
      fail(`Memory Studio layout telemetry failed:\n- ${failures.join('\n- ')}`);
    }
  } finally {
    await evaluate(
      client,
      `(() => {
        window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
        const scroll = document.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');
        if (scroll) {
          scroll.scrollTo({ left: 0, top: 0, behavior: 'auto' });
        }
        window.dispatchEvent(new Event('resize'));
        return true;
      })()`
    ).catch(() => undefined);
    if (viewportOverrideApplied) {
      await client.send('Emulation.clearDeviceMetricsOverride').catch(() => undefined);
    }
    client.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(error.exitCode || 1);
});
