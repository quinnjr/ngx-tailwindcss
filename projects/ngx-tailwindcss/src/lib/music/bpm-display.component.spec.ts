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

  it('should keep focus in the controls when a button disables itself at the tempo limit', async () => {
    const double = [...el.querySelectorAll('button')].find(b => b.textContent?.trim() === '×2')!;
    double.focus();
    double.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // 240 BPM: doubling again would pass maxBpm, so ×2 is now disabled
    expect(double.disabled).toBe(true);
    const active = document.activeElement as HTMLButtonElement;
    expect(active).not.toBe(document.body);
    expect(active.tagName).toBe('BUTTON');
    expect(active.disabled).toBe(false);
    expect(el.contains(active)).toBe(true);
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
    expect(slider.getAttribute('aria-label')).toBe('Tempo in BPM');
  });

  it('should align the fill, value bubble and marks with the native thumb travel', async () => {
    await TestBed.configureTestingModule({ imports: [TwBpmDisplayComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwBpmDisplayComponent);
    fixture.componentRef.setInput('showSlider', true);
    fixture.componentRef.setInput('minBpm', 60);
    fixture.componentRef.setInput('maxBpm', 260);
    fixture.componentRef.setInput('bpm', 260);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const style = (sel: string) => el.querySelector(sel)!.getAttribute('style') ?? '';

    // The thumb centre spans the track minus half a (16px) thumb at each end
    expect(style('.rounded-l-lg')).toContain('calc(8px + 1 * (100% - 16px))');
    expect(style('.-top-4')).toContain('calc(8px + 1 * (100% - 16px))');
    const mark60 = [...el.querySelectorAll('span')].find(s => s.textContent?.trim() === '60')!;
    expect(mark60.parentElement!.getAttribute('style')).toContain('calc(8px + 0 * (100% - 16px))');
  });
});

describe('TwBpmDisplayComponent text colours', () => {
  it('should keep labels, scale and the slider value readable on each surface', async () => {
    await TestBed.configureTestingModule({ imports: [TwBpmDisplayComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwBpmDisplayComponent);
    fixture.componentRef.setInput('showSlider', true);
    fixture.componentRef.setInput('showTempoMarking', true);
    fixture.componentRef.setInput('showMsPerBeat', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const span = (t: string) =>
      [...el.querySelectorAll('span')].find(s => s.textContent?.trim() === t)!;
    const bubble = () => el.querySelector<HTMLElement>('.-top-4')!;

    // default (slate-800): slate-500/600 were ~2-3:1
    expect(span('BPM').className).toContain('text-slate-400');
    expect(span('Allegro').className).toContain('text-slate-400');
    expect(span('60').className).toContain('text-slate-400');
    expect(span('(500ms)').className).not.toContain('opacity-60');

    // light: the value bubble had white text and no background (white on white)
    fixture.componentRef.setInput('variant', 'light');
    fixture.detectChanges();
    expect(bubble().className).toContain('bg-blue-600');
    expect(bubble().className).toContain('text-white');

    // digital: white on cyan-500 was ~2.4:1
    fixture.componentRef.setInput('variant', 'digital');
    fixture.detectChanges();
    expect(bubble().className).toContain('text-slate-950');
    expect(span('BPM').className).toContain('text-cyan-500');
    expect(span('BPM').className).not.toContain('/60');

    // led: white on red-500 was ~3.8:1
    fixture.componentRef.setInput('variant', 'led');
    fixture.detectChanges();
    expect(bubble().className).toContain('bg-red-600');
    expect(bubble().className).not.toContain('bg-red-500');
  });
});

describe('TwBpmDisplayComponent sync status icon', () => {
  it('should draw the status glyph at 3:1 on its badge', async () => {
    await TestBed.configureTestingModule({ imports: [TwBpmDisplayComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwBpmDisplayComponent);
    fixture.componentRef.setInput('showSync', true);
    fixture.detectChanges();
    const badge = () => (fixture.nativeElement as HTMLElement).querySelector('.w-5.h-5')!;

    // slate-400 on slate-600 was ~2.9:1
    expect(badge().className).toContain('text-slate-300');

    // white on green-500 was ~2.3:1
    fixture.componentRef.setInput('syncStatus', 'synced');
    fixture.detectChanges();
    expect(badge().className).toContain('bg-green-600');
    expect(badge().className).not.toContain('bg-green-500');
  });
});

describe('TwBpmDisplayComponent disabled', () => {
  it('should show every control as disabled', async () => {
    await TestBed.configureTestingModule({ imports: [TwBpmDisplayComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwBpmDisplayComponent);
    fixture.componentRef.setInput('showSync', true);
    fixture.componentRef.setInput('showSlider', true);
    fixture.componentRef.setInput('size', 'xl');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const controls = [
      ...el.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input'),
    ];

    expect(controls.length).toBeGreaterThan(15);
    for (const control of controls) {
      expect(control.disabled).toBe(true);
      expect(control.classList).toContain('disabled:opacity-50');
      // Hovering a disabled control must not change its colour as if it were live
      expect(
        [...control.classList].filter(c => /(^|:)hover:/.test(c) && !c.includes('enabled:hover:'))
      ).toEqual([]);
    }
  });
});
