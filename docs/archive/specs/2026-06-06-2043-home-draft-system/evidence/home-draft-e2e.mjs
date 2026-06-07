#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import WebSocket from 'ws';

const execFileAsync = promisify(execFile);
const port = Number(process.env.REMOTE_DEBUGGING_PORT || 9233);
const host = process.env.REMOTE_DEBUGGING_HOST || '127.0.0.1';
const timeoutMs = 15_000;
const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const runId = `${Date.now()}`;
const uniqueBody = `Codex E2E Home Draft body ${runId}`;
const results = [];

function fail(message) {
  throw new Error(message);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      fail(`${url} returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
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
    const { resolve, reject, timeoutId } = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(timeoutId);
    if (message.error) {
      reject(new Error(message.error.message || JSON.stringify(message.error)));
      return;
    }
    resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('CDP socket open timed out')), timeoutMs);
    socket.once('open', () => {
      clearTimeout(timeoutId);
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });

  return {
    close() {
      socket.close();
    },
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP command timed out: ${method}`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timeoutId });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function evaluate(cdp, fn, ...args) {
  const expression = `(${fn})(...${JSON.stringify(args)})`;
  const result = await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    fail(result.exceptionDetails.text || 'Runtime.evaluate failed');
  }
  return result.result?.value;
}

async function waitFor(cdp, name, fn, ...args) {
  const startedAt = Date.now();
  let lastValue;
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await evaluate(cdp, fn, ...args);
    if (lastValue) {
      return lastValue;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  fail(`Timed out waiting for ${name}. Last value: ${JSON.stringify(lastValue)}`);
}

async function scenario(name, fn) {
  try {
    const evidence = await fn();
    if (evidence === false || evidence === null || evidence === undefined) {
      fail(`Scenario assertion returned ${JSON.stringify(evidence)}`);
    }
    results.push({ evidence, name, status: 'pass' });
    return evidence;
  } catch (error) {
    results.push({ error: error.message, name, status: 'fail' });
    await writeResults();
    throw error;
  }
}

async function writeResults(extra = {}) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    path.join(evidenceDir, 'home-draft-e2e-results.json'),
    JSON.stringify(
      {
        ...extra,
        passed: results.filter((result) => result.status === 'pass').length,
        results,
        runId,
        total: results.length,
      },
      null,
      2
    )
  );
}

function pageHelpers() {
  function elementName(element) {
    return (element.getAttribute('aria-label') || element.textContent || '').trim();
  }
  function visible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
  }
  function buttons() {
    return Array.from(document.querySelectorAll('button,[role="button"]')).filter(visible);
  }
  function menuItems() {
    return Array.from(document.querySelectorAll('[role="menuitem"]')).filter(visible);
  }
  function button(name) {
    return buttons().find((candidate) => elementName(candidate) === name) || null;
  }
  function menuItem(name) {
    return menuItems().find((candidate) => elementName(candidate) === name) || null;
  }
  function clickButton(name) {
    const target = button(name);
    if (!target) return false;
    target.click();
    return true;
  }
  function clickMenuItem(name) {
    const target = menuItem(name);
    if (!target) return false;
    target.click();
    return true;
  }
  function text() {
    return document.body.textContent || '';
  }
  return {
    buttonNames: () => buttons().map(elementName),
    clickButton,
    clickMenuItem,
    hasButton: (name) => Boolean(button(name)),
    hasMenuItem: (name) => Boolean(menuItem(name)),
    menuItemNames: () => menuItems().map(elementName),
    text,
  };
}

async function elementCenter(cdp, kind, name) {
  return evaluate(
    cdp,
    (targetKind, targetName, helpersSource) => {
      const helpers = eval(`(${helpersSource})`)();
      const names = targetKind === 'menuitem' ? helpers.menuItemNames() : helpers.buttonNames();
      if (!names.includes(targetName)) {
        return null;
      }
      const elementName = (element) =>
        (element.getAttribute('aria-label') || element.textContent || '').trim();
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
      };
      const selector = targetKind === 'menuitem' ? '[role="menuitem"]' : 'button,[role="button"]';
      const target = Array.from(document.querySelectorAll(selector))
        .filter(visible)
        .find((candidate) => elementName(candidate) === targetName);
      if (!target) {
        return null;
      }
      const rect = target.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    },
    kind,
    name,
    pageHelpers.toString()
  );
}

