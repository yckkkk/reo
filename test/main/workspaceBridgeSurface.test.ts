import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceBridge } from '../../src/preload/workspaceBridge.js';
import type { ReoWorkspaceBridge } from '../../src/workspace-contract/reo-workspace-bridge.js';

const workspaceBridgeKeys = [
  'chooseDirectory',
  'listMemorySpaces',
  'initializeWorkspace',
  'openWorkspace',
  'openMemorySpace',
  'removeMemorySpace',
  'revealMemorySpaceInFinder',
  'revealMemoryInFinder',
  'revealSegmentInFinder',
  'revealSegmentSupplementInFinder',
  'openMemorySpaceAgentsFile',
  'openMemoryDocument',
  'openSegmentDocument',
  'openSegmentSupplementDocument',
  'copyMemorySpaceAbsolutePath',
  'copyMemoryAbsolutePath',
  'copySegmentAbsolutePath',
  'copySegmentSupplementAbsolutePath',
  'copyMemoryRelativePath',
  'copySegmentRelativePath',
  'copySegmentSupplementRelativePath',
  'updateMemorySpaceTitle',
  'closeWorkspace',
  'readWorkspaceSnapshot',
  'createMemory',
  'deleteMemory',
  'restoreDeletedMemory',
  'deleteSegment',
  'restoreDeletedSegment',
  'deleteSegmentSupplement',
  'restoreDeletedSegmentSupplement',
  'readMemoryDetail',
  'readFinalizedAudioSegment',
  'readFinalizedAudioSegmentSupplement',
  'createRecordingDraft',
  'createSegmentSupplementRecordingDraft',
  'createNoteSegmentDraft',
  'createSegmentSupplementNoteDraft',
  'writeNoteSegmentDraftBody',
  'writeSegmentSupplementNoteDraftBody',
  'finalizeNoteSegmentDraft',
  'finalizeSegmentSupplementNoteDraft',
  'readSegmentContent',
  'readSegmentSupplementContent',
  'writeSegmentContent',
  'writeSegmentSupplementContent',
  'saveSegmentAttachment',
  'listSegmentAttachments',
  'saveSegmentSupplementAttachment',
  'listSegmentSupplementAttachments',
  'readRecordingDraftAudio',
  'appendRecordingAudioChunk',
  'appendSegmentSupplementRecordingAudioChunk',
  'cloneRecordingDraftPrefix',
  'finalizeRecordingDraft',
  'finalizeSegmentSupplementRecordingDraft',
  'discardRecordingDraft',
  'discardSegmentSupplementRecordingDraft',
  'updateMemoryTitle',
  'updateSegmentTitle',
  'updateSegmentContentTitle',
  'updateSegmentSupplementTitle',
  'updateSegmentContentTabOrder',
  'saveTranscript',
  'saveSegmentSupplementTranscript',
  'requestSegmentTranscriptionBackfill',
  'requestSegmentSupplementTranscriptionBackfill',
  'beginMicrophoneIntent',
  'clearMicrophoneIntent',
  'startRecordingTranscription',
  'sendRecordingTranscriptionAudio',
  'finishRecordingTranscription',
  'closeRecordingTranscription',
  'readVoiceTranscriptionSettings',
  'setVoiceTranscriptionEnabled',
  'saveVoiceTranscriptionApiKey',
  'clearVoiceTranscriptionApiKey',
  'validateVoiceTranscriptionCredentials',
  'openVoiceTranscriptionProviderConsole',
  'openMarkdownExternalLink',
  'onRecordingTranscriptionEvent',
  'onFileTruthChanged',
] as const;

const workspaceEntityActionBridgeKeys = [
  'revealMemorySpaceInFinder',
  'revealMemoryInFinder',
  'revealSegmentInFinder',
  'revealSegmentSupplementInFinder',
  'openMemorySpaceAgentsFile',
  'openMemoryDocument',
  'openSegmentDocument',
  'openSegmentSupplementDocument',
  'copyMemorySpaceAbsolutePath',
  'copyMemoryAbsolutePath',
  'copySegmentAbsolutePath',
  'copySegmentSupplementAbsolutePath',
  'copyMemoryRelativePath',
  'copySegmentRelativePath',
  'copySegmentSupplementRelativePath',
] as const;

