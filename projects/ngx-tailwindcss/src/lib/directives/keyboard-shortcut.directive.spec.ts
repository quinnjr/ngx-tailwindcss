import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { KeyboardShortcutEvent, TwKeyboardShortcutDirective } from './keyboard-shortcut.directive';

@Component({
  template: `
    <div twKeyboardShortcut="cmd+k" (shortcutPressed)="onCmdK($event)" data-testid="cmd-host">
      Press cmd+k
    </div>
    <div twKeyboardShortcut="ctrl+s" (shortcutPressed)="onCtrlS($event)" data-testid="ctrl-host">
      Press ctrl+s
    </div>
    <div twKeyboardShortcut="ctrl++" (shortcutPressed)="plusCount = plusCount + 1">Zoom in</div>
    <div twKeyboardShortcut="?" (shortcutPressed)="helpCount = helpCount + 1">Help</div>
  `,
  standalone: true,
  imports: [TwKeyboardShortcutDirective],
})
class TestHostComponent {
  cmdKCount = 0;
  plusCount = 0;
  helpCount = 0;
  ctrlSCount = 0;
  lastEvent: KeyboardShortcutEvent | null = null;

  onCmdK(event: KeyboardShortcutEvent): void {
    this.cmdKCount++;
    this.lastEvent = event;
  }

  onCtrlS(event: KeyboardShortcutEvent): void {
    this.ctrlSCount++;
    this.lastEvent = event;
  }
}

@Component({
  template: `
    <div
      tabindex="0"
      twKeyboardShortcut="escape"
      [shortcutGlobal]="global()"
      (shortcutPressed)="count = count + 1"
    ></div>
  `,
  standalone: true,
  imports: [TwKeyboardShortcutDirective],
})
class ScopeHostComponent {
  global = signal(true);
  count = 0;
}

describe('TwKeyboardShortcutDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the directive', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should bind `ctrl++` to the plus key, including Shift+= on US layouts', () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '+', ctrlKey: true, shiftKey: true })
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+', ctrlKey: true }));

    expect(component.plusCount).toBe(2);
  });

  it('should fire a shifted-symbol shortcut such as `?` while Shift is held', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));

    expect(component.helpCount).toBe(1);
  });

  it('should still require exact Shift state for letter shortcuts', () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, shiftKey: true })
    );

    expect(component.ctrlSCount).toBe(0);
  });

  it('should fire a cmd shortcut when the meta key is pressed', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));

    expect(component.cmdKCount).toBe(1);
    expect(component.lastEvent?.shortcut).toBe('cmd+k');
    expect(component.lastEvent?.key).toBe('k');
  });

  it('should not fire a cmd shortcut without the meta key', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));

    expect(component.cmdKCount).toBe(0);
  });

  it('should fire a ctrl shortcut when the ctrl key is pressed', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));

    expect(component.ctrlSCount).toBe(1);
    expect(component.lastEvent?.shortcut).toBe('ctrl+s');
  });

  it('should fire a ctrl shortcut when the meta key is pressed (cross-platform fold)', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }));

    expect(component.ctrlSCount).toBe(1);
  });

  it('should not fire when the key does not match', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', metaKey: true }));

    expect(component.cmdKCount).toBe(0);
    expect(component.ctrlSCount).toBe(0);
  });

  it('should match the physical key when the layout types a non-ASCII character', () => {
    // Cyrillic layout: Ctrl+S types 'ы'
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ы', code: 'KeyS', ctrlKey: true }));

    expect(component.ctrlSCount).toBe(1);
  });

  it('should not match the physical key when the layout types another ASCII letter', () => {
    // A layout typing 'd' at the KeyS position means Ctrl+D, not Ctrl+S
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyS', ctrlKey: true }));

    expect(component.ctrlSCount).toBe(0);
  });

  it('should stop firing after the fixture is destroyed', () => {
    fixture.destroy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));

    expect(component.cmdKCount).toBe(0);
  });

  it('should move the listener when shortcutGlobal changes after init', () => {
    const scoped = TestBed.createComponent(ScopeHostComponent);
    scoped.detectChanges();
    const host: HTMLElement = scoped.nativeElement.querySelector('div');

    scoped.componentInstance.global.set(false);
    scoped.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(scoped.componentInstance.count).toBe(0);

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(scoped.componentInstance.count).toBe(1);

    scoped.componentInstance.global.set(true);
    scoped.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(scoped.componentInstance.count).toBe(2);
    scoped.destroy();
  });
});
