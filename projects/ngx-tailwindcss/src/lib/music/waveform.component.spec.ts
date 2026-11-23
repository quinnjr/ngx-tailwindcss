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

  it('should pan a zoomed view to follow keyboard seeking', () => {
    fixture.componentRef.setInput('zoomable', true);
    fixture.componentRef.setInput('progress', 0.5);
    fixture.detectChanges();
    component.setZoom(4, 0.5); // visible window 0.375..0.625
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(internals.visibleRange().end).toBeCloseTo(1, 10);

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(internals.visibleRange().start).toBeCloseTo(0, 10);
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

  it('should colour the whole visible line/mirror waveform as played once progress passes it', () => {
    const clips: number[] = [];
    internals.ctx = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === 'rect' ? (_x: number, _y: number, w: number) => clips.push(w) : () => {},
        set: () => true,
      }
    );
    internals.peakData = Array.from({ length: 100 }, () => 0.5);
    fixture.componentRef.setInput('progress', 1);
    fixture.detectChanges();

    internals.drawLine();
    internals.drawMirror();

    expect(clips).toEqual([internals.effectiveWidth(), internals.effectiveWidth()]);
  });

  it('should keep the progress overlay over the whole view when progress is past it', () => {
    fixture.componentRef.setInput('zoomable', true);
    fixture.componentRef.setInput('progress', 0.9);
    fixture.detectChanges();
    component.setZoom(4, 0.25); // visible window 0.125..0.375
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('.bg-blue-500\\/20') as HTMLElement;

    expect(overlay.style.display).toBe('block');
    expect(overlay.style.width).toBe('100%');
  });

  it('should show the hover time label inside the clipped container', () => {
    fixture.componentRef.setInput('duration', 60);
    fixture.detectChanges();
    internals.hoverPosition.set(0.5);
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.whitespace-nowrap') as HTMLElement;

    expect(label.textContent?.trim()).toBe('0:30');
    expect(label.classList).toContain('top-1');
    expect(label.classList).not.toContain('-top-6');
  });

  it('should keep the hover time label inside the view at the edges and below the zoom controls', () => {
    fixture.componentRef.setInput('duration', 60);
    fixture.componentRef.setInput('zoomable', true);
    fixture.detectChanges();
    const label = () => fixture.nativeElement.querySelector('.whitespace-nowrap') as HTMLElement;

    // At the left edge the label hangs right of the cursor, at the right edge left of it
    internals.hoverPosition.set(0);
    fixture.detectChanges();
    expect(label().style.transform).toMatch(/^translateX\((-)?0%\)$/);
    internals.hoverPosition.set(1);
    fixture.detectChanges();
    expect(label().style.transform).toBe('translateX(-100%)');

    // Zoom controls sit at the top-right: the label drops below them
    expect(label().classList).toContain('top-11');
    expect(label().classList).not.toContain('top-1');
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
