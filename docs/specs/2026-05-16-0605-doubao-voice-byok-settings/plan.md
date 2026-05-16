# 豆包流式语音识别 BYOK 设置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Reo 用户通过 Settings 路由的「语音」类目自带豆包 X-Api-Key（BYOK），并把 ASR 协议从旧版双 header 切换到新版单 X-Api-Key header；新增"启用/停用"全局 toggle，停用时整条 transcription 链路安静关闭，启用时才进入异常处理路径。

**Architecture:** main process 通过 Electron 官方 `safeStorage` 把 X-Api-Key 加密写入 userData JSON，由新增模块 `voiceSettingsStore` 单点持有；6 个 application-scoped IPC channel 暴露不含密文的状态投影；renderer 在 AppShell 引入 `appMode: 'app' | 'settings'` 顶层 state，同 BrowserWindow 切换 Settings shell，不引入第二窗口。录音 start IPC 增加 `transcriptionMode: 'live' | 'disabled'` 响应字段，让 toggle disabled 时安静关闭整条链路。

**Tech Stack:** Electron `safeStorage` / `ws` / Zod / TanStack Query v5 / React 19 / shadcn-style primitives / Radix Switch / Tailwind v4 / Vitest（renderer）/ node:test（main）

**Spec reference:** `docs/specs/2026-05-16-0605-doubao-voice-byok-settings/README.md`

---

## File Structure

### main 新增

- `src/main/voiceSettingsStore.ts` — voice settings 真源；持有 `read() / write() / clear() / encrypt() / decrypt()`，依赖注入 `{ safeStorage, fs, userDataDir }` 用于测试。
- `src/main/voiceTranscriptionProbe.ts` — 最小 WebSocket 握手 probe；发新版鉴权 header，1s timeout，不发音频，返回 `{ ok, code, message? }`。

### main 修改

- `src/main/doubaoStreamingAsr.ts` — 双 header 改单 header；`DoubaoAsrAuthInput / DoubaoStreamingAsrSessionInput / redactSecrets` 适配。
- `src/main/recordingTranscriptionSessions.ts` — `DoubaoCredentials` shape 改 `{ apiKey }`；删 env var 读取；start path 增加 `enabled` 分支返回 `transcriptionMode`。
- `src/main/workspaceIpc.ts` — 注册 6 个新 handler + 1 个扩展。
- `src/main/index.ts` — `app.whenReady` 中初始化 `voiceSettingsStore`。

### workspace-contract 修改

- `src/workspace-contract/workspace-channels.ts` — 追加 6 个新 channel 常量。
- `src/workspace-contract/workspace-contract.ts` — 追加 6 套 request/response schemas、错误码、`workspaceRecordingTranscriptionControlResponseSchema` 扩展 `transcriptionMode`。
- `src/workspace-contract/reo-workspace-bridge.ts` — 追加 6 个 method types。

### preload 修改

- `src/preload/workspaceBridge.ts`（已有；由 `createWorkspaceBridge` 暴露 `window.reoWorkspace`）— 追加 6 个新方法。

### renderer 新增

- `src/renderer/src/components/ui/switch.tsx` — shadcn Switch source（Radix Switch + Reo design system token）。
- `src/renderer/src/settings/SettingsShell.tsx` — 左 nav rail + 右 content panel + 返回按钮。
- `src/renderer/src/settings/VoiceSettingsPanel.tsx` — 9 状态机 + key 输入 + 状态点 + 清除二次确认。
- `src/renderer/src/settings/voiceSettingsQueries.ts` — TanStack Query options + mutation seed/invalidate。
- `src/renderer/src/workspace/SidebarSettingsTrigger.tsx` — Sidebar 齿轮按钮。

### renderer 修改

- `src/renderer/src/App.tsx` / `src/renderer/src/app-shell/AppShell.tsx` — `App.tsx` 持有 `appMode: 'app' | 'settings'` 顶层 state；`AppShell` 只暴露 sidebar 底部齿轮入口并与主题按钮水平并列；`appMode === 'settings'` 时在同一 AppShell 主内容区渲染 `SettingsShell`；录音中阻止 mode 切换。
- `src/renderer/src/workspace/RecordingOverlay.tsx` — 从 `useVoiceTranscriptionSettings()` 读 `enabled`；disabled 时不发起 `startRecordingTranscription` IPC，不渲染 transcript 容器。
- `src/renderer/src/workspaceApi.ts`（如存在）— 包装 6 个新 preload 方法。

### 测试新增

- `test/main/voiceSettingsStore.test.ts`
- `test/main/voiceTranscriptionProbe.test.ts`
- `src/renderer/src/components/ui/switch.test.tsx`
- `src/renderer/src/settings/SettingsShell.test.tsx`
- `src/renderer/src/settings/VoiceSettingsPanel.test.tsx`
- `src/renderer/src/settings/voiceSettingsQueries.test.ts`
- `src/renderer/src/workspace/SidebarSettingsTrigger.test.tsx`

### 测试修改

- `test/main/doubaoStreamingAsr.test.ts` — 协议迁移 fixture。
- `test/main/recordingTranscriptionSessions.test.ts` — 新增 disabled / unavailable / available 三分支断言。
- `test/main/workspaceIpc.test.ts`（如存在）— 6 个新 handler 测试。
- `src/renderer/src/app-shell/AppShell.test.tsx` — appMode 切换 + 录音中阻止断言。
- `src/renderer/src/workspace/RecordingOverlay.test.tsx` — disabled 时跳过 start transcription 断言。

### 文档同步（最后一批 commit）

- `docs/current/electron.md` — 删除旧 env var 描述；更新 ASR header 描述；IPC channel 列表追加 6 项；`shell.openExternal` 规则更新。
- `docs/current/frontend.md` — sidebar 底部 + Settings Shell 新章节 + navigation gate 列表 + shadcn 边界。
- `docs/current/data.md` — voice settings ownership + `['settings','voice']` query key。

---

## Phase 1: main process foundation

### Task 1: voiceSettingsStore module

**Files:**

- Create: `src/main/voiceSettingsStore.ts`
- Test: `test/main/voiceSettingsStore.test.ts`

- [ ] **Step 1: Write failing tests for read / write / clear / parse error / decrypt fail**

Create `test/main/voiceSettingsStore.test.ts`：

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  createVoiceSettingsStore,
  type VoiceSettingsFile,
} from '../../src/main/voiceSettingsStore.js';

function makeFakeSafeStorage() {
  let available = true;
  const prefix = 'enc:';
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plaintext: string) => Buffer.from(prefix + plaintext, 'utf8'),
    decryptString: (cipher: Buffer) => {
      const s = cipher.toString('utf8');
      if (!s.startsWith(prefix)) throw new Error('decrypt failed');
      return s.slice(prefix.length);
    },
    setAvailable(value: boolean) {
      available = value;
    },
  };
}

function setup() {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'reo-voice-settings-'));
  const safeStorage = makeFakeSafeStorage();
  const store = createVoiceSettingsStore({ safeStorage, userDataDir });
  return {
    userDataDir,
    safeStorage,
    store,
    cleanup: () => rmSync(userDataDir, { recursive: true, force: true }),
  };
}

