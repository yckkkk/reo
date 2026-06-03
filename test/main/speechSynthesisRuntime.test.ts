import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkspaceMemoryDetailProjection } from '../../src/workspace-contract/workspace-contract.js';
import { createWorkspaceSpeechSynthesisRuntime } from '../../src/main/speechSynthesisRuntime.js';

const usable = () => ({ ok: true as const });

const voiceSettingsStore = {
  read: () => ({
    enabled: true,
    apiKeyConfigured: true,
    apiKeyLastFour: 'key1',
    speechSynthesisSpeaker: 'zh_female_vv_uranus_bigtts' as const,
    lastTranscriptionValidatedAt: null,
    lastTranscriptionValidationOk: null,
    lastTranscriptionValidationCode: null,
    lastSpeechSynthesisValidatedAt: '2026-06-02T13:00:00.000Z',
    lastSpeechSynthesisValidationOk: true,
    lastSpeechSynthesisValidationCode: 'ok' as const,
  }),
  readDecryptedApiKey: () => 'api-key-1',
};

const missingSpeechSynthesis = {
  status: 'missing' as const,
  audioByteLength: null,
  contentHash: null,
  format: null,
  lastSynthesisAttempt: 'never' as const,
  mimeType: null,
  model: null,
  reason: null,
  resourceId: null,
  sampleRate: null,
  speaker: null,
  updatedAt: null,
};

const readySpeechSynthesis = {
  ...missingSpeechSynthesis,
  status: 'ready' as const,
  audioByteLength: 3,
  contentHash: 'a'.repeat(64),
  format: 'mp3' as const,
  lastSynthesisAttempt: 'success' as const,
  mimeType: 'audio/mpeg' as const,
  model: 'seed-tts-2.0-expressive' as const,
  resourceId: 'seed-tts-2.0' as const,
  sampleRate: 24000 as const,
  speaker: 'zh_female_vv_uranus_bigtts' as const,
  updatedAt: '2026-06-02T13:10:00.000Z',
};

const failedSpeechSynthesis = {
  ...missingSpeechSynthesis,
  status: 'failed' as const,
  contentHash: 'b'.repeat(64),
  lastSynthesisAttempt: 'failed' as const,
  updatedAt: '2026-06-02T13:12:00.000Z',
};

function noteMemoryDetail(): WorkspaceMemoryDetailProjection {
  return {
    audioByteLength: 0,
    createdAt: '2026-06-02T13:00:00.000Z',
    audioDurationMs: 0,
    hasAudioTranscript: false,
    memoryId: 'mem_1',
    segmentCount: 1,
    audioSegmentCount: 0,
    noteSegmentCount: 1,
    hasAnyNote: true,
    segments: [
      {
        bodyByteLength: 14,
        createdAt: '2026-06-02T13:01:00.000Z',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementCount: 1,
        supplements: [
          {
            bodyByteLength: 16,
            createdAt: '2026-06-02T13:02:00.000Z',
            memoryId: 'mem_1',
            segmentId: 'seg_1',
            supplementId: 'sup_1',
            title: 'Supplement note',
            type: 'note',
            updatedAt: '2026-06-02T13:02:00.000Z',
            workspaceId: 'ws_1',
          },
        ],
        title: 'Segment note',
        type: 'note',
        updatedAt: '2026-06-02T13:01:00.000Z',
        workspaceId: 'ws_1',
      },
    ],
    supplementCount: 1,
    title: 'Memory',
    updatedAt: '2026-06-02T13:02:00.000Z',
    workspaceId: 'ws_1',
  };
}

