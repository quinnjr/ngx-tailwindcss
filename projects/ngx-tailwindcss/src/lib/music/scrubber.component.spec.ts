import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwScrubberComponent } from './scrubber.component';

describe('TwScrubberComponent', () => {
  let fixture: ComponentFixture<TwScrubberComponent>;
  let el: HTMLElement;

  const slider = (): HTMLElement => el.querySelector<HTMLElement>('[role="slider"]')!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwScrubberComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwScrubberComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('duration', 200);
    fixture.componentRef.setInput('currentTime', 65);
    fixture.detectChanges();
  });

  it('should expose a human-readable slider value', () => {
    expect(slider().getAttribute('aria-valuetext')).toBe('1:05 of 3:20');
  });

  it('should expose the disabled state', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(slider().getAttribute('aria-disabled')).toBe('true');
    expect(slider().getAttribute('tabindex')).toBe('-1');
  });

  it('should not overfill the progress bar past the duration', () => {
    fixture.componentRef.setInput('currentTime', 250);
    fixture.detectChanges();

    const fill = slider().querySelector<HTMLElement>('.bg-blue-500')!;
    expect(fill.style.width).toBe('100%');
  });

  it('should emit seek times from the keyboard', () => {
    const seeks: number[] = [];
    fixture.componentInstance.seek.subscribe(t => seeks.push(t));
    slider().dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));

    expect(seeks).toEqual([200]);
  });
});
