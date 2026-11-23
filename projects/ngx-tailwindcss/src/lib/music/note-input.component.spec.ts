import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlacedNote, TwNoteInputComponent } from './note-input.component';
import { NoteName } from './note.component';

interface NoteInputInternals {
  notes: () => PlacedNote[];
  selectedNotes: { (): PlacedNote[]; set: (v: PlacedNote[]) => void };
  currentVoice: () => number;
  currentDuration: () => string;
  currentAccidental: () => string | null;
  clipboard: () => unknown;
  noteToY: (name: NoteName, octave: number) => number;
  yToNote: (y: number) => { note: NoteName; octave: number };
  handleMidiMessage: (event: { data: Uint8Array }) => void;
}

const note = (id: string, overrides: Partial<PlacedNote> = {}): PlacedNote => ({
  id,
  name: 'C',
  octave: 5,
  duration: 'quarter',
  x: 200,
  measure: 0,
  beat: 0,
  voice: 1,
  ...overrides,
});

describe('TwNoteInputComponent', () => {
  let fixture: ComponentFixture<TwNoteInputComponent>;
  let cmp: TwNoteInputComponent;
  let internals: NoteInputInternals;

  const keydown = (init: KeyboardEventInit): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { cancelable: true, ...init });
    cmp.onKeyDown(event);
    return event;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwNoteInputComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwNoteInputComponent);
    cmp = fixture.componentInstance;
    internals = cmp as unknown as NoteInputInternals;
    fixture.detectChanges();
  });

  it('maps every staff pitch to a Y that round-trips through yToNote', () => {
    const pitches: Array<[NoteName, number]> = [
      ['F', 5],
      ['C', 5],
      ['B', 4],
      ['A', 4],
      ['G', 4],
      ['C', 4],
      ['B', 3],
      ['G', 3],
    ];
    for (const [name, octave] of pitches) {
      const y = internals.noteToY(name, octave);
      expect(internals.yToNote(y)).toEqual({ note: name, octave });
    }
  });

  it('draws B4 one step below C5 (not an octave lower)', () => {
    const step = cmp.lineSpacing() / 2;
    expect(internals.noteToY('B', 4) - internals.noteToY('C', 5)).toBe(step);
  });

  it('Ctrl+C copies the selection instead of placing a C note', () => {
    const n = note('note-0');
    cmp.setNotes([n]);
    internals.selectedNotes.set([n]);

    const event = keydown({ key: 'c', ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(internals.notes()).toHaveLength(1);
    expect(internals.clipboard()).not.toBeNull();
  });

  it('Ctrl+V pastes and Ctrl+A selects all', () => {
    const n = note('note-0');
    cmp.setNotes([n]);
    internals.selectedNotes.set([n]);
    keydown({ key: 'c', ctrlKey: true });

    keydown({ key: 'v', ctrlKey: true });
    expect(internals.notes()).toHaveLength(2);

    keydown({ key: 'a', ctrlKey: true });
    expect(internals.selectedNotes()).toHaveLength(2);
  });

  it('Shift+2 switches to voice 2 without changing the duration', () => {
    keydown({ key: '@', code: 'Digit2', shiftKey: true });
    expect(internals.currentVoice()).toBe(2);
    expect(internals.currentDuration()).toBe('quarter');
  });

  it('places MIDI notes with their own accidental and does not leak it to later notes', () => {
    // C#4 then D4
    internals.handleMidiMessage({ data: new Uint8Array([0x90, 61, 100]) });
    internals.handleMidiMessage({ data: new Uint8Array([0x90, 62, 100]) });

    const [first, second] = internals.notes();
    expect(first).toMatchObject({ name: 'C', octave: 4, accidental: 'sharp' });
    expect(second).toMatchObject({ name: 'D', octave: 4, accidental: null });
    expect(internals.currentAccidental()).toBeNull();
    expect(second.x).toBeGreaterThan(first.x);
  });

  it('spells MIDI notes against the key signature and earlier accidentals in the bar', () => {
    fixture.componentRef.setInput('keySignature', 'G');
    fixture.detectChanges();
    // G major: F#4 is implied by the key, F4 needs a natural, a following F#4 a sharp
    for (const pitch of [66, 65, 66]) {
      internals.handleMidiMessage({ data: new Uint8Array([0x90, pitch, 100]) });
    }
    expect(internals.notes().map(n => [n.name, n.accidental])).toEqual([
      ['F', null],
      ['F', 'natural'],
      ['F', 'sharp'],
    ]);
  });

  it('keeps notes moved past the first beat on the staff', () => {
    fixture.componentRef.setInput('initialNotes', [note('note-0', { measure: 0, beat: 0 })]);
    fixture.detectChanges();
    internals.selectedNotes.set([...internals.notes()]);
    keydown({ key: 'ArrowLeft' });
    const [moved] = internals.notes();
    expect(moved.measure).toBe(0);
    expect(moved.beat).toBe(0);
    expect(moved.x).toBeGreaterThan(0);
  });

  it('reloads notes when initialNotes changes and avoids id collisions', () => {
    fixture.componentRef.setInput('initialNotes', [note('note-0'), note('note-5')]);
    fixture.detectChanges();
    expect(internals.notes().map(n => n.id)).toEqual(['note-0', 'note-5']);

    keydown({ key: 'd' });
    const ids = internals.notes().map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);

    fixture.componentRef.setInput('initialNotes', [note('note-9')]);
    fixture.detectChanges();
    expect(internals.notes().map(n => n.id)).toEqual(['note-9']);
  });

  it('does not emit noteMoved or record undo for a click without movement', () => {
    const n = note('note-0');
    cmp.setNotes([n]);
    const moved: unknown[] = [];
    cmp.noteMoved.subscribe(e => moved.push(e));
    const undoBefore = (cmp as unknown as { undoStack: () => unknown[] }).undoStack().length;

    // Equivalent of mousedown + mouseup on the same spot (jsdom lacks AbortSignal listener
    // support under zone.js, so drive the drag state directly)
    const drag = cmp as unknown as {
      draggedNote: { set: (v: PlacedNote | null) => void };
      finalizeDrag: () => void;
    };
    drag.draggedNote.set(n);
    drag.finalizeDrag();

    expect(moved).toHaveLength(0);
    expect((cmp as unknown as { undoStack: () => unknown[] }).undoStack().length).toBe(undoBefore);
  });
});

