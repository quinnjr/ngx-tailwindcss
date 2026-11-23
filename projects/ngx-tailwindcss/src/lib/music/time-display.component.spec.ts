import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwTimeDisplayComponent } from './time-display.component';

describe('TwTimeDisplayComponent', () => {
  let fixture: ComponentFixture<TwTimeDisplayComponent>;
  let component: TwTimeDisplayComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwTimeDisplayComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwTimeDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should format minutes and seconds', () => {
    expect(component.formatTime(65)).toBe('1:05');
  });

  it('should show hours automatically past one hour', () => {
    expect(component.formatTime(3725)).toBe('1:02:05');
  });

  it('should carry the full duration in minutes when hours are hidden', () => {
    fixture.componentRef.setInput('showHours', 'never');
    fixture.detectChanges();

    expect(component.formatTime(3900)).toBe('65:00');
  });

  it('should not lose a millisecond to floating-point noise', () => {
    fixture.componentRef.setInput('showMilliseconds', true);
    fixture.detectChanges();

    expect(component.formatTime(1.005)).toBe('0:01.005');
  });

  it('should render full minutes in the flip variant when hours are hidden', () => {
    fixture.componentRef.setInput('variant', 'flip');
    fixture.componentRef.setInput('showHours', 'never');
    fixture.componentRef.setInput('value', 3900);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.replaceAll(/\s/g, '')).toContain(
      '65:00'
    );
  });

  it('should count down in the flip variant when showRemaining is set', () => {
    fixture.componentRef.setInput('variant', 'flip');
    fixture.componentRef.setInput('showRemaining', true);
    fixture.componentRef.setInput('value', 30);
    fixture.componentRef.setInput('total', 90);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.replaceAll(/\s/g, '')).toBe('01:00');
  });
  it('should honour the mode in the flip variant', () => {
    const text = (): string | undefined =>
      (fixture.nativeElement as HTMLElement).textContent?.replaceAll(/\s/g, '');
    fixture.componentRef.setInput('variant', 'flip');
    fixture.componentRef.setInput('mode', 'bars');
    fixture.componentRef.setInput('bar', 12);
    fixture.componentRef.setInput('beat', 3);
    fixture.detectChanges();
    expect(text()).toBe('12.3');

    fixture.componentRef.setInput('mode', 'bpm');
    fixture.componentRef.setInput('bpm', 128);
    fixture.detectChanges();
    expect(text()).toBe('128.0BPM');
  });

  it('should show milliseconds in the flip variant', () => {
    fixture.componentRef.setInput('variant', 'flip');
    fixture.componentRef.setInput('showMilliseconds', true);
    fixture.componentRef.setInput('value', 65.25);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.replaceAll(/\s/g, '')).toBe(
      '01:05.250'
    );
  });
  it('should keep LED unit letters and flip separators at 4.5:1', () => {
    const root = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('variant', 'led');
    fixture.componentRef.setInput('mode', 'bpm');
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    // 'BPM' at emerald-400/50 was ~3.1:1 on the slate-900 display
    const letter = root.querySelector('[data-char="B"]')!;
    expect(letter.className).toContain('text-emerald-400/70');
    expect(letter.className).not.toContain('/50');

    fixture.componentRef.setInput('variant', 'flip');
    fixture.componentRef.setInput('mode', 'time');
    fixture.detectChanges();
    const separator = [...root.querySelectorAll('span')].find(s => s.textContent === ':')!;
    // slate-500 alone was ~3.5:1 on a dark page
    expect(separator.className).toContain('dark:text-slate-400');
  });

  it('should inherit the surrounding text colour in the minimal variant', () => {
    const textDiv = () =>
      (fixture.nativeElement as HTMLElement).querySelector('[role="img"] > div')!;
    expect(textDiv().className).toContain('text-slate-700');

    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();

    // An own colour would override e.g. the dark audio player's light text
    expect(textDiv().className).not.toMatch(/(^|\s)(dark:)?text-slate-\d/);
  });

  it('should include the visible total in the accessible name', () => {
    fixture.componentRef.setInput('value', 65);
    fixture.componentRef.setInput('total', 200);
    fixture.detectChanges();
    const img = () => (fixture.nativeElement as HTMLElement).querySelector('[role="img"]')!;
    // role="img" hides the "/ 3:20" text from assistive technology
    expect(img().getAttribute('aria-label')).toBe('1:05 of 3:20');

    fixture.componentRef.setInput('showTotal', false);
    fixture.detectChanges();
    expect(img().getAttribute('aria-label')).toBe('1:05');
  });
});
