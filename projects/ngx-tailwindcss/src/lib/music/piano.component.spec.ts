import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NoteEvent, TwPianoComponent } from './piano.component';

describe('TwPianoComponent', () => {
  let fixture: ComponentFixture<TwPianoComponent>;
  let piano: TwPianoComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwPianoComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwPianoComponent);
    piano = fixture.componentInstance;
    fixture.componentRef.setInput('startOctave', 4);
    fixture.componentRef.setInput('octaves', 2);
    fixture.detectChanges();
  });

  it('renders one distinct button per key across multiple octaves', () => {
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
      b => b.getAttribute('aria-label')
    );
    expect(labels).toHaveLength(24);
    expect(new Set(labels).size).toBe(24);
    expect(labels).toContain('C4');
    expect(labels).toContain('C5');
  });

  it('emits noteOff for every key released by releaseAllKeys()', () => {
    const offs: NoteEvent[] = [];
    piano.noteOff.subscribe(e => offs.push(e));

    piano.pressKey('C', 4);
    piano.pressKey('E', 5);
    piano.releaseAllKeys();

    expect(offs.map(e => e.midi).sort()).toEqual([60, 76]);
    expect(piano.getActiveNotes()).toEqual([]);
  });

  it('releases a key on touchcancel', () => {
    const offs: NoteEvent[] = [];
    piano.noteOff.subscribe(e => offs.push(e));
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="D4"]'
    )!;

    piano.pressKey('D', 4);
    button.dispatchEvent(new Event('touchcancel'));

    expect(offs.map(e => e.midi)).toEqual([62]);
  });
});
