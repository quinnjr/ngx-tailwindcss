import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwPanControlComponent } from './pan-control.component';

describe('TwPanControlComponent', () => {
  let fixture: ComponentFixture<TwPanControlComponent>;
  let component: TwPanControlComponent;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwPanControlComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwPanControlComponent);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('should leave center with arrow keys despite the center detent', () => {
    hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();

    expect(hostEl.getAttribute('aria-valuenow')).toBe('1');
    expect(hostEl.getAttribute('aria-valuetext')).toBe('R1');
  });

  it('should honour setDisabledState from the forms API', () => {
    component.setDisabledState(true);
    fixture.detectChanges();

    expect(hostEl.getAttribute('tabindex')).toBe('-1');
    expect(hostEl.getAttribute('aria-disabled')).toBe('true');

    hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    fixture.detectChanges();
    expect(hostEl.getAttribute('aria-valuenow')).toBe('0');
  });

  it('should not map stereo-width clicks into the -100..100 pan range', () => {
    fixture.componentRef.setInput('variant', 'stereo-width');
    fixture.detectChanges();
    component.writeValue(50);
    const received: number[] = [];
    component.registerOnChange(v => received.push(v));

    // Host-level mousedown (bubbled from the overlaid range input) must not set a pan value
    component.onMouseDown(new MouseEvent('mousedown', { clientX: 0 }));
    fixture.detectChanges();

    expect(received).toEqual([]);
  });

  it('should leave stereo-width keyboard handling to the native range input', () => {
    fixture.componentRef.setInput('variant', 'stereo-width');
    fixture.detectChanges();
    const received: number[] = [];
    component.registerOnChange(v => received.push(v));

    const range = hostEl.querySelector<HTMLInputElement>('input[type="range"]')!;
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    range.dispatchEvent(event);

    // Must not be swallowed by the host and must not drive width below 0
    expect(event.defaultPrevented).toBe(false);
    expect(received).toEqual([]);
  });
});