async function waitForCount(values: readonly unknown[], count: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (values.length >= count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(values.length, count);
}

async function waitForSetSize(values: ReadonlySet<unknown>, count: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (values.size >= count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(values.size, count);
}

test('speech synthesis runtime manually synthesizes segment notes and saves MP3 metadata', async () => {
  const saved: unknown[] = [];
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readSegmentSource: async () => ({
      bodyMarkdown: '[标题](https://example.com)\n\n正文 **加粗**',
      contentHash: 'a'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    saveSegmentSpeech: async (input) => {
      saved.push(input);
      return {
        ok: true,
        speechSynthesis: {
          ...missingSpeechSynthesis,
          status: 'ready',
          audioByteLength: 2,
          contentHash: 'a'.repeat(64),
          format: 'mp3',
          lastSynthesisAttempt: 'success',
          mimeType: 'audio/mpeg',
          model: 'seed-tts-2.0-expressive',
          resourceId: 'seed-tts-2.0',
          sampleRate: 24000,
          speaker: 'zh_female_vv_uranus_bigtts',
          updatedAt: '2026-06-02T13:10:00.000Z',
        },
      };
    },
    synthesize: async (input) => {
      assert.equal(input.apiKey, 'api-key-1');
      assert.equal(input.speaker, 'zh_female_vv_uranus_bigtts');
      assert.equal(input.text, '标题 正文 加粗');
      return {
        audio: new Uint8Array([1, 2]),
        audioByteLength: 2,
        ok: true,
        requestId: 'tts-1',
      };
    },
    voiceSettingsStore,
  });

  const response = await runtime.requestSegmentSpeechSynthesis({
    assertWorkspaceUsable: usable,
    memoryId: 'mem_1',
    mode: 'regenerate',
    rootPath: '/workspace',
    segmentId: 'seg_1',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.equal(response.ok, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0] && typeof saved[0] === 'object' && 'expectedContentHash' in saved[0], true);
});

test('speech synthesis runtime allows manual speech when configured key has not run TTS validation yet', async () => {
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readSegmentSource: async () => ({
      bodyMarkdown: '旧密钥语音生成',
      contentHash: 'a'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    saveSegmentSpeech: async () => ({ ok: true, speechSynthesis: readySpeechSynthesis }),
    synthesize: async () => ({
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      ok: true,
      requestId: 'tts-unvalidated-key',
    }),
    voiceSettingsStore: {
      ...voiceSettingsStore,
      read: () => ({
        ...voiceSettingsStore.read(),
        lastSpeechSynthesisValidatedAt: null,
        lastSpeechSynthesisValidationCode: null,
        lastSpeechSynthesisValidationOk: null,
      }),
    },
  });

  const response = await runtime.requestSegmentSpeechSynthesis({
    assertWorkspaceUsable: usable,
    memoryId: 'mem_1',
    mode: 'regenerate',
    rootPath: '/workspace',
    segmentId: 'seg_1',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.equal(response.ok, true);
});

test('speech synthesis runtime still blocks manual speech after an auth validation failure', async () => {
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readSegmentSource: async () => {
      throw new Error('auth-blocked speech should not read note content');
    },
    voiceSettingsStore: {
      ...voiceSettingsStore,
      read: () => ({
        ...voiceSettingsStore.read(),
        lastSpeechSynthesisValidatedAt: '2026-06-02T13:00:00.000Z',
        lastSpeechSynthesisValidationCode: 'auth' as const,
        lastSpeechSynthesisValidationOk: false,
      }),
    },
  });

  const response = await runtime.requestSegmentSpeechSynthesis({
    assertWorkspaceUsable: usable,
    memoryId: 'mem_1',
    mode: 'regenerate',
    rootPath: '/workspace',
    segmentId: 'seg_1',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_SPEECH_SYNTHESIS_AUTH_FAILED');
  }
});

test('speech synthesis runtime lets manual note speech use a per-request speaker override', async () => {
  const savedSpeakers: string[] = [];
  const synthesizedSpeakers: string[] = [];
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readSegmentSource: async () => ({
      bodyMarkdown: 'Manual speaker override',
      contentHash: 'a'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    saveSegmentSpeech: async (input) => {
      savedSpeakers.push(input.speaker);
      return { ok: true, speechSynthesis: readySpeechSynthesis };
    },
    synthesize: async (input) => {
      synthesizedSpeakers.push(input.speaker);
      return {
        audio: new Uint8Array([1, 2]),
        audioByteLength: 2,
        ok: true,
        requestId: 'tts-speaker-override',
      };
    },
    voiceSettingsStore,
  });

  const response = await runtime.requestSegmentSpeechSynthesis({
    assertWorkspaceUsable: usable,
    memoryId: 'mem_1',
    mode: 'regenerate',
    rootPath: '/workspace',
    segmentId: 'seg_1',
    speaker: 'zh_male_m191_uranus_bigtts',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.equal(response.ok, true);
  assert.deepEqual(synthesizedSpeakers, ['zh_male_m191_uranus_bigtts']);
  assert.deepEqual(savedSpeakers, ['zh_male_m191_uranus_bigtts']);
});

test('speech synthesis runtime strips Markdown markers before sending text to TTS', async () => {
  let synthesizedText = '';
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readSegmentSource: async () => ({
      bodyMarkdown: [
        '# 语音验证',
        '',
        '==今日问题：产品经理必读的《启示录》==',
        '++<mark data-color="var(--tt-color-highlight-red)" style="background-color: var(--tt-color-highlight-red); color: inherit">E2E sidecar rich mark 1779846666899</mark>++',
        '',
        '- [x] **核心原则**：[链接标题](https://example.com/doc.png)',
        '- [ ] ~~风险验证~~ 与 `代码片段`',
        '',
        '![截图](attachments/screenshot.png)',
        '',
        '| 维度 | 结论 |',
        '| --- | --- |',
        '| 需求 | 成立 |',
        '',
        '```md',
        '不要读代码 fence 符号',
        '```',
        '',
        'https://example.com/raw-url',
      ].join('\n'),
      contentHash: 'a'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    saveSegmentSpeech: async () => ({ ok: true, speechSynthesis: readySpeechSynthesis }),
    synthesize: async (input) => {
      synthesizedText = input.text;
      return {
        audio: new Uint8Array([1, 2]),
        audioByteLength: 2,
        ok: true,
        requestId: 'tts-clean-markdown',
      };
    },
    voiceSettingsStore,
  });

  const response = await runtime.requestSegmentSpeechSynthesis({
    assertWorkspaceUsable: usable,
    memoryId: 'mem_1',
    mode: 'regenerate',
    rootPath: '/workspace',
    segmentId: 'seg_1',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.equal(response.ok, true);
  assert.match(synthesizedText, /今日问题/);
  assert.match(synthesizedText, /E2E sidecar rich mark 1779846666899/);
  assert.match(synthesizedText, /核心原则/);
  assert.match(synthesizedText, /代码片段/);
  assert.match(synthesizedText, /不要读代码 fence 符号/);
  assert.doesNotMatch(synthesizedText, /\+\+|==|\[[ xX]\]|\*\*|~~|```|\|/);
  assert.doesNotMatch(
    synthesizedText,
    /https?:\/\/|attachments\/|screenshot\.png|doc\.png|<mark|data-color|background-color/
  );
});

test('speech synthesis runtime splits long note text into multiple TTS requests', async () => {
  const synthesizedTexts: string[] = [];
  const saved: unknown[] = [];
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readSegmentSource: async () => ({
      bodyMarkdown: `${'第一段。'.repeat(160)} ${'second paragraph '.repeat(80)}`,
      contentHash: 'a'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    saveSegmentSpeech: async (input) => {
      saved.push(input);
      return { ok: true, speechSynthesis: readySpeechSynthesis };
    },
    synthesize: async (input) => {
      synthesizedTexts.push(input.text);
      return {
        audio: new Uint8Array([synthesizedTexts.length]),
        audioByteLength: 1,
        ok: true,
        requestId: `tts-long-${synthesizedTexts.length}`,
      };
    },
    voiceSettingsStore,
  });

  const response = await runtime.requestSegmentSpeechSynthesis({
    assertWorkspaceUsable: usable,
    memoryId: 'mem_1',
    mode: 'fill-missing',
    rootPath: '/workspace',
    segmentId: 'seg_1',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.equal(response.ok, true);
  assert.ok(synthesizedTexts.length > 1);
  assert.equal(
    synthesizedTexts.every((text) => text.length <= 900),
    true
  );
  assert.equal(saved.length, 1);
  assert.deepEqual(
    saved[0] && typeof saved[0] === 'object' && 'audio' in saved[0] ? saved[0].audio : null,
    new Uint8Array(synthesizedTexts.map((_, index) => index + 1))
  );
});

test('speech synthesis runtime rejects oversized note text before provider calls', async () => {
  const marked: unknown[] = [];
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readSegmentSource: async () => ({
      bodyMarkdown: '超长正文'.repeat(5_000),
      contentHash: 'a'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    saveSegmentSpeech: async () => {
      throw new Error('oversized speech should not be saved');
    },
    markSegmentSpeechFailed: async (input) => {
      marked.push(input);
      return {
        ok: true,
        speechSynthesis: {
          ...failedSpeechSynthesis,
          reason: 'text-too-long' as const,
          status: 'unsupported' as const,
        },
      };
    },
    synthesize: async () => {
      throw new Error('oversized speech should not call provider');
    },
    voiceSettingsStore,
  });

  const response = await runtime.requestSegmentSpeechSynthesis({
    assertWorkspaceUsable: usable,
    memoryId: 'mem_1',
    mode: 'regenerate',
    rootPath: '/workspace',
    segmentId: 'seg_1',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.error.code, 'ERR_SPEECH_SYNTHESIS_TEXT_TOO_LONG');
  }
  assert.deepEqual(marked, [
    {
      assertWorkspaceUsable: usable,
      expectedContentHash: 'a'.repeat(64),
      kind: 'segment',
      memoryId: 'mem_1',
      mode: 'regenerate',
      reason: 'text-too-long',
      rootPath: '/workspace',
      segmentId: 'seg_1',
      source: 'manual',
      speaker: 'zh_female_vv_uranus_bigtts',
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
    },
  ]);
});

test('speech synthesis runtime marks automatic oversized note speech as unsupported', async () => {
  const marked: unknown[] = [];
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readWorkspaceSnapshot: async () => ({
      ok: true,
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Workspace',
        description: '',
        memories: [
          {
            audioByteLength: 0,
            createdAt: '2026-06-02T13:00:00.000Z',
            audioDurationMs: 0,
            hasAudioTranscript: false,
            hasAnyNote: true,
            memoryId: 'mem_1',
            segmentCount: 1,
            audioSegmentCount: 0,
            noteSegmentCount: 1,
            supplementCount: 0,
            title: 'Memory',
            updatedAt: '2026-06-02T13:00:00.000Z',
          },
        ],
      },
    }),
    readMemoryDetail: async () => {
      const detail = noteMemoryDetail();
      return {
        ok: true,
        value: {
          ...detail,
          supplementCount: 0,
          segments: detail.segments.map((segment) => ({ ...segment, supplements: [] })),
        },
      };
    },
    readSegmentSource: async () => ({
      bodyMarkdown: '超长正文'.repeat(5_000),
      contentHash: 'c'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    markSegmentSpeechFailed: async (input) => {
      marked.push(input);
      return {
        ok: true,
        speechSynthesis: {
          ...failedSpeechSynthesis,
          reason: 'text-too-long' as const,
          status: 'unsupported' as const,
        },
      };
    },
    saveSegmentSpeech: async () => {
      throw new Error('oversized automatic speech should not be saved');
    },
    synthesize: async () => {
      throw new Error('oversized automatic speech should not call provider');
    },
    voiceSettingsStore,
  });

  const result = await runtime.enqueueAutomaticWorkspace({
    assertWorkspaceUsable: usable,
    rootPath: '/workspace',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.equal(result.accepted, 1);
  await waitForCount(marked, 1);
  assert.deepEqual(marked[0], {
    assertWorkspaceUsable: usable,
    expectedContentHash: 'c'.repeat(64),
    kind: 'segment',
    memoryId: 'mem_1',
    mode: 'fill-missing',
    reason: 'text-too-long',
    rootPath: '/workspace',
    segmentId: 'seg_1',
    source: 'auto',
    speaker: 'zh_female_vv_uranus_bigtts',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });
});

test('speech synthesis runtime marks automatic provider failures as failed targets', async () => {
  const marked: unknown[] = [];
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readWorkspaceSnapshot: async () => ({
      ok: true,
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Workspace',
        description: '',
        memories: [
          {
            audioByteLength: 0,
            createdAt: '2026-06-02T13:00:00.000Z',
            audioDurationMs: 0,
            hasAudioTranscript: false,
            hasAnyNote: true,
            memoryId: 'mem_1',
            segmentCount: 1,
            audioSegmentCount: 0,
            noteSegmentCount: 1,
            supplementCount: 0,
            title: 'Memory',
            updatedAt: '2026-06-02T13:00:00.000Z',
          },
        ],
      },
    }),
    readMemoryDetail: async () => {
      const detail = noteMemoryDetail();
      return {
        ok: true,
        value: {
          ...detail,
          supplementCount: 0,
          segments: detail.segments.map((segment) => ({ ...segment, supplements: [] })),
        },
      };
    },
    readSegmentSource: async () => ({
      bodyMarkdown: '自动失败正文',
      contentHash: 'c'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    markSegmentSpeechFailed: async (input) => {
      marked.push(input);
      return { ok: true, speechSynthesis: failedSpeechSynthesis };
    },
    synthesize: async () => ({ errorCode: 'network' as const, ok: false as const, requestId: 'x' }),
    voiceSettingsStore,
  });

  const result = await runtime.enqueueAutomaticWorkspace({
    assertWorkspaceUsable: usable,
    rootPath: '/workspace',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.equal(result.accepted, 1);
  await waitForCount(marked, 1);
  assert.deepEqual(marked[0], {
    assertWorkspaceUsable: usable,
    expectedContentHash: 'c'.repeat(64),
    kind: 'segment',
    memoryId: 'mem_1',
    mode: 'fill-missing',
    rootPath: '/workspace',
    segmentId: 'seg_1',
    source: 'auto',
    speaker: 'zh_female_vv_uranus_bigtts',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });
});

test('speech synthesis runtime enqueues automatic missing note speech for segments and supplements', async () => {
  const saved: string[] = [];
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readWorkspaceSnapshot: async () => ({
      ok: true,
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Workspace',
        description: '',
        memories: [
          {
            audioByteLength: 0,
            createdAt: '2026-06-02T13:00:00.000Z',
            audioDurationMs: 0,
            hasAudioTranscript: false,
            hasAnyNote: true,
            memoryId: 'mem_1',
            segmentCount: 1,
            audioSegmentCount: 0,
            noteSegmentCount: 1,
            supplementCount: 1,
            title: 'Memory',
            updatedAt: '2026-06-02T13:02:00.000Z',
          },
        ],
      },
    }),
    readMemoryDetail: async () => ({ ok: true, value: noteMemoryDetail() }),
    readSegmentSource: async () => ({
      bodyMarkdown: 'Segment note',
      contentHash: 'a'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    readSupplementSource: async () => ({
      bodyMarkdown: 'Supplement note',
      contentHash: 'b'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    saveSegmentSpeech: async () => {
      saved.push('segment');
      return { ok: true, speechSynthesis: readySpeechSynthesis };
    },
    saveSupplementSpeech: async () => {
      saved.push('supplement');
      return { ok: true, speechSynthesis: readySpeechSynthesis };
    },
    synthesize: async () => ({
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      ok: true,
      requestId: 'tts-auto',
    }),
    voiceSettingsStore,
  });

  const result = await runtime.enqueueAutomaticWorkspace({
    assertWorkspaceUsable: usable,
    rootPath: '/workspace',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.deepEqual(result, { accepted: 2, capped: 0, duplicates: 0 });
  await waitForCount(saved, 2);
  assert.deepEqual(saved.sort(), ['segment', 'supplement']);
});

test('speech synthesis runtime skips stale automatic source before provider calls', async () => {
  const sourceReads: string[] = [];
  let synthesizeCalled = false;
  const memoryDetail = noteMemoryDetail();
  const [segment] = memoryDetail.segments;
  assert.ok(segment);
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readWorkspaceSnapshot: async () => ({
      ok: true,
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Workspace',
        description: '',
        memories: [
          {
            audioByteLength: 0,
            createdAt: '2026-06-02T13:00:00.000Z',
            audioDurationMs: 0,
            hasAudioTranscript: false,
            hasAnyNote: true,
            memoryId: 'mem_1',
            segmentCount: 1,
            audioSegmentCount: 0,
            noteSegmentCount: 1,
            supplementCount: 0,
            title: 'Memory',
            updatedAt: '2026-06-02T13:02:00.000Z',
          },
        ],
      },
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: {
        ...memoryDetail,
        segmentCount: 1,
        segments: [
          {
            ...segment,
            supplementCount: 0,
            supplements: [],
          },
        ],
        supplementCount: 0,
      },
    }),
    readSegmentSource: async () => {
      sourceReads.push('seg_1');
      return sourceReads.length === 1
        ? {
            bodyMarkdown: 'Old automatic note',
            contentHash: 'a'.repeat(64),
            ok: true,
            speechSynthesis: missingSpeechSynthesis,
          }
        : {
            bodyMarkdown: 'Updated automatic note',
            contentHash: 'b'.repeat(64),
            ok: true,
            speechSynthesis: missingSpeechSynthesis,
          };
    },
    saveSegmentSpeech: async () => {
      throw new Error('stale automatic speech should not save');
    },
    synthesize: async () => {
      synthesizeCalled = true;
      throw new Error('stale automatic speech should not call provider');
    },
    voiceSettingsStore,
  });

  const result = await runtime.enqueueAutomaticWorkspace({
    assertWorkspaceUsable: usable,
    rootPath: '/workspace',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.deepEqual(result, { accepted: 1, capped: 0, duplicates: 0 });
  await waitForCount(sourceReads, 2);
  assert.equal(synthesizeCalled, false);
});

test('speech synthesis runtime continues automatic note speech batches after the first cap', async () => {
  const saved = new Set<string>();
  const sourceReads: string[] = [];
  const segmentIds = ['seg_1', 'seg_2', 'seg_3', 'seg_4'];
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    automaticBatchLimit: 2,
    readWorkspaceSnapshot: async () => ({
      ok: true,
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Workspace',
        description: '',
        memories: [
          {
            audioByteLength: 0,
            createdAt: '2026-06-02T13:00:00.000Z',
            audioDurationMs: 0,
            hasAudioTranscript: false,
            hasAnyNote: true,
            memoryId: 'mem_1',
            segmentCount: segmentIds.length,
            audioSegmentCount: 0,
            noteSegmentCount: segmentIds.length,
            supplementCount: 0,
            title: 'Memory',
            updatedAt: '2026-06-02T13:02:00.000Z',
          },
        ],
      },
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: {
        ...noteMemoryDetail(),
        segmentCount: segmentIds.length,
        noteSegmentCount: segmentIds.length,
        segments: segmentIds.map((segmentId, index) => ({
          bodyByteLength: 14,
          createdAt: '2026-06-02T13:01:00.000Z',
          memoryId: 'mem_1',
          segmentId,
          supplementCount: 0,
          supplements: [],
          title: `Segment note ${index + 1}`,
          type: 'note' as const,
          updatedAt: '2026-06-02T13:01:00.000Z',
          workspaceId: 'ws_1',
        })),
        supplementCount: 0,
      },
    }),
    readSegmentSource: async (input) => {
      sourceReads.push(input.segmentId);
      return {
        bodyMarkdown: `Segment note ${input.segmentId}`,
        contentHash: input.segmentId.padEnd(64, 'a'),
        ok: true,
        speechSynthesis: saved.has(input.segmentId) ? readySpeechSynthesis : missingSpeechSynthesis,
      };
    },
    saveSegmentSpeech: async (input) => {
      saved.add(input.segmentId);
      return { ok: true, speechSynthesis: readySpeechSynthesis };
    },
    synthesize: async () => ({
      audio: new Uint8Array([1, 2, 3]),
      audioByteLength: 3,
      ok: true,
      requestId: 'tts-auto-drain',
    }),
    voiceSettingsStore,
  });

  const result = await runtime.enqueueAutomaticWorkspace({
    assertWorkspaceUsable: usable,
    rootPath: '/workspace',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.deepEqual(result, { accepted: 2, capped: 1, duplicates: 0 });
  await waitForSetSize(saved, 4);
  assert.deepEqual([...saved].sort(), segmentIds);
  assert.deepEqual(sourceReads, [
    'seg_1',
    'seg_2',
    'seg_3',
    'seg_1',
    'seg_2',
    'seg_3',
    'seg_4',
    'seg_3',
    'seg_4',
  ]);
});

test('speech synthesis runtime regenerates every note target in a workspace with the selected speaker', async () => {
  const saved: string[] = [];
  const synthesizedSpeakers: string[] = [];
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readWorkspaceSnapshot: async () => ({
      ok: true,
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Workspace',
        description: '',
        memories: [
          {
            audioByteLength: 0,
            createdAt: '2026-06-02T13:00:00.000Z',
            audioDurationMs: 0,
            hasAudioTranscript: false,
            hasAnyNote: true,
            memoryId: 'mem_1',
            segmentCount: 1,
            audioSegmentCount: 0,
            noteSegmentCount: 1,
            supplementCount: 1,
            title: 'Memory',
            updatedAt: '2026-06-02T13:02:00.000Z',
          },
        ],
      },
    }),
    readMemoryDetail: async () => ({ ok: true, value: noteMemoryDetail() }),
    readSegmentSource: async () => ({
      bodyMarkdown: 'Segment note',
      contentHash: 'a'.repeat(64),
      ok: true,
      speechSynthesis: readySpeechSynthesis,
    }),
    readSupplementSource: async () => ({
      bodyMarkdown: 'Supplement note',
      contentHash: 'b'.repeat(64),
      ok: true,
      speechSynthesis: missingSpeechSynthesis,
    }),
    saveSegmentSpeech: async (input) => {
      saved.push(`segment:${input.speaker}`);
      return { ok: true, speechSynthesis: { ...readySpeechSynthesis, speaker: input.speaker } };
    },
    saveSupplementSpeech: async (input) => {
      saved.push(`supplement:${input.speaker}`);
      return { ok: true, speechSynthesis: { ...readySpeechSynthesis, speaker: input.speaker } };
    },
    synthesize: async (input) => {
      synthesizedSpeakers.push(input.speaker);
      return {
        audio: new Uint8Array([1, 2, 3]),
        audioByteLength: 3,
        ok: true,
        requestId: 'tts-batch',
      };
    },
    voiceSettingsStore,
  });

  const result = await runtime.regenerateWorkspaceSpeechSynthesis({
    assertWorkspaceUsable: usable,
    rootPath: '/workspace',
    speaker: 'zh_male_shaonianzixin_uranus_bigtts',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.deepEqual(result, {
    failed: 0,
    failedTargets: [],
    generated: 2,
    skipped: 0,
    speaker: 'zh_male_shaonianzixin_uranus_bigtts',
    total: 2,
  });
  assert.deepEqual(synthesizedSpeakers, [
    'zh_male_shaonianzixin_uranus_bigtts',
    'zh_male_shaonianzixin_uranus_bigtts',
  ]);
  assert.deepEqual(saved.sort(), [
    'segment:zh_male_shaonianzixin_uranus_bigtts',
    'supplement:zh_male_shaonianzixin_uranus_bigtts',
  ]);
});

test('speech synthesis runtime does not scan workspace during batch regeneration when key is unavailable', async () => {
  const target = {
    kind: 'segment' as const,
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    workspaceId: 'ws_1',
  };
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readWorkspaceSnapshot: async () => {
      throw new Error('unavailable speech settings should not scan workspace snapshot');
    },
    readMemoryDetail: async () => {
      throw new Error('unavailable speech settings should not read memory detail');
    },
    readSegmentSource: async () => {
      throw new Error('unavailable speech settings should not read note source');
    },
    synthesize: async () => {
      throw new Error('unavailable speech settings should not call provider');
    },
    voiceSettingsStore: {
      ...voiceSettingsStore,
      readDecryptedApiKey: () => '',
    },
  });

  const result = await runtime.regenerateWorkspaceSpeechSynthesis({
    assertWorkspaceUsable: usable,
    rootPath: '/workspace',
    speaker: 'zh_male_shaonianzixin_uranus_bigtts',
    targets: [target],
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.deepEqual(result, {
    failed: 1,
    failedTargets: [target],
    generated: 0,
    skipped: 0,
    speaker: 'zh_male_shaonianzixin_uranus_bigtts',
    total: 1,
  });
});

test('speech synthesis runtime skips failed note speech during automatic fill-missing scans', async () => {
  const saved: string[] = [];
  const runtime = createWorkspaceSpeechSynthesisRuntime({
    readWorkspaceSnapshot: async () => ({
      ok: true,
      snapshot: {
        workspaceId: 'ws_1',
        title: 'Workspace',
        description: '',
        memories: [
          {
            audioByteLength: 0,
            createdAt: '2026-06-02T13:00:00.000Z',
            audioDurationMs: 0,
            hasAudioTranscript: false,
            hasAnyNote: true,
            memoryId: 'mem_1',
            segmentCount: 1,
            audioSegmentCount: 0,
            noteSegmentCount: 1,
            supplementCount: 0,
            title: 'Memory',
            updatedAt: '2026-06-02T13:02:00.000Z',
          },
        ],
      },
    }),
    readMemoryDetail: async () => ({
      ok: true,
      value: {
        ...noteMemoryDetail(),
        supplementCount: 0,
        segments: [{ ...noteMemoryDetail().segments[0]!, supplementCount: 0, supplements: [] }],
      },
    }),
    readSegmentSource: async () => ({
      bodyMarkdown: 'Segment note',
      contentHash: 'b'.repeat(64),
      ok: true,
      speechSynthesis: failedSpeechSynthesis,
    }),
    saveSegmentSpeech: async () => {
      saved.push('segment');
      return { ok: true, speechSynthesis: readySpeechSynthesis };
    },
    synthesize: async () => {
      throw new Error('failed automatic speech should not be retried');
    },
    voiceSettingsStore,
  });

  const result = await runtime.enqueueAutomaticWorkspace({
    assertWorkspaceUsable: usable,
    rootPath: '/workspace',
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });

  assert.deepEqual(result, { accepted: 0, capped: 0, duplicates: 0 });
  assert.deepEqual(saved, []);
});
