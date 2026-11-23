import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { MenuItem, TwContextMenuComponent, TwMenuComponent } from './menu.component';
import { TwClassService } from '../core/tw-class.service';
import { TwModalComponent } from '../modal/modal.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

@Component({
  template: `
    <tw-menu
      [items]="items()"
      [variant]="variant()"
      [popup]="popup()"
      (onSelect)="onSelect($event)"
      data-testid="test-menu"
    ></tw-menu>
  `,
  standalone: true,
  imports: [TwMenuComponent],
})
class TestHostComponent {
  @ViewChild(TwMenuComponent) menu!: TwMenuComponent;
  items = signal<MenuItem[]>([
    { id: 1, label: 'Open' },
    { id: 2, label: 'Save', shortcut: 'Ctrl+S' },
    { id: 3, separator: true },
    { id: 4, label: 'Quit' },
  ]);
  variant = signal<'default' | 'bordered' | 'elevated'>('default');
  popup = signal(false);
  selected: MenuItem | null = null;

  onSelect(item: MenuItem): void {
    this.selected = item;
  }
}

describe('TwMenuComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  const menuItems = (): HTMLElement[] =>
    fixture.debugElement.queryAll(By.css('[role="menuitem"]')).map(de => de.nativeElement);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the menu', () => {
    expect(component.menu).toBeTruthy();
  });

  it('should render menu items', () => {
    const labels = menuItems().map(el => el.textContent?.trim());
    expect(labels).toContain('Open');
    expect(labels?.join(' ')).toContain('Save');
    expect(labels).toContain('Quit');
  });

  it('should render separators', () => {
    const separators = fixture.debugElement.queryAll(By.css('.border-t'));
    expect(separators.length).toBe(1);
  });

  it('should emit onSelect when an item is clicked', () => {
    menuItems()[0].click();
    fixture.detectChanges();

    expect(component.selected?.label).toBe('Open');
  });

  it('should not emit onSelect for disabled items', () => {
    component.items.set([{ id: 1, label: 'Disabled', disabled: true }]);
    fixture.detectChanges();

    menuItems()[0].click();
    fixture.detectChanges();

    expect(component.selected).toBeNull();
  });

  describe('visible', () => {
    it('should hide items with visible: false', () => {
      component.items.set([
        { id: 1, label: 'Shown' },
        { id: 2, label: 'Hidden', visible: false },
      ]);
      fixture.detectChanges();

      const labels = menuItems().map(el => el.textContent?.trim());
      expect(labels).toContain('Shown');
      expect(labels).not.toContain('Hidden');
    });

    it('should show items again when visible flips back', () => {
      component.items.set([{ id: 1, label: 'Toggled', visible: false }]);
      fixture.detectChanges();
      expect(menuItems().length).toBe(0);

      component.items.set([{ id: 1, label: 'Toggled', visible: true }]);
      fixture.detectChanges();
      expect(menuItems().length).toBe(1);
    });
  });

  describe('url items', () => {
    it('should render an anchor with href when url is set', () => {
      component.items.set([{ id: 1, label: 'Docs', url: 'https://example.com/docs' }]);
      fixture.detectChanges();

      const anchor = fixture.debugElement.query(By.css('a[role="menuitem"]'));
      expect(anchor).toBeTruthy();
      expect(anchor.nativeElement.getAttribute('href')).toBe('https://example.com/docs');
    });

    it('should render routerLink arrays as a joined href fallback', () => {
      component.items.set([{ id: 1, label: 'Settings', routerLink: ['/admin', 'settings'] }]);
      fixture.detectChanges();

      const anchor = fixture.debugElement.query(By.css('a[role="menuitem"]'));
      expect(anchor.nativeElement.getAttribute('href')).toBe('/admin/settings');
    });
  });

  describe('popup', () => {
    it('should not apply popup classes by default', () => {
      const container = fixture.debugElement.query(By.css('[role="menu"]')).nativeElement;
      expect(container.className).not.toContain('shadow-lg');
    });

    it('should apply elevation classes when popup is set', () => {
      component.popup.set(true);
      fixture.detectChanges();

      const container = fixture.debugElement.query(By.css('[role="menu"]')).nativeElement;
      expect(container.className).toContain('shadow-lg');
      expect(container.className).toContain('rounded-lg');
      expect(container.className).toContain('border');
    });
  });

  describe('keyboard navigation', () => {
    const keydownOnMenu = (key: string): void => {
      const container = fixture.debugElement.query(By.css('[role="menu"]')).nativeElement;
      container.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };

    it('should move focus with ArrowDown/ArrowUp/Home/End', () => {
      const items = menuItems();

      keydownOnMenu('ArrowDown');
      expect(document.activeElement).toBe(items[0]);

      keydownOnMenu('ArrowDown');
      expect(document.activeElement).toBe(items[1]);

      keydownOnMenu('ArrowUp');
      expect(document.activeElement).toBe(items[0]);

      keydownOnMenu('End');
      expect(document.activeElement).toBe(items.at(-1));

      keydownOnMenu('Home');
      expect(document.activeElement).toBe(items[0]);
    });
  });

  describe('submenu', () => {
    beforeEach(() => {
      component.items.set([
        {
          id: 1,
          label: 'File',
          items: [
            { id: 11, label: 'New' },
            { id: 12, label: 'Old', visible: false },
          ],
        },
      ]);
      fixture.detectChanges();
    });

    it('should open submenu on click (Enter equivalence)', () => {
      menuItems()[0].click();
      fixture.detectChanges();

      const labels = menuItems().map(el => el.textContent?.trim());
      expect(labels).toContain('New');
      expect(labels).not.toContain('Old');
    });

    it('should open submenu on ArrowRight', () => {
      const parent = menuItems()[0];
      parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();

      expect(parent.getAttribute('aria-expanded')).toBe('true');
      expect(menuItems().length).toBe(2);
    });

    it('should move focus to the first enabled submenu item on ArrowRight', () => {
      component.items.set([
        {
          id: 1,
          label: 'File',
          items: [
            { id: 10, label: 'Disabled', disabled: true },
            { id: 11, label: 'New' },
            { id: 12, label: 'Open' },
          ],
        },
        { id: 2, label: 'Edit' },
      ]);
      fixture.detectChanges();

      const parent = menuItems()[0];
      parent.focus();
      parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();

      const newItem = menuItems().find(el => el.textContent?.trim() === 'New');
      expect(document.activeElement).toBe(newItem);

      // Arrow navigation stays within the submenu
      newItem!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(document.activeElement?.textContent?.trim()).toBe('Open');
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );
      expect(document.activeElement).toBe(newItem);
    });

    it('should close the submenu on Escape and return focus to its trigger', () => {
      const parent = menuItems()[0];
      parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();

      (document.activeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      fixture.detectChanges();

      expect(menuItems().length).toBe(1);
      expect(document.activeElement).toBe(parent);
    });

    it('should close the submenu on ArrowLeft and return focus to its trigger', () => {
      const parent = menuItems()[0];
      parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();

      const child = menuItems()[1];
      child.focus();
      child.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      fixture.detectChanges();

      expect(menuItems().length).toBe(1);
      expect(document.activeElement).toBe(parent);
    });
  });
});

