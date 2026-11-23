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

@Component({
  template: `
    <div twTrapScroll data-testid="outer">
      <pre data-testid="inner" style="overflow-x: auto; overflow-y: auto">wide content</pre>
    </div>
  `,
  standalone: true,
  imports: [TwTrapScrollDirective],
})
class NestedHostComponent {}

describe('TwTrapScrollDirective with a scrollable descendant', () => {
  let outer: HTMLElement;
  let inner: HTMLElement;

  beforeEach(() => {
    const fixture = TestBed.createComponent(NestedHostComponent);
    fixture.detectChanges();
    outer = fixture.nativeElement.querySelector('[data-testid="outer"]');
    inner = fixture.nativeElement.querySelector('[data-testid="inner"]');
    // The host itself does not scroll
    setMetrics(outer, {
      scrollTop: 0,
      clientHeight: 100,
      scrollHeight: 100,
      scrollLeft: 0,
      clientWidth: 100,
      scrollWidth: 100,
    });
  });

  it('should let a scrollable descendant take the wheel', () => {
    setMetrics(inner, { scrollLeft: 0, clientWidth: 100, scrollWidth: 400 });
    expect(wheel(inner, 10, 0).defaultPrevented).toBe(false);
  });

  it('should block the wheel once the descendant reaches its edge', () => {
    setMetrics(inner, { scrollLeft: 300, clientWidth: 100, scrollWidth: 400 });
    expect(wheel(inner, 10, 0).defaultPrevented).toBe(true);
  });

  it('should still block the wheel on non-scrollable content', () => {
    expect(wheel(outer, 0, 10).defaultPrevented).toBe(true);
  });

  it('should let touch scrolling reach a scrollable descendant', () => {
    setMetrics(inner, { clientWidth: 100, scrollWidth: 400 });
    const event = new TouchEvent('touchmove', { cancelable: true, bubbles: true });
    inner.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