const applicationScopedBridgeContractKeys = [
  'readVoiceTranscriptionSettings',
  'setVoiceTranscriptionEnabled',
  'saveVoiceTranscriptionApiKey',
  'clearVoiceTranscriptionApiKey',
  'validateVoiceTranscriptionCredentials',
  'openVoiceTranscriptionProviderConsole',
  'openMarkdownExternalLink',
] as const satisfies readonly (keyof ReoWorkspaceBridge)[];

test('workspace bridge contract declares application-scoped methods before preload exposure', () => {
  assert.deepEqual(
    [...applicationScopedBridgeContractKeys],
    [
      'readVoiceTranscriptionSettings',
      'setVoiceTranscriptionEnabled',
      'saveVoiceTranscriptionApiKey',
      'clearVoiceTranscriptionApiKey',
      'validateVoiceTranscriptionCredentials',
      'openVoiceTranscriptionProviderConsole',
      'openMarkdownExternalLink',
    ]
  );
});

test('workspace preload bridge exposes explicit methods and no generic ipc methods', async () => {
  const calls: string[] = [];
  const bridge = createWorkspaceBridge({
    invoke: async (channel) => {
      calls.push(channel);
      return { ok: true, value: { status: 'canceled' } };
    },
  });

  assert.deepEqual(Object.keys(bridge), workspaceBridgeKeys);
  assert.equal('invoke' in bridge, false);
  assert.equal('send' in bridge, false);

  assert.deepEqual(await bridge.chooseDirectory(), {
    ok: true,
    value: { status: 'canceled' },
  });
  await bridge.listMemorySpaces();
  await bridge.openMemorySpace({ workspaceId: 'ws_1' });
  await bridge.removeMemorySpace({ workspaceId: 'ws_1' });
  await bridge.updateMemorySpaceTitle({ workspaceId: 'ws_1', title: '测试工作区1' });
  await bridge.readWorkspaceSnapshot({ workspaceHandle: 'wh_1' });
  await bridge.createMemory({ workspaceHandle: 'wh_1', title: '产品灵感与思考' });
  await bridge.deleteMemory({ workspaceHandle: 'wh_1', memoryId: 'mem_1' });
  await bridge.restoreDeletedMemory({ workspaceHandle: 'wh_1', restoreToken: 'mem_1' });
  await bridge.deleteSegment({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
  });
  await bridge.restoreDeletedSegment({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    restoreToken: 'seg_1',
  });
  await bridge.deleteSegmentSupplement({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
  });
  await bridge.restoreDeletedSegmentSupplement({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    restoreToken: 'sup_1',
  });
  await bridge.readMemoryDetail({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    requestId: 'request_mem_1',
  });
  await bridge.readFinalizedAudioSegment({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    requestId: 'request_seg_1',
  });
  await bridge.readFinalizedAudioSegmentSupplement({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    requestId: 'request_sup_1',
  });
  await bridge.createSegmentSupplementRecordingDraft({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
  });
  await bridge.createNoteSegmentDraft({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    title: 'Note',
  });
  await bridge.createSegmentSupplementNoteDraft({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    title: 'Supplement note',
  });
  await bridge.writeNoteSegmentDraftBody({
    workspaceHandle: 'wh_1',
    segmentId: 'seg_1',
    bodyMarkdown: 'body',
    revision: 0,
  });
  await bridge.writeSegmentSupplementNoteDraftBody({
    workspaceHandle: 'wh_1',
    supplementId: 'sup_1',
    bodyMarkdown: 'body',
    revision: 0,
  });
  await bridge.finalizeNoteSegmentDraft({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    title: 'Final note',
  });
  await bridge.finalizeSegmentSupplementNoteDraft({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    title: 'Final supplement',
  });
  await bridge.readSegmentContent({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    requestId: 'request_seg_1',
  });
  await bridge.readSegmentSupplementContent({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    requestId: 'request_sup_1',
  });
  await bridge.writeSegmentContent({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    bodyMarkdown: 'updated',
    baselineContentHash: 'a'.repeat(64),
  });
  await bridge.writeSegmentSupplementContent({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    bodyMarkdown: 'updated',
    baselineContentHash: 'a'.repeat(64),
  });
  await bridge.saveSegmentAttachment({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    originalFilename: 'image.png',
    mimeType: 'image/png',
    payload: new Uint8Array([1]),
  });
  await bridge.listSegmentAttachments({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
  });
  await bridge.saveSegmentSupplementAttachment({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    originalFilename: 'supplement.png',
    mimeType: 'image/png',
    payload: new Uint8Array([2]),
  });
  await bridge.listSegmentSupplementAttachments({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
  });
  await bridge.readRecordingDraftAudio({ workspaceHandle: 'wh_1', segmentId: 'seg_1' });
  await bridge.appendSegmentSupplementRecordingAudioChunk({
    workspaceHandle: 'wh_1',
    supplementId: 'sup_1',
    sequence: 0,
    chunk: new Uint8Array([1]),
  });
  await bridge.cloneRecordingDraftPrefix({
    workspaceHandle: 'wh_1',
    sourceSegmentId: 'seg_1',
    targetSegmentId: 'seg_2',
    retainedByteLength: 12,
    nextSequence: 0,
  });
  await bridge.finalizeSegmentSupplementRecordingDraft({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    title: '补充录音',
    durationMs: 1200,
    lastTranscriptionAttemptOnFinalize: 'never',
  });
  await bridge.discardSegmentSupplementRecordingDraft({
    workspaceHandle: 'wh_1',
    supplementId: 'sup_1',
  });
  await bridge.saveSegmentSupplementTranscript({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    markdown: '补充录音转写',
  });
  await bridge.requestSegmentTranscriptionBackfill({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    mode: 'fill-missing',
  });
  await bridge.requestSegmentSupplementTranscriptionBackfill({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    mode: 'regenerate',
  });
  assert.deepEqual(calls, [
    'workspace:chooseDirectory',
    'workspace:listMemorySpaces',
    'workspace:openMemorySpace',
    'workspace:removeMemorySpace',
    'workspace:updateMemorySpaceTitle',
    'workspace:readWorkspaceSnapshot',
    'workspace:createMemory',
    'workspace:deleteMemory',
    'workspace:restoreDeletedMemory',
    'workspace:deleteSegment',
    'workspace:restoreDeletedSegment',
    'workspace:deleteSegmentSupplement',
    'workspace:restoreDeletedSegmentSupplement',
    'workspace:readMemoryDetail',
    'workspace:readFinalizedAudioSegment',
    'workspace:readFinalizedAudioSegmentSupplement',
    'workspace:createSegmentSupplementRecordingDraft',
    'workspace:createNoteSegmentDraft',
    'workspace:createSegmentSupplementNoteDraft',
    'workspace:writeNoteSegmentDraftBody',
    'workspace:writeSegmentSupplementNoteDraftBody',
    'workspace:finalizeNoteSegmentDraft',
    'workspace:finalizeSegmentSupplementNoteDraft',
    'workspace:readSegmentContent',
    'workspace:readSegmentSupplementContent',
    'workspace:writeSegmentContent',
    'workspace:writeSegmentSupplementContent',
    'workspace:saveSegmentAttachment',
    'workspace:listSegmentAttachments',
    'workspace:saveSegmentSupplementAttachment',
    'workspace:listSegmentSupplementAttachments',
    'workspace:readRecordingDraftAudio',
    'workspace:appendSegmentSupplementRecordingAudioChunk',
    'workspace:cloneRecordingDraftPrefix',
    'workspace:finalizeSegmentSupplementRecordingDraft',
    'workspace:discardSegmentSupplementRecordingDraft',
    'workspace:saveSegmentSupplementTranscript',
    'workspace:requestSegmentTranscriptionBackfill',
    'workspace:requestSegmentSupplementTranscriptionBackfill',
  ]);
});

