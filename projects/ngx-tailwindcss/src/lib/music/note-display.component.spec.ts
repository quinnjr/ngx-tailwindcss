import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DetectedNote, TwNoteDisplayComponent } from './note-display.component';

describe('TwNoteDisplayComponent', () => {
  let fixture: ComponentFixture<TwNoteDisplayComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [TwNoteDisplayComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwNoteDisplayComponent);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits noteChange only when the input changes (no polling)', () => {
    const changes: DetectedNote[] = [];
    fixture.componentInstance.noteChange.subscribe(n => changes.push(n));

    fixture.componentRef.setInput('frequency', 440);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ note: 'A', octave: 4, cents: 0 });

    fixture.componentRef.setInput('frequency', 261.63);
    fixture.detectChanges();
    expect(changes).toHaveLength(2);
    expect(changes[1]).toMatchObject({ note: 'C', octave: 4 });
  });

  it('shows the detected note without waiting for a timer', () => {
    fixture.componentRef.setInput('frequency', 466.16);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('A♯');
  });
});
