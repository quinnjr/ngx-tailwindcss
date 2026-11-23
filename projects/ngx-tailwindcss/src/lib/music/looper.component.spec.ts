import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TwLooperComponent } from './looper.component';

describe('TwLooperComponent', () => {
  let fixture: ComponentFixture<TwLooperComponent>;
  let internals: any;

  const fakeBuffer = { duration: 2, getChannelData: () => new Float32Array(16) } as unknown;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwLooperComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TwLooperComponent);
    internals = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should enable redo after an undo (canRedo is reactive)', () => {
    internals.layers.set([{ id: 1, audioBuffer: fakeBuffer, volume: 1, muted: false, name: 'L1' }]);
    expect(internals.canRedo()).toBe(false);

    internals.undo();
    expect(internals.canRedo()).toBe(true);

    internals.redo();
    expect(internals.canRedo()).toBe(false);
    expect(internals.layers().length).toBe(1);
  });

  it('should stop the undone layer if it is playing', () => {
    let stopped = false;
    internals.layers.set([{ id: 1, audioBuffer: fakeBuffer, volume: 1, muted: false, name: 'L1' }]);
    internals.sourceNodes = [
      {
        stop: () => {
          stopped = true;
        },
      },
    ];
    internals.gainNodes = [{}];

    internals.undo();

    expect(stopped).toBe(true);
    expect(internals.sourceNodes.length).toBe(0);
  });

  it('should defer auto-play until the recording has been decoded', () => {
    internals.state.set('recording');

    void internals.stopRecording();

    expect(internals.state()).toBe('stopped');
    expect(internals.pendingAutoPlay).toBe(true);
  });
});
