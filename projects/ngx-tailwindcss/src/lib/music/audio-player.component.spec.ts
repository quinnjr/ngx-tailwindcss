import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwAudioPlayerComponent } from './audio-player.component';
import { TwScrubberComponent } from './scrubber.component';
import { TwTransportComponent } from './transport.component';

describe('TwAudioPlayerComponent', () => {
  let fixture: ComponentFixture<TwAudioPlayerComponent>;
  let audio: HTMLAudioElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwAudioPlayerComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwAudioPlayerComponent);
    fixture.componentRef.setInput('variant', 'full');
    fixture.detectChanges();
    audio = (fixture.nativeElement as HTMLElement).querySelector('audio')!;
    // Pretend a 200s track is loaded
    (fixture.componentInstance as unknown as { duration: { set(v: number): void } }).duration.set(
      200
    );
    fixture.detectChanges();
  });

  it('should seek to the scrubber time in seconds', () => {
    const scrubber = fixture.debugElement.query(By.directive(TwScrubberComponent))
      .componentInstance as TwScrubberComponent;
    scrubber.seek.emit(50);

    expect(audio.currentTime).toBe(50);
  });

  it('should wire the transport skip buttons', () => {
    audio.currentTime = 50;
    const transport = fixture.debugElement.query(By.directive(TwTransportComponent))
      .componentInstance as TwTransportComponent;

    transport.onSkipNext();
    expect(audio.currentTime).toBe(60);

    transport.onSkipPrevious();
    expect(audio.currentTime).toBe(50);
  });

  it('should not render a bogus "/ 0:00" total next to the time displays', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('/');
  });

  it('should follow volume/muted/loop input changes after init', () => {
    fixture.componentRef.setInput('volume', 0.3);
    fixture.componentRef.setInput('muted', true);
    fixture.componentRef.setInput('loop', true);
    fixture.detectChanges();

    expect(audio.volume).toBeCloseTo(0.3);
    expect(audio.muted).toBe(true);
    expect(audio.loop).toBe(true);
  });

  it('should clamp an out-of-range volume input instead of throwing', () => {
    fixture.componentRef.setInput('volume', 80);
    expect(() => {
      fixture.detectChanges();
    }).not.toThrow();
    expect(audio.volume).toBe(1);
  });

  it('should give the icon-only mute button an accessible name', () => {
    const mute = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="Mute"]'
    )!;
    expect(mute).toBeTruthy();
    mute.click();
    fixture.detectChanges();
    expect(mute.getAttribute('aria-label')).toBe('Unmute');
  });

  it('should handle a rejected play() (e.g. blocked by autoplay policy)', () => {
    const rejection = Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    rejection.catch(() => undefined); // keep the test itself free of unhandled noise
    const thenSpy = vi.spyOn(rejection, 'then');
    audio.play = () => rejection;
    const transport = fixture.debugElement.query(By.directive(TwTransportComponent))
      .componentInstance as TwTransportComponent;

    transport.play.emit();

    expect(thenSpy).toHaveBeenCalled();
  });
});
