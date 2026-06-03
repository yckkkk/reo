import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMemoryFromFileTruth } from '../../src/main/memoryFiles.js';
import {
  createNoteSegmentDraft,
  createSegmentSupplementNoteDraft,
  finalizeNoteSegmentDraft,
  finalizeSegmentSupplementNoteDraft,
  readFinalizedNoteSegmentContent,
  readFinalizedNoteSegmentSpeechAudio,
  readFinalizedNoteSegmentSupplementContent,
  readFinalizedNoteSegmentSupplementSpeechAudio,
  writeNoteSegmentDraftBody,
  writeSegmentSupplementNoteDraftBody,
} from '../../src/main/noteDrafts.js';
import { recognizeDoubaoAucTurboAudioData } from '../../src/main/doubaoAucTurboClient.js';
import { createWorkspaceSpeechSynthesisRuntime } from '../../src/main/speechSynthesisRuntime.js';
import { initializeWorkspaceFiles } from '../../src/main/workspaceFiles.js';

const liveApiKey = process.env['REO_LIVE_DOUBAO_X_API_KEY']?.trim();
const workspaceId = 'ws_live_note_tts';
const memoryId = 'mem_live_note_tts';
const segmentId = 'seg_live_note_tts';
const supplementId = 'sup_live_note_tts';
const timestamp = '2026-06-02T16:00:00.000Z';
const liveTestOptions = {
  skip: liveApiKey ? false : 'Set REO_LIVE_DOUBAO_X_API_KEY to run live Doubao TTS/ASR E2E.',
  timeout: 120_000,
};

const voiceSettingsStore = {
  read: () => ({
    enabled: true,
    apiKeyConfigured: true,
    apiKeyLastFour: 'live',
    speechSynthesisSpeaker: 'zh_female_vv_uranus_bigtts' as const,
    lastTranscriptionValidatedAt: timestamp,
    lastTranscriptionValidationOk: true,
    lastTranscriptionValidationCode: 'ok' as const,
    lastSpeechSynthesisValidatedAt: timestamp,
    lastSpeechSynthesisValidationOk: true,
    lastSpeechSynthesisValidationCode: 'ok' as const,
  }),
  readDecryptedApiKey: () => liveApiKey ?? null,
};

