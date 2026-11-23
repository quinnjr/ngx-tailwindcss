import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TwClassValue, twClassValue } from './class-value';
import { TwAlertComponent } from '../alert/alert.component';
import { TwAspectRatioComponent } from '../aspect-ratio/aspect-ratio.component';
import { TwBadgeComponent } from '../badge/badge.component';
import { TwBleedComponent } from '../bleed/bleed.component';
import { TwButtonComponent, TwButtonLinkComponent } from '../button/button.component';
import {
  TwCardBodyDirective,
  TwCardComponent,
  TwCardFooterDirective,
  TwCardHeaderDirective,
  TwCardHorizontalComponent,
  TwCardMediaDirective,
  TwCardSubtitleDirective,
  TwCardTitleDirective,
} from '../card/card.component';
import {
  TwCenterComponent,
  TwCircleComponent,
  TwSquareComponent,
} from '../center/center.component';
import { TwColumnsComponent } from '../columns/columns.component';
import { TwContainerComponent } from '../container/container.component';
import { TwGridComponent, TwSimpleGridComponent } from '../grid/grid.component';
import { TwSpacerComponent, TwWrapComponent } from '../spacer/spacer.component';
import { TwHStackComponent, TwStackComponent, TwVStackComponent } from '../stack/stack.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TwOverlayComponent } from '../overlay/overlay.component';
import { TwScrollAreaComponent } from '../scroll-area/scroll-area.component';
import { TwSplitterComponent, TwSplitterPaneComponent } from '../splitter/splitter.component';
import { TwStickyComponent } from '../sticky/sticky.component';

describe('twClassValue', () => {
  it('normalizes every [class] binding shape to a class string', () => {
    expect(twClassValue('a b')).toBe('a b');
    expect(twClassValue(['a', 'b'])).toBe('a b');
    expect(twClassValue(new Set(['a', 'b']))).toBe('a b');
    expect(twClassValue({ a: true, b: false, c: null, d: undefined, 'e f': true })).toBe('a e f');
    expect(twClassValue(null)).toBe('');
    expect(twClassValue(undefined)).toBe('');
    expect(twClassValue('')).toBe('');
  });
});

@Component({
  template: `
    <tw-alert data-k [class]="cls()" [class.is-on]="on()">x</tw-alert>
    <tw-aspect-ratio data-k [class]="cls()" [class.is-on]="on()" />
    <tw-badge data-k [class]="cls()" [class.is-on]="on()">x</tw-badge>
    <tw-bleed data-k [class]="cls()" [class.is-on]="on()" />
    <tw-button data-k [class]="cls()" [class.is-on]="on()">x</tw-button>
    <a tw-button data-k href="#" [class]="cls()" [class.is-on]="on()">x</a>
    <tw-card data-k [class]="cls()" [class.is-on]="on()">
      <tw-card-header data-k [class]="cls()" [class.is-on]="on()" />
      <tw-card-title data-k [class]="cls()" [class.is-on]="on()" />
      <tw-card-subtitle data-k [class]="cls()" [class.is-on]="on()" />
      <tw-card-media data-k [class]="cls()" [class.is-on]="on()" />
      <tw-card-body data-k [class]="cls()" [class.is-on]="on()" />
      <tw-card-footer data-k [class]="cls()" [class.is-on]="on()" />
    </tw-card>
    <tw-card-horizontal data-k [class]="cls()" [class.is-on]="on()" />
    <tw-center data-k [class]="cls()" [class.is-on]="on()" />
    <tw-square data-k [class]="cls()" [class.is-on]="on()" />
    <tw-circle data-k [class]="cls()" [class.is-on]="on()" />
    <tw-columns data-k [class]="cls()" [class.is-on]="on()" />
    <tw-container data-k [class]="cls()" [class.is-on]="on()" />
    <tw-grid data-k [class]="cls()" [class.is-on]="on()" />
    <tw-simple-grid data-k [class]="cls()" [class.is-on]="on()" />
    <tw-spacer data-k [class]="cls()" [class.is-on]="on()" />
    <tw-wrap data-k [class]="cls()" [class.is-on]="on()" />
    <tw-stack data-k [class]="cls()" [class.is-on]="on()" />
    <tw-vstack data-k [class]="cls()" [class.is-on]="on()" />
    <tw-hstack data-k [class]="cls()" [class.is-on]="on()" />
  `,
  imports: [
    TwAlertComponent,
    TwAspectRatioComponent,
    TwBadgeComponent,
    TwBleedComponent,
    TwButtonComponent,
    TwButtonLinkComponent,
    TwCardComponent,
    TwCardHeaderDirective,
    TwCardTitleDirective,
    TwCardSubtitleDirective,
    TwCardMediaDirective,
    TwCardBodyDirective,
    TwCardFooterDirective,
    TwCardHorizontalComponent,
    TwCenterComponent,
    TwSquareComponent,
    TwCircleComponent,
    TwColumnsComponent,
    TwContainerComponent,
    TwGridComponent,
    TwSimpleGridComponent,
    TwSpacerComponent,
    TwWrapComponent,
    TwStackComponent,
    TwVStackComponent,
    TwHStackComponent,
  ],
})
class ClassBindingHostComponent {
  cls = signal<TwClassValue>('');
  on = signal(false);
}

