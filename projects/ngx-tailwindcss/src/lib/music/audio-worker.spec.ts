import { describe, expect, it } from 'vitest';
import {
  BeatDetectionResult,
  FFTProcessResult,
  getWorkerScript,
  handleMessage,
  LevelResult,
  TimeDomainResult,
  WaveformDownsampleResult,
  WorkerMessage,
} from './audio-worker';

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

  describe('edge cases (no NaN on empty/short input)', () => {
    it('processFFT fills output bins past the input with 0', () => {
      const result = run('processFFT', {
        frequencyData: Array.from({ length: 32 }).fill(100),
        outputBins: 64,
      }) as FFTProcessResult;
      expect(result.processedData.every(Number.isFinite)).toBe(true);
      expect(result.processedData[63]).toBe(0);
      expect(Number.isFinite(result.averageLevel)).toBe(true);
    });

    it('processFFT handles empty input', () => {
      for (const logarithmic of [false, true]) {
        const result = run('processFFT', { frequencyData: [], logarithmic }) as FFTProcessResult;
        expect(result.processedData.every(Number.isFinite)).toBe(true);
      }
    });

    it('detectBeat returns 0 energy for an empty band', () => {
      const result = run('detectBeat', {
        frequencyData: [],
        energyHistory: [],
      }) as BeatDetectionResult;
      expect(result.energy).toBe(0);
      expect(result.updatedHistory).toEqual([0]);
      expect(result.isBeat).toBe(false);
    });

    it('downsampleWaveform never yields NaN when upsampling', () => {
      for (const method of ['minmax', 'average', 'rms'] as const) {
        const result = run('downsampleWaveform', {
          samples: [0.5, -0.5, 0.25],
          outputLength: 10,
          method,
        }) as WaveformDownsampleResult;
        expect(result.data).toHaveLength(10);
        expect(result.data.every(Number.isFinite)).toBe(true);
        expect((result.minValues ?? []).every(Number.isFinite)).toBe(true);
        expect((result.maxValues ?? []).every(Number.isFinite)).toBe(true);
      }
    });

    it('downsampleWaveform handles empty input', () => {
      const result = run('downsampleWaveform', {
        samples: [],
        outputLength: 4,
      }) as WaveformDownsampleResult;
      expect(result.data).toEqual([0, 0, 0, 0]);
    });

    it('processTimeDomain and calculateLevels handle empty input', () => {
      const td = run('processTimeDomain', { timeDomainData: [] }) as TimeDomainResult;
      expect(td.rms).toBe(0);
      const levels = run('calculateLevels', { data: [] }) as LevelResult;
      expect(levels.rms).toBe(0);
    });

    it('smoothData returns an empty array for empty input', () => {
      const result = run('smoothData', { data: [] }) as { data: number[] };
      expect(result.data).toEqual([]);
    });

    it('rejects inherited Object.prototype keys as unknown message types', () => {
      const event = { data: { id: '1', type: 'constructor', data: {} } };
      const response = handleMessage(event as unknown as MessageEvent<WorkerMessage>);
      expect(response.error).toBe('Unknown message type: constructor');
      expect(response.result).toBeNull();
    });

    it('generated worker script still evaluates (handlers stay closure-free)', () => {
      const posted: unknown[] = [];
      const self: {
        onmessage?: (e: { data: WorkerMessage }) => void;
        postMessage: (m: unknown) => void;
      } = { postMessage: m => posted.push(m) };
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func -- evaluating the generated worker script is what is under test
      new Function('self', getWorkerScript())(self);
      self.onmessage!({
        data: { id: 'x', type: 'downsampleWaveform', data: { samples: [1], outputLength: 3 } },
      });
      expect(posted).toEqual([
        {
          id: 'x',
          type: 'downsampleWaveform',
          result: { data: [1, 1, 1], minValues: [1, 1, 1], maxValues: [1, 1, 1] },
        },
      ]);
    });
  });
});
