import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('should keep the spotify playhead fill >= 3:1 against the buffered range', () => {
    fixture.componentRef.setInput('variant', 'spotify');
    fixture.componentRef.setInput('buffered', 150);
    fixture.detectChanges();

    // The thumb is hover-only, so the fill marks the position: emerald-500 was ~1.9:1 on
    // the slate-500 buffered range
    expect(slider().querySelector('.bg-slate-500')).not.toBeNull();
    expect(slider().querySelector('.bg-emerald-500')).toBeNull();
    const fill = slider().querySelector<HTMLElement>('.bg-emerald-300')!;
    expect(fill.style.width).toBe('32.5%');
  });

  it('should not leave a stale hover preview after a drag released off the track', () => {
    const track = slider();
    // jsdom's AbortSignal does not mix with zone.js-patched document listeners: capture them
    const listeners: Record<string, (e: Event) => void> = {};
    vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string,
      listener: (e: Event) => void
    ) => {
      listeners[type] = listener;
    }) as typeof document.addEventListener);
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 8 })
    );
    track.dispatchEvent(new MouseEvent('mousemove', { clientX: 50 }));
    fixture.detectChanges();
    expect(track.querySelector('.w-px')).not.toBeNull();
    track.dispatchEvent(new MouseEvent('mousedown', { clientX: 50 }));
    // The pointer leaves the track mid-drag and is released elsewhere
    track.dispatchEvent(new MouseEvent('mouseleave'));
    listeners['mouseup'](new MouseEvent('mouseup'));
    fixture.detectChanges();

    expect(track.querySelector('.w-px')).toBeNull();
    vi.restoreAllMocks();
  });
  it('should scale sprite frames to the preview size', () => {
    fixture.componentRef.setInput('showThumbnailPreview', true);
    fixture.componentRef.setInput('thumbnailWidth', 160);
    fixture.componentRef.setInput('thumbnailHeight', 90);
    fixture.componentRef.setInput('thumbnailSprite', {
      url: 'sprite.jpg',
      frameWidth: 320,
      frameHeight: 180,
      columns: 5,
      interval: 10,
      totalFrames: 20,
    });
    const track = slider();
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 8 })
    );
    // 140s of 200s -> frame 14 -> column 4, row 2
    track.dispatchEvent(new MouseEvent('mousemove', { clientX: 140 }));
    fixture.detectChanges();

    const frame = track.querySelector<HTMLElement>('div[style*="background-image"]')!;
    expect(frame.style.width).toBe('160px');
    expect(frame.style.backgroundSize).toBe('800px 360px');
    expect(frame.style.backgroundPosition).toBe('-640px -180px');
    vi.restoreAllMocks();
  });

  it('should keep the inside time readable on the light track and page', () => {
    fixture.componentRef.setInput('timePosition', 'inside');
    fixture.detectChanges();
    const times = [...slider().querySelectorAll('span')];
    expect(times.map(t => t.textContent?.trim())).toEqual(['1:05', '3:20']);
    for (const time of times) {
      // bare white text sat on the slate-200 track / white page (~1.2:1)
      expect(time.className).toContain('bg-slate-900/80');
      expect(time.className).toContain('text-white');
    }
  });

  it('should draw chapter markers in their own colour, or at 3:1 on the track by default', () => {
    fixture.componentRef.setInput('showMarkers', true);
    fixture.componentRef.setInput('markers', [
      { time: 20, label: 'Intro' },
      { time: 100, label: 'Chorus', color: 'rgb(255, 0, 0)' },
    ]);
    fixture.detectChanges();
    const markers = [...slider().querySelectorAll<HTMLElement>('[title]')];
    expect(markers.map(m => m.title)).toEqual(['Intro', 'Chorus']);
    // yellow-500 was ~1.6:1 on the light slate-200 track
    expect(markers[0].className).toContain('bg-slate-900');
    expect(markers[0].className).not.toContain('bg-yellow-500');
    expect(markers[0].style.backgroundColor).toBe('');
    // the marker's `color` was ignored
    expect(markers[1].style.backgroundColor).toBe('rgb(255, 0, 0)');
  });
});
