import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { MixerChannel, MixerState, TwMixerComponent } from './mixer.component';
import { TwChannelStripComponent } from './channel-strip.component';

@Component({
  template: `<tw-mixer
    [channels]="channels()"
    [showMasterChannel]="false"
    (stateChange)="states.push($event)"
  ></tw-mixer>`,
  standalone: true,
  imports: [TwMixerComponent],
})
class TestHostComponent {
  channels = signal<MixerChannel[]>([
    { id: 'a', label: 'A', volume: 50, pan: 0, mute: false, solo: false },
    { id: 'b', label: 'B', volume: 60, pan: 0, mute: false, solo: false },
  ]);
  states: MixerState[] = [];
}

describe('TwMixerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const strips = () =>
    fixture.debugElement
      .queryAll(By.directive(TwChannelStripComponent))
      .map(d => d.componentInstance as TwChannelStripComponent);

  it('should emit stateChange with the updated channel, not the stale input', () => {
    (strips()[1] as unknown as { toggleMute(): void }).toggleMute();

    const last = host.states.at(-1)!;
    expect(last.channels[1].mute).toBe(true);
    expect(last.channels[0].mute).toBe(false);
  });

  it('should hand each strip a stable state object across change detection', () => {
    const mixer = fixture.debugElement.query(By.directive(TwMixerComponent))
      .componentInstance as unknown as { getChannelState(c: MixerChannel): unknown };
    const channel = host.channels()[0];
    expect(mixer.getChannelState(channel)).toBe(mixer.getChannelState(channel));
  });
});
