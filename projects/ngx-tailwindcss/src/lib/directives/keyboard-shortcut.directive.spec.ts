import { Component } from '@angular/core';
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

  it('should stop firing after the fixture is destroyed', () => {
    fixture.destroy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));

    expect(component.cmdKCount).toBe(0);
  });
});
