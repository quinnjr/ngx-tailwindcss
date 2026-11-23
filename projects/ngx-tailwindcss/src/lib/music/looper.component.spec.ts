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

  it('should use page-readable, dark-mode-aware text on the transparent minimal variant', () => {
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.componentRef.setInput('showLayers', true);
    internals.layers.set([{ id: 1, audioBuffer: fakeBuffer, volume: 1, muted: false, name: 'L1' }]);
    internals.loopDuration.set(2);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // no fixed light text that would be ~1.5-2.6:1 on a light page
    for (const node of el.querySelectorAll('span, div')) {
      const classes = [...node.classList];
      for (const tone of ['text-slate-300', 'text-slate-400']) {
        if (classes.includes(tone)) {
          expect(classes.some(c => c.startsWith('dark:text-'))).toBe(true);
        }
      }
    }
    expect(el.querySelectorAll('.text-slate-600.dark\\:text-slate-400').length).toBeGreaterThan(0);
    expect(el.querySelectorAll('.text-slate-800.dark\\:text-slate-300').length).toBeGreaterThan(0);
    expect(el.querySelector('.bg-slate-800\\/50')).toBeNull();
    expect(el.querySelector('[aria-label="Overdub"] svg')!.classList).toContain('text-amber-700');
  });

  it('should keep the light text on the dark panel variants', () => {
    expect(internals.labelClass()).toBe('text-slate-400');
    expect(internals.valueClass()).toBe('text-slate-300');
    expect(internals.layerRowClass()).toBe('bg-slate-800/50');
  });

  it('should give unselected speed buttons >= 4.5:1 text on their slate-700 background', () => {
    fixture.componentRef.setInput('showSpeedControl', true);
    fixture.detectChanges();

    const half = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ].find(b => b.textContent?.trim() === '0.5x')!;
    expect(half.classList).toContain('bg-slate-700');
    expect(half.classList).toContain('text-slate-300');
    expect(half.classList).not.toContain('text-slate-400');
  });

  it('should expose the selected playback speed to assistive technology', () => {
    fixture.componentRef.setInput('showSpeedControl', true);
    fixture.detectChanges();
    const speed = (label: string) =>
      [
        ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
      ].find(b => b.textContent?.trim() === label)!;
    expect(speed('1x').getAttribute('aria-pressed')).toBe('true');
    expect(speed('2x').getAttribute('aria-pressed')).toBe('false');

    speed('2x').click();
    fixture.detectChanges();
    expect(speed('2x').getAttribute('aria-pressed')).toBe('true');
    expect(speed('1x').getAttribute('aria-pressed')).toBe('false');
  });

  it('should keep the white play/overdub icons at 3:1 on their hovered active fills', () => {
    internals.state.set('playing');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // white on green-500 was ~2.3:1, on amber-500 ~2.1:1
    const stop = el.querySelector('[aria-label="Stop"]')!;
    expect(stop.classList).toContain('enabled:hover:bg-green-700');
    expect(stop.classList).not.toContain('enabled:hover:bg-green-500');

    internals.state.set('overdubbing');
    fixture.detectChanges();
    const overdub = el.querySelector('[aria-label="Stop Overdub"]')!;
    expect(overdub.classList).toContain('enabled:hover:bg-amber-700');
    expect(overdub.classList).not.toContain('enabled:hover:bg-amber-500');
    internals.state.set('idle');
  });

  it('should keep the muted layer label and the hovered delete icon readable', () => {
    internals.layers.set([{ id: 1, audioBuffer: fakeBuffer, volume: 1, muted: true, name: 'L1' }]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // White "M" on red-500 was ~3.8:1
    const mute = el.querySelector('[aria-label="Unmute L1"]')!;
    expect(mute.classList).toContain('bg-red-600');
    expect(mute.classList).not.toContain('bg-red-500');

    // red-500 on its red-500/20 hover fill is ~2.6:1 on the light page under `minimal`
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    const del = el.querySelector('[aria-label="Delete L1"]')!;
    expect(del.classList).toContain('enabled:hover:text-red-700');
    expect(del.classList).toContain('dark:enabled:hover:text-red-500');
    expect(del.classList).not.toContain('enabled:hover:text-red-500');
    expect(del.classList).toContain('text-slate-600');
    internals.layers.set([]);
  });

  it('should keep the idle record icon at 3:1 against its tinted button', () => {
    const icon = (): SVGElement =>
      (fixture.nativeElement as HTMLElement).querySelector('[aria-label="Record"] svg')!;
    // red-500 on the red-500/20-30 fill was ~2.5-2.9:1 on a light page, ~2.8:1 over slate-800
    expect(icon().classList).toContain('text-red-400');
    expect(icon().classList).not.toContain('text-red-500');
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    expect(icon().classList).toContain('text-red-700');
    expect(icon().classList).toContain('dark:text-red-400');
  });

  it('should disable the layer, volume and speed controls when disabled', () => {
    fixture.componentRef.setInput('showSpeedControl', true);
    internals.layers.set([{ id: 1, audioBuffer: fakeBuffer, volume: 1, muted: false, name: 'L1' }]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const controls = () => [
      el.querySelector<HTMLButtonElement>('[aria-label="Mute L1"]')!,
      el.querySelector<HTMLInputElement>('[aria-label="L1 volume"]')!,
      el.querySelector<HTMLButtonElement>('[aria-label="Delete L1"]')!,
      el.querySelector<HTMLInputElement>('[aria-label="Master volume"]')!,
      ...[...el.querySelectorAll<HTMLButtonElement>('button')].filter(b =>
        /^\d(\.\d)?x$/.test(b.textContent?.trim() ?? '')
      ),
    ];
    expect(controls()).toHaveLength(7);
    expect(controls().every(c => !c.disabled)).toBe(true);

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(controls().every(c => c.disabled)).toBe(true);

    // A disabled looper no longer deletes layers on click
    el.querySelector<HTMLButtonElement>('[aria-label="Delete L1"]')!.click();
    expect(internals.layers().length).toBe(1);
    internals.layers.set([]);
  });

  it('should visibly dim the transport buttons when disabled', () => {
    internals.layers.set([{ id: 1, audioBuffer: fakeBuffer, volume: 1, muted: false, name: 'L1' }]);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    for (const label of ['Record', 'Play', 'Overdub', 'Clear All']) {
      const button = el.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
      expect(button.disabled).toBe(true);
      expect(button.classList).toContain('disabled:opacity-50');
      // Size classes from the [class] binding are kept alongside
      expect(button.classList).toContain('rounded-full');
    }
    internals.layers.set([]);
  });

  it('should not change disabled buttons colour on hover', () => {
    internals.layers.set([{ id: 1, audioBuffer: fakeBuffer, volume: 1, muted: false, name: 'L1' }]);
    fixture.componentRef.setInput('disabled', true);
    fixture.componentRef.setInput('showSpeedControl', true);
    fixture.detectChanges();
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      // Hover fills only apply while enabled, so disabled buttons stay visibly inert
      const hover = [...button.classList].filter(c => c.includes('hover:'));
      for (const c of hover)
        expect(c, button.getAttribute('aria-label') ?? '').toMatch(/enabled:hover:/);
    }
    internals.layers.set([]);
  });
});