test('voiceSettingsStore: read returns default when file missing', () => {
  const { store, cleanup } = setup();
  try {
    const snapshot = store.read();
    assert.deepEqual(snapshot, {
      enabled: false,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: write apiKey + read decrypted', () => {
  const { store, cleanup } = setup();
  try {
    store.writeApiKey('abcd1234EFGH5678');
    const snapshot = store.read();
    assert.equal(snapshot.apiKeyConfigured, true);
    assert.equal(snapshot.apiKeyLastFour, '5678');
    assert.equal(store.readDecryptedApiKey(), 'abcd1234EFGH5678');
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: setEnabled toggles independently of key', () => {
  const { store, cleanup } = setup();
  try {
    store.setEnabled(true);
    assert.equal(store.read().enabled, true);
    assert.equal(store.read().apiKeyConfigured, false);
    store.setEnabled(false);
    assert.equal(store.read().enabled, false);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: clear wipes key and validation fields', () => {
  const { store, cleanup } = setup();
  try {
    store.writeApiKey('xxxx1234');
    store.recordValidation({ ok: true, code: 'ok' });
    store.clearApiKey();
    const snapshot = store.read();
    assert.equal(snapshot.apiKeyConfigured, false);
    assert.equal(snapshot.apiKeyLastFour, null);
    assert.equal(snapshot.lastValidatedAt, null);
    assert.equal(snapshot.lastValidationOk, null);
    assert.equal(snapshot.lastValidationCode, null);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: corrupted JSON falls back to default', () => {
  const { store, userDataDir, cleanup } = setup();
  try {
    writeFileSync(path.join(userDataDir, 'voice-transcription-settings.json'), '{not json');
    const snapshot = store.read();
    assert.equal(snapshot.enabled, false);
    assert.equal(snapshot.apiKeyConfigured, false);
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: decrypt failure returns null but keeps file', () => {
  const { store, userDataDir, safeStorage, cleanup } = setup();
  try {
    store.writeApiKey('abcd1234');
    safeStorage.setAvailable(false);
    assert.equal(store.readDecryptedApiKey(), null);
    const raw = JSON.parse(
      readFileSync(path.join(userDataDir, 'voice-transcription-settings.json'), 'utf8')
    ) as VoiceSettingsFile;
    assert.ok(raw.apiKeyCiphertext, 'cipher remains on disk');
  } finally {
    cleanup();
  }
});

test('voiceSettingsStore: writeApiKey throws when safeStorage unavailable', () => {
  const { store, safeStorage, cleanup } = setup();
  try {
    safeStorage.setAvailable(false);
    assert.throws(() => store.writeApiKey('foo'), /safeStorage unavailable/);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:main`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement voiceSettingsStore**

Create `src/main/voiceSettingsStore.ts`：

```ts
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { z } from 'zod';

const SCHEMA_VERSION = 1;
const FILE_NAME = 'voice-transcription-settings.json';

const voiceSettingsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  enabled: z.boolean(),
  apiKeyCiphertext: z.string().nullable(),
  apiKeyLastFour: z.string().length(4).nullable(),
  lastValidatedAt: z.string().nullable(),
  lastValidationOk: z.boolean().nullable(),
  lastValidationCode: z.enum(['ok', 'auth', 'network']).nullable(),
});

export type VoiceSettingsFile = z.infer<typeof voiceSettingsFileSchema>;

export type VoiceSettingsSnapshot = {
  readonly enabled: boolean;
  readonly apiKeyConfigured: boolean;
  readonly apiKeyLastFour: string | null;
  readonly lastValidatedAt: string | null;
  readonly lastValidationOk: boolean | null;
  readonly lastValidationCode: 'ok' | 'auth' | 'network' | null;
};

export type VoiceSettingsStoreSafeStorage = {
  readonly isEncryptionAvailable: () => boolean;
  readonly encryptString: (plaintext: string) => Buffer;
  readonly decryptString: (cipher: Buffer) => string;
};

export type VoiceSettingsStoreOptions = {
  readonly safeStorage: VoiceSettingsStoreSafeStorage;
  readonly userDataDir: string;
};

function defaultFile(): VoiceSettingsFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    enabled: false,
    apiKeyCiphertext: null,
    apiKeyLastFour: null,
    lastValidatedAt: null,
    lastValidationOk: null,
    lastValidationCode: null,
  };
}

function fileToSnapshot(file: VoiceSettingsFile): VoiceSettingsSnapshot {
  return {
    enabled: file.enabled,
    apiKeyConfigured: file.apiKeyCiphertext !== null,
    apiKeyLastFour: file.apiKeyLastFour,
    lastValidatedAt: file.lastValidatedAt,
    lastValidationOk: file.lastValidationOk,
    lastValidationCode: file.lastValidationCode,
  };
}

export function createVoiceSettingsStore({ safeStorage, userDataDir }: VoiceSettingsStoreOptions) {
  const filePath = path.join(userDataDir, FILE_NAME);
  let cache: VoiceSettingsFile = loadFromDisk();

  function loadFromDisk(): VoiceSettingsFile {
    if (!existsSync(filePath)) return defaultFile();
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = voiceSettingsFileSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : defaultFile();
    } catch {
      return defaultFile();
    }
  }

  function persist(next: VoiceSettingsFile) {
    if (!existsSync(userDataDir)) mkdirSync(userDataDir, { recursive: true });
    const tempPath = `${filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(next, null, 2), 'utf8');
    renameSync(tempPath, filePath);
    cache = next;
  }

  function read(): VoiceSettingsSnapshot {
    return fileToSnapshot(cache);
  }

  function setEnabled(enabled: boolean) {
    persist({ ...cache, enabled });
  }

  function writeApiKey(apiKey: string) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage unavailable');
    }
    const trimmed = apiKey.trim();
    if (trimmed.length === 0) throw new Error('apiKey is empty');
    const cipher = safeStorage.encryptString(trimmed);
    persist({
      ...cache,
      apiKeyCiphertext: cipher.toString('base64'),
      apiKeyLastFour: trimmed.slice(-4),
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
  }

  function clearApiKey() {
    persist({
      ...cache,
      apiKeyCiphertext: null,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
  }

  function recordValidation({
    ok,
    code,
  }: {
    ok: boolean | null;
    code: 'ok' | 'auth' | 'network' | null;
  }) {
    persist({
      ...cache,
      lastValidatedAt: new Date().toISOString(),
      lastValidationOk: ok,
      lastValidationCode: code,
    });
  }

  function readDecryptedApiKey(): string | null {
    if (!cache.apiKeyCiphertext) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    try {
      return safeStorage.decryptString(Buffer.from(cache.apiKeyCiphertext, 'base64'));
    } catch {
      return null;
    }
  }

  return { read, setEnabled, writeApiKey, clearApiKey, recordValidation, readDecryptedApiKey };
}

export type VoiceSettingsStore = ReturnType<typeof createVoiceSettingsStore>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:main`
Expected: PASS all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/voiceSettingsStore.ts test/main/voiceSettingsStore.test.ts
git commit -m "feat(main): add voiceSettingsStore for BYOK X-Api-Key persistence

safeStorage-backed JSON store in userData. In-memory cache; default
snapshot when file missing or corrupted; null decrypt on cross-user
copy. Strict Zod schema; no fallback to plaintext."
```

---

### Task 2: voiceTranscriptionProbe module

**Files:**

- Create: `src/main/voiceTranscriptionProbe.ts`
- Test: `test/main/voiceTranscriptionProbe.test.ts`

- [ ] **Step 1: Write failing tests for ok / auth-fail / network-fail / timeout**

Create `test/main/voiceTranscriptionProbe.test.ts`：

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runVoiceTranscriptionProbe,
  type VoiceTranscriptionProbeSocket,
} from '../../src/main/voiceTranscriptionProbe.js';

type Handlers = {
  open?: () => void;
  error?: (err: Error) => void;
  close?: (code?: number) => void;
};

function fakeSocket(
  behavior: 'open' | 'unauthorized' | 'network',
  latencyMs = 5
): {
  socket: VoiceTranscriptionProbeSocket;
  flush: () => void;
} {
  const handlers: Handlers = {};
  const closed = { value: false };
  const socket: VoiceTranscriptionProbeSocket = {
    on(event, listener) {
      handlers[event as keyof Handlers] = listener as never;
      return socket;
    },
    close() {
      closed.value = true;
    },
  };
  function flush() {
    setTimeout(() => {
      if (closed.value) return;
      if (behavior === 'open') handlers.open?.();
      if (behavior === 'unauthorized') handlers.close?.(401);
      if (behavior === 'network') handlers.error?.(new Error('ECONNREFUSED'));
    }, latencyMs);
  }
  return { socket, flush };
}

test('voiceTranscriptionProbe: open within timeout returns ok', async () => {
  const { socket, flush } = fakeSocket('open');
  flush();
  const result = await runVoiceTranscriptionProbe({
    apiKey: 'k1',
    timeoutMs: 100,
    createSocket: () => socket,
  });
  assert.deepEqual(result, { ok: true, code: 'ok' });
});

test('voiceTranscriptionProbe: 401-style close returns auth', async () => {
  const { socket, flush } = fakeSocket('unauthorized');
  flush();
  const result = await runVoiceTranscriptionProbe({
    apiKey: 'k1',
    timeoutMs: 100,
    createSocket: () => socket,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'auth');
});

test('voiceTranscriptionProbe: socket error returns network', async () => {
  const { socket, flush } = fakeSocket('network');
  flush();
  const result = await runVoiceTranscriptionProbe({
    apiKey: 'k1',
    timeoutMs: 100,
    createSocket: () => socket,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'network');
});

test('voiceTranscriptionProbe: nothing happens within timeout returns network', async () => {
  const noop: VoiceTranscriptionProbeSocket = { on: () => noop, close: () => {} };
  const result = await runVoiceTranscriptionProbe({
    apiKey: 'k1',
    timeoutMs: 30,
    createSocket: () => noop,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'network');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:main`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement voiceTranscriptionProbe**

Create `src/main/voiceTranscriptionProbe.ts`：

```ts
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import {
  DOUBAO_STREAMING_ASR_ENDPOINT,
  DOUBAO_STREAMING_ASR_RESOURCE_ID,
} from './doubaoStreamingAsr.js';

export type VoiceTranscriptionProbeCode = 'ok' | 'auth' | 'network';

export type VoiceTranscriptionProbeResult =
  | { readonly ok: true; readonly code: 'ok' }
  | { readonly ok: false; readonly code: VoiceTranscriptionProbeCode; readonly message?: string };

export type VoiceTranscriptionProbeSocket = {
  readonly on: (
    event: 'open' | 'error' | 'close',
    listener: (...args: unknown[]) => void
  ) => VoiceTranscriptionProbeSocket;
  readonly close: () => void;
};

export type RunVoiceTranscriptionProbeInput = {
  readonly apiKey: string;
  readonly timeoutMs?: number;
  readonly createSocket?: (init: {
    readonly url: string;
    readonly headers: Record<string, string>;
  }) => VoiceTranscriptionProbeSocket;
};

const DEFAULT_TIMEOUT_MS = 1000;

function defaultCreateSocket({
  url,
  headers,
}: {
  url: string;
  headers: Record<string, string>;
}): VoiceTranscriptionProbeSocket {
  const ws = new WebSocket(url, { handshakeTimeout: 1000, headers, perMessageDeflate: false });
  const wrapper: VoiceTranscriptionProbeSocket = {
    on(event, listener) {
      ws.on(event, listener as never);
      return wrapper;
    },
    close() {
      ws.close();
    },
  };
  return wrapper;
}

export function runVoiceTranscriptionProbe({
  apiKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  createSocket = defaultCreateSocket,
}: RunVoiceTranscriptionProbeInput): Promise<VoiceTranscriptionProbeResult> {
  return new Promise((resolve) => {
    let settled = false;
    const socket = createSocket({
      url: DOUBAO_STREAMING_ASR_ENDPOINT,
      headers: {
        'X-Api-Key': apiKey,
        'X-Api-Connect-Id': randomUUID(),
        'X-Api-Resource-Id': DOUBAO_STREAMING_ASR_RESOURCE_ID,
      },
    });
    const timer = setTimeout(
      () => settle({ ok: false, code: 'network', message: 'probe timeout' }),
      Math.max(1, timeoutMs)
    );
    function settle(result: VoiceTranscriptionProbeResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      resolve(result);
    }
    socket
      .on('open', () => settle({ ok: true, code: 'ok' }))
      .on('error', (err) =>
        settle({
          ok: false,
          code: 'network',
          message: err instanceof Error ? err.message : String(err),
        })
      )
      .on('close', (code) => {
        const numeric = typeof code === 'number' ? code : 0;
        if (numeric === 401 || numeric === 403) settle({ ok: false, code: 'auth' });
        else settle({ ok: false, code: 'network' });
      });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:main`
Expected: PASS all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/voiceTranscriptionProbe.ts test/main/voiceTranscriptionProbe.test.ts
git commit -m "feat(main): add voiceTranscriptionProbe for X-Api-Key validation

Single WS handshake against the new-console endpoint with injectable
socket factory. 1s default timeout. Returns ok/auth/network code; never
sends audio."
```

---

### Task 3: doubaoStreamingAsr.ts — protocol migration

**Files:**

- Modify: `src/main/doubaoStreamingAsr.ts`
- Modify: `test/main/doubaoStreamingAsr.test.ts`

- [ ] **Step 1: Update doubaoStreamingAsr.ts header builder and session input**

In `src/main/doubaoStreamingAsr.ts`:

Replace `DoubaoAsrAuthInput`：

```ts
type DoubaoAsrAuthInput = {
  readonly apiKey: string;
  readonly connectId: string;
};
```

Replace `buildDoubaoAsrAuthHeaders`：

```ts
export function buildDoubaoAsrAuthHeaders({
  apiKey,
  connectId,
}: DoubaoAsrAuthInput): Record<string, string> {
  return {
    'X-Api-Key': apiKey,
    'X-Api-Connect-Id': connectId,
    'X-Api-Resource-Id': DOUBAO_STREAMING_ASR_RESOURCE_ID,
  };
}
```

Replace `DoubaoStreamingAsrSessionInput`：

```ts
export type DoubaoStreamingAsrSessionInput = {
  readonly apiKey: string;
  readonly connectId?: string;
  readonly createSocket?: (input: CreateDoubaoStreamingAsrSocketInput) => DoubaoStreamingAsrSocket;
  readonly finalResultTimeoutMs?: number;
  readonly onError?: (message: string) => void;
  readonly onTerminalError?: (message: string) => void;
  readonly onTranscriptSegments?: (segments: DoubaoAsrTranscriptSegment[]) => void;
  readonly recordingSessionId: string;
  readonly revisionId: string;
  readonly uid: string;
  readonly url?: string;
};
```

In `createDoubaoStreamingAsrSession`, replace destructuring `{ accessKey, appKey, ... }` with `{ apiKey, ... }`. Replace `const secrets = [accessKey, appKey];` with `const secrets = [apiKey];`. Replace `buildDoubaoAsrAuthHeaders({ accessKey, appKey, connectId })` with `buildDoubaoAsrAuthHeaders({ apiKey, connectId })`.

- [ ] **Step 2: Update existing tests to use apiKey fixture**

In `test/main/doubaoStreamingAsr.test.ts`:

- Replace every `accessKey: 'xxx', appKey: 'yyy'` with `apiKey: 'test-api-key'`.
- Replace any `buildDoubaoAsrAuthHeaders({ accessKey, appKey, connectId })` call with `{ apiKey: 'test-api-key', connectId: 'fixture-uuid' }`.
- Update header-shape assertion: header dict should equal `{ 'X-Api-Key': 'test-api-key', 'X-Api-Connect-Id': 'fixture-uuid', 'X-Api-Resource-Id': 'volc.seedasr.sauc.duration' }`.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm run test:main`
Expected: PASS all existing tests with new apiKey shape.

- [ ] **Step 4: grep verify no legacy refs remain**

Run: `grep -n 'X-Api-App-Key\|X-Api-Access-Key\|accessKey\|appKey' src/main/doubaoStreamingAsr.ts test/main/doubaoStreamingAsr.test.ts`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add src/main/doubaoStreamingAsr.ts test/main/doubaoStreamingAsr.test.ts
git commit -m "refactor(main): migrate doubaoStreamingAsr to new-console X-Api-Key

Drop legacy dual-header X-Api-App-Key + X-Api-Access-Key in favour of
the single X-Api-Key new-console auth. Caller surface, redact list and
tests updated. No fallback to legacy headers."
```

---

### Task 4: recordingTranscriptionSessions — credentials + toggle branching

**Files:**

- Modify: `src/main/recordingTranscriptionSessions.ts`
- Modify: `test/main/recordingTranscriptionSessions.test.ts`
- Modify: `src/workspace-contract/workspace-contract.ts` (extend response shape — picked up in Task 7; here only adjust call sites)

> Note: `transcriptionMode: 'live' | 'disabled'` lives in the contract response value. For this task, branch the registry so it returns `{ accepted: true, transcriptionMode: 'disabled' }` and `{ accepted: true, transcriptionMode: 'live' }` accordingly. The contract change happens in Task 7; until then both fields are `unknown` to TS but the test can use any-shape assertion.

- [ ] **Step 1: Write failing test for disabled / unavailable / live three branches**

Add to `test/main/recordingTranscriptionSessions.test.ts`:

```ts
test('start returns transcriptionMode=disabled when toggle off', async () => {
  const registry = createRecordingTranscriptionSessionRegistry({
    resolveVoiceSettings: () => ({ enabled: false, apiKey: null }),
    createSession: () => {
      throw new Error('should not create');
    },
  });
  const response = await registry.start(makeStartInput());
  assert.equal(response.ok, true);
  assert.equal(
    (response as { value: { accepted: boolean; transcriptionMode: string } }).value.accepted,
    true
  );
  assert.equal(
    (response as { value: { transcriptionMode: string } }).value.transcriptionMode,
    'disabled'
  );
});

test('start returns ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE when enabled but no key', async () => {
  const registry = createRecordingTranscriptionSessionRegistry({
    resolveVoiceSettings: () => ({ enabled: true, apiKey: null }),
    createSession: () => {
      throw new Error('should not create');
    },
  });
  const response = await registry.start(makeStartInput());
  assert.equal(response.ok, false);
  assert.equal(
    (response as { error: { code: string } }).error.code,
    'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE'
  );
});

test('start returns transcriptionMode=live when enabled with key', async () => {
  const registry = createRecordingTranscriptionSessionRegistry({
    resolveVoiceSettings: () => ({ enabled: true, apiKey: 'k1' }),
    createSession: makeFakeSession, // existing helper
  });
  const response = await registry.start(makeStartInput());
  assert.equal(response.ok, true);
  assert.equal(
    (response as { value: { transcriptionMode: string } }).value.transcriptionMode,
    'live'
  );
});
```

`makeStartInput` and `makeFakeSession` must follow the existing test helpers in the file. If they don't exist, copy the smallest existing fixture and rename.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:main`
Expected: FAIL — `resolveVoiceSettings` option not accepted; `transcriptionMode` undefined.

- [ ] **Step 3: Refactor recordingTranscriptionSessions.ts**

In `src/main/recordingTranscriptionSessions.ts`:

Replace `DoubaoCredentials`:

```ts
type DoubaoCredentials = { readonly apiKey: string };
```

Add at top of `CreateRecordingTranscriptionSessionRegistryOptions`:

```ts
readonly resolveVoiceSettings?: () => { readonly enabled: boolean; readonly apiKey: string | null };
```

Replace `resolveDefaultDoubaoCredentials`:

```ts
function defaultResolveVoiceSettings(): { enabled: boolean; apiKey: string | null } {
  return { enabled: false, apiKey: null };
}
```

(real wiring to `voiceSettingsStore` happens at app entry in Task 5; default returns disabled-no-key so existing call sites without injection are explicitly disabled.)

Update `accepted` helper to include `transcriptionMode`:

```ts
function accepted(
  acceptedValue: boolean,
  options: {
    segments?: readonly DoubaoAsrTranscriptSegment[];
    transcriptionMode?: 'live' | 'disabled';
  } = {}
): WorkspaceRecordingTranscriptionControlResponse {
  return {
    ok: true,
    value: {
      accepted: acceptedValue,
      ...(options.transcriptionMode ? { transcriptionMode: options.transcriptionMode } : {}),
      ...(options.segments && options.segments.length > 0
        ? { segments: [...options.segments] }
        : {}),
    },
  };
}
```

Replace `start` first lines (was credentials check). New:

```ts
const voiceSettings = resolveVoiceSettings();
if (!voiceSettings.enabled) {
  return accepted(true, { transcriptionMode: 'disabled' });
}
if (!voiceSettings.apiKey) {
  return workspaceError(
    'ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE',
    '请到 设置 → 语音 填写 X-Api-Key 后再录音。',
    'none-written'
  );
}
const credentials: DoubaoCredentials = { apiKey: voiceSettings.apiKey };
```

Where `resolveVoiceSettings` is the option (default `defaultResolveVoiceSettings`).

Replace `redactCredentialText`:

```ts
function redactCredentialText(message: string, credentials: DoubaoCredentials) {
  return redactSecrets(message, [credentials.apiKey]);
}
```

Replace `createLiveSession` invocation: pass `apiKey: credentials.apiKey` instead of `accessKey/appKey`. Replace existing `resolveCredentials` option with `resolveVoiceSettings`; **delete** the `resolveDefaultDoubaoCredentials` function and all `process.env['REO_DOUBAO_ASR_*']` reads.

Update accepted-success path in `finish`:

```ts
return accepted(true, { segments: entry.transcriptSegments, transcriptionMode: 'live' });
```

- [ ] **Step 4: Run all main tests**

Run: `npm run test:main`
Expected: all PASS including the 3 new branches.

- [ ] **Step 5: grep verify no env var refs**

Run: `grep -n 'REO_DOUBAO_ASR_APP_ID\|REO_DOUBAO_ASR_ACCESS_TOKEN\|resolveDefaultDoubaoCredentials' src/main/`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add src/main/recordingTranscriptionSessions.ts test/main/recordingTranscriptionSessions.test.ts
git commit -m "feat(main): branch transcription start on voice settings + drop env vars

Toggle-off returns transcriptionMode='disabled' (no error, no socket).
Toggle-on but missing key returns ERR_RECORDING_TRANSCRIPTION_UNAVAILABLE.
Toggle-on with key returns transcriptionMode='live'. Replace dual-key
credentials with single apiKey; delete REO_DOUBAO_ASR_APP_ID and
REO_DOUBAO_ASR_ACCESS_TOKEN env var reads with no fallback."
```

---

### Task 5: Initialize voiceSettingsStore in main entry

**Files:**

- Modify: `src/main/index.ts`
- Modify: `src/main/workspaceIpc.ts` (or wherever `createRecordingTranscriptionSessionRegistry` is constructed)

- [ ] **Step 1: Inject safeStorage-backed store at app ready**

In `src/main/index.ts`, near `app.whenReady`:

```ts
import { safeStorage, app } from 'electron';
import { createVoiceSettingsStore } from './voiceSettingsStore.js';

// inside whenReady, before registerWorkspaceIpc:
const voiceSettingsStore = createVoiceSettingsStore({
  safeStorage,
  userDataDir: app.getPath('userData'),
});
```

Pass `voiceSettingsStore` to `registerWorkspaceIpc(...)` as a new option.

- [ ] **Step 2: Wire registry to voiceSettingsStore**

In the place where `createRecordingTranscriptionSessionRegistry({...})` is called:

```ts
createRecordingTranscriptionSessionRegistry({
  resolveVoiceSettings: () => {
    const snapshot = voiceSettingsStore.read();
    return {
      enabled: snapshot.enabled,
      apiKey: voiceSettingsStore.readDecryptedApiKey(),
    };
  },
});
```

- [ ] **Step 3: Run verify:quick to catch regressions**

Run: `npm run verify:quick`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts src/main/workspaceIpc.ts
git commit -m "feat(main): wire voiceSettingsStore at app.whenReady

Inject Electron safeStorage + userData dir into voiceSettingsStore;
expose snapshot+decrypted key to recordingTranscriptionSessions via
resolveVoiceSettings option."
```

---

## Phase 2: Contract + IPC

### Task 6: workspace-channels — 6 new channel constants

**Files:**

- Modify: `src/workspace-contract/workspace-channels.ts`

- [ ] **Step 1: Append channel constants**

At end of `src/workspace-contract/workspace-channels.ts`:

```ts
export const WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL =
  'workspace:readVoiceTranscriptionSettings' as const;
export const WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL =
  'workspace:setVoiceTranscriptionEnabled' as const;
export const WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL =
  'workspace:saveVoiceTranscriptionApiKey' as const;
export const WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL =
  'workspace:clearVoiceTranscriptionApiKey' as const;
export const WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL =
  'workspace:validateVoiceTranscriptionCredentials' as const;
export const WORKSPACE_OPEN_EXTERNAL_URL_CHANNEL = 'workspace:openExternalUrl' as const;
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/workspace-contract/workspace-channels.ts
git commit -m "feat(contract): add voice settings + openExternalUrl channel names

Six new workspace channels for voice transcription BYOK settings:
read/setEnabled/saveApiKey/clearApiKey/validate, plus openExternalUrl
for the volcengine console deep link."
```

---

### Task 7: workspace-contract — schemas + transcriptionMode extension + error codes

**Files:**

- Modify: `src/workspace-contract/workspace-contract.ts`

- [ ] **Step 1: Add error codes to workspaceErrorCodeSchema**

Find `workspaceErrorCodeSchema` (around line 37-93). Add the following enum entries:

```text
'ERR_VOICE_SETTINGS_STORAGE_UNAVAILABLE',
'ERR_VOICE_SETTINGS_WRITE_FAILED',
'ERR_VOICE_TRANSCRIPTION_PROBE_FAILED',
'ERR_OPEN_EXTERNAL_URL_REJECTED',
```

- [ ] **Step 2: Add settings snapshot + 6 request/response schemas**

Add (alphabetically grouped or at end):

```ts
export const voiceTranscriptionSettingsSnapshotSchema = z.strictObject({
  enabled: z.boolean(),
  apiKeyConfigured: z.boolean(),
  apiKeyLastFour: z.string().length(4).nullable(),
  lastValidatedAt: z.string().nullable(),
  lastValidationOk: z.boolean().nullable(),
  lastValidationCode: z.enum(['ok', 'auth', 'network']).nullable(),
});
export type VoiceTranscriptionSettingsSnapshot = z.infer<
  typeof voiceTranscriptionSettingsSnapshotSchema
>;

const settingsResponseValueSchema = z.strictObject({
  settings: voiceTranscriptionSettingsSnapshotSchema,
});

export const workspaceReadVoiceTranscriptionSettingsRequestSchema = z.strictObject({});
export const workspaceReadVoiceTranscriptionSettingsResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), value: settingsResponseValueSchema }),
  workspaceErrorEnvelopeSchema,
]);

export const workspaceSetVoiceTranscriptionEnabledRequestSchema = z.strictObject({
  enabled: z.boolean(),
});
export const workspaceSetVoiceTranscriptionEnabledResponseSchema =
  workspaceReadVoiceTranscriptionSettingsResponseSchema;

export const workspaceSaveVoiceTranscriptionApiKeyRequestSchema = z.strictObject({
  apiKey: z.string().min(4).max(1024),
});
export const workspaceSaveVoiceTranscriptionApiKeyResponseSchema =
  workspaceReadVoiceTranscriptionSettingsResponseSchema;

export const workspaceClearVoiceTranscriptionApiKeyRequestSchema = z.strictObject({});
export const workspaceClearVoiceTranscriptionApiKeyResponseSchema =
  workspaceReadVoiceTranscriptionSettingsResponseSchema;

export const workspaceValidateVoiceTranscriptionCredentialsRequestSchema = z.strictObject({});
export const workspaceValidateVoiceTranscriptionCredentialsResponseSchema = z.discriminatedUnion(
  'ok',
  [
    z.strictObject({
      ok: z.literal(true),
      value: z.strictObject({
        code: z.enum(['ok', 'auth', 'network']),
        message: z.string().optional(),
      }),
    }),
    workspaceErrorEnvelopeSchema,
  ]
);

export const workspaceOpenExternalUrlRequestSchema = z.strictObject({
  url: z.string().url(),
});
export const workspaceOpenExternalUrlResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), value: z.strictObject({}) }),
  workspaceErrorEnvelopeSchema,
]);
```

- [ ] **Step 3: Extend WorkspaceRecordingTranscriptionControlResponse**

Find the existing `workspaceRecordingTranscriptionControlResponseSchema` (search file). In its `value` strictObject add:

```ts
transcriptionMode: z.enum(['live', 'disabled']).optional(),
```

Update derived `type WorkspaceRecordingTranscriptionControlResponse` to reflect.

- [ ] **Step 4: Run typecheck + main tests**

Run: `npm run typecheck && npm run test:main`
Expected: PASS (Task 4's accepted helper now matches schema).

- [ ] **Step 5: Commit**

```bash
git add src/workspace-contract/workspace-contract.ts
git commit -m "feat(contract): add voice settings IPC schemas + transcriptionMode

Six new request/response schemas (read/setEnabled/saveApiKey/
clearApiKey/validate/openExternalUrl), four new error codes, and
WorkspaceRecordingTranscriptionControlResponse gains optional
transcriptionMode: 'live' | 'disabled' so the renderer can render or
skip the transcript surface."
```

---

### Task 8: reo-workspace-bridge — 6 new method types

**Files:**

- Modify: `src/workspace-contract/reo-workspace-bridge.ts`

- [ ] **Step 1: Add 6 method type declarations**

Follow existing convention in `reo-workspace-bridge.ts`. Each method:

```ts
readonly readVoiceTranscriptionSettings: (
  payload: z.input<typeof workspaceReadVoiceTranscriptionSettingsRequestSchema>
) => Promise<z.infer<typeof workspaceReadVoiceTranscriptionSettingsResponseSchema>>;
readonly setVoiceTranscriptionEnabled: (
  payload: z.input<typeof workspaceSetVoiceTranscriptionEnabledRequestSchema>
) => Promise<z.infer<typeof workspaceSetVoiceTranscriptionEnabledResponseSchema>>;
readonly saveVoiceTranscriptionApiKey: (
  payload: z.input<typeof workspaceSaveVoiceTranscriptionApiKeyRequestSchema>
) => Promise<z.infer<typeof workspaceSaveVoiceTranscriptionApiKeyResponseSchema>>;
readonly clearVoiceTranscriptionApiKey: (
  payload: z.input<typeof workspaceClearVoiceTranscriptionApiKeyRequestSchema>
) => Promise<z.infer<typeof workspaceClearVoiceTranscriptionApiKeyResponseSchema>>;
readonly validateVoiceTranscriptionCredentials: (
  payload: z.input<typeof workspaceValidateVoiceTranscriptionCredentialsRequestSchema>
) => Promise<z.infer<typeof workspaceValidateVoiceTranscriptionCredentialsResponseSchema>>;
readonly openExternalUrl: (
  payload: z.input<typeof workspaceOpenExternalUrlRequestSchema>
) => Promise<z.infer<typeof workspaceOpenExternalUrlResponseSchema>>;
```

Match the file's existing import style (the file is type-only with no Zod runtime — use `import type { z } from 'zod';` if needed and `z.input/z.infer` style).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/workspace-contract/reo-workspace-bridge.ts
git commit -m "feat(contract): expose voice settings + openExternalUrl bridge types"
```

---

### Task 9: workspaceIpc — register 6 new handlers

**Files:**

- Modify: `src/main/workspaceIpc.ts`
- Modify: `test/main/workspaceIpc.test.ts` (may already exist; if not, create new colocated test file)

- [ ] **Step 1: Write failing test for `readVoiceTranscriptionSettings` handler**

Add to `test/main/workspaceIpc.test.ts` (create file if absent):

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceSettingsStore } from '../../src/main/voiceSettingsStore.js';
import { handleReadVoiceTranscriptionSettingsForTest } from '../../src/main/workspaceIpc.js';

function fakeStore() {
  /* in-memory store with same surface */
}

test('readVoiceTranscriptionSettings returns snapshot without ciphertext', async () => {
  const store = fakeStore();
  store.setEnabled(true);
  store.writeApiKey('abcd1234');
  const response = await handleReadVoiceTranscriptionSettingsForTest({ store });
  assert.equal(response.ok, true);
  assert.equal(response.value.settings.enabled, true);
  assert.equal(response.value.settings.apiKeyConfigured, true);
  assert.equal(response.value.settings.apiKeyLastFour, '1234');
  // ensure no key / cipher leak in response
  assert.ok(!JSON.stringify(response).includes('abcd1234'));
});
```

Repeat 5 more tests for setEnabled / saveApiKey (with mock probe) / clearApiKey / validate / openExternalUrl (with mock shell). Follow existing `handleForTest` pattern in `workspaceIpc.ts`.

- [ ] **Step 2: Implement handlers**

In `src/main/workspaceIpc.ts`:

```ts
import { runVoiceTranscriptionProbe } from './voiceTranscriptionProbe.js';
import {
  WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
  WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL,
  WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
  WORKSPACE_OPEN_EXTERNAL_URL_CHANNEL,
} from '../workspace-contract/workspace-channels.js';
import {
  workspaceSetVoiceTranscriptionEnabledRequestSchema,
  workspaceSaveVoiceTranscriptionApiKeyRequestSchema,
  workspaceOpenExternalUrlRequestSchema,
  workspaceError,
} from '../workspace-contract/workspace-contract.js';

async function handleSettingsRead(store: VoiceSettingsStore) {
  return { ok: true as const, value: { settings: store.read() } };
}

async function handleSettingsSetEnabled(store: VoiceSettingsStore, payload: unknown) {
  const parsed = workspaceSetVoiceTranscriptionEnabledRequestSchema.safeParse(payload);
  if (!parsed.success)
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'Invalid voice settings enabled request.',
      'none-written'
    );
  store.setEnabled(parsed.data.enabled);
  return { ok: true as const, value: { settings: store.read() } };
}

async function handleSettingsSaveApiKey(
  store: VoiceSettingsStore,
  probe: (
    key: string
  ) => Promise<{ ok: boolean; code: 'ok' | 'auth' | 'network'; message?: string }>,
  payload: unknown
) {
  const parsed = workspaceSaveVoiceTranscriptionApiKeyRequestSchema.safeParse(payload);
  if (!parsed.success)
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'Invalid voice settings API key request.',
      'none-written'
    );
  try {
    store.writeApiKey(parsed.data.apiKey);
  } catch (err) {
    const code =
      err instanceof Error && err.message === 'safeStorage unavailable'
        ? 'ERR_VOICE_SETTINGS_STORAGE_UNAVAILABLE'
        : 'ERR_VOICE_SETTINGS_WRITE_FAILED';
    return workspaceError(code, '无法写入本地配置，请检查磁盘或系统安全存储。', 'none-written');
  }
  const result = await probe(parsed.data.apiKey);
  store.recordValidation({
    ok: result.code === 'ok' ? true : result.code === 'auth' ? false : null,
    code: result.code,
  });
  return {
    ok: true as const,
    value: {
      settings: store.read(),
    },
  };
}

async function handleSettingsClear(store: VoiceSettingsStore) {
  store.clearApiKey();
  return { ok: true as const, value: { settings: store.read() } };
}

async function handleValidate(
  store: VoiceSettingsStore,
  probe: (
    key: string
  ) => Promise<{ ok: boolean; code: 'ok' | 'auth' | 'network'; message?: string }>
) {
  const key = store.readDecryptedApiKey();
  if (!key)
    return workspaceError(
      'ERR_VOICE_TRANSCRIPTION_PROBE_FAILED',
      '请先填写 X-Api-Key。',
      'none-written'
    );
  const result = await probe(key);
  store.recordValidation({
    ok: result.code === 'ok' ? true : result.code === 'auth' ? false : null,
    code: result.code,
  });
  return {
    ok: true as const,
    value: { code: result.code, ...(result.message ? { message: result.message } : {}) },
  };
}

async function handleOpenExternal(payload: unknown) {
  const parsed = workspaceOpenExternalUrlRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return workspaceError(
      'ERR_WORKSPACE_INVALID_REQUEST',
      'Invalid open external URL request.',
      'none-written'
    );
  }
  const url = new URL(parsed.data.url);
  const hostname = url.hostname.toLowerCase();
  const isAllowedVolcengineHost =
    hostname === 'volcengine.com' || hostname.endsWith('.volcengine.com');
  const hasExplicitPort = url.port.length > 0;
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    hasExplicitPort ||
    !isAllowedVolcengineHost
  ) {
    return workspaceError(
      'ERR_OPEN_EXTERNAL_URL_REJECTED',
      '不允许打开该外部链接。',
      'none-written'
    );
  }
  await requireElectronShellApi().shell.openExternal(url.toString());
  return { ok: true as const, value: {} };
}
```

Register handlers through the existing `registerWorkspaceIpcHandler` helper inside `registerWorkspaceIpc`; do not create a second IPC registration path:

```ts
registerWorkspaceIpcHandler(
  WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
  (event, payload) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) return trusted;
    const request = workspaceNoInputSchema.safeParse(payload);
    if (!request.success)
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'Invalid voice settings read request.',
        'none-written'
      );
    return handleSettingsRead(voiceSettingsStore);
  }
);
registerWorkspaceIpcHandler(WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL, (event, payload) => {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) return trusted;
  return handleSettingsSetEnabled(voiceSettingsStore, payload);
});
registerWorkspaceIpcHandler(
  WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  (event, payload) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) return trusted;
    return handleSettingsSaveApiKey(
      voiceSettingsStore,
      (k) => runVoiceTranscriptionProbe({ apiKey: k }),
      payload
    );
  }
);
registerWorkspaceIpcHandler(
  WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
  (event, payload) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) return trusted;
    const request = workspaceNoInputSchema.safeParse(payload);
    if (!request.success)
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'Invalid voice settings clear request.',
        'none-written'
      );
    return handleSettingsClear(voiceSettingsStore);
  }
);
registerWorkspaceIpcHandler(
  WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
  (event, payload) => {
    const trusted = validateWorkspaceSender({
      event,
      channel: WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL,
      expectedSession,
      expectedSessionKey,
      isTrustedUrl,
    });
    if (!trusted.ok) return trusted;
    const request = workspaceNoInputSchema.safeParse(payload);
    if (!request.success)
      return workspaceError(
        'ERR_WORKSPACE_INVALID_REQUEST',
        'Invalid voice settings validate request.',
        'none-written'
      );
    return handleValidate(voiceSettingsStore, (k) => runVoiceTranscriptionProbe({ apiKey: k }));
  }
);
registerWorkspaceIpcHandler(WORKSPACE_OPEN_EXTERNAL_URL_CHANNEL, (event, payload) => {
  const trusted = validateWorkspaceSender({
    event,
    channel: WORKSPACE_OPEN_EXTERNAL_URL_CHANNEL,
    expectedSession,
    expectedSessionKey,
    isTrustedUrl,
  });
  if (!trusted.ok) return trusted;
  return handleOpenExternal(payload);
});
```

Export `handle*ForTest` variants mirroring existing convention.

- [ ] **Step 3: Run main tests**

Run: `npm run test:main`
Expected: PASS including 6 new tests.

- [ ] **Step 4: Commit**

```bash
git add src/main/workspaceIpc.ts test/main/workspaceIpc.test.ts
git commit -m "feat(main): register voice settings + openExternalUrl IPC handlers

Six new handlers wired to voiceSettingsStore and voiceTranscriptionProbe.
openExternalUrl restricts to volcengine.com host allowlist. Every handler
parses request with strict Zod schema and validates sender. Snapshot
responses never contain ciphertext or full key."
```

---

### Task 10: preload bridge — expose 6 new methods

**Files:**

- Modify: `src/preload/workspaceBridge.ts`

- [ ] **Step 1: Add invoke wrappers**

In `src/preload/workspaceBridge.ts`, within `createWorkspaceBridge` factory:

```ts
readVoiceTranscriptionSettings: (payload) =>
  invoke(WORKSPACE_READ_VOICE_TRANSCRIPTION_SETTINGS_CHANNEL, payload),
setVoiceTranscriptionEnabled: (payload) =>
  invoke(WORKSPACE_SET_VOICE_TRANSCRIPTION_ENABLED_CHANNEL, payload),
saveVoiceTranscriptionApiKey: (payload) =>
  invoke(WORKSPACE_SAVE_VOICE_TRANSCRIPTION_API_KEY_CHANNEL, payload),
clearVoiceTranscriptionApiKey: (payload) =>
  invoke(WORKSPACE_CLEAR_VOICE_TRANSCRIPTION_API_KEY_CHANNEL, payload),
validateVoiceTranscriptionCredentials: (payload) =>
  invoke(WORKSPACE_VALIDATE_VOICE_TRANSCRIPTION_CREDENTIALS_CHANNEL, payload),
openExternalUrl: (payload) =>
  invoke(WORKSPACE_OPEN_EXTERNAL_URL_CHANNEL, payload),
```

Import the 6 new channel constants at the top.

- [ ] **Step 2: Run typecheck + verify:quick**

Run: `npm run typecheck && npm run verify:quick`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/preload/workspaceBridge.ts
git commit -m "feat(preload): expose voice settings + openExternalUrl bridge methods"
```

---

## Phase 3: Renderer foundation

### Task 11: shadcn Switch primitive

**Files:**

- Create: `src/renderer/src/components/ui/switch.tsx`
- Create: `src/renderer/src/components/ui/switch.test.tsx`
- Modify: `package.json` if `@radix-ui/react-switch` missing
- Modify: `docs/current/frontend.md` (in Task 24)

- [ ] **Step 1: Add Radix Switch dependency**

Run: `grep -q "@radix-ui/react-switch" package.json && echo OK || npm install @radix-ui/react-switch`

- [ ] **Step 2: Write failing test**

Create `src/renderer/src/components/ui/switch.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Switch } from './switch';

describe('Switch', () => {
  it('renders unchecked by default', () => {
    render(<Switch aria-label="toggle" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('fires onCheckedChange when clicked', async () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="toggle" onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('honors disabled prop', () => {
    render(<Switch aria-label="toggle" disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/ui/switch.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement Switch**

Create `src/renderer/src/components/ui/switch.tsx`：

```tsx
'use client';
import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-secondary',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
        'data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[2px]'
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

export { Switch };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/components/ui/switch.test.tsx`
Expected: PASS 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/ui/switch.tsx src/renderer/src/components/ui/switch.test.tsx package.json package-lock.json
git commit -m "feat(ui): add shadcn Switch primitive using Radix Switch

Reo design tokens: primary (red) when checked, secondary (grey) when
unchecked. Background-colored thumb. Used by VoiceSettingsPanel toggle."
```

---

### Task 12: voiceSettingsQueries — TanStack Query options

**Files:**

- Create: `src/renderer/src/settings/voiceSettingsQueries.ts`
- Create: `src/renderer/src/settings/voiceSettingsQueries.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/renderer/src/settings/voiceSettingsQueries.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { voiceSettingsQueryKey, voiceSettingsQueryOptions } from './voiceSettingsQueries';

declare global {
  interface Window {
    reoWorkspace: any;
  }
}

beforeEach(() => {
  window.reoWorkspace = {
    readVoiceTranscriptionSettings: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        settings: {
          enabled: true,
          apiKeyConfigured: true,
          apiKeyLastFour: '1234',
          lastValidatedAt: '2026-05-16T13:00:00.000Z',
          lastValidationOk: true,
          lastValidationCode: 'ok',
        },
      },
    }),
  };
});

describe('voiceSettingsQueries', () => {
  it('key is stable', () => {
    expect(voiceSettingsQueryKey()).toEqual(['settings', 'voice']);
  });

  it('fetches snapshot via preload bridge', async () => {
    const qc = new QueryClient();
    const data = await qc.fetchQuery(voiceSettingsQueryOptions());
    expect(data.enabled).toBe(true);
    expect(data.apiKeyConfigured).toBe(true);
    expect(data.apiKeyLastFour).toBe('1234');
  });

  it('throws on error envelope', async () => {
    window.reoWorkspace.readVoiceTranscriptionSettings = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: 'ERR_VOICE_SETTINGS_WRITE_FAILED',
        message: 'oops',
        dataRetention: 'none-written',
      },
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(qc.fetchQuery(voiceSettingsQueryOptions())).rejects.toThrow('oops');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/settings/voiceSettingsQueries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement queries**

Create `src/renderer/src/settings/voiceSettingsQueries.ts`：

```ts
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { VoiceTranscriptionSettingsSnapshot } from '../../../workspace-contract/workspace-contract';

export function voiceSettingsQueryKey() {
  return ['settings', 'voice'] as const;
}

export function voiceSettingsQueryOptions() {
  return queryOptions({
    queryKey: voiceSettingsQueryKey(),
    queryFn: async (): Promise<VoiceTranscriptionSettingsSnapshot> => {
      const response = await window.reoWorkspace.readVoiceTranscriptionSettings({});
      if (!response.ok) throw new Error(response.error.message);
      return response.value.settings;
    },
    staleTime: 60_000,
  });
}

export function invalidateVoiceSettings(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: voiceSettingsQueryKey(), exact: true });
}
```

(Use the relative path shown above; the renderer does not have an `@/../../../workspace-contract` alias. Prefer wrapping preload calls in `src/renderer/src/workspace/workspaceApi.ts` if the surrounding code already uses that facade.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/settings/voiceSettingsQueries.test.ts`
Expected: PASS 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/settings/voiceSettingsQueries.ts src/renderer/src/settings/voiceSettingsQueries.test.ts
git commit -m "feat(renderer): add voice settings TanStack Query options

Stable key ['settings','voice']; throws on workspace error envelope;
60s stale time. invalidateVoiceSettings helper for mutations."
```

---

## Phase 4: Settings UI

### Task 13: SettingsShell skeleton

**Files:**

- Create: `src/renderer/src/settings/SettingsShell.tsx`
- Create: `src/renderer/src/settings/SettingsShell.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/renderer/src/settings/SettingsShell.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SettingsShell } from './SettingsShell';

describe('SettingsShell', () => {
  it('renders return button, voice nav item, voice panel title', () => {
    render(
      <SettingsShell activeCategory="voice" onReturnToApp={vi.fn()} onSelectCategory={vi.fn()}>
        <div>voice content</div>
      </SettingsShell>
    );
    expect(screen.getByRole('button', { name: '返回应用' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '语音' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('voice content')).toBeInTheDocument();
  });

  it('calls onReturnToApp when return button clicked', async () => {
    const onReturnToApp = vi.fn();
    render(
      <SettingsShell
        activeCategory="voice"
        onReturnToApp={onReturnToApp}
        onSelectCategory={vi.fn()}
      >
        <div />
      </SettingsShell>
    );
    await userEvent.click(screen.getByRole('button', { name: '返回应用' }));
    expect(onReturnToApp).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/settings/SettingsShell.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement SettingsShell**

Create `src/renderer/src/settings/SettingsShell.tsx`：

```tsx
import { ArrowLeft, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SettingsCategory = 'voice';

export type SettingsShellProps = {
  readonly activeCategory: SettingsCategory;
  readonly onReturnToApp: () => void;
  readonly onSelectCategory: (category: SettingsCategory) => void;
  readonly children: React.ReactNode;
};

const CATEGORY_LABEL: Record<SettingsCategory, string> = { voice: '语音' };

export function SettingsShell({
  activeCategory,
  onReturnToApp,
  onSelectCategory,
  children,
}: SettingsShellProps) {
  return (
    <div className="flex h-full min-h-0 w-full bg-background">
      <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-secondary bg-card px-3 py-4">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 rounded-md"
          onClick={onReturnToApp}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回应用</span>
        </Button>
        <nav className="mt-2 flex flex-col gap-1" aria-label="设置类目">
          {(Object.keys(CATEGORY_LABEL) as SettingsCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              aria-current={cat === activeCategory ? 'page' : undefined}
              onClick={() => onSelectCategory(cat)}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                cat === activeCategory
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              <Settings2 className="h-4 w-4" />
              {CATEGORY_LABEL[cat]}
            </button>
          ))}
        </nav>
      </aside>
      <section className="flex flex-1 flex-col overflow-y-auto px-28 py-20">
        <h1 className="mb-6 text-2xl font-medium tracking-tight">
          {CATEGORY_LABEL[activeCategory]}
        </h1>
        {children}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/src/settings/SettingsShell.test.tsx`
Expected: PASS 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/settings/SettingsShell.tsx src/renderer/src/settings/SettingsShell.test.tsx
git commit -m "feat(renderer): add SettingsShell route layout

Left nav rail (return + voice category), right content panel with h1
title. Uses Reo design tokens; no shadows; bg-card sidebar with
border-secondary divider mirrors AppShell layout."
```

---

### Task 14: VoiceSettingsPanel — states 1-3 (disabled-no-key / enabled-no-key / editing-with-key)

**Files:**

- Create: `src/renderer/src/settings/VoiceSettingsPanel.tsx`
- Create: `src/renderer/src/settings/VoiceSettingsPanel.test.tsx`

- [ ] **Step 1: Write failing test for state 1**

Create `src/renderer/src/settings/VoiceSettingsPanel.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';

function renderWithQuery(snapshot: any) {
  window.reoWorkspace = {
    readVoiceTranscriptionSettings: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { settings: snapshot } }),
    setVoiceTranscriptionEnabled: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { settings: snapshot } }),
    saveVoiceTranscriptionApiKey: vi.fn(),
    clearVoiceTranscriptionApiKey: vi.fn(),
    validateVoiceTranscriptionCredentials: vi.fn(),
    openExternalUrl: vi.fn(),
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <VoiceSettingsPanel />
    </QueryClientProvider>
  );
}

describe('VoiceSettingsPanel state disabled-no-key', () => {
  it('toggle is off, input is disabled, save is disabled', async () => {
    renderWithQuery({
      enabled: false,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
    expect(await screen.findByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByLabelText('X-Api-Key')).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });
});

describe('VoiceSettingsPanel state enabled-no-key', () => {
  it('shows red hint and enables input', async () => {
    renderWithQuery({
      enabled: true,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
    expect(await screen.findByText('启用后需要 X-Api-Key 才能生成转录')).toBeInTheDocument();
    expect(screen.getByLabelText('X-Api-Key')).not.toBeDisabled();
  });
});

describe('VoiceSettingsPanel state editing-with-key', () => {
  it('typing in input enables Save button and hides red hint', async () => {
    renderWithQuery({
      enabled: true,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
    const input = await screen.findByLabelText('X-Api-Key');
    await userEvent.type(input, 'mykey1234');
    expect(screen.getByRole('button', { name: '保存' })).not.toBeDisabled();
    expect(screen.queryByText('启用后需要 X-Api-Key 才能生成转录')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/settings/VoiceSettingsPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement VoiceSettingsPanel (first 3 states)**

Create `src/renderer/src/settings/VoiceSettingsPanel.tsx`：

```tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldControl, FieldGroup, FieldHint, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { invalidateVoiceSettings, voiceSettingsQueryOptions } from './voiceSettingsQueries';

export function VoiceSettingsPanel() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery(voiceSettingsQueryOptions());
  const [draftKey, setDraftKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const setEnabledMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const r = await window.reoWorkspace.setVoiceTranscriptionEnabled({ enabled });
      if (!r.ok) throw new Error(r.error.message);
      return r.value.settings;
    },
    onSuccess: () => invalidateVoiceSettings(qc),
  });

  if (isLoading || !settings) return <p className="text-muted-foreground">正在载入...</p>;

  const inputDisabled = !settings.enabled;
  const canSave = draftKey.trim().length > 0;
  const showRedHint = settings.enabled && !settings.apiKeyConfigured && draftKey.length === 0;

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-lg font-medium">启用流式语音识别</h2>
          <p className="text-sm text-muted-foreground">
            在录音时使用火山引擎豆包大模型流式语音识别生成转录
          </p>
        </div>
        <Switch
          aria-label="启用流式语音识别"
          checked={settings.enabled}
          disabled={setEnabledMutation.isPending}
          onCheckedChange={(checked) => setEnabledMutation.mutate(checked)}
        />
      </header>

      <FieldGroup>
        <FieldLabel htmlFor="api-key">X-Api-Key</FieldLabel>
        <FieldControl>
          <div className="relative">
            <Input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={draftKey}
              disabled={inputDisabled}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder={
                settings.apiKeyConfigured
                  ? `已配置 · 末 4 位 ●●●● ${settings.apiKeyLastFour ?? ''}`
                  : 'X-Api-Key'
              }
              maxLength={1024}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? '隐藏 key' : '显示 key'}
              disabled={inputDisabled}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FieldControl>
        {showRedHint ? (
          <p className="text-sm text-destructive">启用后需要 X-Api-Key 才能生成转录</p>
        ) : (
          <FieldHint>可在火山引擎控制台 → 大模型流式语音识别 获取</FieldHint>
        )}
      </FieldGroup>

      <div className="flex items-center gap-3">
        <Button disabled={!canSave}>保存</Button>
      </div>
    </div>
  );
}
```

(`components/ui/field.tsx` 当前导出 `FieldGroup / FieldControl / FieldHint / FieldLabel / FieldError`，不导出 `Field` 或 `FieldDescription`。实现必须使用当前导出名。)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/settings/VoiceSettingsPanel.test.tsx`
Expected: PASS 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/settings/VoiceSettingsPanel.tsx src/renderer/src/settings/VoiceSettingsPanel.test.tsx
git commit -m "feat(renderer): add VoiceSettingsPanel states 1-3

disabled-no-key, enabled-no-key, editing-with-key. Toggle wires to
setVoiceTranscriptionEnabled mutation; key input password-masked with
eye-toggle; red hint when toggle on and key blank."
```

---

### Task 15: VoiceSettingsPanel — states 4-5 (validating / verified-active)

**Files:**

- Modify: `src/renderer/src/settings/VoiceSettingsPanel.tsx`
- Modify: `src/renderer/src/settings/VoiceSettingsPanel.test.tsx`

- [ ] **Step 1: Add failing tests for validating + verified-active**

Append to `VoiceSettingsPanel.test.tsx`:

```tsx
describe('VoiceSettingsPanel state validating + verified-active', () => {
  it('clicking save calls saveVoiceTranscriptionApiKey and shows spinner', async () => {
    const saveMock = vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                value: {
                  settings: {
                    enabled: true,
                    apiKeyConfigured: true,
                    apiKeyLastFour: '1234',
                    lastValidatedAt: '2026-05-16T13:00:00.000Z',
                    lastValidationOk: true,
                    lastValidationCode: 'ok',
                  },
                },
              }),
            30
          )
        )
    );
    renderWithQuery({
      enabled: true,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      lastValidatedAt: null,
      lastValidationOk: null,
      lastValidationCode: null,
    });
    window.reoWorkspace.saveVoiceTranscriptionApiKey = saveMock;
    const input = await screen.findByLabelText('X-Api-Key');
    await userEvent.type(input, 'goodkey1234');
    const save = screen.getByRole('button', { name: '保存' });
    await userEvent.click(save);
    expect(screen.getByRole('button', { name: '验证中...' })).toBeInTheDocument();
    expect(saveMock).toHaveBeenCalledWith({ apiKey: 'goodkey1234' });
  });

  it('shows verified status point after success', async () => {
    renderWithQuery({
      enabled: true,
      apiKeyConfigured: true,
      apiKeyLastFour: '1234',
      lastValidatedAt: '2026-05-16T13:00:00.000Z',
      lastValidationOk: true,
      lastValidationCode: 'ok',
    });
    expect(await screen.findByText(/已验证/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '更换' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement saveApiKey mutation + status point**

In `VoiceSettingsPanel.tsx`, add:

```tsx
const saveMutation = useMutation({
  mutationFn: async (apiKey: string) => {
    const r = await window.reoWorkspace.saveVoiceTranscriptionApiKey({ apiKey });
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  },
  onSuccess: () => {
    setDraftKey('');
    invalidateVoiceSettings(qc);
  },
});

// In header replace Save button area:
<Button
  disabled={!canSave || saveMutation.isPending}
  onClick={() => saveMutation.mutate(draftKey.trim())}
>
  {saveMutation.isPending ? '验证中...' : '保存'}
</Button>;

// After Save, render status point:
{
  settings.lastValidatedAt && (
    <StatusPoint
      code={settings.lastValidationCode}
      ok={settings.lastValidationOk}
      timestamp={settings.lastValidatedAt}
    />
  );
}

// Replace placeholder logic:
// When apiKeyConfigured: render "已配置 · 末 4 位 ●●●● XXXX" + 更换 button (clears draftKey ready)
```

Implement small `StatusPoint` component below the panel that returns colored dot + localized text based on `code/ok/timestamp`.

```tsx
function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusPoint({
  code,
  ok,
  timestamp,
}: {
  code: 'ok' | 'auth' | 'network' | null;
  ok: boolean | null;
  timestamp: string;
}) {
  if (code === 'ok' && ok) {
    return (
      <p className="flex items-center gap-2 text-sm text-foreground">
        <span className="h-2 w-2 rounded-full bg-emerald-500" /> 已验证 ·{' '}
        {formatTimestamp(timestamp)}
      </p>
    );
  }
  if (code === 'auth') {
    return (
      <p className="flex items-center gap-2 text-sm text-destructive">
        <span className="h-2 w-2 rounded-full bg-destructive" /> X-Api-Key
        无效或没有权限，请检查控制台
      </p>
    );
  }
  if (code === 'network') {
    return (
      <p className="flex items-center gap-2 text-sm text-amber-600">
        <span className="h-2 w-2 rounded-full bg-amber-500" /> 无法连接豆包服务，请检查网络后重试
      </p>
    );
  }
  return null;
}
```

When `apiKeyConfigured` true and draftKey empty, render an addition "更换" Button that does `setDraftKey(' ')` then immediately empty so input becomes focusable (or set focus). Simpler approach: keep input always editable when toggle on; placeholder shows masked value when configured.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/settings/VoiceSettingsPanel.test.tsx`
Expected: PASS 5 tests so far.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/settings/VoiceSettingsPanel.tsx src/renderer/src/settings/VoiceSettingsPanel.test.tsx
git commit -m "feat(renderer): add VoiceSettingsPanel save flow + verified status

Save mutation calls saveVoiceTranscriptionApiKey (which probes
synchronously). StatusPoint renders green/red/amber dot + localized
text from lastValidationCode/lastValidationOk/lastValidatedAt."
```

---

### Task 16: VoiceSettingsPanel — states 6-9 (disabled-with-key / validation-failed-401 / validation-failed-network / enabled-with-stale-key)

**Files:**

- Modify: `src/renderer/src/settings/VoiceSettingsPanel.tsx`
- Modify: `src/renderer/src/settings/VoiceSettingsPanel.test.tsx`

- [ ] **Step 1: Add failing tests for 4 remaining states**

```tsx
describe('VoiceSettingsPanel state validation-failed-401', () => {
  it('shows red status and 401 message', async () => {
    renderWithQuery({
      enabled: true,
      apiKeyConfigured: true,
      apiKeyLastFour: '1234',
      lastValidatedAt: '2026-05-16T13:00:00.000Z',
      lastValidationOk: false,
      lastValidationCode: 'auth',
    });
    expect(await screen.findByText(/X-Api-Key 无效/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});

describe('VoiceSettingsPanel state validation-failed-network', () => {
  it('shows amber status and network message', async () => {
    renderWithQuery({
      enabled: true,
      apiKeyConfigured: true,
      apiKeyLastFour: '1234',
      lastValidatedAt: '2026-05-16T13:00:00.000Z',
      lastValidationOk: null,
      lastValidationCode: 'network',
    });
    expect(await screen.findByText(/无法连接豆包服务/)).toBeInTheDocument();
  });
});

describe('VoiceSettingsPanel state disabled-with-key', () => {
  it('toggle off but configured shows masked input', async () => {
    renderWithQuery({
      enabled: false,
      apiKeyConfigured: true,
      apiKeyLastFour: '1234',
      lastValidatedAt: '2026-05-16T13:00:00.000Z',
      lastValidationOk: true,
      lastValidationCode: 'ok',
    });
    const input = await screen.findByLabelText('X-Api-Key');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', expect.stringContaining('●●●● 1234'));
  });
});

describe('VoiceSettingsPanel state enabled-with-stale-key', () => {
  it('shows stale validation hint when >24h', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    renderWithQuery({
      enabled: true,
      apiKeyConfigured: true,
      apiKeyLastFour: '1234',
      lastValidatedAt: eightDaysAgo,
      lastValidationOk: true,
      lastValidationCode: 'ok',
    });
    expect(await screen.findByText(/上次验证.+天前/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新验证' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Extend VoiceSettingsPanel for these 4 states**

Add logic:

```tsx
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const isStale = settings.lastValidatedAt
  ? Date.now() - new Date(settings.lastValidatedAt).getTime() > STALE_THRESHOLD_MS
  : false;
const isFailed =
  settings.lastValidationCode === 'auth' || settings.lastValidationCode === 'network';
const saveLabel = saveMutation.isPending ? '验证中...' : isFailed ? '重试' : '保存';

// Stale path renders <Button onClick={() => validateMutation.mutate()}>重新验证</Button>
const validateMutation = useMutation({
  mutationFn: async () => {
    const r = await window.reoWorkspace.validateVoiceTranscriptionCredentials({});
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  },
  onSuccess: () => invalidateVoiceSettings(qc),
});

// Stale-time hint: "上次验证 N 天前"
function staleLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  return `上次验证 ${days} 天前`;
}
```

When `settings.enabled && settings.apiKeyConfigured && isStale && !isFailed` render the stale message + 重新验证 button instead of green status point.

When `isFailed`, save button label becomes 重试; still calls `saveMutation` with current draft (or re-validate existing key if draft empty).

When `!settings.enabled && settings.apiKeyConfigured`, input disabled and placeholder shows masked key (already handled).

- [ ] **Step 3: Run all tests to verify pass**

Run: `npx vitest run src/renderer/src/settings/VoiceSettingsPanel.test.tsx`
Expected: PASS 9 tests so far.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/settings/VoiceSettingsPanel.tsx src/renderer/src/settings/VoiceSettingsPanel.test.tsx
git commit -m "feat(renderer): add VoiceSettingsPanel failure + stale states

validation-failed-401 (red + 重试), validation-failed-network (amber +
重试), disabled-with-key (input disabled + masked placeholder),
enabled-with-stale-key (>24h since validation, gray hint + 重新验证
button). validateVoiceTranscriptionCredentials mutation wired."
```

---

### Task 17: VoiceSettingsPanel — clear flow with AlertDialog

**Files:**

- Modify: `src/renderer/src/settings/VoiceSettingsPanel.tsx`
- Modify: `src/renderer/src/settings/VoiceSettingsPanel.test.tsx`

- [ ] **Step 1: Add failing test for clear flow**

```tsx
describe('VoiceSettingsPanel clear flow', () => {
  it('clicking 清除 opens AlertDialog, confirm calls clearVoiceTranscriptionApiKey', async () => {
    renderWithQuery({
      enabled: true,
      apiKeyConfigured: true,
      apiKeyLastFour: '1234',
      lastValidatedAt: '2026-05-16T13:00:00.000Z',
      lastValidationOk: true,
      lastValidationCode: 'ok',
    });
    window.reoWorkspace.clearVoiceTranscriptionApiKey = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        settings: {
          enabled: true,
          apiKeyConfigured: false,
          apiKeyLastFour: null,
          lastValidatedAt: null,
          lastValidationOk: null,
          lastValidationCode: null,
        },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: '清除' }));
    expect(screen.getByText('确认清除 X-Api-Key？此操作会停止流式语音识别。')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '清除' })); // confirm
    expect(window.reoWorkspace.clearVoiceTranscriptionApiKey).toHaveBeenCalledWith({});
  });
});
```

(If the workspace has a `WorkspaceDangerConfirmDialog` helper, prefer it; otherwise use shadcn `AlertDialog` directly.)

- [ ] **Step 2: Implement clear flow**

Add clear button + AlertDialog in `VoiceSettingsPanel.tsx`. Confirm calls `clearMutation.mutate()`. Cancel closes dialog. On success, dialog closes and snapshot refetches (invalidate).

- [ ] **Step 3: Run all tests**

Run: `npx vitest run src/renderer/src/settings/VoiceSettingsPanel.test.tsx`
Expected: PASS 10 tests total.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/settings/VoiceSettingsPanel.tsx src/renderer/src/settings/VoiceSettingsPanel.test.tsx
git commit -m "feat(renderer): add VoiceSettingsPanel clear flow with confirm dialog

Destructive 清除 button opens AlertDialog that mirrors
WorkspaceDangerConfirmDialog shape. Confirm invokes
clearVoiceTranscriptionApiKey IPC and invalidates ['settings','voice']."
```

---

## Phase 5: AppShell + integration

### Task 18: SidebarSettingsTrigger button

**Files:**

- Create: `src/renderer/src/workspace/SidebarSettingsTrigger.tsx`
- Create: `src/renderer/src/workspace/SidebarSettingsTrigger.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SidebarSettingsTrigger } from './SidebarSettingsTrigger';

describe('SidebarSettingsTrigger', () => {
  it('renders gear icon and label', () => {
    render(<SidebarSettingsTrigger onClick={vi.fn()} disabled={false} />);
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument();
  });

  it('calls onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<SidebarSettingsTrigger onClick={onClick} disabled={false} />);
    await userEvent.click(screen.getByRole('button', { name: '设置' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<SidebarSettingsTrigger onClick={onClick} disabled />);
    await userEvent.click(screen.getByRole('button', { name: '设置' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement trigger**

```tsx
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SidebarSettingsTriggerProps = {
  readonly onClick: () => void;
  readonly disabled: boolean;
};

export function SidebarSettingsTrigger({ onClick, disabled }: SidebarSettingsTriggerProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start gap-2"
      onClick={onClick}
      disabled={disabled}
      aria-label="设置"
    >
      <Settings className="h-4 w-4" />
      <span>设置</span>
    </Button>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/renderer/src/workspace/SidebarSettingsTrigger.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/workspace/SidebarSettingsTrigger.tsx src/renderer/src/workspace/SidebarSettingsTrigger.test.tsx
git commit -m "feat(renderer): add SidebarSettingsTrigger gear button

Ghost variant with Settings icon + label, sits next to the theme cycle
button. Disabled prop honors recording navigation gate."
```

---

### Task 19: AppShell appMode state + sidebar bottom layout

**Files:**

- Modify: `src/renderer/src/app-shell/AppShell.tsx`
- Modify: `src/renderer/src/app-shell/AppShell.test.tsx`

- [ ] **Step 1: Write failing test for appMode switch + recording gate**

In `src/renderer/src/app-shell/AppShell.test.tsx` add:

```tsx
describe('AppShell appMode', () => {
  it('clicking settings trigger switches mode to settings', async () => {
    const { rerender } = render(<AppShell {...baseProps} appMode="app" recordingActive={false} onAppModeChange={...} />);
    await userEvent.click(screen.getByRole('button', { name: '设置' }));
    rerender(<AppShell {...baseProps} appMode="settings" recordingActive={false} />);
    expect(screen.getByRole('button', { name: '返回应用' })).toBeInTheDocument();
  });

  it('clicking settings trigger during recording is blocked', async () => {
    const onAppModeChange = vi.fn();
    render(<AppShell {...baseProps} appMode="app" recordingActive={true} onAppModeChange={onAppModeChange} />);
    await userEvent.click(screen.getByRole('button', { name: '设置' }));
    expect(onAppModeChange).not.toHaveBeenCalled();
  });
});
```

(Match `baseProps` to the actual AppShell props convention; if AppShell is controlled by an external owner, this test may move up the tree. Adjust accordingly.)

- [ ] **Step 2: Lift appMode state to App.tsx**

In `src/renderer/src/App.tsx` (or wherever AppShell is rendered):

```tsx
const [appMode, setAppMode] = useState<'app' | 'settings'>('app');
const recordingActive = /* derive from existing recording overlay state */;

const tryOpenSettings = () => {
  if (recordingActive) {
    toast.error('请先完成或关闭录音');
    return;
  }
  setAppMode('settings');
};
```

Render conditionally:

```tsx
{appMode === 'settings' ? (
  <SettingsShell
    activeCategory="voice"
    onReturnToApp={() => setAppMode('app')}
    onSelectCategory={() => {}}
  >
    <VoiceSettingsPanel />
  </SettingsShell>
) : (
  <AppShell ... existing props />
)}
```

In `AppShell.tsx` sidebar bottom container, add `SidebarSettingsTrigger` next to the existing theme button (horizontal row, gap-2):

```tsx
<div className="mt-auto flex items-center justify-between gap-2 px-3 py-3">
  <SidebarSettingsTrigger onClick={tryOpenSettings} disabled={recordingActive} />
  <ThemeCycleButton ... />
</div>
```

Pass `tryOpenSettings` and `recordingActive` as new AppShell props.

- [ ] **Step 3: Run renderer tests**

Run: `npm run test:renderer`
Expected: PASS (including new AppShell tests; if existing baseProps shape mismatched, fix props or extract minimal fixtures).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/app-shell/AppShell.tsx src/renderer/src/app-shell/AppShell.test.tsx src/renderer/src/App.tsx
git commit -m "feat(renderer): add appMode and settings navigation gate

AppShell hosts SidebarSettingsTrigger next to theme button. App holds
appMode: 'app' | 'settings' and renders SettingsShell + VoiceSettingsPanel
when in settings. Recording-active blocks mode switch with root toast."
```

---

### Task 20: RecordingOverlay — skip start when toggle disabled

**Files:**

- Modify: `src/renderer/src/workspace/RecordingOverlay.tsx`
- Modify: `src/renderer/src/workspace/RecordingOverlay.test.tsx` (or related test)

- [ ] **Step 1: Write failing test**

Add to existing RecordingOverlay test:

```tsx
it('does not call startRecordingTranscription when voice settings disabled', async () => {
  // mock useVoiceTranscriptionSettings to return enabled=false
  // render RecordingOverlay
  // simulate start
  expect(window.reoWorkspace.startRecordingTranscription).not.toHaveBeenCalled();
});
```

(The exact mock surface depends on the RecordingOverlay test fixtures.)

- [ ] **Step 2: Read settings in RecordingOverlay**

Import and use:

```tsx
import { useQuery } from '@tanstack/react-query';
import { voiceSettingsQueryOptions } from '@/settings/voiceSettingsQueries';

const { data: voiceSettings } = useQuery(voiceSettingsQueryOptions());
const transcriptionEnabled = voiceSettings?.enabled === true;
```

At every existing `startRecordingTranscription` IPC call site, gate with `transcriptionEnabled`:

```tsx
if (transcriptionEnabled) {
  await window.reoWorkspace.startRecordingTranscription({ ... });
}
```

For transcript UI: when `!transcriptionEnabled`, render simple placeholder instead of transcript container.

- [ ] **Step 3: Run renderer tests**

Run: `npm run test:renderer`
Expected: PASS including new gated-start assertion.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/workspace/RecordingOverlay.tsx src/renderer/src/workspace/RecordingOverlay.test.tsx
git commit -m "feat(renderer): gate startRecordingTranscription on voice toggle

RecordingOverlay reads ['settings','voice']; if enabled=false the start
IPC is never invoked and the transcript container shows a quiet
placeholder. Live ASR errors are impossible when toggle is off."
```

---

## Phase 6: Docs + verification

### Task 21: Update docs/current/electron.md

**Files:**

- Modify: `docs/current/electron.md`

- [ ] **Step 1: Edit electron.md**

- Replace the section about `REO_DOUBAO_ASR_APP_ID / REO_DOUBAO_ASR_ACCESS_TOKEN` (currently at line 20) with:

```
- 当前豆包流式语音识别凭证使用 Electron safeStorage 加密存放在 `userData/voice-transcription-settings.json`，由 main process `voiceSettingsStore` 持有；renderer/preload 只通过 application-scoped voice settings IPC 获得不含密文的 snapshot（enabled / apiKeyConfigured / apiKeyLastFour / lastValidatedAt / lastValidationOk / lastValidationCode），无 workspaceHandle 参与，不进入 renderer / IPC payload / 日志 / 错误信封 / 内容文件。
```

- Replace the line near 115 about `X-Api-Connect-Id` and dual headers with single-header description:

```
- 豆包流式语音识别在 main 侧运行 live session：使用单 `X-Api-Key` header 加上 `X-Api-Connect-Id` 与 `X-Api-Resource-Id`...（保留其余协议描述）
```

- Replace line 119 from `当前不使用 shell.openExternal` to:

```
- 当前 `shell.openExternal` 只在 settings 场景下用于打开 volcengine.com host allowlist 内的链接（由 `workspace:openExternalUrl` 校验后转发），不暴露通用外链能力。
```

- Append 6 new channel descriptions to the existing IPC channels list (paragraph that enumerates Memory Space channels et al.). Each in one line, e.g.：

```
- `workspace:readVoiceTranscriptionSettings` request 不接受 payload；response 返回 `settings: { enabled, apiKeyConfigured, apiKeyLastFour, lastValidatedAt, lastValidationOk, lastValidationCode }`，不返回 X-Api-Key 明文或密文。
- `workspace:setVoiceTranscriptionEnabled` request 接受 `{ enabled }`；response 与 read 同。
- `workspace:saveVoiceTranscriptionApiKey` request 接受 `{ apiKey }`；main 先 safeStorage 加密写入再立即跑 probe，response 携带最新 snapshot，不返回额外 validation 字段。
- `workspace:clearVoiceTranscriptionApiKey` request 不接受 payload；response 与 read 同；ciphertext、apiKeyLastFour 与 validation 字段一并清空。
- `workspace:validateVoiceTranscriptionCredentials` request 不接受 payload；response `{ code: 'ok' \| 'auth' \| 'network', message? }`；同步更新 store lastValidation 字段。
- `workspace:openExternalUrl` request 接受 `{ url }`；main 校验 host ∈ volcengine.com allowlist 后调用 `shell.openExternal`，否则返回 `ERR_OPEN_EXTERNAL_URL_REJECTED`。
```

- Update the IPC overall description to add `voice transcription settings read/setEnabled/save/clear/validate, open external URL`.

- [ ] **Step 2: Commit**

```bash
git add docs/current/electron.md
git commit -m "docs(current): update electron for voice settings + protocol migration

Replace REO_DOUBAO_ASR_APP_ID/ACCESS_TOKEN env var description with
safeStorage-backed voiceSettingsStore. Update ASR header description to
single X-Api-Key. Add six new IPC channels. Allow shell.openExternal
in the settings deep-link path with host allowlist."
```

---

### Task 22: Update docs/current/frontend.md

**Files:**

- Modify: `docs/current/frontend.md`

- [ ] **Step 1: Edit frontend.md**

- Line 14: append `齿轮 + 「设置」按钮` to the sidebar bottom button description.
- Line 16: add `components/ui/switch.tsx` to the shadcn/ui source range list.
- Line 122 navigation gate list: add `切换到 settings 模式` between existing items.
- Add a new section after "App Shell" titled `## Settings Shell`:

```
- 当前 App 顶层 state 包含 `appMode: 'app' \| 'settings'`；默认 `'app'`，由 Sidebar 左下齿轮按钮切换。
- Settings 模式下整个内容区由 `SettingsShell` 接管：左 nav rail 顶部 `← 返回应用`，下方分类目（本次只有「语音」），右侧 content panel 渲染当前 category panel；不引入第二 BrowserWindow。
- 「语音」panel 由 `VoiceSettingsPanel` 实现，9 状态机由 toggle/enabled + apiKeyConfigured + lastValidationCode + lastValidatedAt 派生；保存调用 `saveVoiceTranscriptionApiKey` IPC（main 同步 probe），清除走 AlertDialog 二次确认。
- 进入 settings 模式不释放当前 workspace handle、不清 Memory detail cache；返回应用恢复 stage 选择状态。
- 录音 overlay open 时 SidebarSettingsTrigger disabled，并通过 root toast 阻止进入 settings；这是 navigation gate 的扩展项。
```

- [ ] **Step 2: Commit**

```bash
git add docs/current/frontend.md
git commit -m "docs(current): add Settings Shell section + voice settings sidebar bits"
```

---

### Task 23: Update docs/current/data.md

**Files:**

- Modify: `docs/current/data.md`

- [ ] **Step 1: Edit data.md**

- TanStack Query key list section (around line 12-16): add `['settings', 'voice']`.
- 状态归属 section: add bullet `Voice transcription settings 属于 main-owned safeStorage + userData JSON store，application-scoped，不绑定单个 workspace`.
- 加一段：

```
- Voice transcription settings 由 main process `voiceSettingsStore` 持有，文件 `userData/voice-transcription-settings.json` 经 `safeStorage` 加密 X-Api-Key 字段；renderer 通过 TanStack Query `['settings', 'voice']` 读取不含密文的 snapshot。Snapshot 字段为 `enabled / apiKeyConfigured / apiKeyLastFour / lastValidatedAt / lastValidationOk / lastValidationCode`。`setEnabled` / `saveApiKey` / `clear` 成功后 seed exact key，`validate` 成功后 invalidate exact key；该 query 不绑定 workspaceHandle，不在 workspace session 切换时清理。
- Recording transcription session 在 start 时通过 `resolveVoiceSettings()` 拍下当前 voice settings 快照，并把 `transcriptionMode: 'live' \| 'disabled'` 写入 `WorkspaceRecordingTranscriptionControlResponse.value`。Live session 一旦 start 完成就不响应中途的 voice settings 变更。
```

- [ ] **Step 2: Commit**

```bash
git add docs/current/data.md
git commit -m "docs(current): add voice transcription settings ownership + query key"
```

---

### Task 24: Final verify + dev runtime evidence + verification.md + artifacts/

**Files:**

- Create: `docs/specs/2026-05-16-0605-doubao-voice-byok-settings/verification.md`
- Create: `docs/specs/2026-05-16-0605-doubao-voice-byok-settings/tasks.md`
- Create: `docs/specs/2026-05-16-0605-doubao-voice-byok-settings/artifacts/` (with screenshots and verify-quick.txt)

- [ ] **Step 1: Run verify:quick**

Run: `npm run verify:quick 2>&1 | tee docs/specs/2026-05-16-0605-doubao-voice-byok-settings/artifacts/verify-quick.txt`
Expected: All green (typecheck, lint, format:check, test:main, test:renderer).

- [ ] **Step 2: grep verifications**

Run:

```bash
grep -rn 'REO_DOUBAO_ASR_APP_ID\|REO_DOUBAO_ASR_ACCESS_TOKEN' src/ ; echo "EXIT=$?"
grep -rn 'X-Api-App-Key\|X-Api-Access-Key' src/ ; echo "EXIT=$?"
```

Expected: 0 matches each; capture into `artifacts/grep-evidence.txt`.

- [ ] **Step 3: Dev manual verification — 9 states + 3 recording lines**

Start dev: `npm run dev`. Manually walk through:

1. disabled-no-key (initial install — clear `userData/voice-transcription-settings.json` first)
2. Open toggle → enabled-no-key (red hint)
3. Type key → editing-with-key (save enabled)
4. Click save → validating (spinner)
5. Probe success → verified-active (green dot)
6. Close toggle → disabled-with-key (masked)
7. Re-open + bad key → validation-failed-401 (red)
8. Re-open + network down → validation-failed-network (amber)
9. Wait/inject stale timestamp → enabled-with-stale-key
10. Clear → confirm → back to disabled-no-key

Then recording lines:

- enabled + good key + record → transcript appears
- enabled + bad key + record → toast "X-Api-Key 无效..."
- disabled + record → no ASR call, no error, file saved

Capture screenshots into `artifacts/state-{N}.png` and `artifacts/recording-{a,b,c}.png`.

- [ ] **Step 4: Write verification.md**

Create `verification.md`：

```markdown
# 豆包流式语音识别 BYOK 设置 — 验证

## 命令验证

- [x] `npm run verify:quick`: PASS, see `artifacts/verify-quick.txt`
- [x] grep REO_DOUBAO_ASR_APP_ID / ACCESS_TOKEN: 0 matches in src/
- [x] grep X-Api-App-Key / X-Api-Access-Key: 0 matches in src/

## 9 状态视觉证据

- [x] disabled-no-key: `artifacts/state-1.png`
- [x] enabled-no-key: `artifacts/state-2.png`
- [x] editing-with-key: `artifacts/state-3.png`
- [x] validating: `artifacts/state-4.png`
- [x] verified-active: `artifacts/state-5.png`
- [x] disabled-with-key: `artifacts/state-6.png`
- [x] validation-failed-401: `artifacts/state-7.png`
- [x] validation-failed-network: `artifacts/state-8.png`
- [x] enabled-with-stale-key: `artifacts/state-9.png`

## 录音主线证据

- [x] enabled + good key: transcript live, `artifacts/recording-a.png`
- [x] enabled + bad key: toast, `artifacts/recording-b.png`
- [x] disabled: no ASR, no error, `artifacts/recording-c.png`
```

- [ ] **Step 5: Write tasks.md**

Create `tasks.md` mirroring the supplement-transcript-panel format — list each Task in this plan with status `done`.

- [ ] **Step 6: Commit verification**

```bash
git add docs/specs/2026-05-16-0605-doubao-voice-byok-settings/verification.md \
        docs/specs/2026-05-16-0605-doubao-voice-byok-settings/tasks.md \
        docs/specs/2026-05-16-0605-doubao-voice-byok-settings/artifacts/
git commit -m "docs(spec): record doubao voice BYOK settings verification

verify:quick green, zero matches for legacy env vars and dual-header
auth in src/. Nine UI states + three recording scenarios captured into
artifacts/."
```

---

## Self-Review Checklist (before declaring plan complete)

After plan execution, the following must all be true:

- [ ] `npm run verify:quick` passes
- [ ] `grep -rn 'REO_DOUBAO_ASR_APP_ID\|REO_DOUBAO_ASR_ACCESS_TOKEN\|X-Api-App-Key\|X-Api-Access-Key' src/` returns no matches
- [ ] All 9 UI states have screenshot evidence in `artifacts/`
- [ ] All 3 recording scenarios (enabled+good, enabled+bad, disabled) verified in dev
- [ ] `docs/current/electron.md` / `frontend.md` / `data.md` reflect new reality (no env var, single header, settings shell, voice query key)
- [ ] `docs/specs/2026-05-16-0605-doubao-voice-byok-settings/verification.md` filled
- [ ] Spec ready to be archived to `docs/archive/specs/` (after closure, follow CLAUDE.md archival rules — that closure step happens after this plan's last task, in a separate close-out session)

---

## Out-of-Scope (Follow-ups — DO NOT START IN THIS PLAN)

The spec end lists B / C / D / E. Each must independently re-run brainstorm → spec → plan → implement → verify after this plan closes. Do not pre-build hooks for them in this plan.

---

## Review Notes

This section is authoritative over earlier illustrative code blocks. Phase 2 review found more than three critical executable/security mismatches, so the plan was revised and mini-reviewed before implementation.

### Official Protocol Evidence

- Volcengine official "大模型流式语音识别API" docs: `https://www.volcengine.com/docs/6561/1354869?lang=zh`
- Volcengine official "大模型流式语音识别API文档（优化版）" docs: `https://www.volcengine.com/docs/6561/1631584?lang=zh`
- User-provided official demo: `/Users/yck/Downloads/PM/技术线/reo文件区/sauc_python/sauc_websocket_demo.py`

### Findings And Handling

1. Critical — plan used `npx tsx --test ...`, but `package.json` has no `tsx` and main tests are compiled by `scripts/run-main-tests.mjs`.
   Handling: plan revised to run `npm run test:main` for main-process TDD gates. Per-file main subsets are not required in this repo until the runner supports them.

2. Critical — `components/ui/field.tsx` exports `FieldGroup / FieldControl / FieldHint / FieldLabel / FieldError`, not `Field` or `FieldDescription`.
   Handling: plan revised to use current exports. Do not add compatibility aliases.

3. Critical — renderer import path `@/../../../workspace-contract/workspace-contract` is invalid.
   Handling: plan revised to use `../../../workspace-contract/workspace-contract` or the existing `src/renderer/src/workspace/workspaceApi.ts` facade. Do not add a new alias just for this feature.

4. Critical — `workspaceIpc.ts` has no `requireTrustedSender` helper and existing handlers use `validateWorkspaceSender` / `validateTrustedWorkspaceSender` with `channel`, `expectedSession`, `expectedSessionKey`, and `isTrustedUrl`.
   Handling: plan revised. New handlers must be registered through the existing `registerWorkspaceIpcHandler` path and use existing sender-validation helpers plus strict `safeParse`; no generic invoke bridge.

5. Critical — `shell.openExternal` allowlist based on `URL.host` is unsafe because ports, case, credentials, and suffix tricks can bypass intended host logic.
   Handling: plan revised to parse with `new URL()`, require `https:`, reject username/password and explicit ports, compare `url.hostname.toLowerCase()`, allow only `volcengine.com` and `.volcengine.com` subdomains, then call existing `requireElectronShellApi().shell.openExternal(url.toString())`.

6. Critical — Electron 41 local types expose sync `safeStorage.encryptString/decryptString/isEncryptionAvailable` and Linux `getSelectedStorageBackend()`, not async safeStorage APIs.
   Handling: implementation must use installed sync API. On Linux, `safeStorage.getSelectedStorageBackend() === 'basic_text'` or `'unknown'` is storage-unavailable, not a plaintext fallback. Do not call `setUsePlainTextEncryption` and do not downgrade to plaintext.

7. Critical — `voiceSettingsStore` illustrative sync `writeFileSync` + `renameSync` omits the repo's durability pattern.
   Handling: implement app-state writes using the existing `writeWorkspaceJsonAtomic` helper or an equivalent fsync-backed atomic writer. Because Reo is unpublished, do the direct replacement; do not preserve a second old store format.

8. Critical — plan classified auth failure through WebSocket `close(401/403)`, but HTTP 401/403 handshake failures surface through `ws` `unexpected-response` rather than valid close codes.
   Handling: probe socket abstraction must cover `open`, `error`, `close`, and `unexpected-response`. Classify HTTP 401/403 as `auth`; timeout, DNS/TLS, 5xx, and non-auth close as `network`.

9. Critical — `workspace-channels.ts` plan only said "append constants"; current sender validation allowlist uses `WORKSPACE_IPC_CHANNELS`.
   Handling: each new channel constant must also be appended to `WORKSPACE_IPC_CHANNELS`, and existing contract/bridge surface tests must be updated.

10. Critical — `reo-workspace-bridge.ts` currently imports concrete request/response types from `workspace-contract.ts`; it does not use `z.input/z.infer`.
    Handling: follow the current concrete type import pattern. Do not introduce a one-off Zod type style in this file.

11. Critical — API key length was inconsistent: spec says max 1KB, plan used 512 and allowed length 1 even though `apiKeyLastFour` is length 4.
    Handling: request schema and UI `maxLength` revised to 1024; minimum is 4. IME/composition must trim only on submit, not while composing.

12. Critical — `recordValidation({ ok: result.code === 'ok' })` would mark network failures as negative credential validation.
    Handling: persist `lastValidationOk = true` for `ok`, `false` for `auth`, and `null` for `network`.

13. Important — official docs and current code both support `DOUBAO_STREAMING_ASR_ENDPOINT = wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async` with `DOUBAO_STREAMING_ASR_RESOURCE_ID = volc.seedasr.sauc.duration` for the optimized streaming API. The local official demo is an older dual-header sample using `volc.bigasr.sauc.duration`.
    Handling: README revised. Do not change endpoint or resource id in A. Follow-up E remains a later cost/stability/semantics validation, not a reason to undo A.

14. Important — the user provided a test X-Api-Key for runtime validation.
    Handling: use it only during manual probe/recording verification. Never commit it, print it, put it in screenshots, or place it in logs/docs.

15. Important — because Reo is unpublished, all implementation should be direct cutover.
    Handling: remove old env-var reads, old dual-header auth, old type shapes, and related tests outright. Do not add compatibility shims, aliases, migration wrappers, or fallback env paths.

16. Important — `window.reoWorkspace` is already typed as readonly in `src/renderer/src/types/reoWorkspace.d.ts`.
    Handling: renderer tests should use `Object.defineProperty(window, 'reoWorkspace', { configurable: true, value })`; do not redeclare `Window` with `any`.

17. Important — `AppShell` should not own application routing state.
    Handling: `src/renderer/src/App.tsx` owns `appMode`; `AppShell` exposes the settings trigger and renders whichever main content App passes. Entering settings must preserve workspace handle/session.

18. Important — the plan's disabled recording surface must stay inside A.
    Handling: implement only the A behavior: disabled toggle skips ASR start and does not show an error. Do not build B/C/D/E recovery queues, More menu, or auto backfill hooks.

### Mini-Review Result

- CLAUDE hard constraints: PASS after amendments. No renderer Node/Electron API, no generic invoke, sender validation remains narrow, no compatibility fallback.
- Current source fit: PASS after amendments. Paths, field exports, workspace bridge style, channel allowlist, main test runner, and App/AppShell ownership are now aligned with current repo.
- Official protocol fit: PASS for A. Keep `bigmodel_async`, `volc.seedasr.sauc.duration`, and single `X-Api-Key`; treat the supplied Python demo as older dual-header reference only.
- Executability: PASS with caveat that illustrative snippets remain guidance. Workers must inspect current files before coding and follow this Review Notes section when snippets conflict.

### Post-Implementation Review / ycksimplify Amendments

- `voiceSettingsStore` writes are serialized through a per-store queue so concurrent `setEnabled` / `writeApiKey` / `recordValidation` mutations derive next state from the latest cache.
- Startup settings load is bounded to 64 KiB and uses no-follow file open before parsing userData JSON.
- `workspace:saveVoiceTranscriptionApiKey` persists the trimmed key and probes the same trimmed value.
- Probe failure and validation-state persistence failure are separated; validation persistence failure returns `ERR_VOICE_SETTINGS_WRITE_FAILED` without retrying or leaking key material.
- Settings response value no longer carries `validationError`; renderer derives visible auth/network state from the persisted snapshot fields.
- The BYOK probe now sends the Doubao full request frame after WebSocket open and returns ok only after a service response frame.
- Settings mutations seed returned snapshots for `setEnabled` / `saveApiKey` / `clear`; `validate` still invalidates and rereads.
- Saved key drafts are cleared after any successful save, including auth/network validation outcomes; the eye control only reveals the current unsaved draft.
- Recording finish/close now closes existing ASR sessions even if settings change to disabled mid-session, and a main-side disabled start suppresses final backfill ASR.
- Settings shell shares AppShell geometry constants, keeps the full-width drag titlebar, locks return/Escape while settings mutations are pending, and removes the unused multi-category abstraction for Slice A.
- Real-key verification artifacts must redact key fragments; only result code and non-secret protocol metadata may be recorded.