test('workspace preload bridge exposes entity actions menu methods', () => {
  const bridge = createWorkspaceBridge({
    invoke: async () => ({ ok: true }),
  });

  for (const method of workspaceEntityActionBridgeKeys) {
    assert.equal(typeof (bridge as unknown as Record<string, unknown>)[method], 'function', method);
  }
});

test('workspace preload bridge maps entity actions menu methods to explicit channels', async () => {
  const memorySpacePayload = { workspaceId: 'ws_1' };
  const memoryPayload = {
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
  };
  const segmentPayload = {
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
  };
  const supplementPayload = {
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
  };
  const calls: Array<{ readonly channel: string; readonly payload?: unknown }> = [];
  const bridge = createWorkspaceBridge({
    invoke: async (channel, payload) => {
      calls.push({ channel, payload });
      return { ok: true };
    },
  });

  await bridge.revealMemorySpaceInFinder(memorySpacePayload);
  await bridge.revealMemoryInFinder(memoryPayload);
  await bridge.revealSegmentInFinder(segmentPayload);
  await bridge.revealSegmentSupplementInFinder(supplementPayload);
  await bridge.openMemorySpaceAgentsFile(memorySpacePayload);
  await bridge.openMemoryDocument(memoryPayload);
  await bridge.openSegmentDocument(segmentPayload);
  await bridge.openSegmentSupplementDocument(supplementPayload);
  await bridge.copyMemorySpaceAbsolutePath(memorySpacePayload);
  await bridge.copyMemoryAbsolutePath(memoryPayload);
  await bridge.copySegmentAbsolutePath(segmentPayload);
  await bridge.copySegmentSupplementAbsolutePath(supplementPayload);
  await bridge.copyMemoryRelativePath(memoryPayload);
  await bridge.copySegmentRelativePath(segmentPayload);
  await bridge.copySegmentSupplementRelativePath(supplementPayload);

  assert.deepEqual(calls, [
    { channel: 'workspace:revealMemorySpaceInFinder', payload: memorySpacePayload },
    { channel: 'workspace:revealMemoryInFinder', payload: memoryPayload },
    { channel: 'workspace:revealSegmentInFinder', payload: segmentPayload },
    { channel: 'workspace:revealSegmentSupplementInFinder', payload: supplementPayload },
    { channel: 'workspace:openMemorySpaceAgentsFile', payload: memorySpacePayload },
    { channel: 'workspace:openMemoryDocument', payload: memoryPayload },
    { channel: 'workspace:openSegmentDocument', payload: segmentPayload },
    { channel: 'workspace:openSegmentSupplementDocument', payload: supplementPayload },
    { channel: 'workspace:copyMemorySpaceAbsolutePath', payload: memorySpacePayload },
    { channel: 'workspace:copyMemoryAbsolutePath', payload: memoryPayload },
    { channel: 'workspace:copySegmentAbsolutePath', payload: segmentPayload },
    { channel: 'workspace:copySegmentSupplementAbsolutePath', payload: supplementPayload },
    { channel: 'workspace:copyMemoryRelativePath', payload: memoryPayload },
    { channel: 'workspace:copySegmentRelativePath', payload: segmentPayload },
    { channel: 'workspace:copySegmentSupplementRelativePath', payload: supplementPayload },
  ]);
});

