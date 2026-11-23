import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwWaveformComponent } from './waveform.component';

describe('TwWaveformComponent', () => {
  let fixture: ComponentFixture<TwWaveformComponent>;
  let component: TwWaveformComponent;
  let internals: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwWaveformComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwWaveformComponent);
    component = fixture.componentInstance;
    internals = component;
    fixture.detectChanges();
  });

  it('should expose the seekable canvas as a keyboard-operable slider', () => {
    fixture.componentRef.setInput('progress', 0.5);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    const seeks: number[] = [];
    component.seek.subscribe(v => seeks.push(v));

    expect(canvas.getAttribute('role')).toBe('slider');
    expect(canvas.getAttribute('tabindex')).toBe('0');
    expect(canvas.getAttribute('aria-valuenow')).toBe('50');

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));

    expect(seeks[0]).toBeCloseTo(0.51, 5);
    expect(seeks[1]).toBe(0);
  });

  it('should keep zoomToRegion inside the 0..1 range when zoom is clamped', () => {
    fixture.componentRef.setInput('maxZoom', 4);
    fixture.detectChanges();

    component.zoomToRegion(0.95, 1);

    expect(internals.zoomLevel()).toBe(4);
    expect(internals.panPosition()).toBeCloseTo(0.75, 10);
    expect(internals.visibleRange().end).toBeCloseTo(1, 10);
  });

  it('should produce peaks for buffers shorter than the canvas width', () => {
    const data = new Float32Array([0.5, -0.8, 0.2]);
    fixture.componentRef.setInput('audioBuffer', {
      getChannelData: () => data,
    });
    fixture.detectChanges();

    expect(Math.max(...internals.peakData)).toBeCloseTo(0.8, 5);
  });

  it('should draw the realtime line with positive samples above the centre', () => {
    fixture.componentRef.setInput('height', 100);
    fixture.detectChanges();
    const points: Array<[number, number]> = [];
    internals.ctx = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === 'lineTo' || prop === 'moveTo'
            ? (x: number, y: number) => points.push([x, y])
            : () => {},
        set: () => true,
      }
    );
    internals.timeDomainData = new Uint8Array([255, 0]);

    internals.drawRealTimeLine();

    expect(points[0][1]).toBeLessThan(50);
    expect(points[1][1]).toBeGreaterThan(50);
  });

  it('should position the zoom scrollbar thumb at the visible window', () => {
    fixture.componentRef.setInput('zoomable', true);
    fixture.detectChanges();
    component.setZoom(2, 0.75); // visible window 0.5..1

    expect(internals.panPosition()).toBeCloseTo(0.5, 10);
    expect(internals.scrollbarPosition()).toBeCloseTo(50, 10);
    expect(internals.scrollbarPosition() + internals.scrollbarWidth()).toBeCloseTo(100, 10);
  });

  it('should centre the visible window on a clicked scrollbar point', () => {
    fixture.componentRef.setInput('zoomable', true);
    fixture.detectChanges();
    component.setZoom(4, 0.125); // visible width 0.25
    const track = document.createElement('div');
    const rect = { left: 0, width: 100 };
    track.getBoundingClientRect = () => rect as unknown as DOMRect;

    component.onScrollbarDrag({
      clientX: 50,
      currentTarget: track,
      preventDefault: () => {},
    } as unknown as MouseEvent);

    expect(internals.visibleRange().start).toBeCloseTo(0.375, 10);
    expect(internals.visibleRange().end).toBeCloseTo(0.625, 10);
  });

  it('should clear the loading state when peaks supersede a pending buffer scan', () => {
    internals.loading.set(true);
    fixture.componentRef.setInput('peaks', [0.1, 0.2]);
    fixture.detectChanges();

    expect(internals.loading()).toBe(false);
  });

  it('should render the zoom scrollbar time labels readably on the dark strip', () => {
    fixture.componentRef.setInput('zoomable', true);
    fixture.componentRef.setInput('peaks', [0.1, 0.2, 0.3]);
    component.setZoom(4);
    fixture.detectChanges();
    const labels = [...fixture.nativeElement.querySelectorAll('div')].find((d: HTMLElement) =>
      d.classList.contains('text-[8px]')
    ) as HTMLElement;
    // slate-500 on the slate-800 strip was ~3:1
    expect(labels.classList).toContain('text-slate-300');
    expect(labels.classList).not.toContain('text-slate-500');
  });

  it('should render the time display readably over the always-dark canvas', () => {
    fixture.componentRef.setInput('duration', 60);
    fixture.componentRef.setInput('showTime', true);
    fixture.detectChanges();
    const time = [...fixture.nativeElement.querySelectorAll('div')].find(
      (d: HTMLElement) => d.classList.contains('text-xs') && d.classList.contains('font-mono')
    ) as HTMLElement;
    // slate-500 on the #1e293b canvas was ~2.9:1 on a light page
    expect(time.classList).toContain('text-slate-300');
    expect(time.classList).not.toContain('text-slate-500');
  });

  it('should draw a visible focus ring inside the seekable canvas', () => {
    fixture.componentRef.setInput('seekable', true);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    // An outside ring is clipped by the overflow-hidden container
    expect(canvas.parentElement!.className).toContain('overflow-hidden');
    expect(canvas.classList).toContain('focus-visible:outline-2');
    expect(canvas.classList).toContain('focus-visible:-outline-offset-2');
  });
});
