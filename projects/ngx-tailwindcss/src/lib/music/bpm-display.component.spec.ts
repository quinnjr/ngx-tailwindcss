import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwBpmDisplayComponent } from './bpm-display.component';

@Component({
  template: `<tw-bpm-display [bpm]="bpm()" (bpmChange)="changes.push($event)"></tw-bpm-display>`,
  standalone: true,
  imports: [TwBpmDisplayComponent],
})
class TestHostComponent {
  bpm = signal(120);
  changes: number[] = [];
}

describe('TwBpmDisplayComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('should follow bpm input changes', () => {
    host.bpm.set(95);
    fixture.detectChanges();

    expect(el.textContent).toContain('95');
  });

  it('should keep a locally changed bpm instead of reverting to the input', async () => {
    const half = [...el.querySelectorAll('button')].find(b => b.textContent?.trim() === '÷2')!;
    half.click();
    fixture.detectChanges();
    expect(host.changes).toEqual([60]);

    // The previous implementation polled the input every 100ms and reverted
    await new Promise<void>(resolve => {
      setTimeout(resolve, 250);
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('60');
    expect(el.textContent).not.toContain('120');
  });

  it('should commit an Enter edit once, not again on the following blur', () => {
    const display = el.querySelector<HTMLElement>('[role="button"]')!;
    display.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    const editor = el.querySelector<HTMLInputElement>('input[type="number"]')!;
    expect(editor).toBeTruthy();
    editor.value = '140';
    editor.dispatchEvent(new Event('input'));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    // Removing the focused input fires blur in browsers
    editor.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(host.changes).toEqual([140]);
  });

  it('should return focus to the value display after a keyboard commit', async () => {
    el.querySelector<HTMLElement>('[role="button"]')!.click();
    fixture.detectChanges();
    const editor = el.querySelector<HTMLInputElement>('input[type="number"]')!;
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(el.querySelector('[role="button"]'));
  });

  it('should not commit on the blur after Escape cancels', () => {
    el.querySelector<HTMLElement>('[role="button"]')!.click();
    fixture.detectChanges();
    const editor = el.querySelector<HTMLInputElement>('input[type="number"]')!;
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    editor.dispatchEvent(new Event('blur'));

    expect(host.changes).toEqual([]);
  });

  it('should give the icon-only step buttons an accessible name', () => {
    const decrease = el.querySelector<HTMLButtonElement>('button[aria-label="Decrease BPM"]')!;
    const increase = el.querySelector<HTMLButtonElement>('button[aria-label="Increase BPM"]')!;

    increase.click();
    decrease.click();
    decrease.click();

    expect(host.changes).toEqual([121, 120, 119]);
  });
});

@Component({
  template: `<tw-bpm-display [bpm]="bpm()" [showSlider]="true"></tw-bpm-display>`,
  standalone: true,
  imports: [TwBpmDisplayComponent],
})
class SliderHostComponent {
  bpm = signal(150);
}

describe('TwBpmDisplayComponent slider', () => {
  it('should position the slider at a bpm above 100 on first render', async () => {
    await TestBed.configureTestingModule({ imports: [SliderHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SliderHostComponent);
    fixture.detectChanges();

    const slider = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[type="range"]'
    )!;
    // [value] bound before [min]/[max] was clamped by the default 0-100 range
    expect(slider.value).toBe('150');
  });
});
