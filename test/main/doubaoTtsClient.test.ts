import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOUBAO_TTS_UNIDIRECTIONAL_ENDPOINT,
  synthesizeDoubaoTtsSpeech,
} from '../../src/main/doubaoTtsClient.js';

function streamFromText(chunks: readonly string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}

test('synthesizeDoubaoTtsSpeech sends V3 key auth request and concatenates streamed MP3 chunks', async () => {
  const calls: Array<{ readonly url: string; readonly init?: RequestInit }> = [];
  const chunkA = Buffer.from([0xff, 0xfb, 0x90, 0x64]).toString('base64');
  const chunkB = Buffer.from([0x01, 0x02]).toString('base64');
  const result = await synthesizeDoubaoTtsSpeech({
    apiKey: 'tts-key-1234',
    fetch: async (url, init) => {
      calls.push({ url, ...(init ? { init } : {}) });
      return new Response(
        streamFromText([
          `event: 352\n`,
          `data: {"code":0,"message":"","data":"${chunkA}"}\n\n`,
          `event: 351\n`,
          `data: {"code":0,"message":"","data":null,"sentence":{"text":"合成正文","words":[]}}\n\n`,
          `event: 352\n`,
          `data: {"code":0,"message":"","data":"${chunkB}"}\n\n`,
          `event: 152\n`,
          `data: {"code":20000000,"message":"OK","data":null,"usage":{"text_words":4}}\n\n`,
        ]),
        { status: 200 }
      );
    },
    requestId: 'request-1',
    speaker: 'zh_female_vv_uranus_bigtts',
    text: '合成正文',
  });

  assert.deepEqual(result, {
    audio: new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x01, 0x02]),
    audioByteLength: 6,
    ok: true,
    requestId: 'request-1',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, DOUBAO_TTS_UNIDIRECTIONAL_ENDPOINT);
  const headers = calls[0]?.init?.headers as Record<string, string>;
  assert.equal(headers['X-Api-Key'], 'tts-key-1234');
  assert.equal(headers['X-Api-Resource-Id'], 'seed-tts-2.0');
  assert.equal(headers['X-Api-Request-Id'], 'request-1');
  const body = JSON.parse(String(calls[0]?.init?.body)) as {
    readonly req_params: {
      readonly audio_params: { readonly format: string; readonly sample_rate: number };
      readonly model: string;
      readonly speaker: string;
      readonly text: string;
    };
  };
  assert.deepEqual(body.req_params, {
    audio_params: { format: 'mp3', sample_rate: 24000 },
    model: 'seed-tts-2.0-expressive',
    speaker: 'zh_female_vv_uranus_bigtts',
    text: '合成正文',
  });
});

test('synthesizeDoubaoTtsSpeech keeps compatibility with nested audio chunk shapes', async () => {
  const chunkA = Buffer.from([0xff, 0xfb, 0x90, 0x64]).toString('base64');
  const chunkB = Buffer.from([0x01, 0x02]).toString('base64');
  const result = await synthesizeDoubaoTtsSpeech({
    apiKey: 'tts-key',
    fetch: async () =>
      new Response(
        streamFromText([
          `data: {"data":{"audio":"${chunkA}"}}\n`,
          `{"result":{"audio":"${chunkB}"}}\n`,
        ]),
        { status: 200 }
      ),
    requestId: 'nested-request',
    speaker: 'zh_female_vv_uranus_bigtts',
    text: '合成正文',
  });

  assert.deepEqual(result, {
    audio: new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x01, 0x02]),
    audioByteLength: 6,
    ok: true,
    requestId: 'nested-request',
  });
});

test('synthesizeDoubaoTtsSpeech rejects malformed base64 data instead of saving it as MP3', async () => {
  const malformed = await synthesizeDoubaoTtsSpeech({
    apiKey: 'tts-key',
    fetch: async () => new Response(streamFromText(['{"data":"not audio"}\n']), { status: 200 }),
    requestId: 'malformed-request',
    speaker: 'zh_female_vv_uranus_bigtts',
    text: '合成正文',
  });

  assert.deepEqual(malformed, {
    errorCode: 'malformed',
    ok: false,
    requestId: 'malformed-request',
  });
});

test('synthesizeDoubaoTtsSpeech maps auth and empty audio responses', async () => {
  const auth = await synthesizeDoubaoTtsSpeech({
    apiKey: 'bad-key',
    fetch: async () => new Response('unauthorized', { status: 401 }),
    requestId: 'auth-request',
    speaker: 'zh_female_vv_uranus_bigtts',
    text: '合成正文',
  });
  assert.deepEqual(auth, { errorCode: 'auth', ok: false, requestId: 'auth-request' });

  const empty = await synthesizeDoubaoTtsSpeech({
    apiKey: 'tts-key',
    fetch: async () => new Response(streamFromText(['{"message":"ok"}\n']), { status: 200 }),
    requestId: 'empty-request',
    speaker: 'zh_female_vv_uranus_bigtts',
    text: '合成正文',
  });
  assert.deepEqual(empty, { errorCode: 'empty-audio', ok: false, requestId: 'empty-request' });
});
