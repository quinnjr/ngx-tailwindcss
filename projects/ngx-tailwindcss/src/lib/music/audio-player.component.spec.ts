import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
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
});
