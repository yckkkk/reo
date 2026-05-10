#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import WebSocket from 'ws';

const defaultPort = Number(process.env.REMOTE_DEBUGGING_PORT || 9233);
const defaultTolerance = 1.5;
const defaultMinCardWidth = 120;
const defaultMaxCardWidth = 150;

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
  --screenshot <path>      Write a viewport screenshot after measurement.
  --metrics <path>         Write machine-readable metrics JSON.
  --json                   Print metrics JSON to stdout.
`);
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
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
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--host':
        options.host = next;
        index += 1;
        break;
      case '--port':
        options.port = Number(next);
        index += 1;
        break;
      case '--viewport':
        options.viewport = parseViewport(next);
        index += 1;
        break;
      case '--interaction':
        options.interaction = next;
        index += 1;
        break;
      case '--tolerance':
        options.tolerance = Number(next);
        index += 1;
        break;
      case '--min-card-width':
        options.minCardWidth = Number(next);
        index += 1;
        break;
      case '--max-card-width':
        options.maxCardWidth = Number(next);
        index += 1;
        break;
      case '--screenshot':
        options.screenshot = next;
        index += 1;
        break;
      case '--metrics':
        options.metrics = next;
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
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    fail(
      `Cannot reach Electron remote debugging endpoint ${url}. Start runtime with REMOTE_DEBUGGING_PORT=<port> npm run dev. ${error.message}`
    );
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

  socket.on('message', (data) => {
    const message = JSON.parse(data.toString());
    if (!message.id || !pending.has(message.id)) {
      return;
    }
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message || JSON.stringify(message.error)));
      return;
    }
    resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  return {
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      const payload = JSON.stringify({ id, method, params });
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(payload, (error) => {
          if (error) {
            pending.delete(id);
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

function measurementExpression() {
  return `(() => {
    const studio = document.querySelector('[aria-label="Memory Studio"]');
    if (!studio) {
      return { ok: false, reason: 'Memory Studio region is not visible.' };
    }

    const scroll = studio.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');
    const items = Array.from(studio.querySelectorAll('[data-slot="memory-studio-segment-item"]'));
    const nav = studio.querySelector('[aria-label="Memory 片段时间轴"]');
    const player = studio.querySelector('[data-slot="memory-studio-player"]');
    const playerTime = studio.querySelector('[data-slot="memory-studio-audio-player-time"]');
    const contentPanel = studio.querySelector('[data-slot="memory-studio-content-panel"]');
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

    const itemMetrics = items.map((item, index) => {
      const card = item.querySelector('[data-slot="memory-studio-segment-card"]');
      const dot = item.querySelector('[data-slot="memory-studio-segment-timeline-dot"]');
      const time = item.querySelector('[data-slot="memory-studio-segment-timeline-time"]');
      const anchor = item.querySelector('[data-slot="memory-studio-segment-timeline-anchor"]');
      const itemRect = rectOf(item);
      const cardRect = card ? rectOf(card) : null;
      const dotRect = dot ? rectOf(dot) : null;
      const timeRect = time ? rectOf(time) : null;
      const anchorRect = anchor ? rectOf(anchor) : null;
      return {
        index,
        label: item.getAttribute('aria-label'),
        selected: item.getAttribute('aria-current') === 'true',
        itemRect,
        cardRect,
        dotRect,
        timeRect,
        anchorRect,
        dotToCardCenterDelta: cardRect && dotRect ? dotRect.centerX - cardRect.centerX : null,
        timeToCardCenterDelta: cardRect && timeRect ? timeRect.centerX - cardRect.centerX : null,
        timelineBelowCard: cardRect && anchorRect ? anchorRect.top >= cardRect.bottom : false,
      };
    });

    const playerTimeStyle = playerTime ? getComputedStyle(playerTime) : null;

    return {
      ok: true,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      windowScrollX: window.scrollX,
      windowScrollY: window.scrollY,
      studioRect: rectOf(studio),
      contentPanelRect: contentPanel ? rectOf(contentPanel) : null,
      standaloneTimelineExists: Boolean(nav),
      stripScrollOwnerCount: studio.querySelectorAll('[data-slot="memory-studio-segment-strip-scroll"]').length,
      itemCount: items.length,
      selectedItemCount: items.filter((item) => item.getAttribute('aria-current') === 'true').length,
      scroll: {
        left: scroll.scrollLeft,
        width: scroll.scrollWidth,
        clientWidth: scroll.clientWidth,
        rect: rectOf(scroll),
      },
      player: {
        rowRect: player ? rectOf(player) : null,
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
    if (Math.abs(item.timeToCardCenterDelta) > tolerance) {
      failures.push(
        `Segment item ${item.index} time is not centered under card: delta ${item.timeToCardCenterDelta.toFixed(2)}px.`
      );
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
    }
    await client.send('Input.setIgnoreInputEvents', { ignore: false }).catch(() => undefined);
    await evaluate(
      client,
      `(() => {
        window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
        const scroll = document.querySelector('[data-slot="memory-studio-segment-strip-scroll"]');
        if (scroll) {
          scroll.scrollTo({ left: 0, top: 0, behavior: 'auto' });
        }
        return true;
      })()`
    );
    await evaluate(client, waitExpression());

    const before = await evaluate(client, measurementExpression());
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

    let after = await evaluate(client, measurementExpression());
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

      after = await evaluate(client, measurementExpression());
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
        after = await evaluate(client, measurementExpression());
        scrollMethod = 'dom-scroll-fallback';
      }
    }

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
        `Memory Studio layout telemetry: ${metrics.ok ? 'PASS' : 'FAIL'}; items=${after.itemCount}; scrollLeft=${after.scroll.left}; clickedSecondItem=${clickedSecondItem}; scrollMethod=${scrollMethod}`
      );
    }

    if (!metrics.ok) {
      fail(`Memory Studio layout telemetry failed:\n- ${failures.join('\n- ')}`);
    }
  } finally {
    client.close();
  }
}

main().catch((error) => {
  fail(error.stack || error.message);
});
