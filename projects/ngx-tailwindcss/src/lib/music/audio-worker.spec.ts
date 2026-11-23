import { describe, expect, it } from 'vitest';
import { FFTProcessResult, handleMessage, WorkerMessage } from './audio-worker';

function run(type: WorkerMessage['type'], data: unknown): unknown {
  const event = { data: { id: '1', type, data } };
  const response = handleMessage(event as MessageEvent<WorkerMessage>);
  expect(response.error).toBeUndefined();
  return response.result;
}

describe('audio-worker', () => {
  describe('processFFT', () => {
    it('should map the dominant output bin back to the input FFT bin frequency', () => {
      // 1024 input bins downsampled to 64 output bins => 16 input bins per output bin
      const frequencyData = Array.from({ length: 1024 }).fill(0);
      // Energy at input bins 160-175 => output bin 10
      for (let i = 160; i < 176; i++) frequencyData[i] = 255;

      const result = run('processFFT', {
        frequencyData,
        outputBins: 64,
        sampleRate: 48_000,
        fftSize: 2048,
      }) as FFTProcessResult;

      const binWidth = 48_000 / 2048;
      expect(result.dominantFrequency).toBeGreaterThanOrEqual(160 * binWidth);
      expect(result.dominantFrequency).toBeLessThan(176 * binWidth);
    });
  });
});
