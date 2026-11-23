import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwFaderComponent } from './fader.component';

describe('TwFaderComponent', () => {
  let fixture: ComponentFixture<TwFaderComponent>;
  let component: TwFaderComponent;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwFaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwFaderComponent);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  describe('ControlValueAccessor', () => {
    it('writeValue should update the rendered value', () => {
      component.writeValue(6);
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('6');
    });

    it('writeValue should fall back to the default value for null', () => {
      component.writeValue(null as unknown as number);
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('0');
    });

    it('registerOnChange callback should fire on keyboard changes', () => {
      const received: number[] = [];
      component.registerOnChange(value => received.push(value));

      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      fixture.detectChanges();

      expect(received).toContain(12); // default max
    });
  });

  describe('step precision', () => {
    it('should not leak floating-point noise into aria-valuenow on keyboard steps', () => {
      component.writeValue(0.2);
      fixture.detectChanges();

      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('0.3');
    });
  });

  describe('setDisabledState', () => {
    it('should reflect the disabled state on the host', () => {
      component.setDisabledState(true);
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-disabled')).toBe('true');
      expect(hostEl.getAttribute('tabindex')).toBe('-1');
    });

    it('should block keyboard interaction while disabled', () => {
      component.setDisabledState(true);
      fixture.detectChanges();

      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('0');
    });

    it('should re-enable interaction when cleared', () => {
      component.setDisabledState(true);
      fixture.detectChanges();
      component.setDisabledState(false);
      fixture.detectChanges();

      expect(hostEl.getAttribute('tabindex')).toBe('0');

      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      fixture.detectChanges();

      expect(hostEl.getAttribute('aria-valuenow')).toBe('12');
    });
  });

  describe('slider accessibility', () => {
    it('should expose the slider role and range', () => {
      expect(hostEl.getAttribute('role')).toBe('slider');
      expect(hostEl.getAttribute('aria-valuemin')).toBe('-60');
      expect(hostEl.getAttribute('aria-valuemax')).toBe('12');
      expect(hostEl.getAttribute('aria-valuetext')).toContain('dB');
    });
  });

  describe('peak hold', () => {
    const held = (): number =>
      (component as unknown as { peakHoldLevel(): number }).peakHoldLevel();

    it('should keep holding the peak while the level rises below it', () => {
      fixture.componentRef.setInput('peakLevel', 80);
      fixture.detectChanges();
      fixture.componentRef.setInput('peakLevel', 30);
      fixture.detectChanges();
      fixture.componentRef.setInput('peakLevel', 40);
      fixture.detectChanges();

      expect(held()).toBe(80);
    });

    it('should follow the level down once the hold time has elapsed', () => {
      vi.useFakeTimers();
      try {
        fixture.componentRef.setInput('peakHoldTime', 100);
        fixture.componentRef.setInput('peakLevel', 80);
        fixture.detectChanges();
        fixture.componentRef.setInput('peakLevel', 30);
        fixture.detectChanges();
        vi.advanceTimersByTime(150);
        expect(held()).toBe(30);

        fixture.componentRef.setInput('peakLevel', 0);
        fixture.detectChanges();
        expect(held()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('keyboard', () => {
    it('should not re-emit an unchanged value at the boundary', () => {
      const received: number[] = [];
      component.registerOnChange(value => received.push(value));
      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));

      expect(received).toEqual([12]);
    });

    it('should mark the control touched on keyboard interaction', () => {
      let touched = false;
      component.registerOnTouched(() => (touched = true));
      hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));

      expect(touched).toBe(true);
    });
  });
});
