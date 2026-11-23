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

@Component({
  template: `<tw-mixer
    [channels]="channels"
    [sections]="sections"
    [showSectionHeaders]="false"
    [maxVisibleChannels]="2"
    [showMasterChannel]="false"
  ></tw-mixer>`,
  standalone: true,
  imports: [TwMixerComponent],
})
class ScrollHostComponent {
  channels: MixerChannel[] = ['a', 'b', 'c', 'd'].map(id => ({
    id,
    label: id.toUpperCase(),
    volume: 50,
    pan: 0,
    mute: false,
    solo: false,
  }));
  sections = [{ id: 's', name: 'S', channelIds: ['c', 'd'], collapsed: false }];
}

describe('TwMixerComponent layout', () => {
  it('should keep the variant container classes on the root element', async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const root = (fixture.nativeElement as HTMLElement).querySelector('tw-mixer > div')!;
    expect(root.classList).toContain('rounded-xl');
    expect(root.classList).toContain('bg-slate-900');
  });

  it('should bound scrolling by the channels left after collapsing sections', async () => {
    await TestBed.configureTestingModule({ imports: [ScrollHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ScrollHostComponent);
    fixture.detectChanges();
    const mixer = fixture.debugElement.query(By.directive(TwMixerComponent))
      .componentInstance as unknown as {
      toggleSection(id: string): void;
      canScrollRight(): boolean;
    };

    expect(mixer.canScrollRight()).toBe(true);
    mixer.toggleSection('s');
    fixture.detectChanges();

    // Only a and b remain visible, which fit within maxVisibleChannels
    expect(mixer.canScrollRight()).toBe(false);
    expect(fixture.debugElement.queryAll(By.css('button[title="Scroll Right"]')).length).toBe(0);
  });

  it('should not show no-op scroll buttons when the sectioned layout shows every channel', async () => {
    await TestBed.configureTestingModule({ imports: [SectionHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SectionHostComponent);
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.directive(TwChannelStripComponent)).length).toBe(4);
    expect(fixture.debugElement.queryAll(By.css('button[title^="Scroll"]')).length).toBe(0);
  });
});

@Component({
  template: `<tw-mixer
    [channels]="channels"
    [sections]="sections"
    [maxVisibleChannels]="2"
    [showMasterChannel]="false"
  ></tw-mixer>`,
  standalone: true,
  imports: [TwMixerComponent],
})
class SectionHostComponent extends ScrollHostComponent {}
