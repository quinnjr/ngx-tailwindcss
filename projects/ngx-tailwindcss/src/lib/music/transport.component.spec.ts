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
});
