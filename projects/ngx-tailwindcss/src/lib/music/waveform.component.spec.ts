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
});