@Component({
  template: `
    <div class="target" (contextmenu)="cm.show($event)">Right-click me</div>
    <tw-context-menu #cm [items]="items" (onHide)="hideCount = hideCount + 1"></tw-context-menu>
  `,
  standalone: true,
  imports: [TwContextMenuComponent],
})
class ContextMenuHostComponent {
  items: MenuItem[] = [{ label: 'Copy' }, { label: 'Paste' }];
  hideCount = 0;
}

describe('TwContextMenuComponent', () => {
  let fixture: ComponentFixture<ContextMenuHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContextMenuHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(ContextMenuHostComponent);
    fixture.detectChanges();
  });

  const openMenu = () => {
    const target = fixture.nativeElement.querySelector('.target') as HTMLElement;
    target.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 })
    );
    fixture.detectChanges();
  };

  it('should stay open after the contextmenu event bubbles to the document', () => {
    openMenu();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeTruthy();
    expect(fixture.componentInstance.hideCount).toBe(0);
  });

  it('should hide on a later document click', () => {
    openMenu();
    document.body.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
    expect(fixture.componentInstance.hideCount).toBe(1);
  });
});

describe('TwContextMenuComponent dismissal', () => {
  @Component({
    template: `
      <button type="button" class="more" (click)="cm.show($event)">More</button>
      <tw-context-menu #cm [items]="items" (onHide)="hideCount = hideCount + 1"></tw-context-menu>
    `,
    standalone: true,
    imports: [TwContextMenuComponent],
  })
  class ClickOpenHostComponent {
    items: MenuItem[] = [{ label: 'Copy' }];
    hideCount = 0;
  }

  let fixture: ComponentFixture<ClickOpenHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClickOpenHostComponent],
      providers: [TwClassService],
    }).compileComponents();
    fixture = TestBed.createComponent(ClickOpenHostComponent);
    fixture.detectChanges();
  });

  const open = () => {
    (fixture.nativeElement.querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  it('should stay open when opened from a click that bubbles to the document', () => {
    open();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeTruthy();
    expect(fixture.componentInstance.hideCount).toBe(0);
  });

  it('should close on Escape', () => {
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
    expect(fixture.componentInstance.hideCount).toBe(1);
  });

  it('should move focus into the menu on open and back to the opener on Escape', () => {
    const opener = fixture.nativeElement.querySelector('.more') as HTMLButtonElement;
    opener.focus();
    open();
    const item = fixture.nativeElement.querySelector('[role="menuitem"]') as HTMLElement;
    expect(document.activeElement).toBe(item);

    // Arrow keys work because focus is inside the menu
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(item);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('should return focus to the opener after selecting an item', () => {
    const opener = fixture.nativeElement.querySelector('.more') as HTMLButtonElement;
    opener.focus();
    open();
    (fixture.nativeElement.querySelector('[role="menuitem"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('TwContextMenuComponent inside a modal', () => {
  @Component({
    template: `
      <tw-modal [open]="modalOpen()" (openChange)="modalOpen.set($event)">
        <div class="target" (contextmenu)="cm.show($event)">Right-click me</div>
        <tw-context-menu #cm [items]="items"></tw-context-menu>
      </tw-modal>
    `,
    standalone: true,
    imports: [TwModalComponent, TwContextMenuComponent],
  })
  class ContextMenuInModalHostComponent {
    items: MenuItem[] = [{ label: 'Copy' }];
    modalOpen = signal(true);
  }

  it('should close only the context menu on Escape, not the enclosing modal', async () => {
    await TestBed.configureTestingModule({
      imports: [ContextMenuInModalHostComponent, NoopAnimationsModule],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(ContextMenuInModalHostComponent);
    fixture.detectChanges();

    document
      .querySelector('.target')!
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(document.querySelector('tw-context-menu [role="menu"]')).toBeTruthy();

    const escape = () =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
    escape();
    fixture.detectChanges();
    expect(document.querySelector('tw-context-menu [role="menu"]')).toBeNull();
    expect(fixture.componentInstance.modalOpen()).toBe(true);

    escape();
    fixture.detectChanges();
    expect(fixture.componentInstance.modalOpen()).toBe(false);
    fixture.destroy();
  });
});
