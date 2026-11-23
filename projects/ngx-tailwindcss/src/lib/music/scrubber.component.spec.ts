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

  it('should not clip the thumb or the hover time preview with the track', () => {
    const track = slider();
    track.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }));
    fixture.detectChanges();
    const preview = track.querySelector<HTMLElement>('div[class*="-top-8"]')!;
    expect(preview).toBeTruthy();

    // No element between the preview and the track (inclusive) may clip it
    for (let node: HTMLElement | null = preview; node; node = node.parentElement) {
      expect(node.classList).not.toContain('overflow-hidden');
      if (node === track) break;
    }
  });

  it('should reveal the youtube thumb when hovering the track', () => {
    fixture.componentRef.setInput('variant', 'youtube');
    fixture.detectChanges();

    expect(slider().classList).toContain('group');
    const thumb = slider().querySelector<HTMLElement>('.bg-red-600.rounded-full')!;
    expect(thumb.classList).toContain('group-hover:opacity-100');
  });
});
