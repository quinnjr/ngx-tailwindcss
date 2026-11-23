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
});