test('workspace preload bridge maps memory methods and microphone methods to explicit channels', async () => {
  const calls: Array<{ readonly channel: string; readonly payload?: unknown }> = [];
  const bridge = createWorkspaceBridge({
    invoke: async (channel, payload) => {
      calls.push({ channel, payload });
      return { ok: true, value: {} };
    },
  });

  await bridge.createMemory({ workspaceHandle: 'wh_1', title: '产品灵感与思考' });
  await bridge.updateMemorySpaceTitle({ workspaceHandle: 'wh_1', title: '测试工作区1' });
  await bridge.updateMemoryTitle({
    workspaceHandle: 'wh_1',
    memoryId: 'mem_1',
    title: '产品灵感与思考',
  });
  await bridge.updateSegmentTitle({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    title: '录音1',
  });
  await bridge.updateSegmentContentTitle({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    contentTitle: '访谈转录',
  });
  await bridge.updateSegmentSupplementTitle({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
    title: '现场补充',
  });
  await bridge.updateSegmentContentTabOrder({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    contentTabOrder: ['supplement:sup_1', 'segment'],
  });
  await bridge.deleteSegmentSupplement({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    supplementId: 'sup_1',
  });
  await bridge.restoreDeletedSegmentSupplement({
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
    memoryId: 'mem_1',
    segmentId: 'seg_1',
    restoreToken: 'sup_1',
  });
  await bridge.beginMicrophoneIntent({
    workspaceHandle: 'wh_1',
    recordingFlowSessionId: 'recording_flow_1',
  });
  await bridge.clearMicrophoneIntent({
    workspaceHandle: 'wh_1',
    recordingFlowSessionId: 'recording_flow_1',
  });

  assert.deepEqual(calls, [
    {
      channel: 'workspace:createMemory',
      payload: { workspaceHandle: 'wh_1', title: '产品灵感与思考' },
    },
    {
      channel: 'workspace:updateMemorySpaceTitle',
      payload: { workspaceHandle: 'wh_1', title: '测试工作区1' },
    },
    {
      channel: 'workspace:updateMemoryTitle',
      payload: { workspaceHandle: 'wh_1', memoryId: 'mem_1', title: '产品灵感与思考' },
    },
    {
      channel: 'workspace:updateSegmentTitle',
      payload: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        title: '录音1',
      },
    },
    {
      channel: 'workspace:updateSegmentContentTitle',
      payload: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        contentTitle: '访谈转录',
      },
    },
    {
      channel: 'workspace:updateSegmentSupplementTitle',
      payload: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementId: 'sup_1',
        title: '现场补充',
      },
    },
    {
      channel: 'workspace:updateSegmentContentTabOrder',
      payload: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        contentTabOrder: ['supplement:sup_1', 'segment'],
      },
    },
    {
      channel: 'workspace:deleteSegmentSupplement',
      payload: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        supplementId: 'sup_1',
      },
    },
    {
      channel: 'workspace:restoreDeletedSegmentSupplement',
      payload: {
        workspaceHandle: 'wh_1',
        workspaceId: 'ws_1',
        memoryId: 'mem_1',
        segmentId: 'seg_1',
        restoreToken: 'sup_1',
      },
    },
    {
      channel: 'workspace:beginMicrophoneIntent',
      payload: { workspaceHandle: 'wh_1', recordingFlowSessionId: 'recording_flow_1' },
    },
    {
      channel: 'workspace:clearMicrophoneIntent',
      payload: { workspaceHandle: 'wh_1', recordingFlowSessionId: 'recording_flow_1' },
    },
  ]);
});

