import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioContextService } from './audio-context.service';

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
  addEventListener = vi.fn();
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  minDecibels = -90;
  maxDecibels = -10;
  frequencyBinCount = 1024;
}

class MockGainNode extends MockAudioNode {
  gain = { value: 1 };
}

class MockAudioContext {
  state = 'running';
  sampleRate = 44_100;
  destination = new MockAudioNode();
  createMediaElementSource = vi.fn(() => new MockAudioNode());
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createGain = vi.fn(() => new MockGainNode());
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

describe('AudioContextService', () => {
  let service: AudioContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AudioContextService],
    });

    service = TestBed.inject(AudioContextService);
  });

  describe('initialization', () => {
    it('should create the service', () => {
      expect(service).toBeTruthy();
    });

    it('should start with suspended state', () => {
      expect(service.state()).toBe('suspended');
    });

    it('should report not running initially', () => {
      expect(service.isRunning()).toBe(false);
    });

    it('should have zero sources initially', () => {
      expect(service.sourceCount()).toBe(0);
    });
  });

  describe('service methods exist', () => {
    it('should have getContext method', () => {
      expect(typeof service.getContext).toBe('function');
    });

    it('should have resume method', () => {
      expect(typeof service.resume).toBe('function');
    });

    it('should have suspend method', () => {
      expect(typeof service.suspend).toBe('function');
    });

    it('should have close method', () => {
      expect(typeof service.close).toBe('function');
    });

    it('should have connectMediaElement method', () => {
      expect(typeof service.connectMediaElement).toBe('function');
    });

    it('should have connectMediaStream method', () => {
      expect(typeof service.connectMediaStream).toBe('function');
    });

    it('should have connectAudioBuffer method', () => {
      expect(typeof service.connectAudioBuffer).toBe('function');
    });

    it('should have connectOscillator method', () => {
      expect(typeof service.connectOscillator).toBe('function');
    });

    it('should have createAnalyser method', () => {
      expect(typeof service.createAnalyser).toBe('function');
    });

    it('should have createGain method', () => {
      expect(typeof service.createGain).toBe('function');
    });

    it('should have createFilter method', () => {
      expect(typeof service.createFilter).toBe('function');
    });

    it('should have createCompressor method', () => {
      expect(typeof service.createCompressor).toBe('function');
    });

    it('should have createStereoPanner method', () => {
      expect(typeof service.createStereoPanner).toBe('function');
    });

    it('should have createDelay method', () => {
      expect(typeof service.createDelay).toBe('function');
    });

    it('should have getFrequencyData method', () => {
      expect(typeof service.getFrequencyData).toBe('function');
    });

    it('should have getTimeDomainData method', () => {
      expect(typeof service.getTimeDomainData).toBe('function');
    });

    it('should have binToFrequency method', () => {
      expect(typeof service.binToFrequency).toBe('function');
    });

    it('should have frequencyToBin method', () => {
      expect(typeof service.frequencyToBin).toBe('function');
    });
  });

  describe('media element connection tracking', () => {
    beforeEach(() => {
      vi.stubGlobal('AudioContext', MockAudioContext);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return the existing source when connecting the same element twice', async () => {
      const element = document.createElement('audio');

      const first = await service.connectMediaElement(element);
      const second = await service.connectMediaElement(element);

      expect(second.id).toBe(first.id);
      expect(service.sourceCount()).toBe(1);
    });

    it('should report whether an element is connected', async () => {
      const element = document.createElement('audio');
      expect(service.isElementConnected(element)).toBe(false);

      await service.connectMediaElement(element);
      expect(service.isElementConnected(element)).toBe(true);

      const other = document.createElement('audio');
      expect(service.isElementConnected(other)).toBe(false);
    });

    it('should clear element tracking on disconnect', async () => {
      const element = document.createElement('audio');
      const source = await service.connectMediaElement(element);

      service.disconnectSource(source.id);

      expect(service.isElementConnected(element)).toBe(false);
      expect(service.sourceCount()).toBe(0);

      // Reconnecting after disconnect creates a fresh source
      const reconnected = await service.connectMediaElement(element);
      expect(reconnected.id).not.toBe(source.id);
    });

    it('should reuse the media element node when reconnecting after disconnect', async () => {
      const element = document.createElement('audio');
      const ctx = service.getContext() as unknown as MockAudioContext;
      ctx.createMediaElementSource.mockImplementation(() => {
        if (ctx.createMediaElementSource.mock.calls.length > 1) {
          throw new DOMException('already connected', 'InvalidStateError');
        }
        return new MockAudioNode();
      });

      const first = await service.connectMediaElement(element);
      service.disconnectSource(first.id);
      const second = await service.connectMediaElement(element);

      expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
      expect(second.node).toBe(first.node);
    });
  });

  describe('microphone and context lifecycle', () => {
    beforeEach(() => {
      vi.stubGlobal('AudioContext', MockAudioContext);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should stop microphone tracks when the source is disconnected', async () => {
      const track = { stop: vi.fn() };
      const stream = { getTracks: () => [track] } as unknown as MediaStream;
      const ctx = service.getContext() as unknown as MockAudioContext & {
        createMediaStreamSource: ReturnType<typeof vi.fn>;
      };
      ctx.createMediaStreamSource = vi.fn(() => new MockAudioNode());
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
      });

      const source = await service.connectMicrophone();
      expect(track.stop).not.toHaveBeenCalled();

      service.disconnectSource(source.id);
      expect(track.stop).toHaveBeenCalledTimes(1);
    });

    it('should stop a running oscillator when its source is disconnected', async () => {
      const oscillator = Object.assign(new MockAudioNode(), {
        frequency: { value: 0 },
        type: 'sine',
        start: vi.fn(),
        stop: vi.fn(),
      });
      const ctx = service.getContext() as unknown as MockAudioContext & {
        createOscillator: ReturnType<typeof vi.fn>;
      };
      ctx.createOscillator = vi.fn(() => oscillator);

      const source = await service.connectOscillator();
      source.start();
      service.disconnectSource(source.id);

      expect(oscillator.stop).toHaveBeenCalledTimes(1);
      expect(oscillator.disconnect).toHaveBeenCalled();
      expect(service.sourceCount()).toBe(0);
    });

    it('should still disconnect a never-started buffer source', async () => {
      const bufferSource = Object.assign(new MockAudioNode(), {
        buffer: null as AudioBuffer | null,
        start: vi.fn(),
        stop: vi.fn(() => {
          throw new DOMException('not started', 'InvalidStateError');
        }),
      });
      const ctx = service.getContext() as unknown as MockAudioContext & {
        createBufferSource: ReturnType<typeof vi.fn>;
      };
      ctx.createBufferSource = vi.fn(() => bufferSource);

      const buffer = Object.create(null) as AudioBuffer;
      const source = await service.connectAudioBuffer(buffer);
      expect(() => {
        service.disconnectSource(source.id);
      }).not.toThrow();

      expect(bufferSource.disconnect).toHaveBeenCalled();
      expect(service.sourceCount()).toBe(0);
    });

    it('should reject with the HTTP status when an audio file fails to load', async () => {
      const ctx = service.getContext() as unknown as MockAudioContext & {
        decodeAudioData: ReturnType<typeof vi.fn>;
      };
      ctx.decodeAudioData = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          arrayBuffer: vi.fn(),
        })
      );

      await expect(service.loadAudioBuffer('/missing.mp3')).rejects.toThrow(/404/);
      expect(ctx.decodeAudioData).not.toHaveBeenCalled();
    });

    it('should forget loaded worklet modules when the context is closed', async () => {
      vi.stubGlobal('AudioWorkletNode', class {});
      const ctx = service.getContext() as unknown as MockAudioContext & {
        audioWorklet: { addModule: ReturnType<typeof vi.fn> };
      };
      ctx.audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };

      await service.loadWorkletModule('proc', '/proc.js');
      expect(service.workletModules().length).toBe(1);

      await service.close();
      expect(service.workletModules().length).toBe(0);
    });
  });

  describe('createAnalyser decibel range', () => {
    // Mirrors the Web Audio spec: a write that leaves minDecibels >= maxDecibels
    // throws IndexSizeError. Real nodes start at -100 / -30 dB.
    class StrictAnalyserNode extends MockAudioNode {
      fftSize = 2048;
      smoothingTimeConstant = 0.8;
      frequencyBinCount = 1024;
      private min = -100;
      private max = -30;
      get minDecibels(): number {
        return this.min;
      }
      set minDecibels(value: number) {
        if (value >= this.max) throw new DOMException('min >= max', 'IndexSizeError');
        this.min = value;
      }
      get maxDecibels(): number {
        return this.max;
      }
      set maxDecibels(value: number) {
        if (value <= this.min) throw new DOMException('max <= min', 'IndexSizeError');
        this.max = value;
      }
    }

    class StrictAudioContext extends MockAudioContext {
      override createAnalyser = vi.fn(() => new StrictAnalyserNode());
    }

    beforeEach(() => {
      vi.stubGlobal('AudioContext', StrictAudioContext);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('applies a range above the node default max without throwing', () => {
      const analyser = service.createAnalyser({ minDecibels: -20, maxDecibels: 0 });
      expect(analyser.minDecibels).toBe(-20);
      expect(analyser.maxDecibels).toBe(0);
    });

    it('applies the default range', () => {
      const analyser = service.createAnalyser();
      expect(analyser.minDecibels).toBe(-90);
      expect(analyser.maxDecibels).toBe(-10);
    });

    it('applies a range below the node default min without throwing', () => {
      const analyser = service.createAnalyser({ minDecibels: -140, maxDecibels: -110 });
      expect(analyser.minDecibels).toBe(-140);
      expect(analyser.maxDecibels).toBe(-110);
    });

    it('falls back to defaults for keys explicitly set to undefined', () => {
      const analyser = service.createAnalyser({
        fftSize: undefined,
        smoothingTimeConstant: undefined,
        minDecibels: undefined,
        maxDecibels: undefined,
      });
      expect(analyser.fftSize).toBe(2048);
      expect(analyser.smoothingTimeConstant).toBe(0.8);
      expect(analyser.minDecibels).toBe(-90);
      expect(analyser.maxDecibels).toBe(-10);
    });
  });

  describe('signals', () => {
    it('should have state signal', () => {
      expect(service.state).toBeDefined();
      expect(typeof service.state()).toBe('string');
    });

    it('should have isRunning signal', () => {
      expect(service.isRunning).toBeDefined();
      expect(typeof service.isRunning()).toBe('boolean');
    });

    it('should have sourceCount signal', () => {
      expect(service.sourceCount).toBeDefined();
      expect(typeof service.sourceCount()).toBe('number');
    });

    it('should have sources signal', () => {
      expect(service.sources).toBeDefined();
      expect(Array.isArray(service.sources())).toBe(true);
    });
  });
});