describe('class input accepts Angular [class] binding shapes', () => {
  function setup() {
    const fixture = TestBed.createComponent(ClassBindingHostComponent);
    fixture.detectChanges();
    const hosts = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-k]')];
    expect(hosts.length).toBe(26);
    return { fixture, hosts };
  }

  function expectAll(hosts: Element[], present: string[], absent: string[] = []) {
    for (const host of hosts) {
      for (const cls of present) expect(host.classList.contains(cls), host.tagName).toBe(true);
      for (const cls of absent) expect(host.classList.contains(cls), host.tagName).toBe(false);
    }
  }

  it('applies string, array, Set and object forms', () => {
    const { fixture, hosts } = setup();

    fixture.componentInstance.cls.set('str-a str-b');
    fixture.detectChanges();
    expectAll(hosts, ['str-a', 'str-b']);

    fixture.componentInstance.cls.set(['arr-a', 'arr-b']);
    fixture.detectChanges();
    expectAll(hosts, ['arr-a', 'arr-b'], ['str-a', 'str-b']);

    fixture.componentInstance.cls.set(new Set(['set-a']));
    fixture.detectChanges();
    expectAll(hosts, ['set-a'], ['arr-a']);

    fixture.componentInstance.cls.set({ 'obj-on': true, 'obj-off': false });
    fixture.detectChanges();
    expectAll(hosts, ['obj-on'], ['obj-off', 'set-a', '[object', 'Object]']);

    fixture.componentInstance.cls.set({ 'obj-on': false, 'obj-off': true });
    fixture.detectChanges();
    expectAll(hosts, ['obj-off'], ['obj-on']);

    fixture.componentInstance.cls.set(null);
    fixture.detectChanges();
    expectAll(hosts, [], ['obj-off']);
  });

  it('keeps [class.x] bindings working alongside the class input', () => {
    const { fixture, hosts } = setup();
    fixture.componentInstance.cls.set({ 'obj-on': true });
    fixture.componentInstance.on.set(true);
    fixture.detectChanges();
    expectAll(hosts, ['is-on', 'obj-on']);

    fixture.componentInstance.on.set(false);
    fixture.detectChanges();
    expectAll(hosts, ['obj-on'], ['is-on']);
  });
});

@Component({
  template: `
    <tw-overlay data-k [visible]="true" [class]="cls()">x</tw-overlay>
    <tw-scroll-area data-k [class]="cls()">x</tw-scroll-area>
    <tw-splitter data-k [class]="cls()">
      <div twSplitterPaneStart>a</div>
      <div twSplitterPaneEnd>b</div>
    </tw-splitter>
    <tw-sticky data-k [class]="cls()">x</tw-sticky>
  `,
  imports: [
    TwOverlayComponent,
    TwScrollAreaComponent,
    TwSplitterComponent,
    TwSplitterPaneComponent,
    TwStickyComponent,
  ],
})
class InnerClassBindingHostComponent {
  cls = signal<TwClassValue>('');
}

describe('class input shapes on overlay, scroll-area, splitter and sticky', () => {
  it('applies object and array forms to the styled element', () => {
    TestBed.configureTestingModule({ imports: [NoopAnimationsModule] });
    const fixture = TestBed.createComponent(InnerClassBindingHostComponent);
    fixture.componentInstance.cls.set({ 'obj-on': true, 'obj-off': false });
    fixture.detectChanges();
    const hosts = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-k]')];
    expect(hosts.length).toBe(4);
    for (const host of hosts) {
      const styled = host.classList.contains('obj-on') ? host : host.querySelector('.obj-on');
      expect(styled, host.tagName).not.toBeNull();
      expect(host.outerHTML, host.tagName).not.toContain('[object');
      expect(host.querySelector('.obj-off'), host.tagName).toBeNull();
    }

    fixture.componentInstance.cls.set(['arr-a']);
    fixture.detectChanges();
    for (const host of hosts) {
      const styled = host.classList.contains('arr-a') ? host : host.querySelector('.arr-a');
      expect(styled, host.tagName).not.toBeNull();
    }
  });
});