describe('TwNoteInputComponent clefs and layout', () => {
  let fixture: ComponentFixture<TwNoteInputComponent>;
  const internals = () =>
    fixture.componentInstance as unknown as NoteInputInternals & {
      staffTop: () => number;
      contentStartX: () => number;
      ledgerLines: (name: NoteName, octave: number) => number[];
    };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TwNoteInputComponent] }).compileComponents();
    fixture = TestBed.createComponent(TwNoteInputComponent);
  });

  it('places and reads pitches according to the bass clef', () => {
    fixture.componentRef.setInput('clef', 'bass');
    fixture.detectChanges();
    const cmp = internals();
    const spacing = fixture.componentInstance.lineSpacing();
    // Bass clef: A3 on the top line, G2 on the bottom line
    expect(cmp.noteToY('A', 3)).toBe(cmp.staffTop());
    expect(cmp.noteToY('G', 2)).toBe(cmp.staffTop() + spacing * 4);
    for (const [name, octave] of [
      ['A', 3],
      ['D', 3],
      ['G', 2],
      ['C', 4],
      ['E', 2],
    ] as Array<[NoteName, number]>) {
      expect(cmp.yToNote(cmp.noteToY(name, octave))).toEqual({ note: name, octave });
    }
  });

  it('puts middle C on the middle line of the alto clef', () => {
    fixture.componentRef.setInput('clef', 'alto');
    fixture.detectChanges();
    const cmp = internals();
    expect(cmp.noteToY('C', 4)).toBe(cmp.staffTop() + fixture.componentInstance.lineSpacing() * 2);
  });

  it('starts the note grid after the key signature drawn by tw-staff', () => {
    fixture.componentRef.setInput('keySignature', 'C#');
    fixture.detectChanges();
    // tw-staff: 10 padding + 50 clef + (7 * 12 + 10) key signature + 30 time signature
    expect(internals().contentStartX()).toBe(184);
  });

  it('draws ledger lines for notes outside the staff', () => {
    fixture.detectChanges();
    const cmp = internals();
    const spacing = fixture.componentInstance.lineSpacing();
    expect(cmp.ledgerLines('C', 4)).toEqual([cmp.staffTop() + spacing * 5]);
    expect(cmp.ledgerLines('G', 4)).toEqual([]);
  });

  it('keeps toolbar labels and the status bar readable (>= 4.5:1) in light and dark mode', () => {
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const byText = (text: string): HTMLElement =>
      [...host.querySelectorAll<HTMLElement>('span')].find(el =>
        el.textContent?.trim().startsWith(text)
      )!;
    // slate-500 is < 4.5:1 on the slate-100 toolbar and on slate-800/900 in dark mode
    for (const label of ['Duration:', 'Notes:']) {
      const el = byText(label).closest('[class*="text-slate-"]')!;
      expect(el.classList).toContain('text-slate-600');
      expect(el.classList).toContain('dark:text-slate-400');
    }
    expect(byText('Shortcuts').classList).not.toContain('text-slate-400');
  });
});
