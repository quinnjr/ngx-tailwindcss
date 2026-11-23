import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwAudioStatsComponent } from './audio-stats.component';

describe('TwAudioStatsComponent', () => {
  let fixture: ComponentFixture<TwAudioStatsComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwAudioStatsComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwAudioStatsComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('showQualityIndicator', true);
    fixture.componentRef.setInput('showCodecDetails', true);
  });

  it('should resolve hyphenated codec names such as AAC-LC', () => {
    fixture.componentRef.setInput('codec', 'AAC-LC');
    fixture.detectChanges();

    expect(el.textContent).toContain('Low Complexity AAC');
  });

  it('should not label a WAV file without a codec as lossy', () => {
    fixture.componentRef.setInput('format', 'wav');
    fixture.detectChanges();

    expect(el.textContent).toContain('Lossless');
    expect(el.textContent).not.toContain('Lossy');
  });
});
