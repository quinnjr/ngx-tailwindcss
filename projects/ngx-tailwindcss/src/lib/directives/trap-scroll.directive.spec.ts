import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwTrapScrollDirective } from './trap-scroll.directive';

@Component({
  template: `<div twTrapScroll data-testid="scroller"></div>`,
  standalone: true,
  imports: [TwTrapScrollDirective],
})
class TestHostComponent {}

function setMetrics(el: HTMLElement, metrics: Record<string, number>): void {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(el, key, { configurable: true, value });
  }
}

function wheel(el: HTMLElement, deltaX: number, deltaY: number): WheelEvent {
  const event = new WheelEvent('wheel', { deltaX, deltaY, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

describe('TwTrapScrollDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    el = fixture.nativeElement.querySelector('[data-testid="scroller"]');
  });

  it('should prevent scrolling down at the bottom even with a fractional scrollTop', () => {
    setMetrics(el, { scrollTop: 499.5, clientHeight: 100, scrollHeight: 600 });
    expect(wheel(el, 0, 10).defaultPrevented).toBe(true);
  });

  it('should allow scrolling down when not at the bottom', () => {
    setMetrics(el, { scrollTop: 200, clientHeight: 100, scrollHeight: 600 });
    expect(wheel(el, 0, 10).defaultPrevented).toBe(false);
  });

  it('should prevent scrolling up at the top', () => {
    setMetrics(el, { scrollTop: 0, clientHeight: 100, scrollHeight: 600 });
    expect(wheel(el, 0, -10).defaultPrevented).toBe(true);
  });

  it('should allow scrolling left in RTL when not at the left edge', () => {
    el.style.direction = 'rtl';
    setMetrics(el, { scrollLeft: 0, clientWidth: 100, scrollWidth: 600 });
    expect(wheel(el, -10, 0).defaultPrevented).toBe(false);
    expect(wheel(el, 10, 0).defaultPrevented).toBe(true);
  });
});
