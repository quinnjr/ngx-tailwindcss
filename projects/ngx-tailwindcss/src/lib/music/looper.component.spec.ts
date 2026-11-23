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
});
