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

@Component({
  template: `<div
    twHoverClass="bg-red-600 ring-2"
    class="p-2"
    [class.bg-red-500]="hasError()"
    [class.ring-2]="focused()"
    data-testid="hover"
  >
    Error
  </div>`,
  standalone: true,
  imports: [TwHoverClassDirective],
})
class RemoveOnlyHostComponent {
  readonly hasError = signal(true);
  readonly focused = signal(false);
}

describe('TwHoverClassDirective', () => {
  it('should not restore a conflicting class a binding removed while hovered', () => {
    const fixture = TestBed.createComponent(RemoveOnlyHostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="hover"]') as HTMLElement;
    expect(el.classList.contains('bg-red-500')).toBe(true);

    el.dispatchEvent(new Event('mouseenter'));
    expect(el.classList.contains('bg-red-600')).toBe(true);
    expect(el.classList.contains('bg-red-500')).toBe(false);

    fixture.componentInstance.hasError.set(false);
    fixture.detectChanges();

    el.dispatchEvent(new Event('mouseleave'));
    expect(el.classList.contains('bg-red-500')).toBe(false);
    expect(el.classList.contains('bg-red-600')).toBe(false);
    expect(el.classList.contains('ring-2')).toBe(false);
    expect(el.classList.contains('p-2')).toBe(true);
    // The element's own classList is no longer wrapped after leaving
    expect(Object.hasOwn(el, 'classList')).toBe(false);
  });

  it('should keep a hover class that a binding asserted while hovered', () => {
    const fixture = TestBed.createComponent(RemoveOnlyHostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="hover"]') as HTMLElement;

    el.dispatchEvent(new Event('mouseenter'));
    fixture.componentInstance.focused.set(true);
    fixture.detectChanges();

    el.dispatchEvent(new Event('mouseleave'));
    expect(el.classList.contains('ring-2')).toBe(true);
    expect(el.classList.contains('bg-red-600')).toBe(false);
    expect(el.classList.contains('bg-red-500')).toBe(true);
  });

  it('should unwrap classList when destroyed while hovered', () => {
    const fixture = TestBed.createComponent(RemoveOnlyHostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="hover"]') as HTMLElement;

    el.dispatchEvent(new Event('mouseenter'));
    expect(Object.hasOwn(el, 'classList')).toBe(true);
    fixture.destroy();
    expect(Object.hasOwn(el, 'classList')).toBe(false);
  });

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
