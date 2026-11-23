import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwAutoFocusDirective } from './auto-focus.directive';
import { TwLazyImageDirective } from './lazy-image.directive';

@Component({
  template: `<input twAutoFocus />`,
  standalone: true,
  imports: [TwAutoFocusDirective],
})
class AutoFocusHostComponent {}

@Component({
  template: `<img twLazyImage="/real.png" alt="" lazyDisabled />`,
  standalone: true,
  imports: [TwLazyImageDirective],
})
class LazyImageHostComponent {}

describe('TwAutoFocusDirective', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('focuses the host element in the browser', async () => {
    const fixture = TestBed.createComponent(AutoFocusHostComponent);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    await new Promise(resolve => {
      setTimeout(resolve, 10);
    });

    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('input'));
    fixture.nativeElement.remove();
  });

  it('does not touch browser-only APIs on the server', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    vi.stubGlobal('requestAnimationFrame', undefined);

    const fixture = TestBed.createComponent(AutoFocusHostComponent);
    expect(() => {
      fixture.detectChanges();
    }).not.toThrow();
  });
});

describe('TwLazyImageDirective (no Image constructor, e.g. SSR)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets the real source directly instead of throwing', () => {
    vi.stubGlobal('Image', undefined);

    const fixture = TestBed.createComponent(LazyImageHostComponent);
    expect(() => {
      fixture.detectChanges();
    }).not.toThrow();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('/real.png');
  });
});
