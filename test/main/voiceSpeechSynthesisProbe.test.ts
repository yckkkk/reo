import assert from 'node:assert/strict';
import test from 'node:test';
import { runVoiceSpeechSynthesisProbe } from '../../src/main/voiceSpeechSynthesisProbe.js';

test('runVoiceSpeechSynthesisProbe uses the same default timeout scale as real TTS requests', async () => {
  let timeoutMs: number | undefined;
  const result = await runVoiceSpeechSynthesisProbe({
    apiKey: 'probe-key',
    speaker: 'zh_female_vv_uranus_bigtts',
    synthesize: async (input) => {
      timeoutMs = input.timeoutMs;
      return {
        audio: new Uint8Array([0xff, 0xfb, 0x90]),
        audioByteLength: 3,
        ok: true,
        requestId: 'probe-request',
      };
    },
  });

  assert.deepEqual(result, { code: 'ok', ok: true });
  assert.equal(timeoutMs, 30_000);
});