test('workspace preload bridge maps recording transcription methods and strips ipc events', async () => {
  const calls: Array<{ readonly channel: string; readonly payload?: unknown }> = [];
  const subscriptions: Array<{
    readonly channel: string;
    readonly listener: (payload: unknown) => void;
  }> = [];
  let removed = false;
  const bridge = createWorkspaceBridge({
    invoke: async (channel, payload) => {
      calls.push({ channel, payload });
      return { ok: true, value: { accepted: true } };
    },
    on: (channel, listener) => {
      subscriptions.push({ channel, listener });
      return () => {
        removed = true;
      };
    },
  });

  await bridge.startRecordingTranscription({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    timeOffsetMs: 0,
    workspaceHandle: 'wh_1',
  });
  await bridge.sendRecordingTranscriptionAudio({
    chunk: new Uint8Array([1, 2, 3]),
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    workspaceHandle: 'wh_1',
  });
  await bridge.finishRecordingTranscription({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    workspaceHandle: 'wh_1',
  });
  await bridge.closeRecordingTranscription({
    recordingFlowSessionId: 'recording-1',
    recordingSessionId: 'recording-1',
    revisionId: 'recording-1-revision-0',
    workspaceHandle: 'wh_1',
  });

  const events: unknown[] = [];
  const fileTruthEvents: unknown[] = [];
  const unsubscribe = bridge.onRecordingTranscriptionEvent((event) => events.push(event));
  const unsubscribeFileTruth = bridge.onFileTruthChanged((event) => fileTruthEvents.push(event));
  subscriptions[0]?.listener({ kind: 'closed', recordingSessionId: 'recording-1' });
  subscriptions[1]?.listener({
    kind: 'changed',
    reason: 'file-system',
    sequence: 1,
    workspaceHandle: 'wh_1',
    workspaceId: 'ws_1',
  });
  unsubscribe();
  unsubscribeFileTruth();

  assert.deepEqual(calls, [
    {
      channel: 'workspace:startRecordingTranscription',
      payload: {
        recordingFlowSessionId: 'recording-1',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        timeOffsetMs: 0,
        workspaceHandle: 'wh_1',
      },
    },
    {
      channel: 'workspace:sendRecordingTranscriptionAudio',
      payload: {
        chunk: new Uint8Array([1, 2, 3]),
        recordingFlowSessionId: 'recording-1',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        workspaceHandle: 'wh_1',
      },
    },
    {
      channel: 'workspace:finishRecordingTranscription',
      payload: {
        recordingFlowSessionId: 'recording-1',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        workspaceHandle: 'wh_1',
      },
    },
    {
      channel: 'workspace:closeRecordingTranscription',
      payload: {
        recordingFlowSessionId: 'recording-1',
        recordingSessionId: 'recording-1',
        revisionId: 'recording-1-revision-0',
        workspaceHandle: 'wh_1',
      },
    },
  ]);
  assert.deepEqual(
    subscriptions.map((subscription) => subscription.channel),
    ['workspace:recordingTranscriptionEvent', 'workspace:fileTruthChanged']
  );
  assert.deepEqual(events, [{ kind: 'closed', recordingSessionId: 'recording-1' }]);
  assert.deepEqual(fileTruthEvents, [
    {
      kind: 'changed',
      reason: 'file-system',
      sequence: 1,
      workspaceHandle: 'wh_1',
      workspaceId: 'ws_1',
    },
  ]);
  assert.equal(removed, true);
});