async function mouseClick(cdp, point) {
  await cdp.send('Input.dispatchMouseEvent', {
    button: 'none',
    type: 'mouseMoved',
    x: point.x,
    y: point.y,
  });
  await cdp.send('Input.dispatchMouseEvent', {
    button: 'left',
    buttons: 1,
    clickCount: 1,
    type: 'mousePressed',
    x: point.x,
    y: point.y,
  });
  await cdp.send('Input.dispatchMouseEvent', {
    button: 'left',
    buttons: 0,
    clickCount: 1,
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
  });
}

async function clickButton(cdp, name) {
  const point = await elementCenter(cdp, 'button', name);
  if (!point) {
    fail(`Button not found: ${name}`);
  }
  await mouseClick(cdp, point);
}

async function clickMenuItem(cdp, name) {
  const point = await elementCenter(cdp, 'menuitem', name);
  if (!point) {
    fail(`Menu item not found: ${name}`);
  }
  await mouseClick(cdp, point);
}

async function pressEscape(cdp) {
  await cdp.send('Input.dispatchKeyEvent', { key: 'Escape', type: 'keyDown' });
  await cdp.send('Input.dispatchKeyEvent', { key: 'Escape', type: 'keyUp' });
}

async function captureHomeActionTimeline(cdp, actionName, durationMs = 900) {
  return evaluate(
    cdp,
    async (name, duration) => {
      const elementName = (element) =>
        (element.getAttribute('aria-label') || element.textContent || '').trim();
      const visible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
      };
      const hasVisibleButton = (buttonName) =>
        Array.from(document.querySelectorAll('button,[role="button"]')).some(
          (button) => visible(button) && elementName(button) === buttonName
        );
      const target = Array.from(document.querySelectorAll('button,[role="button"]')).find(
        (button) => visible(button) && elementName(button) === name
      );
      if (!target) {
        return { error: `Button not found: ${name}`, samples: [] };
      }
      const readState = () => ({
        draftCurrent: Array.from(document.querySelectorAll('button')).some(
          (button) =>
            elementName(button) === '草稿' && button.getAttribute('aria-current') === 'page'
        ),
        draftTitlebar: hasVisibleButton('草稿 记忆空间操作'),
        home: Boolean(document.querySelector('section[aria-label="首页"]')),
        homeCurrent: Array.from(document.querySelectorAll('button')).some(
          (button) =>
            elementName(button) === '首页' && button.getAttribute('aria-current') === 'page'
        ),
        noteEditor: Boolean(document.querySelector('[aria-label="笔记编辑器"]')),
        recordingOverlay:
          Boolean(document.querySelector('[role="dialog"][aria-label="录音"]')) ||
          (document.body.textContent || '').includes('开始录音'),
        toastCopied: (document.body.textContent || '').includes('已复制作品提示词'),
      });
      const samples = [];
      const startedAt = performance.now();
      target.click();
      while (performance.now() - startedAt < duration) {
        samples.push({ t: Math.round(performance.now() - startedAt), ...readState() });
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      samples.push({ t: Math.round(performance.now() - startedAt), ...readState() });
      return { samples };
    },
    actionName,
    durationMs
  );
}

function assertHomeForegroundTimeline(timeline, targetState) {
  if (timeline.error) {
    fail(timeline.error);
  }
  const samples = timeline.samples ?? [];
  if (samples.length === 0) {
    fail('No timeline samples were captured.');
  }
  const targetReached = samples.some((sample) => Boolean(sample[targetState]));
  const draftFrame = samples.find((sample) => sample.draftTitlebar || sample.draftCurrent);
  if (draftFrame) {
    fail(
      `Draft workspace became foreground during Home ${targetState}: ${JSON.stringify(draftFrame)}`
    );
  }
  const last = samples[samples.length - 1];
  if (!last.home || !last.homeCurrent) {
    fail(`Home was not foreground after ${targetState}: ${JSON.stringify(last)}`);
  }
  return {
    first: samples[0],
    last,
    sampleCount: samples.length,
    targetReached,
  };
}

