import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TwHoverClassDirective } from './hover-class.directive';

@Component({
  template: `<div
    twHoverClass="bg-blue-500"
    hoverClassBase="bg-white"
    [hoverDisabled]="disabled"
    class="bg-white"
    data-testid="hover"
  >
    Hover
  </div>`,
  standalone: true,
  imports: [TwHoverClassDirective],
})
class HoverHostComponent {
  disabled = false;
}

@Component({
  template: `<div
    twHoverClass="bg-blue-600 text-white"
    class="bg-blue-500 text-white p-2"
    data-testid="hover"
  >
    Hover
  </div>`,
  standalone: true,
  imports: [TwHoverClassDirective],
})
class ConflictHostComponent {}

@Component({
  template: `<div
    twHoverClass="bg-gray-300"
    [class]="selected() ? 'bg-blue-600' : 'bg-gray-200'"
    data-testid="hover"
  >
    Toggle
  </div>`,
  standalone: true,
  imports: [TwHoverClassDirective],
})
class ToggleHostComponent {
  readonly selected = signal(false);
}

describe('TwHoverClassDirective', () => {
  it('should swap out conflicting element classes while hovered and restore them on leave', () => {
    // Tailwind 4 orders bg-blue-500 before bg-blue-600 regardless of class order,
    // so the static class must be removed for the hover class to win either way
    const fixture = TestBed.createComponent(ConflictHostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="hover"]') as HTMLElement;

    el.dispatchEvent(new Event('mouseenter'));
    expect(el.classList.contains('bg-blue-600')).toBe(true);
    expect(el.classList.contains('bg-blue-500')).toBe(false);
    expect(el.classList.contains('p-2')).toBe(true);

    el.dispatchEvent(new Event('mouseleave'));
    expect(el.classList.contains('bg-blue-600')).toBe(false);
    expect(el.classList.contains('bg-blue-500')).toBe(true);
    // A hover class the element already had is not stripped on leave
    expect(el.classList.contains('text-white')).toBe(true);
    expect(el.classList.contains('p-2')).toBe(true);
  });

  it('should not restore a conflicting class replaced by a binding while hovered', () => {
    const fixture = TestBed.createComponent(ToggleHostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="hover"]') as HTMLElement;

    el.dispatchEvent(new Event('mouseenter'));
    expect(el.classList.contains('bg-gray-200')).toBe(false);

    fixture.componentInstance.selected.set(true);
    fixture.detectChanges();
    expect(el.classList.contains('bg-blue-600')).toBe(true);

    el.dispatchEvent(new Event('mouseleave'));
    expect(el.classList.contains('bg-blue-600')).toBe(true);
    expect(el.classList.contains('bg-gray-200')).toBe(false);
    expect(el.classList.contains('bg-gray-300')).toBe(false);
  });

  it('should remove hover classes on leave even if disabled while hovered', () => {
    const fixture = TestBed.createComponent(HoverHostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="hover"]') as HTMLElement;

    el.dispatchEvent(new Event('mouseenter'));
    expect(el.classList.contains('bg-blue-500')).toBe(true);
    expect(el.classList.contains('bg-white')).toBe(false);

    fixture.componentInstance.disabled = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    el.dispatchEvent(new Event('mouseleave'));
    expect(el.classList.contains('bg-blue-500')).toBe(false);
    expect(el.classList.contains('bg-white')).toBe(true);
  });
});
