import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SwipeEvent, TwSwipeDirective } from './swipe.directive';

interface Point {
  clientX: number;
  clientY: number;
}

function touch(type: string, touches: Point[], changedTouches: Point[] = touches): Event {
  const event = new Event(type);
  Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : touches });
  Object.defineProperty(event, 'changedTouches', { value: changedTouches });
  return event;
}

@Component({
  template: `<div twSwipe (swipe)="swipes.push($event)" data-testid="area">Area</div>`,
  standalone: true,
  imports: [TwSwipeDirective],
})
class SwipeHostComponent {
  swipes: SwipeEvent[] = [];
}

describe('TwSwipeDirective', () => {
  function setup() {
    const fixture = TestBed.createComponent(SwipeHostComponent);
    fixture.detectChanges();
    const area = fixture.nativeElement.querySelector('[data-testid="area"]') as HTMLElement;
    return { fixture, area };
  }

  it('should emit a swipe for a fast single-finger gesture', () => {
    const { fixture, area } = setup();

    area.dispatchEvent(touch('touchstart', [{ clientX: 200, clientY: 10 }]));
    area.dispatchEvent(touch('touchend', [], [{ clientX: 50, clientY: 12 }]));

    expect(fixture.componentInstance.swipes.map(s => s.direction)).toEqual(['left']);
  });

  it('should not emit a swipe when a second finger joined the gesture (pinch)', () => {
    const { fixture, area } = setup();

    area.dispatchEvent(touch('touchstart', [{ clientX: 200, clientY: 10 }]));
    area.dispatchEvent(
      touch(
        'touchstart',
        [
          { clientX: 200, clientY: 10 },
          { clientX: 20, clientY: 10 },
        ],
        [{ clientX: 20, clientY: 10 }]
      )
    );
    area.dispatchEvent(touch('touchend', [], [{ clientX: 20, clientY: 10 }]));

    expect(fixture.componentInstance.swipes).toEqual([]);
  });

  it('should not reuse a stale start point after the gesture ended', () => {
    const { fixture, area } = setup();

    area.dispatchEvent(touch('touchstart', [{ clientX: 200, clientY: 10 }]));
    area.dispatchEvent(touch('touchcancel', []));
    area.dispatchEvent(touch('touchend', [], [{ clientX: 20, clientY: 10 }]));

    expect(fixture.componentInstance.swipes).toEqual([]);
  });
});
