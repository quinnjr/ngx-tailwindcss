import { Component } from '@angular/core';
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

describe('TwHoverClassDirective', () => {
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
