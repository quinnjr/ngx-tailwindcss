import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccentLevel, TimeSignature, TwMetronomeComponent } from './metronome.component';

@Component({
  template: `<tw-metronome [bpm]="bpm()" [timeSignature]="timeSignature()"></tw-metronome>`,
  standalone: true,
  imports: [TwMetronomeComponent],
})
class TestHostComponent {
  bpm = signal(120);
  timeSignature = signal<TimeSignature>('4/4');
}

describe('TwMetronomeComponent', () => {
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

  const buttonByText = (text: string): HTMLButtonElement =>
    [...el.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!;

  it('should count down the tap hint and drop it once the tempo is set', () => {
    const hint = () => /Tap \d more \w+/.exec(el.textContent?.replaceAll(/\s+/g, ' ') ?? '')?.[0];
    buttonByText('TAP').click();
    fixture.detectChanges();
    expect(hint()).toBe('Tap 2 more times');

    buttonByText('TAP').click();
    fixture.detectChanges();
    expect(hint()).toBe('Tap 1 more time');

    buttonByText('TAP').click();
    fixture.detectChanges();
    // The third tap set the tempo: no stale "Tap 1 more times" hint
    expect(hint()).toBeUndefined();
  });

  it('should follow bpm input changes after init', () => {
    expect(el.textContent).not.toContain('90');
    host.bpm.set(90);
    fixture.detectChanges();

    expect(el.textContent).toContain('90');
  });

  it('should apply a time signature picked from its own selector', () => {
    buttonByText('3/4').click();
    fixture.detectChanges();

    expect(buttonByText('3/4').classList).toContain('bg-blue-600');
    expect(buttonByText('4/4').classList).not.toContain('bg-blue-600');
  });

  it('should follow timeSignature input changes', () => {
    host.timeSignature.set('6/8');
    fixture.detectChanges();

    expect(buttonByText('6/8').classList).toContain('bg-blue-600');
  });
});

@Component({
  template: `<tw-metronome
    [accentPattern]="pattern()"
    [showAccentConfig]="true"
    (accentPatternChange)="changes.push($event)"
  ></tw-metronome>`,
  standalone: true,
  imports: [TwMetronomeComponent],
})
class AccentHostComponent {
  pattern = signal<AccentLevel[] | null>(['strong', 'none', 'none', 'none']);
  changes: AccentLevel[][] = [];
}

describe('TwMetronomeComponent accent pattern', () => {
  let fixture: ComponentFixture<AccentHostComponent>;
  let el: HTMLElement;

  const beatButtons = (): HTMLButtonElement[] =>
    [...el.querySelectorAll('button')].filter(b => b.title.startsWith('Click to cycle accent'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccentHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(AccentHostComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('should apply a beat click even when accentPattern is bound', () => {
    beatButtons()[1].click();
    fixture.detectChanges();

    expect(beatButtons()[1].title).toBe('Click to cycle accent: soft');
    expect(fixture.componentInstance.changes).toEqual([['strong', 'soft', 'none', 'none']]);
  });

  it('should re-sync to a new bound accentPattern', () => {
    beatButtons()[1].click();
    fixture.detectChanges();
    fixture.componentInstance.pattern.set(['none', 'none', 'medium', 'none']);
    fixture.detectChanges();

    expect(beatButtons().map(b => b.title.split(': ')[1])).toEqual([
      'none',
      'none',
      'medium',
      'none',
    ]);
  });
});

@Component({
  template: `<tw-metronome
    [accentFirstBeat]="accentFirst()"
    [showAccentConfig]="true"
  ></tw-metronome>`,
  standalone: true,
  imports: [TwMetronomeComponent],
})
class AccentFirstHostComponent {
  accentFirst = signal(false);
}

describe('TwMetronomeComponent accentFirstBeat', () => {
  it('should not accent any beat when accentFirstBeat is false and no pattern is bound', async () => {
    await TestBed.configureTestingModule({
      imports: [AccentFirstHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(AccentFirstHostComponent);
    const el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    const levels = () =>
      [...el.querySelectorAll('button')]
        .filter(b => b.title.startsWith('Click to cycle accent'))
        .map(b => b.title.split(': ')[1]);

    expect(levels()).toEqual(['none', 'none', 'none', 'none']);

    fixture.componentInstance.accentFirst.set(true);
    fixture.detectChanges();
    expect(levels()[0]).toBe('strong');
  });
});

describe('TwMetronomeComponent subdivisions', () => {
  const frequencies: number[] = [];
  let currentTime = 0;

  class FakeAudioContext {
    state = 'running';
    destination = {};
    get currentTime(): number {
      return currentTime;
    }
    createOscillator() {
      const osc = {
        frequency: { value: 0 },
        type: 'sine',
        connect: vi.fn(),
        start: vi.fn(() => frequencies.push(osc.frequency.value)),
        stop: vi.fn(),
      };
      return osc;
    }
    createGain() {
      return {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
    }
    resume = vi.fn(() => Promise.resolve());
    close = vi.fn(() => Promise.resolve());
  }

  @Component({
    template: `<tw-metronome [bpm]="120" [subdivisions]="2"></tw-metronome>`,
    standalone: true,
    imports: [TwMetronomeComponent],
  })
  class SubdivisionHostComponent {}

  @Component({
    template: `<tw-metronome [bpm]="120" [subdivisions]="0"></tw-metronome>`,
    standalone: true,
    imports: [TwMetronomeComponent],
  })
  class ZeroSubdivisionHostComponent {}

  beforeEach(() => {
    frequencies.length = 0;
    currentTime = 0;
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should play audible clicks on subdivisions between main beats', async () => {
    await TestBed.configureTestingModule({
      imports: [SubdivisionHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(SubdivisionHostComponent);
    fixture.detectChanges();
    const metronome = fixture.debugElement.query(By.directive(TwMetronomeComponent))
      .componentInstance as unknown as { start(): Promise<void>; scheduler(): void; stop(): void };

    await metronome.start();
    // 120 bpm, 2 subdivisions => a click every 0.25s starting at 0.05s
    currentTime = 0.9;
    metronome.scheduler();
    metronome.stop();

    // main, sub, main, sub (0.05, 0.3, 0.55, 0.8)
    expect(frequencies.length).toBe(4);
    expect(frequencies[1]).toBe(600);
    expect(frequencies[3]).toBe(600);
    expect(frequencies[0]).not.toBe(600);
    expect(frequencies[2]).not.toBe(600);
    fixture.destroy();
  });

  it('should keep the beat interval in step with the sanitized subdivision count', async () => {
    await TestBed.configureTestingModule({
      imports: [ZeroSubdivisionHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ZeroSubdivisionHostComponent);
    fixture.detectChanges();
    const metronome = fixture.debugElement.query(By.directive(TwMetronomeComponent))
      .componentInstance as unknown as { start(): Promise<void>; scheduler(): void; stop(): void };

    await metronome.start();
    // subdivisions=0 is treated as 1: 120 bpm => main beats at 0.05 and 0.55
    currentTime = 0.9;
    metronome.scheduler();
    metronome.stop();

    expect(frequencies.length).toBe(2);
    expect(frequencies).not.toContain(600);
    fixture.destroy();
  });
});

describe('TwMetronomeComponent text colours', () => {
  it('should keep the BPM readout and labels readable on each surface', async () => {
    await TestBed.configureTestingModule({ imports: [TwMetronomeComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwMetronomeComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const span = (t: string) =>
      [...el.querySelectorAll('span')].find(s => s.textContent?.trim() === t)!;

    // default (slate-800): slate-500 was ~3:1
    expect(span('BPM').className).toContain('text-slate-400');
    expect(span('BPM').className).not.toContain('text-slate-500');

    // minimal is transparent: a white readout vanished on a light page
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    expect(span('120').className).toContain('text-slate-900');
    expect(span('120').className).toContain('dark:text-white');
    expect(span('BPM').className).toContain('text-slate-600');
    fixture.destroy();
  });
});