function normalizeTranscript(text: string): string {
  return text.replace(/[\s，。！？、：；,.!?;:"'“”‘’（）()[\]{}<>《》]/g, '').toLowerCase();
}

function assertSpeechTextClean({
  expectedTerms,
  forbiddenTerms,
  transcript,
}: {
  readonly expectedTerms: readonly string[];
  readonly forbiddenTerms: readonly RegExp[];
  readonly transcript: string;
}) {
  const normalized = normalizeTranscript(transcript);
  for (const term of expectedTerms) {
    assert.ok(
      normalized.includes(normalizeTranscript(term)),
      `ASR transcript should include "${term}", got: ${transcript}`
    );
  }
  for (const forbidden of forbiddenTerms) {
    assert.doesNotMatch(transcript, forbidden);
  }
}

async function recognizeSpeechAudio(apiKey: string, audio: Uint8Array) {
  return recognizeDoubaoAucTurboAudioData({
    apiKey,
    audioDataBase64: Buffer.from(audio).toString('base64'),
    timeoutMs: 60_000,
  });
}

async function createWorkspaceWithNotes(rootPath: string) {
  await initializeWorkspaceFiles({
    createWorkspaceId: () => workspaceId,
    description: '',
    now: () => timestamp,
    rootPath,
    title: 'Live note TTS E2E',
  });
  const memory = await createMemoryFromFileTruth({
    memoryId,
    now: () => timestamp,
    rootPath,
    title: 'Live note TTS memory',
  });
  assert.equal(memory.ok, true, JSON.stringify(memory));

  const segmentDraft = await createNoteSegmentDraft({
    createSegmentId: () => segmentId,
    memoryId,
    now: () => timestamp,
    rootPath,
    title: '产品验证清单',
    workspaceId,
  });
  assert.equal(segmentDraft.ok, true, JSON.stringify(segmentDraft));
  const segmentWrite = await writeNoteSegmentDraftBody({
    bodyMarkdown:
      '# 产品验证清单\n\n' +
      '请朗读第一条。 [链接文字](https://example.com/private?token=secret) 只保留链接文字。\n\n' +
      '++<mark data-color="var(--tt-color-highlight-red)" style="background-color: var(--tt-color-highlight-red); color: inherit">红色富文本标记验证</mark>++\n\n' +
      '++<mark data-color="var(--tt-color-highlight-red)" style="background-color: var(--tt-color-highlight-red); color: inherit">E2E sidecar rich mark 1779846666899</mark>++\n\n' +
      '![图片说明](attachments/secret-image.png)\n\n' +
      '`代码符号` 正常朗读。\n\n' +
      '> 价值风险需要验证。\n',
    revision: 0,
    rootPath,
    segmentId,
  });
  assert.equal(segmentWrite.ok, true, JSON.stringify(segmentWrite));
  const segment = await finalizeNoteSegmentDraft({
    memoryId,
    now: () => timestamp,
    rootPath,
    segmentId,
    title: '产品验证清单',
    workspaceId,
  });
  assert.equal(segment.ok, true, JSON.stringify(segment));

  const supplementDraft = await createSegmentSupplementNoteDraft({
    createSupplementId: () => supplementId,
    memoryId,
    now: () => timestamp,
    rootPath,
    segmentId,
    title: '补充语音验证',
    workspaceId,
  });
  assert.equal(supplementDraft.ok, true, JSON.stringify(supplementDraft));
  const supplementWrite = await writeSegmentSupplementNoteDraftBody({
    bodyMarkdown:
      '## 补充验证\n\n' +
      '- 只朗读补充正文。\n' +
      '- [补充链接](https://example.com/supplement) 保留补充链接文字。\n\n' +
      '`补充代码` 正常朗读，不包含图片路径。\n' +
      '![补充图片](attachments/supplement-secret.png)\n',
    revision: 0,
    rootPath,
    supplementId,
  });
  assert.equal(supplementWrite.ok, true, JSON.stringify(supplementWrite));
  const supplement = await finalizeSegmentSupplementNoteDraft({
    memoryId,
    now: () => timestamp,
    rootPath,
    segmentId,
    supplementId,
    title: '补充语音验证',
    workspaceId,
  });
  assert.equal(supplement.ok, true, JSON.stringify(supplement));
}

test(
  'live Doubao note speech synthesis speaks cleaned Markdown for segment and supplement',
  liveTestOptions,
  async () => {
    assert.ok(liveApiKey, 'live api key must be configured');
    const rootPath = await mkdtemp(path.join(os.tmpdir(), 'reo-note-tts-live-e2e-'));
    try {
      await createWorkspaceWithNotes(rootPath);
      const runtime = createWorkspaceSpeechSynthesisRuntime({ voiceSettingsStore });
      const usable = () => ({ ok: true as const });

      const segmentSpeech = await runtime.requestSegmentSpeechSynthesis({
        assertWorkspaceUsable: usable,
        memoryId,
        mode: 'fill-missing',
        rootPath,
        segmentId,
        workspaceHandle: 'wh_live_note_tts',
        workspaceId,
      });
      assert.equal(segmentSpeech.ok, true, JSON.stringify(segmentSpeech));
      const segmentContent = await readFinalizedNoteSegmentContent({
        memoryId,
        rootPath,
        segmentId,
        workspaceId,
      });
      assert.equal(segmentContent.ok, true, JSON.stringify(segmentContent));
      assert.equal(segmentContent.speechSynthesis.status, 'ready');
      assert.ok(segmentContent.speechSynthesis.contentHash);
      assert.ok(segmentContent.speechSynthesis.audioByteLength !== null);
      assert.ok(segmentContent.speechSynthesis.speaker);
      assert.ok(segmentContent.speechSynthesis.updatedAt);
      const segmentAudio = await readFinalizedNoteSegmentSpeechAudio({
        memoryId,
        rootPath,
        segmentId,
        workspaceId,
        contentHash: segmentContent.speechSynthesis.contentHash,
        audioByteLength: segmentContent.speechSynthesis.audioByteLength,
        speaker: segmentContent.speechSynthesis.speaker,
        updatedAt: segmentContent.speechSynthesis.updatedAt,
      });
      assert.equal(segmentAudio.ok, true, JSON.stringify(segmentAudio));
      assert.ok(segmentAudio.audio.byteLength > 0);
      const segmentAsr = await recognizeSpeechAudio(liveApiKey, segmentAudio.audio);
      assert.equal(segmentAsr.ok, true, JSON.stringify(segmentAsr));
      assertSpeechTextClean({
        expectedTerms: [
          '产品验证清单',
          '第一条',
          '链接文字',
          '红色富文本标记验证',
          '代码符号',
          '价值风险',
        ],
        forbiddenTerms: [
          /https/i,
          /example/i,
          /private/i,
          /token/i,
          /attachments/i,
          /secret/i,
          /\+\+|加号|等号/,
          /data-color|highlight|background|inherit|var\(--tt/i,
          /井号|星号|中括号|小括号|斜杠/,
        ],
        transcript: segmentAsr.transcriptText,
      });

      const supplementSpeech = await runtime.requestSupplementSpeechSynthesis({
        assertWorkspaceUsable: usable,
        memoryId,
        mode: 'fill-missing',
        rootPath,
        segmentId,
        supplementId,
        workspaceHandle: 'wh_live_note_tts',
        workspaceId,
      });
      assert.equal(supplementSpeech.ok, true, JSON.stringify(supplementSpeech));
      const supplementContent = await readFinalizedNoteSegmentSupplementContent({
        memoryId,
        rootPath,
        segmentId,
        supplementId,
        workspaceId,
      });
      assert.equal(supplementContent.ok, true, JSON.stringify(supplementContent));
      assert.equal(supplementContent.speechSynthesis.status, 'ready');
      assert.ok(supplementContent.speechSynthesis.contentHash);
      assert.ok(supplementContent.speechSynthesis.audioByteLength !== null);
      assert.ok(supplementContent.speechSynthesis.speaker);
      assert.ok(supplementContent.speechSynthesis.updatedAt);
      const supplementAudio = await readFinalizedNoteSegmentSupplementSpeechAudio({
        memoryId,
        rootPath,
        segmentId,
        supplementId,
        workspaceId,
        contentHash: supplementContent.speechSynthesis.contentHash,
        audioByteLength: supplementContent.speechSynthesis.audioByteLength,
        speaker: supplementContent.speechSynthesis.speaker,
        updatedAt: supplementContent.speechSynthesis.updatedAt,
      });
      assert.equal(supplementAudio.ok, true, JSON.stringify(supplementAudio));
      assert.ok(supplementAudio.audio.byteLength > 0);
      const supplementAsr = await recognizeSpeechAudio(liveApiKey, supplementAudio.audio);
      assert.equal(supplementAsr.ok, true, JSON.stringify(supplementAsr));
      assertSpeechTextClean({
        expectedTerms: ['补充验证', '补充正文', '补充链接', '补充代码'],
        forbiddenTerms: [
          /https/i,
          /example/i,
          /supplement-secret/i,
          /attachments/i,
          /井号|星号|中括号|小括号|斜杠/,
        ],
        transcript: supplementAsr.transcriptText,
      });
    } finally {
      await rm(rootPath, { force: true, recursive: true });
    }
  }
);
