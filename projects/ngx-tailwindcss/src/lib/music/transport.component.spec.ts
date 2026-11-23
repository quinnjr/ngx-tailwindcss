import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TwTransportComponent } from './transport.component';

describe('TwTransportComponent icon contrast', () => {
  const create = async (variant: string) => {
    await TestBed.configureTestingModule({ imports: [TwTransportComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TwTransportComponent);
    fixture.componentRef.setInput('variant', variant);
    fixture.componentRef.setInput('showShuffle', true);
    fixture.componentRef.setInput('showRecord', true);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('should keep inactive minimal loop/shuffle icons at 3:1 on a light page', async () => {
    const el = await create('minimal');
    const toggles = [...el.querySelectorAll('button')].filter(b =>
      /loop|shuffle/i.test(b.getAttribute('aria-label') ?? b.title)
    );
    expect(toggles.length).toBe(2);
    for (const button of toggles) {
      // slate-400 on white is ~2.6:1
      expect(button.className).toContain('text-slate-500');
      expect(button.className).not.toMatch(/(^|\s)text-slate-400/);
    }
  });

  it('should not dim the classic record icon below 3:1 on its gradient button', async () => {
    const el = await create('classic');
    const record = [...el.querySelectorAll('button')].find(b =>
      /record/i.test(b.getAttribute('aria-label') ?? b.title)
    )!;
    const icon = record.querySelector('svg')!;
    expect(icon.getAttribute('class')).not.toContain('text-slate-500');
    expect(record.className).toContain('text-slate-700');
  });

  it('should keep the recording indicator at 3:1 on each variant button', async () => {
    await TestBed.configureTestingModule({ imports: [TwTransportComponent] }).compileComponents();
    const expected: Record<string, string[]> = {
      modern: ['text-red-600', 'dark:text-red-400'],
      classic: ['text-red-800', 'dark:text-red-300'],
      compact: ['text-red-500'],
      minimal: ['text-red-500'],
    };
    for (const [variant, classes] of Object.entries(expected)) {
      const fixture = TestBed.createComponent(TwTransportComponent);
      fixture.componentRef.setInput('variant', variant);
      fixture.componentRef.setInput('showRecord', true);
      fixture.componentRef.setInput('recording', true);
      fixture.detectChanges();
      const icon = (fixture.nativeElement as HTMLElement)
        .querySelector('[aria-label="Stop recording"] svg')!
        .getAttribute('class')!
        .split(/\s+/);
      // red-500 was ~1.5:1 on the classic slate-400 gradient
      expect(icon).toEqual(expect.arrayContaining(classes));
      fixture.destroy();
    }
  });

  it('should keep the play icon at 3:1 on the green classic and compact buttons', async () => {
    await TestBed.configureTestingModule({ imports: [TwTransportComponent] }).compileComponents();
    for (const variant of ['classic', 'compact']) {
      const fixture = TestBed.createComponent(TwTransportComponent);
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const play = el.querySelector<HTMLElement>('[aria-label="Play"]')!;
      // White on green-400/500 and emerald-400/500 is below 3:1
      expect(play.className).not.toMatch(/(from|bg|hover:bg|hover:from)-(green|emerald)-[45]00/);
      expect(play.className).toMatch(/(from|bg)-(green|emerald)-600/);
    }
  });
});
