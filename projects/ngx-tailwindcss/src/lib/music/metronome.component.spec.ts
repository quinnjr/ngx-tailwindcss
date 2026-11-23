import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TimeSignature, TwMetronomeComponent } from './metronome.component';

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
