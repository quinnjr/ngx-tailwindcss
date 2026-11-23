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

  it('positions each black key so it straddles the boundary between its white keys', () => {
    const keys = piano as unknown as {
      blackKeys: () => Array<{ note: string; octave: number; position: number }>;
      whiteKeyWidth: () => number;
      blackKeyWidth: () => number;
    };
    const w = keys.whiteKeyWidth();
    const bw = keys.blackKeyWidth();
    // Index of the white key boundary each black key sits on (C#: C|D = 1, D#: D|E = 2, ...)
    const boundaries: Record<string, number> = { 'C#': 1, 'D#': 2, 'F#': 4, 'G#': 5, 'A#': 6 };
    for (const key of keys.blackKeys()) {
      const octaveOffset = (key.octave - 4) * 7 * w;
      const boundary = octaveOffset + boundaries[key.note] * w;
      expect(key.position).toBeLessThan(boundary);
      expect(key.position + bw).toBeGreaterThan(boundary);
    }
  });

  it('stops listening to MIDI when enableMidi is turned off', async () => {
    const listeners = new Set<unknown>();
    const midiInput = {
      id: 'in',
      name: 'Keys',
      manufacturer: 'X',
      state: 'connected',
      onmidimessage: null as unknown,
    };
    const access = {
      inputs: new Map([['in', midiInput]]),
      addEventListener: (_: string, fn: unknown) => listeners.add(fn),
      removeEventListener: (_: string, fn: unknown) => listeners.delete(fn),
    };
    const nav = navigator as unknown as { requestMIDIAccess?: () => Promise<unknown> };
    const original = nav.requestMIDIAccess;
    nav.requestMIDIAccess = () => Promise.resolve(access);
    try {
      fixture.componentRef.setInput('enableMidi', true);
      fixture.detectChanges();
      await fixture.whenStable();
      await Promise.resolve();
      expect(listeners.size).toBe(1);
      expect(midiInput.onmidimessage).not.toBeNull();

      fixture.componentRef.setInput('enableMidi', false);
      fixture.detectChanges();
      expect(listeners.size).toBe(0);
      expect(midiInput.onmidimessage).toBeNull();
    } finally {
      nav.requestMIDIAccess = original;
    }
  });

  it('clears the MIDI status when the connected device is unplugged', async () => {
    let onStateChange: (() => void) | undefined;
    const midiInput = {
      id: 'in',
      name: 'Keys',
      manufacturer: 'X',
      state: 'connected',
      onmidimessage: null as unknown,
    };
    const access = {
      inputs: new Map([['in', midiInput]]),
      addEventListener: (_: string, fn: () => void) => (onStateChange = fn),
      removeEventListener: () => undefined,
    };
    const nav = navigator as unknown as { requestMIDIAccess?: () => Promise<unknown> };
    const original = nav.requestMIDIAccess;
    nav.requestMIDIAccess = () => Promise.resolve(access);
    const connected: string[] = [];
    const disconnected: string[] = [];
    piano.midiConnected.subscribe(d => connected.push(d.id));
    piano.midiDisconnected.subscribe(d => disconnected.push(d.id));
    const status = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    try {
      fixture.componentRef.setInput('enableMidi', true);
      fixture.detectChanges();
      await fixture.whenStable();
      await Promise.resolve();
      fixture.detectChanges();
      expect(status()).toContain('MIDI: Keys');

      // A statechange that changes nothing does not re-announce the device
      onStateChange!();
      expect(connected).toEqual(['in']);

      midiInput.state = 'disconnected';
      onStateChange!();
      fixture.detectChanges();
      expect(disconnected).toEqual(['in']);
      expect(status()).toContain('MIDI: Not connected');
      expect(status()).not.toContain('MIDI: Keys');
    } finally {
      nav.requestMIDIAccess = original;
    }
  });

  it('does not attach MIDI listeners when destroyed before access resolves', async () => {
    const listeners = new Set<unknown>();
    let resolve!: (v: unknown) => void;
    const access = {
      inputs: new Map(),
      addEventListener: (_: string, fn: unknown) => listeners.add(fn),
      removeEventListener: (_: string, fn: unknown) => listeners.delete(fn),
    };
    const nav = navigator as unknown as { requestMIDIAccess?: () => Promise<unknown> };
    const original = nav.requestMIDIAccess;
    nav.requestMIDIAccess = () =>
      new Promise(r => {
        resolve = r;
      });
    try {
      fixture.componentRef.setInput('enableMidi', true);
      fixture.detectChanges();
      fixture.destroy();
      resolve(access);
      await Promise.resolve();
      await Promise.resolve();
      expect(listeners.size).toBe(0);
    } finally {
      nav.requestMIDIAccess = original;
    }
  });

  it('keeps key and octave labels readable (>= 4.5:1) on the dark panel and the page', () => {
    const host = fixture.nativeElement as HTMLElement;
    const octaveLabels = (): HTMLElement =>
      [...host.querySelectorAll<HTMLElement>('div')].find(d =>
        d.textContent?.replaceAll(/\s+/g, '').startsWith('C4C5')
      )!;
    fixture.componentRef.setInput('showLabels', true);
    fixture.componentRef.setInput('showOctaveLabels', true);
    fixture.detectChanges();
    // classic: slate-900 panel (slate-500 there is ~3.7:1)
    expect(octaveLabels().classList).toContain('text-slate-400');
    expect(octaveLabels().classList).not.toContain('text-slate-500');
    const whiteLabel = host.querySelector('button[aria-label="C4"] span')!;
    expect(whiteLabel.classList).toContain('text-slate-600');
    // minimal white keys are slate-400 / blue-300 when pressed / highlighted in dark mode
    expect(whiteLabel.classList).toContain('dark:text-slate-800');

    fixture.componentRef.setInput('variant', 'minimal');
    fixture.detectChanges();
    expect(octaveLabels().classList).toContain('text-slate-600');
    expect(octaveLabels().classList).toContain('dark:text-slate-400');
  });

  it('exposes the disabled state on every key (not only a visual fade)', () => {
    const buttons = () => [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ];
    expect(buttons().every(b => !b.disabled)).toBe(true);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(buttons()).toHaveLength(24);
    expect(buttons().every(b => b.disabled)).toBe(true);
  });

  it('shows the pressed state of a highlighted key', () => {
    const host = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('variant', 'minimal');
    fixture.componentRef.setInput('highlightedNotes', ['C4', 'C#4']);
    fixture.detectChanges();
    const white = host.querySelector<HTMLButtonElement>('button[aria-label="C4"]')!;
    const black = host.querySelector<HTMLButtonElement>('button[aria-label="C#4"]')!;
    expect(white.classList).toContain('bg-blue-200');
    expect(black.classList).toContain('bg-blue-800');

    white.dispatchEvent(new MouseEvent('mousedown'));
    black.dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();
    // The highlight colours used to replace the pressed ones, so nothing visibly changed
    expect(white.classList).toContain('bg-slate-300');
    expect(white.classList).not.toContain('bg-blue-200');
    expect(black.classList).toContain('bg-slate-600');
    expect(black.classList).not.toContain('bg-blue-800');
  });

  it('draws key focus rings with >= 3:1 contrast against the keys', () => {
    const host = fixture.nativeElement as HTMLElement;
    const white = host.querySelector<HTMLButtonElement>('button[aria-label="C4"]')!;
    const black = host.querySelector<HTMLButtonElement>('button[aria-label="C#4"]')!;
    // blue-400 was ~2.5:1 on the white keys (an outer ring on a black key lies over them)
    expect(white.classList).toContain('focus:ring-blue-800');
    expect(white.classList).not.toContain('focus:ring-blue-400');
    expect(black.classList).toContain('focus:ring-inset');
    expect(black.classList).toContain('focus:ring-blue-300');
  });

  it('names the keyboard as a group (aria-label on a plain div is ignored)', () => {
    const group = (fixture.nativeElement as HTMLElement).querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('Piano keyboard');
  });

  it('releases mouse-held keys with noteOff when the piano becomes disabled', () => {
    const offs: NoteEvent[] = [];
    piano.noteOff.subscribe(e => offs.push(e));
    const c4 = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label="C4"]'
    )!;

    c4.dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();
    expect(c4.getAttribute('aria-pressed')).toBe('true');

    // A disabled button never receives the mouseup, so the note used to hang forever
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(offs.map(e => e.midi)).toEqual([60]);
    expect(piano.getActiveNotes()).toEqual([]);
    expect(c4.getAttribute('aria-pressed')).toBe('false');
  });

  it('ignores MIDI note-ons while disabled but still releases held keys', () => {
    const internals = piano as unknown as { handleMidiMessage: (e: { data: Uint8Array }) => void };
    const ons: NoteEvent[] = [];
    const offs: NoteEvent[] = [];
    piano.noteOn.subscribe(e => ons.push(e));
    piano.noteOff.subscribe(e => offs.push(e));

    internals.handleMidiMessage({ data: new Uint8Array([0x90, 60, 100]) });
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    internals.handleMidiMessage({ data: new Uint8Array([0x90, 62, 100]) });
    internals.handleMidiMessage({ data: new Uint8Array([0x80, 60, 0]) });

    expect(ons.map(e => e.midi)).toEqual([60]);
    expect(offs.map(e => e.midi)).toEqual([60]);
    expect(piano.getActiveNotes()).toEqual([]);
  });
});
