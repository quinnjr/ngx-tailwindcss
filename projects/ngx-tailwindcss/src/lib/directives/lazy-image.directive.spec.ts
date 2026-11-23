import { Component, NgZone, provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyImageEvent, TwLazyImageDirective } from './lazy-image.directive';

@Component({
  template: `<img twLazyImage="/real.jpg" alt="" (lazyLoaded)="onLoaded($event)" />`,
  standalone: true,
  imports: [TwLazyImageDirective],
})
class TestHostComponent {
  events: LazyImageEvent[] = [];
  loadedInZone: boolean[] = [];

  onLoaded(event: LazyImageEvent): void {
    this.events.push(event);
    this.loadedInZone.push(NgZone.isInAngularZone());
  }
}

/** Preload image stub that fires `load` asynchronously once a source is set */
class FakeImage extends EventTarget {
  set src(_value: string) {
    setTimeout(() => this.dispatchEvent(new Event('load')));
  }
}

describe('TwLazyImageDirective', () => {
  let observerCallback: IntersectionObserverCallback | null;

  beforeEach(() => {
    // Zone-based apps rely on the zone to run change detection after `lazyLoaded`
    TestBed.configureTestingModule({ providers: [provideZoneChangeDetection()] });
    observerCallback = null;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          observerCallback = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      }
    );
    vi.stubGlobal('Image', FakeImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should emit lazyLoaded inside the Angular zone when the observer fires outside it', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');

    // Browsers invoke IntersectionObserver callbacks outside the Angular zone
    TestBed.inject(NgZone).runOutsideAngular(() => {
      const entry: Partial<IntersectionObserverEntry> = { isIntersecting: true };
      observerCallback!([entry as IntersectionObserverEntry], null as never);
    });
    await new Promise(resolve => {
      setTimeout(resolve, 10);
    });

    expect(img.getAttribute('src')).toBe('/real.jpg');
    expect(fixture.componentInstance.events).toEqual([{ loaded: true, src: '/real.jpg' }]);
    expect(fixture.componentInstance.loadedInZone).toEqual([true]);
  });
});