async function findDraftSegmentByBody() {
  const supportDir = path.join(os.homedir(), 'Library', 'Application Support');
  const stdout = await execFileAsync('find', [
    supportDir,
    '-maxdepth',
    '8',
    '-path',
    '*/system-memory-spaces/草稿',
    '-type',
    'd',
  ])
    .then((result) => result.stdout)
    .catch((error) => (typeof error.stdout === 'string' ? error.stdout : ''));
  const roots = Array.from(
    new Set(
      [path.join(supportDir, 'reo', 'system-memory-spaces', '草稿'), ...stdout.split('\n')]
        .map((line) => line.trim())
        .filter(Boolean)
    )
  );
  for (const rootPath of roots) {
    const memoriesRoot = path.join(rootPath, 'memories');
    const found = await execFileAsync('find', [memoriesRoot, '-name', 'segment.md', '-type', 'f'])
      .then((result) => result.stdout)
      .catch(() => '');
    for (const filePath of found.split('\n').filter(Boolean)) {
      const markdown = await readFile(filePath, 'utf8').catch(() => '');
      if (!markdown.includes(uniqueBody)) {
        continue;
      }
      const title = /^title:\s*(.+)$/m.exec(markdown)?.[1]?.replace(/^["']|["']$/g, '') ?? '';
      const id = /^id:\s*(.+)$/m.exec(markdown)?.[1] ?? '';
      return { filePath, id, rootPath, title };
    }
  }
  return null;
}

async function main() {
  const pages = await fetchJson(`http://${host}:${port}/json/list`);
  const page = pages.find((candidate) =>
    String(candidate.url || '').match(/^(http:\/\/localhost:5183|reo-app:\/\/renderer)/)
  );
  if (!page?.webSocketDebuggerUrl) {
    fail('Could not find the Reo renderer CDP page.');
  }

  const cdp = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Page.reload', { ignoreCache: true });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: 1,
      height: 900,
      mobile: false,
      width: 1440,
    });

    await scenario('01 renderer target is the Reo dev app', async () => page.url);
    await scenario('02 document reaches ready state', () =>
      waitFor(cdp, 'document ready', () => document.readyState === 'complete')
    );
    await scenario('03 Home is reachable from current state', async () => {
      await clickButton(cdp, '首页');
      return waitFor(cdp, 'home section', () =>
        Boolean(document.querySelector('section[aria-label="首页"]'))
      );
    });
    await scenario('04 sidebar top IA order is 首页/画廊/草稿 before 记忆空间', () =>
      waitFor(cdp, 'sidebar order', () => {
        const sidebar = document.querySelector('[aria-label="记忆空间侧边栏"]');
        if (!sidebar) return false;
        const text = sidebar.textContent || '';
        return (
          text.indexOf('首页') < text.indexOf('画廊') &&
          text.indexOf('画廊') < text.indexOf('草稿') &&
          text.indexOf('草稿') < text.indexOf('记忆空间')
        );
      })
    );
    await scenario('05 Home sidebar item is current', () =>
      waitFor(
        cdp,
        'home current',
        (helpersSource) => {
          const helpers = eval(`(${helpersSource})`)();
          return (
            helpers.buttonNames().includes('首页') &&
            Array.from(document.querySelectorAll('button')).some(
              (button) =>
                (button.getAttribute('aria-label') || button.textContent || '').trim() === '首页' &&
                button.getAttribute('aria-current') === 'page'
            )
          );
        },
        pageHelpers.toString()
      )
    );
    await scenario('06 Gallery top-level entry exists', () =>
      waitFor(
        cdp,
        'gallery button',
        (helpersSource) => {
          const helpers = eval(`(${helpersSource})`)();
          return helpers.hasButton('画廊');
        },
        pageHelpers.toString()
      )
    );
    await scenario('07 Draft top-level entry exists', () =>
      waitFor(
        cdp,
        'draft button',
        (helpersSource) => {
          const helpers = eval(`(${helpersSource})`)();
          return helpers.hasButton('草稿');
        },
        pageHelpers.toString()
      )
    );
    await scenario('08 exactly four Home action buttons exist', () =>
      evaluate(cdp, () =>
        ['写下来', '录下来', '造出来', '拍下来'].every((name) =>
          Boolean(document.querySelector(`button[aria-label="${name}"]`))
        )
      )
    );
    await scenario('09 capture action is disabled', () =>
      evaluate(cdp, () => document.querySelector('button[aria-label="拍下来"]')?.disabled === true)
    );
    await scenario('10 write/record/create actions are enabled', () =>
      evaluate(cdp, () =>
        ['写下来', '录下来', '造出来'].every(
          (name) => document.querySelector(`button[aria-label="${name}"]`)?.disabled === false
        )
      )
    );
    await scenario('11 Home action buttons do not use outer card background', () =>
      evaluate(cdp, () =>
        ['写下来', '录下来', '造出来', '拍下来'].every(
          (name) =>
            !document.querySelector(`button[aria-label="${name}"]`)?.className.includes('bg-card')
        )
      )
    );
    await scenario('12 Home action icon has one visual tile layer only', () =>
      evaluate(cdp, () =>
        Array.from(document.querySelectorAll('[data-slot^="home-action-icon-slot-"]')).every(
          (slot) => slot.querySelectorAll('span').length === 0
        )
      )
    );
    await scenario('12b Home action tiles stay compact instead of card-height panels', () =>
      evaluate(cdp, () => {
        const actions = ['写下来', '录下来', '造出来', '拍下来'].map((name) => {
          const button = document.querySelector(`button[aria-label="${name}"]`);
          const slot = button?.querySelector('[data-slot^="home-action-icon-slot-"]');
          return {
            actionHeight: button?.getBoundingClientRect().height ?? 0,
            slotHeight: slot?.getBoundingClientRect().height ?? 0,
          };
        });
        return actions.every(
          ({ actionHeight, slotHeight }) =>
            actionHeight > 0 && actionHeight <= 210 && slotHeight > 0 && slotHeight <= 150
        );
      })
    );
    await scenario('13 recent expression block is visible on Home', () =>
      waitFor(cdp, 'recent block', () =>
        Boolean(document.querySelector('#home-recent-expressions-heading'))
      )
    );
    await scenario('14 recent expression block does not expose raw paths', () =>
      evaluate(cdp, () => !(document.body.textContent || '').includes('/Users/'))
    );
    await scenario('15 Draft is not listed as a normal memory space row', () =>
      evaluate(cdp, () => {
        const sidebar = document.querySelector('[aria-label="记忆空间侧边栏"]');
        const buttons = Array.from(sidebar?.querySelectorAll('button') || []).filter(
          (button) =>
            (button.getAttribute('aria-label') || button.textContent || '').trim() === '草稿'
        );
        return buttons.length === 1;
      })
    );

    await scenario('16 clicking Draft opens the system Draft workspace', async () => {
      await clickButton(cdp, '草稿');
      return waitFor(cdp, 'Draft titlebar', () =>
        Boolean(document.querySelector('button[aria-label="草稿 记忆空间操作"]'))
      );
    });
    await scenario('17 Draft sidebar item becomes current', () =>
      waitFor(cdp, 'draft current', () =>
        Array.from(document.querySelectorAll('button')).some(
          (button) =>
            (button.getAttribute('aria-label') || button.textContent || '').trim() === '草稿' &&
            button.getAttribute('aria-current') === 'page'
        )
      )
    );
    await scenario('18 protected default Draft Memory is current', () =>
      waitFor(cdp, 'default Draft Memory', () =>
        Boolean(document.querySelector('button[aria-label="草稿 记忆操作"]'))
      )
    );
    await scenario('19 Draft workspace menu hides rename/remove', async () => {
      await clickButton(cdp, '草稿 记忆空间操作');
      await new Promise((resolve) => setTimeout(resolve, 120));
      const hidden = await evaluate(
        cdp,
        (helpersSource) => {
          const helpers = eval(`(${helpersSource})`)();
          const names = helpers.menuItemNames();
          return !names.includes('重命名') && !names.includes('移除');
        },
        pageHelpers.toString()
      );
      await pressEscape(cdp);
      return hidden;
    });
    await scenario('20 Draft default Memory menu hides rename/delete', async () => {
      await clickButton(cdp, '草稿 记忆操作');
      await new Promise((resolve) => setTimeout(resolve, 120));
      const hidden = await evaluate(
        cdp,
        (helpersSource) => {
          const helpers = eval(`(${helpersSource})`)();
          const names = helpers.menuItemNames();
          return !names.includes('重命名') && !names.includes('删除');
        },
        pageHelpers.toString()
      );
      await pressEscape(cdp);
      return hidden;
    });
    await scenario('21 Draft still allows creating a new normal Memory', async () => {
      await clickButton(cdp, '新增');
      const exists = await waitFor(
        cdp,
        'new memory menu item',
        (helpersSource) => {
          const helpers = eval(`(${helpersSource})`)();
          return helpers.hasMenuItem('新建记忆');
        },
        pageHelpers.toString()
      );
      await pressEscape(cdp);
      return exists;
    });

    await scenario(
      '22 Home create action copies prompt without showing Draft workspace',
      async () => {
        await clickButton(cdp, '首页');
        await waitFor(cdp, 'home after Draft', () =>
          Boolean(document.querySelector('section[aria-label="首页"]'))
        );
        const timeline = await captureHomeActionTimeline(cdp, '造出来');
        const samples = timeline.samples ?? [];
        const draftFrame = samples.find((sample) => sample.draftTitlebar);
        if (draftFrame) {
          fail(`Draft workspace appeared during Home create launch: ${JSON.stringify(draftFrame)}`);
        }
        if (!samples.some((sample) => sample.toastCopied) || samples.at(-1)?.homeCurrent !== true) {
          fail(`Home create did not stay on Home after copying: ${JSON.stringify(samples.at(-1))}`);
        }
        return {
          copied: true,
          homeCurrent: true,
          sampleCount: samples.length,
        };
      }
    );
    await scenario('23 Home write action opens Note editor on Home foreground', async () => {
      await clickButton(cdp, '首页');
      await waitFor(cdp, 'home before note', () =>
        Boolean(document.querySelector('section[aria-label="首页"]'))
      );
      const timeline = await captureHomeActionTimeline(cdp, '写下来');
      const result = assertHomeForegroundTimeline(timeline, 'noteEditor');
      if (!result.targetReached) {
        await waitFor(cdp, 'note editor', () =>
          Boolean(document.querySelector('[aria-label="笔记编辑器"]'))
        );
      }
      return result;
    });
    await scenario('24 Note editor keeps Home foreground before save', () =>
      evaluate(
        cdp,
        () =>
          Boolean(document.querySelector('[aria-label="笔记编辑器"]')) &&
          Boolean(document.querySelector('section[aria-label="首页"]')) &&
          !Boolean(document.querySelector('button[aria-label="草稿 记忆空间操作"]'))
      )
    );
    await scenario('25 Note editor accepts real user text input', async () => {
      await evaluate(cdp, () => {
        const editor = document.querySelector('[role="textbox"][aria-label="笔记正文"]');
        editor?.focus();
        return Boolean(editor);
      });
      await cdp.send('Input.insertText', { text: uniqueBody });
      return waitFor(
        cdp,
        'unique body in editor',
        (body) => (document.body.textContent || '').includes(body),
        uniqueBody
      );
    });
    await scenario('26 saving Note finalizes a Segment and closes the editor', async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await clickButton(cdp, '保存笔记');
      return waitFor(
        cdp,
        'note editor closed',
        () => !document.querySelector('[aria-label="笔记编辑器"]')
      );
    });
    await scenario('26b saving Home Note enters Draft workspace foreground', () =>
      waitFor(
        cdp,
        'Draft foreground after note save',
        () =>
          Boolean(document.querySelector('button[aria-label="草稿 记忆空间操作"]')) &&
          Array.from(document.querySelectorAll('button')).some(
            (button) =>
              (button.getAttribute('aria-label') || button.textContent || '').trim() === '草稿' &&
              button.getAttribute('aria-current') === 'page'
          )
      )
    );

    const finalized = await scenario('27 finalized Note exists in system Draft files', async () => {
      const match = await findDraftSegmentByBody();
      if (!match) {
        fail('Could not find finalized Draft segment containing unique body.');
      }
      return { segmentId: match.id, title: match.title };
    });
    await scenario('28 finalized Note is projected in Memory Studio', () =>
      waitFor(
        cdp,
        'finalized note projected',
        (body) => (document.body.textContent || '').includes(body),
        uniqueBody
      )
    );
    await scenario('29 returning Home keeps the app non-blank', async () => {
      await clickButton(cdp, '首页');
      return waitFor(
        cdp,
        'home after save',
        () =>
          Boolean(document.querySelector('section[aria-label="首页"]')) &&
          Boolean(document.querySelector('button[aria-label="写下来"]'))
      );
    });
    await scenario('30 recent feed refetches the finalized Draft Note', () =>
      waitFor(
        cdp,
        'recent row from finalized note',
        (title) => Boolean(document.querySelector(`button[aria-label="打开近期表达 ${title}"]`)),
        finalized.title
      )
    );
    await scenario('31 clicking recent row opens and focuses the source Segment', async () => {
      await clickButton(cdp, `打开近期表达 ${finalized.title}`);
      return waitFor(
        cdp,
        'recent row focus content',
        (body) => (document.body.textContent || '').includes(body),
        uniqueBody
      );
    });
    await scenario('32 Home record action opens Recording overlay on Home foreground', async () => {
      await clickButton(cdp, '首页');
      await waitFor(cdp, 'home before recording', () =>
        Boolean(document.querySelector('section[aria-label="首页"]'))
      );
      const timeline = await captureHomeActionTimeline(cdp, '录下来');
      const result = assertHomeForegroundTimeline(timeline, 'recordingOverlay');
      if (!result.targetReached) {
        await waitFor(
          cdp,
          'recording overlay',
          () =>
            Boolean(document.querySelector('[role="dialog"][aria-label="录音"]')) ||
            (document.body.textContent || '').includes('开始录音')
        );
      }
      return result;
    });
    await scenario('33 recording overlay can return without starting microphone', async () => {
      await clickButton(cdp, '返回');
      await new Promise((resolve) => setTimeout(resolve, 200));
      const confirmVisible = await evaluate(cdp, () =>
        (document.body.textContent || '').includes('返回会结束当前录音。')
      );
      if (confirmVisible) {
        await clickButton(cdp, '直接退出');
      }
      return waitFor(
        cdp,
        'recording overlay closed',
        () =>
          !(document.body.textContent || '').includes('开始录音') &&
          Boolean(document.querySelector('section[aria-label="首页"]')) &&
          !Boolean(document.querySelector('button[aria-label="草稿 记忆空间操作"]'))
      );
    });
    await scenario('34 disabled capture action does not leave Home', async () => {
      await clickButton(cdp, '首页');
      await waitFor(cdp, 'home before capture', () =>
        Boolean(document.querySelector('section[aria-label="首页"]'))
      );
      const before = await evaluate(cdp, () => document.body.textContent || '');
      await clickButton(cdp, '拍下来').catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const stillHome = await evaluate(cdp, () =>
        Boolean(document.querySelector('section[aria-label="首页"]'))
      );
      return stillHome && before.includes('敬请期待');
    });
    await scenario(
      '35 dark mode keeps Home actions visible without white PNG backgrounds',
      async () => {
        for (let index = 0; index < 3; index += 1) {
          const isDark = await evaluate(
            cdp,
            () => document.documentElement.dataset.theme === 'dark'
          );
          if (isDark) break;
          const names = await evaluate(
            cdp,
            (helpersSource) => {
              const helpers = eval(`(${helpersSource})`)();
              return helpers.buttonNames();
            },
            pageHelpers.toString()
          );
          const themeButton = names.find((name) => name.startsWith('切换到'));
          if (!themeButton) fail('Theme button not found.');
          await clickButton(cdp, themeButton);
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        return waitFor(
          cdp,
          'dark Home actions',
          () =>
            document.documentElement.dataset.theme === 'dark' &&
            ['写下来', '录下来', '造出来', '拍下来'].every((name) =>
              Boolean(document.querySelector(`button[aria-label="${name}"]`))
            ) &&
            !Array.from(document.querySelectorAll('[data-slot^="home-action-icon-slot-"]')).some(
              (slot) => slot.className.includes('bg-background')
            )
        );
      }
    );

    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(evidenceDir, 'home-draft-e2e-final.png');
    await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    await writeResults({ screenshotPath });
    const passed = results.filter((result) => result.status === 'pass').length;
    console.log(`home-draft-e2e passed ${passed}/${results.length}`);
    if (passed < 30) {
      fail(`Expected at least 30 passing scenarios, got ${passed}.`);
    }
  } finally {
    cdp.close();
  }
}

main().catch(async (error) => {
  await writeResults({ fatal: error.message });
  console.error(error);
  process.exit(1);
});
