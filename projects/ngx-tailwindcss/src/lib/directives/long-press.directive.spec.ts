import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TwLongPressDirective } from './long-press.directive';

@Component({
  template: `<button
    twLongPress
    [longPressDuration]="500"
    [longPressDisabled]="disabled()"
    (longPress)="longPresses = longPresses + 1"
    (pressEnd)="pressEnds = pressEnds + 1"
  >
    Hold
  </button>`,
  standalone: true,
  imports: [TwLongPressDirective],
})
class TestHostComponent {
  readonly disabled = signal(false);
  longPresses = 0;
  pressEnds = 0;
}

function pointer(type: string, init: { clientX?: number; clientY?: number } = {}): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  return event;
}

describe('TwLongPressDirective', () => {
  let host: TestHostComponent;
  let button: HTMLButtonElement;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
    button = fixture.nativeElement.querySelector('button');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits longPress after the configured duration', () => {
    button.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(500);
    expect(host.longPresses).toBe(1);
  });

  it('does not emit pressEnd when the pointer only hovers and leaves', () => {
    button.dispatchEvent(pointer('pointerleave'));
    expect(host.pressEnds).toBe(0);
  });

  it('emits pressEnd once when a short press is released', () => {
    button.dispatchEvent(pointer('pointerdown'));
    button.dispatchEvent(pointer('pointerup'));
    button.dispatchEvent(pointer('pointerleave'));
    expect(host.pressEnds).toBe(1);
  });

  it('cancels the long press on pointercancel (e.g. touch scrolling)', () => {
    button.dispatchEvent(pointer('pointerdown'));
    button.dispatchEvent(pointer('pointercancel'));
    vi.advanceTimersByTime(1000);
    expect(host.longPresses).toBe(0);
  });

  it('does not emit longPress when disabled while the press is held', () => {
    button.dispatchEvent(pointer('pointerdown'));
    host.disabled.set(true);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    expect(host.longPresses).toBe(0);
  });
});
