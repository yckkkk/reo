class ReoPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = options.processorOptions ?? {};
    this.targetSampleRateHz = Math.max(
      1,
      Math.round(Number(processorOptions.targetSampleRateHz) || 16000)
    );
    const chunkDurationMs = Math.max(
      1,
      Math.round(Number(processorOptions.chunkDurationMs) || 200)
    );
    this.sourceStep = sampleRate / this.targetSampleRateHz;
    this.targetChunkBytes = Math.max(
      2,
      Math.round((this.targetSampleRateHz * chunkDurationMs) / 1000) * 2
    );
    this.pendingBytes = new Uint8Array(this.targetChunkBytes);
    this.pendingLength = 0;
    this.nextSourcePosition = 0;
    this.processedInputSamples = 0;
    this.port.onmessage = (event) => {
      if (event.data?.type === 'flush') {
        this.flush();
        this.port.postMessage({ type: 'flushed' });
      }
    };
  }

  appendSample(sample) {
    const clamped = Math.min(1, Math.max(-1, sample));
    const encoded = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
    this.pendingBytes[this.pendingLength] = encoded & 0xff;
    this.pendingBytes[this.pendingLength + 1] = (encoded >> 8) & 0xff;
    this.pendingLength += 2;
    if (this.pendingLength >= this.targetChunkBytes) {
      this.emitPending(this.targetChunkBytes);
    }
  }

  emitPending(byteLength) {
    if (byteLength <= 0) {
      return;
    }
    const chunk = this.pendingBytes.slice(0, byteLength);
    this.port.postMessage(chunk, [chunk.buffer]);
    this.pendingBytes.copyWithin(0, byteLength, this.pendingLength);
    this.pendingLength -= byteLength;
  }

  flush() {
    this.emitPending(this.pendingLength);
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) {
      return true;
    }

    const inputStart = this.processedInputSamples;
    const inputEnd = inputStart + input.length;
    while (this.nextSourcePosition <= inputEnd - 1) {
      const relativePosition = this.nextSourcePosition - inputStart;
      const lowerIndex = Math.max(0, Math.floor(relativePosition));
      const upperIndex = Math.min(input.length - 1, Math.ceil(relativePosition));
      const lowerSample = input[lowerIndex] ?? 0;
      const upperSample = input[upperIndex] ?? lowerSample;
      const ratio = relativePosition - Math.floor(relativePosition);
      this.appendSample(lowerSample + (upperSample - lowerSample) * ratio);
      this.nextSourcePosition += this.sourceStep;
    }
    this.processedInputSamples = inputEnd;
    return true;
  }
}

registerProcessor('reo-pcm-capture', ReoPcmCaptureProcessor);