test('workspace preload bridge maps application-scoped methods to explicit channels', async () => {
  const calls: Array<{ readonly channel: string; readonly payload?: unknown }> = [];
  const bridge = createWorkspaceBridge({
    invoke: async (channel, payload) => {
      calls.push({ channel, payload });
      return { ok: true, value: {} };
    },
  }) as unknown as ReoWorkspaceBridge;

  await bridge.readVoiceTranscriptionSettings(undefined);
  await bridge.setVoiceTranscriptionEnabled({ enabled: true });
  await bridge.saveVoiceTranscriptionApiKey({ apiKey: 'abcd1234' });
  await bridge.clearVoiceTranscriptionApiKey(undefined);
  await bridge.validateVoiceTranscriptionCredentials(undefined);
  await bridge.openVoiceTranscriptionProviderConsole();
  await bridge.openMarkdownExternalLink({ url: 'https://tiptap.dev/docs' });

  assert.deepEqual(calls, [
    { channel: 'workspace:readVoiceTranscriptionSettings', payload: undefined },
    { channel: 'workspace:setVoiceTranscriptionEnabled', payload: { enabled: true } },
    { channel: 'workspace:saveVoiceTranscriptionApiKey', payload: { apiKey: 'abcd1234' } },
    { channel: 'workspace:clearVoiceTranscriptionApiKey', payload: undefined },
    { channel: 'workspace:validateVoiceTranscriptionCredentials', payload: undefined },
    { channel: 'workspace:openVoiceTranscriptionProviderConsole', payload: undefined },
    { channel: 'workspace:openMarkdownExternalLink', payload: { url: 'https://tiptap.dev/docs' } },
  ]);
});

test('workspace preload bridge exposes only implemented workspace file methods', async () => {
  const calls: string[] = [];
  const bridge = createWorkspaceBridge({
    invoke: async (channel) => {
      calls.push(channel);
      return { ok: true, value: { status: 'canceled' } };
    },
  });

  assert.deepEqual(Object.keys(bridge), workspaceBridgeKeys);
  assert.equal('invoke' in bridge, false);
  assert.equal('send' in bridge, false);
});
