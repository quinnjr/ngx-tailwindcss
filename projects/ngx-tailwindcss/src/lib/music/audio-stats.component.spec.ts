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

  it('should rate lossless formats given without a matching codec as lossless', () => {
    fixture.componentRef.setInput('format', 'flac');
    fixture.componentRef.setInput('showStorageEstimate', true);
    fixture.detectChanges();

    expect(el.textContent).toContain('Lossless Quality');
    // 16-bit/44.1 kHz stereo FLAC at ~60% of 1411.2 kbps, not the 256 kbps lossy guess
    expect(el.textContent).toContain('6.1 MB');

    fixture.componentRef.setInput('format', 'aiff');
    fixture.componentRef.setInput('codec', 'pcm');
    fixture.detectChanges();
    expect(el.textContent).toContain('Lossless Quality');
  });

  it('should make stat items keyboard-operable buttons that emit infoClick', () => {
    fixture.componentRef.setInput('duration', 90);
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.infoClick.subscribe(k => emitted.push(k));

    const item = el.querySelector<HTMLElement>('[role="button"]')!;
    expect(item.tabIndex).toBe(0);
    expect(item.getAttribute('aria-label')).toContain('Duration');

    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    item.dispatchEvent(enter);
    item.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));

    expect(emitted).toEqual(['duration', 'duration']);
    expect(enter.defaultPrevented).toBe(true);
  });
});
