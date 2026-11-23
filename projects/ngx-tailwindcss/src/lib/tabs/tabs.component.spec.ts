import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { TabsSize, TabsVariant, TwTabPanelComponent, TwTabsComponent } from './tabs.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-tabs
      [(value)]="activeTab"
      [variant]="variant"
      [size]="size"
      [fullWidth]="fullWidth"
      (valueChange)="onTabChange($event)"
      data-testid="test-tabs"
    >
      <tw-tab-panel value="tab1" label="Tab 1" data-testid="panel-1">
        Content for Tab 1
      </tw-tab-panel>
      <tw-tab-panel value="tab2" label="Tab 2" data-testid="panel-2">
        Content for Tab 2
      </tw-tab-panel>
      <tw-tab-panel value="tab3" label="Tab 3" [disabled]="tab3Disabled()" data-testid="panel-3">
        Content for Tab 3
      </tw-tab-panel>
    </tw-tabs>
  `,
  standalone: true,
  imports: [TwTabsComponent, TwTabPanelComponent],
})
class TestHostComponent {
  @ViewChild(TwTabsComponent) tabs!: TwTabsComponent;
  activeTab = 'tab1';
  variant: TabsVariant = 'line';
  size: TabsSize = 'md';
  fullWidth = false;
  tab3Disabled = signal(false);
  tabChangeCount = 0;
  lastSelectedTab = '';

  onTabChange(value: string): void {
    this.tabChangeCount++;
    this.lastSelectedTab = value;
  }
}

describe('TwTabsComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let tabsEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tabsEl = fixture.debugElement.query(By.directive(TwTabsComponent)).nativeElement;
  });

  it('should create the tabs', () => {
    expect(tabsEl).toBeTruthy();
    expect(component.tabs).toBeTruthy();
  });

  it('should render tab buttons', () => {
    const tabButtons = fixture.debugElement.queryAll(By.css('[role="tab"]'));
    expect(tabButtons.length).toBe(3);
  });

  it('should render tab panels', () => {
    const panels = fixture.debugElement.queryAll(By.css('[role="tabpanel"]'));
    expect(panels.length).toBe(3);
  });

  it('should show first tab content by default', () => {
    const panel1 = fixture.debugElement.query(By.css('[data-testid="panel-1"]'));
    expect(panel1.nativeElement.textContent).toContain('Content for Tab 1');
    expect(panel1.nativeElement.getAttribute('hidden')).toBeNull();

    const panel2 = fixture.debugElement.query(By.css('[data-testid="panel-2"]'));
    expect(panel2.nativeElement.getAttribute('hidden')).toBe('true');
  });

  describe('variants', () => {
    it('should have default line variant styles', () => {
      const tabList = fixture.debugElement.query(By.css('[role="tablist"]'));
      expect(tabList).toBeTruthy();
    });

    const activeTabClasses = (variant: TabsVariant): string[] => {
      const f = TestBed.createComponent(TestHostComponent);
      f.componentInstance.variant = variant;
      f.detectChanges();
      return (
        f.debugElement.query(By.css('[role="tab"][aria-selected="true"]'))
          .nativeElement as HTMLElement
      ).className.split(/\s+/);
    };

    it('should keep the active pill white-on-blue in dark mode and on hover', () => {
      const cls = activeTabClasses('pills');
      // Inactive dark:text-slate-400 / dark:hover:bg-slate-800 would otherwise outrank the
      // unprefixed active colours in dark mode (slate-400 on blue-600 is ~2.2:1)
      expect(cls).toEqual(
        expect.arrayContaining([
          'dark:text-white',
          'dark:hover:text-white',
          'dark:hover:bg-blue-700',
        ])
      );
      expect(cls).not.toContain('dark:text-slate-400');
      expect(cls).not.toContain('dark:hover:bg-slate-800');
    });

    it('should keep the active line tab indicator while hovered', () => {
      const cls = activeTabClasses('line');
      expect(cls).toEqual(
        expect.arrayContaining([
          'hover:border-blue-500',
          'hover:text-blue-600',
          'dark:hover:text-blue-400',
        ])
      );
      expect(cls).not.toContain('hover:border-slate-300');
      expect(cls).not.toContain('hover:text-slate-900');
      expect(cls).not.toContain('dark:hover:border-slate-600');
      expect(cls).not.toContain('dark:hover:text-slate-100');
    });
  });

  describe('sizes', () => {
    it('should apply default size', () => {
      const tabButton = fixture.debugElement.query(By.css('[role="tab"]'));
      expect(tabButton).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const tabList = fixture.debugElement.query(By.css('[role="tablist"]'));
      expect(tabList).toBeTruthy();
      expect(tabList.nativeElement.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('should link tabs to panels', () => {
      const tab1Button = fixture.debugElement.queryAll(By.css('[role="tab"]'))[0];
      const panel1 = fixture.debugElement.query(By.css('[data-testid="panel-1"]'));

      const tabId = tab1Button.nativeElement.id;
      const panelLabelledBy = panel1.nativeElement.getAttribute('aria-labelledby');

      expect(panelLabelledBy).toBe(tabId);
    });

    it('should give each panel an id matching the tab aria-controls', () => {
      const tabButtons = fixture.debugElement.queryAll(By.css('[role="tab"]'));
      const panel1 = fixture.debugElement.query(By.css('[data-testid="panel-1"]'));

      expect(panel1.nativeElement.id).toMatch(/^tw-tabs-\d+-panel-tab1$/);
      expect(tabButtons[0].nativeElement.getAttribute('aria-controls')).toBe(
        panel1.nativeElement.id
      );
    });

    it('should show a focus ring on the focusable tab panel', () => {
      const panel = fixture.debugElement.query(By.css('[role="tabpanel"]')).nativeElement;
      expect(panel.getAttribute('tabindex')).toBe('0');
      expect(panel.className).toContain('focus-visible:ring-2');
      expect(panel.className).toContain('focus-visible:ring-blue-500');
    });

    it('should set tabindex correctly', () => {
      const tabButtons = fixture.debugElement.queryAll(By.css('[role="tab"]'));

      expect(tabButtons[0].nativeElement.getAttribute('tabindex')).toBe('0');
      expect(tabButtons[1].nativeElement.getAttribute('tabindex')).toBe('-1');
    });

    it('should keep a tab stop on the first enabled tab when the active tab becomes disabled', () => {
      component.tabs.select('tab3');
      fixture.detectChanges();
      component.tab3Disabled.set(true);
      fixture.detectChanges();

      const tabButtons = fixture.debugElement.queryAll(By.css('[role="tab"]'));
      expect(tabButtons.map(t => t.nativeElement.getAttribute('tabindex'))).toEqual([
        '0',
        '-1',
        '-1',
      ]);
      expect(tabButtons[2].nativeElement.disabled).toBe(true);
      expect(tabButtons[2].nativeElement.getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('fullWidth', () => {
    it('should have flex layout by default', () => {
      const tabList = fixture.debugElement.query(By.css('[role="tablist"]'));
      expect(tabList.nativeElement.className).toContain('flex');
    });
  });
});

@Component({
  template: `
    <tw-tabs [animated]="false">
      <tw-tab-panel value="a" label="A" data-testid="panel-a">Content A</tw-tab-panel>
      <tw-tab-panel value="b" label="B" [lazy]="true" data-testid="panel-b">Lazy B</tw-tab-panel>
    </tw-tabs>
  `,
  standalone: true,
  imports: [TwTabsComponent, TwTabPanelComponent],
})
class LazyTabsHostComponent {
  @ViewChild(TwTabsComponent) tabs!: TwTabsComponent;
}

describe('TwTabsComponent lazy panels', () => {
  let fixture: ComponentFixture<LazyTabsHostComponent>;
  let component: LazyTabsHostComponent;

  const lazyPanel = () => fixture.debugElement.query(By.css('[data-testid="panel-b"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LazyTabsHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(LazyTabsHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should not render lazy panel content before first activation', () => {
    expect(lazyPanel().nativeElement.textContent).not.toContain('Lazy B');
  });

  it('should render lazy panel content on activation', () => {
    component.tabs.select('b');
    fixture.detectChanges();
    expect(lazyPanel().nativeElement.textContent).toContain('Lazy B');
    expect(lazyPanel().nativeElement.getAttribute('hidden')).toBeNull();
  });

  it('should keep lazy panel content rendered after deactivation', () => {
    component.tabs.select('b');
    fixture.detectChanges();
    component.tabs.select('a');
    fixture.detectChanges();

    // Content is retained ("load once"), only hidden
    expect(lazyPanel().nativeElement.textContent).toContain('Lazy B');
    expect(lazyPanel().nativeElement.getAttribute('hidden')).toBe('true');
  });
});

@Component({
  template: `
    <tw-tabs [(value)]="active">
      <tw-tab-panel value="one" label="One">One</tw-tab-panel>
      <tw-tab-panel value="two" label="Two">Two</tw-tab-panel>
    </tw-tabs>
    <tw-tabs>
      <tw-tab-panel value="one" label="One">Other one</tw-tab-panel>
    </tw-tabs>
  `,
  standalone: true,
  imports: [TwTabsComponent, TwTabPanelComponent],
})
class MultiTabsHostComponent {
  active = signal('one');
}

describe('TwTabsComponent (multiple instances / external value)', () => {
  let fixture: ComponentFixture<MultiTabsHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiTabsHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(MultiTabsHostComponent);
    fixture.detectChanges();
  });

  it('should generate unique tab and panel ids across instances', () => {
    const ids = [...fixture.nativeElement.querySelectorAll('[role="tab"], [role="tabpanel"]')].map(
      (el: Element) => el.id
    );
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);

    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    tabs.forEach((tab: Element) => {
      const panel = document.querySelector(`[id="${tab.getAttribute('aria-controls')}"]`);
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
    });
  });

  it('should activate the tab when the bound value changes after init', () => {
    fixture.componentInstance.active.set('two');
    fixture.detectChanges();

    const panels = fixture.debugElement.queryAll(By.directive(TwTabPanelComponent));
    expect(panels[0].componentInstance.active()).toBe(false);
    expect(panels[1].componentInstance.active()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('[role="tab"]')[1].getAttribute('tabindex')).toBe(
      '0'
    );
  });
});

@Component({
  template: `
    <tw-tabs value="a">
      <tw-tab-panel value="a" label="A">A</tw-tab-panel>
      @if (showB()) {
        <tw-tab-panel value="b" label="B">B</tw-tab-panel>
      }
    </tw-tabs>
  `,
  standalone: true,
  imports: [TwTabsComponent, TwTabPanelComponent],
})
class DynamicTabsHostComponent {
  showB = signal(false);
}

describe('TwTabsComponent (dynamic panels)', () => {
  it('should render a tab button for a panel added after init', async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicTabsHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    const fixture = TestBed.createComponent(DynamicTabsHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[role="tab"]').length).toBe(1);

    fixture.componentInstance.showB.set(true);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
    expect(tabs[1].textContent.trim()).toBe('B');
  });
});

@Component({
  template: `
    <tw-tabs value="first tab">
      <tw-tab-panel value="first tab" label="First">First</tw-tab-panel>
      <tw-tab-panel value="first_tab" label="Underscore">Underscore</tw-tab-panel>
      <tw-tab-panel value='a"b#c' label="Quoted">Quoted</tw-tab-panel>
    </tw-tabs>
  `,
  standalone: true,
  imports: [TwTabsComponent, TwTabPanelComponent],
})
class SpacedValueTabsHostComponent {}

describe('TwTabsComponent (values with id-invalid characters)', () => {
  it('should produce valid, distinct, consistently linked ids', async () => {
    await TestBed.configureTestingModule({
      imports: [SpacedValueTabsHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    const fixture = TestBed.createComponent(SpacedValueTabsHostComponent);
    fixture.detectChanges();

    const tabs: HTMLElement[] = [...fixture.nativeElement.querySelectorAll('[role="tab"]')];
    const panels: HTMLElement[] = [...fixture.nativeElement.querySelectorAll('[role="tabpanel"]')];
    const ids = [...tabs, ...panels].map(el => el.id);

    expect(ids.every(id => /^[A-Za-z0-9_-]+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    tabs.forEach((tab, i) => {
      expect(tab.getAttribute('aria-controls')).toBe(panels[i].id);
      expect(panels[i].getAttribute('aria-labelledby')).toBe(tab.id);
    });
  });
});

@Component({
  template: `
    <tw-tabs>
      @for (tab of tabs(); track tab) {
        <tw-tab-panel [value]="tab" [label]="tab">{{ tab }} content</tw-tab-panel>
      }
    </tw-tabs>
  `,
  standalone: true,
  imports: [TwTabsComponent, TwTabPanelComponent],
})
class AsyncTabsHostComponent {
  tabs = signal<string[]>([]);
}

describe('TwTabsComponent (panels rendered after init)', () => {
  it('should activate the first tab and keep a tab stop when panels arrive or the active one is removed', async () => {
    await TestBed.configureTestingModule({
      imports: [AsyncTabsHostComponent],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(AsyncTabsHostComponent);
    fixture.detectChanges();

    const tabStops = () =>
      [...fixture.nativeElement.querySelectorAll('[role="tab"]')].filter(
        (t: HTMLElement) => t.getAttribute('tabindex') === '0'
      ) as HTMLElement[];
    const visiblePanels = () =>
      [...fixture.nativeElement.querySelectorAll('[role="tabpanel"]')].filter(
        (p: HTMLElement) => !p.hasAttribute('hidden')
      ) as HTMLElement[];

    // Data loaded after the tabs initialized with no panels
    fixture.componentInstance.tabs.set(['a', 'b']);
    fixture.detectChanges();
    expect(tabStops().map(t => t.textContent.trim())).toEqual(['a']);
    expect(visiblePanels().map(p => p.textContent.trim())).toEqual(['a content']);

    // Removing the active panel moves selection to a remaining tab
    fixture.componentInstance.tabs.set(['b']);
    fixture.detectChanges();
    expect(tabStops().map(t => t.textContent.trim())).toEqual(['b']);
    expect(visiblePanels().map(p => p.textContent.trim())).toEqual(['b content']);
  });
});

@Component({
  template: `
    <tw-tabs>
      <tw-tab-panel value="home" label="Home" icon="🏠">Home content</tw-tab-panel>
      <tw-tab-panel value="plain" label="Plain">Plain content</tw-tab-panel>
    </tw-tabs>
  `,
  standalone: true,
  imports: [TwTabsComponent, TwTabPanelComponent],
})
class IconTabsHostComponent {}

describe('TwTabsComponent (icon)', () => {
  it('should render the panel icon before the tab label', async () => {
    await TestBed.configureTestingModule({
      imports: [IconTabsHostComponent],
      providers: [TwClassService],
    }).compileComponents();
    const fixture = TestBed.createComponent(IconTabsHostComponent);
    fixture.detectChanges();

    const [home, plain] = [
      ...fixture.nativeElement.querySelectorAll('[role="tab"]'),
    ] as HTMLElement[];
    const icon = home.querySelector('span[aria-hidden="true"]');
    expect(icon?.textContent?.trim()).toBe('🏠');
    expect(home.textContent?.trim().endsWith('Home')).toBe(true);
    expect(plain.querySelector('span[aria-hidden="true"]')).toBeNull();
  });
});
