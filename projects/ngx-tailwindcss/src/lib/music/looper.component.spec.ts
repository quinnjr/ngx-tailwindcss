import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwLooperComponent } from './looper.component';

describe('TwLooperComponent', () => {
  let fixture: ComponentFixture<TwLooperComponent>;
  let internals: any;

  const fakeBuffer = { duration: 2, getChannelData: () => new Float32Array(16) } as unknown;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwLooperComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwLooperComponent);
    internals = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should contain the count-in overlay within the looper (positioned container)', () => {
    internals.isCountingIn.set(true);
    internals.countInBeat.set(1);
    fixture.detectChanges();

    const container = fixture.nativeElement.firstElementChild as HTMLElement;
    const overlay = container.querySelector<HTMLElement>('.absolute.inset-0')!;
    expect(overlay).toBeTruthy();
    expect(overlay.parentElement).toBe(container);
    expect(container.classList).toContain('relative');
  });

  it('should enable redo after an undo (canRedo is reactive)', () => {
    internals.layers.set([{ id: 1, audioBuffer: fakeBuffer, volume: 1, muted: false, name: 'L1' }]);
    expect(internals.canRedo()).toBe(false);

    internals.undo();
    expect(internals.canRedo()).toBe(true);

    internals.redo();
    expect(internals.canRedo()).toBe(false);
    expect(internals.layers().length).toBe(1);
  });

  it('should stop the undone layer if it is playing', () => {
    let stopped = false;
    internals.layers.set([{ id: 1, audioBuffer: fakeBuffer, volume: 1, muted: false, name: 'L1' }]);
    internals.sourceNodes = [
      {
        stop: () => {
          stopped = true;
        },
      },
    ];
    internals.gainNodes = [{}];

    internals.undo();

    expect(stopped).toBe(true);
    expect(internals.sourceNodes.length).toBe(0);
  });

  it('should defer auto-play until the recording has been decoded', () => {
    internals.state.set('recording');

    void internals.stopRecording();

    expect(internals.state()).toBe('stopped');
    expect(internals.pendingAutoPlay).toBe(true);
  });

  it('should stop an in-progress recording when cleared', () => {
    const recorder = { state: 'recording', onstop: () => {}, stop: vi.fn() };
    internals.mediaRecorder = recorder;
    internals.clickTrackTimer = setInterval(() => {}, 1000);
    internals.layers.set([{ id: 1, audioBuffer: fakeBuffer, volume: 1, muted: false, name: 'L1' }]);
    internals.state.set('overdubbing');

    internals.clear();

    expect(recorder.stop).toHaveBeenCalled();
    expect(recorder.onstop).toBeNull();
    expect(internals.mediaRecorder).toBeNull();
    expect(internals.clickTrackTimer).toBeNull();
    expect(internals.state()).toBe('idle');
  });

  it('should ignore record() while a take is already in progress', async () => {
    const initSpy = vi.spyOn(internals, 'initAudio');
    internals.state.set('overdubbing');

    await internals.record();

    expect(initSpy).not.toHaveBeenCalled();
  });

  it('should ignore overdub() while a take is already in progress', async () => {
    const initSpy = vi.spyOn(internals, 'initAudio');
    internals.loopDuration.set(2);
    internals.state.set('recording');

    await internals.overdub();

    expect(initSpy).not.toHaveBeenCalled();
  });

  it('should not start a second take while the first is still being set up', async () => {
    let resolveInit!: () => void;
    const initSpy = vi.spyOn(internals, 'initAudio').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveInit = resolve;
        })
    );

    const first = internals.record();
    await internals.record();
    expect(initSpy).toHaveBeenCalledTimes(1);

    resolveInit();
    await first;
  });

  it('should not start a take that was cleared while being set up', async () => {
    let resolveInit!: () => void;
    vi.spyOn(internals, 'initAudio').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveInit = resolve;
        })
    );
    internals.audioContext = { currentTime: 0, close: () => Promise.resolve() };
    internals.mediaStream = {};

    const take = internals.record();
    internals.clear();
    resolveInit();
    await take;

    expect(internals.state()).toBe('idle');
    expect(internals.mediaRecorder).toBeNull();
  });

  it('should finish the take (and not auto-play) when stopped while recording', () => {
    const recorder = { state: 'recording', onstop: () => {}, stop: vi.fn() };
    internals.mediaRecorder = recorder;
    internals.state.set('recording');

    internals.stop();

    expect(recorder.stop).toHaveBeenCalled();
    expect(internals.state()).toBe('stopped');
    expect(internals.pendingAutoPlay).toBe(false);
  });

  it('should silence a loop that kept playing under a new take once it stops', () => {
    // record() while playing leaves the existing layers running during the take
    const source = { stop: vi.fn() };
    internals.sourceNodes = [source];
    internals.gainNodes = [{}];
    internals.mediaRecorder = { state: 'recording', onstop: () => {}, stop: vi.fn() };
    internals.state.set('recording');

    void internals.stopRecording();

    expect(internals.state()).toBe('stopped');
    expect(source.stop).toHaveBeenCalled();
    expect(internals.sourceNodes.length).toBe(0);
  });

  it('should keep the loop playing when an overdub stops', () => {
    const source = { stop: vi.fn() };
    internals.sourceNodes = [source];
    internals.gainNodes = [{}];
    internals.mediaRecorder = { state: 'recording', onstop: () => {}, stop: vi.fn() };
    internals.state.set('overdubbing');

    void internals.stopRecording();

    expect(internals.state()).toBe('playing');
    expect(source.stop).not.toHaveBeenCalled();
  });

  it('should draw positive samples above the centre of the loop waveform', () => {
    const points: Array<[number, number]> = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === 'lineTo' || prop === 'moveTo'
            ? (x: number, y: number) => points.push([x, y])
            : () => {},
        set: () => true,
      }
    );
    const canvas = internals.waveformCanvas().nativeElement as HTMLCanvasElement;
    canvas.width = 2;
    canvas.height = 100;
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
    const data = new Float32Array([1, 1, 1, 1]);
    internals.layers.set([
      {
        id: 1,
        audioBuffer: { duration: 1, getChannelData: () => data },
        volume: 1,
        muted: false,
        name: 'L1',
      },
    ]);

    internals.drawWaveform();

    // Second column: lineTo(min) then lineTo(max), both at +1 => top edge
    expect(points[1][1]).toBe(0);
    expect(points[2][1]).toBe(0);
  });
  it('should not draw full-height spikes past the end of a short loop buffer', () => {
    const ys: number[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop) => (prop === 'lineTo' ? (_x: number, y: number) => ys.push(y) : () => {}),
        set: () => true,
      }
    );
    const canvas = internals.waveformCanvas().nativeElement as HTMLCanvasElement;
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
    // md canvas is 300 px wide; 301 samples made the old ceil()'d step (2)
    // run out of samples after column 150
    const data = new Float32Array(301).fill(0);
    internals.layers.set([
      {
        id: 1,
        audioBuffer: { duration: 1, getChannelData: () => data },
        volume: 1,
        muted: false,
        name: 'L1',
      },
    ]);

    internals.drawWaveform();

    // Silence plots on the centre line (height 80) in every column
    expect(ys.length).toBeGreaterThan(0);
    expect(ys.every(y => y === 40)).toBe(true);
  });

  it('should not render low-contrast slate-500 text on the dark panel', () => {
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.text-slate-500')).toHaveLength(
      0
    );
  });
});
