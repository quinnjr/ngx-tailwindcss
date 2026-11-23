import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TwAccordionComponent,
  TwAccordionHeaderDirective,
  TwAccordionItemComponent,
} from './accordion.component';

@Component({
  template: `
    <tw-accordion
      [allowMultiple]="allowMultiple()"
      [variant]="variant()"
      [defaultValue]="defaultValue()"
    >
      <tw-accordion-item
        value="item1"
        itemTitle="Item 1"
        [open]="item1Open()"
        (openChange)="onItem1Change($event)"
      >
        Content for item 1
      </tw-accordion-item>
      <tw-accordion-item value="item2" itemTitle="Item 2"> Content for item 2 </tw-accordion-item>
      <tw-accordion-item value="item3" itemTitle="Item 3" [itemDisabled]="true">
        Content for item 3
      </tw-accordion-item>
    </tw-accordion>
  `,
  standalone: true,
  imports: [TwAccordionComponent, TwAccordionItemComponent],
})
class TestHostComponent {
  @ViewChild(TwAccordionComponent) accordion!: TwAccordionComponent;
  allowMultiple = signal(false);
  variant = signal<'default' | 'bordered' | 'separated'>('default');
  defaultValue = signal<string | string[]>('');
  item1Open = signal(false);

  item1ChangeValue: boolean | null = null;

  onItem1Change(value: boolean) {
    this.item1ChangeValue = value;
  }
}

describe('TwAccordionComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let accordionEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    accordionEl = fixture.debugElement.query(By.directive(TwAccordionComponent)).nativeElement;
  });

  it('should create the accordion', () => {
    expect(accordionEl).toBeTruthy();
    expect(component.accordion).toBeTruthy();
  });

  it('should render all accordion items', () => {
    const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
    expect(items.length).toBe(3);
  });

  describe('variants', () => {
    it('should apply default variant classes', () => {
      const innerDiv = accordionEl.querySelector('div');
      expect(innerDiv?.className).toContain('border');
      expect(innerDiv?.className).toContain('rounded-lg');
    });

    it('should apply bordered variant classes', () => {
      component.variant.set('bordered');
      fixture.detectChanges();
      const innerDiv = accordionEl.querySelector('div');
      expect(innerDiv?.className).not.toContain('divide-y');
    });

    it('should apply separated variant classes', () => {
      component.variant.set('separated');
      fixture.detectChanges();
      const innerDiv = accordionEl.querySelector('div');
      expect(innerDiv?.className).not.toContain('divide-y');
    });

    it('should re-propagate variant changes to items', () => {
      component.variant.set('separated');
      fixture.detectChanges();
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      const itemWrapper = items[0].nativeElement.querySelector('div');
      expect(itemWrapper?.className).toContain('bg-slate-50');

      component.variant.set('bordered');
      fixture.detectChanges();
      fixture.detectChanges();

      expect(itemWrapper?.className).toContain('border');
      expect(itemWrapper?.className).not.toContain('bg-slate-50');
    });
  });

  describe('single mode (allowMultiple=false)', () => {
    it('should open clicked item', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      const header = items[0].query(By.css('button'));
      header.nativeElement.click();
      fixture.detectChanges();

      const content = items[0].query(By.css('[role="region"]:not([hidden])'));
      expect(content).toBeTruthy();
    });

    it('should close other items when opening one', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));

      // Open first item
      items[0].query(By.css('button')).nativeElement.click();
      fixture.detectChanges();

      // Open second item
      items[1].query(By.css('button')).nativeElement.click();
      fixture.detectChanges();

      // First item should be closed (no content visible)
      const firstItemContent = items[0].nativeElement.querySelector(
        '[role="region"]:not([hidden])'
      );
      expect(firstItemContent).toBeNull();
    });

    it('should emit openChange(false) for an item closed by opening another', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      items[0].query(By.css('button')).nativeElement.click();
      fixture.detectChanges();
      expect(component.item1ChangeValue).toBe(true);

      items[1].query(By.css('button')).nativeElement.click();
      fixture.detectChanges();
      // Keeps an `[(open)]` binding on the first item in sync
      expect(component.item1ChangeValue).toBe(false);
    });
  });

  describe('multiple mode (allowMultiple=true)', () => {
    beforeEach(() => {
      component.allowMultiple.set(true);
      fixture.detectChanges();
    });

    it('should allow multiple items to be open', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));

      // Open first item
      items[0].query(By.css('button')).nativeElement.click();
      fixture.detectChanges();

      // Open second item
      items[1].query(By.css('button')).nativeElement.click();
      fixture.detectChanges();

      // Both items should have content visible
      const firstContent = items[0].query(By.css('[role="region"]:not([hidden])'));
      const secondContent = items[1].query(By.css('[role="region"]:not([hidden])'));
      expect(firstContent).toBeTruthy();
      expect(secondContent).toBeTruthy();
    });
  });

  describe('default value', () => {
    it('should open item with matching default value', () => {
      component.defaultValue.set('item2');
      fixture.detectChanges();

      // Need to re-init since ngAfterContentInit runs once
      fixture = TestBed.createComponent(TestHostComponent);
      fixture.componentInstance.defaultValue.set('item2');
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      const content = items[1].query(By.css('[role="region"]:not([hidden])'));
      expect(content).toBeTruthy();
    });
  });

  describe('disabled items', () => {
    it('should not toggle disabled item', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      const disabledHeader = items[2].query(By.css('button'));

      disabledHeader.nativeElement.click();
      fixture.detectChanges();

      const content = items[2].query(By.css('[role="region"]:not([hidden])'));
      expect(content).toBeNull();
    });

    it('should apply disabled styling', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      const disabledHeader = items[2].query(By.css('button'));
      expect(disabledHeader.nativeElement.className).toContain('cursor-not-allowed');
    });

    it('should disable the header button and set aria-disabled', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      const disabledHeader = items[2].query(By.css('button')).nativeElement as HTMLButtonElement;

      expect(disabledHeader.disabled).toBe(true);
      expect(disabledHeader.getAttribute('aria-disabled')).toBe('true');

      const enabledHeader = items[0].query(By.css('button')).nativeElement as HTMLButtonElement;
      expect(enabledHeader.disabled).toBe(false);
      expect(enabledHeader.getAttribute('aria-disabled')).toBe('false');
    });
  });

  describe('accessibility wiring', () => {
    it('should link the header button to the panel via aria-controls', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      const header = items[0].query(By.css('button')).nativeElement as HTMLButtonElement;

      header.click();
      fixture.detectChanges();

      const panel = items[0].nativeElement.querySelector('[role="region"]') as HTMLElement;
      expect(panel).toBeTruthy();
      expect(header.id).toBeTruthy();
      expect(panel.id).toBeTruthy();
      expect(header.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-labelledby')).toBe(header.id);
    });

    it('should keep aria-controls resolvable while the item is collapsed', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      const header = items[0].query(By.css('button')).nativeElement as HTMLButtonElement;

      expect(header.getAttribute('aria-expanded')).toBe('false');
      const controlsId = header.getAttribute('aria-controls');
      const panel = items[0].nativeElement.querySelector(`#${controlsId}`) as HTMLElement;
      expect(panel).toBeTruthy();
      expect(panel.hidden).toBe(true);
    });

    it('should wrap each header button in a level-3 heading by default', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      for (const item of items) {
        const button = item.query(By.css('button')).nativeElement as HTMLButtonElement;
        const heading = button.parentElement!;
        expect(heading.getAttribute('role')).toBe('heading');
        expect(heading.getAttribute('aria-level')).toBe('3');
        expect(heading.children.length).toBe(1);
      }
    });

    it('should set aria-expanded on the header button', () => {
      const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
      const header = items[0].query(By.css('button')).nativeElement as HTMLButtonElement;

      expect(header.getAttribute('aria-expanded')).toBe('false');

      header.click();
      fixture.detectChanges();

      expect(header.getAttribute('aria-expanded')).toBe('true');
    });
  });
});

describe('TwAccordionItemComponent', () => {
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

  it('should render item title', () => {
    const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
    expect(items[0].nativeElement.textContent).toContain('Item 1');
  });

  it('should render content when open', () => {
    const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
    items[0].query(By.css('button')).nativeElement.click();
    fixture.detectChanges();

    expect(items[0].nativeElement.textContent).toContain('Content for item 1');
  });

  it('should toggle on click', () => {
    const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
    const header = items[0].query(By.css('button'));

    // Open
    header.nativeElement.click();
    fixture.detectChanges();
    expect(component.item1ChangeValue).toBe(true);

    // Close
    header.nativeElement.click();
    fixture.detectChanges();
    expect(component.item1ChangeValue).toBe(false);
  });

  it('should have chevron icon that rotates when open', () => {
    const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
    const icon = items[0].query(By.css('svg'));

    // SVG elements use getAttribute('class') instead of className
    expect(icon.nativeElement.getAttribute('class')).not.toContain('rotate-180');

    items[0].query(By.css('button')).nativeElement.click();
    fixture.detectChanges();

    expect(icon.nativeElement.getAttribute('class')).toContain('rotate-180');
  });

  it('should emit openChange event', () => {
    const items = fixture.debugElement.queryAll(By.directive(TwAccordionItemComponent));
    items[0].query(By.css('button')).nativeElement.click();
    fixture.detectChanges();

    expect(component.item1ChangeValue).toBe(true);
  });
});

@Component({
  template: `
    <tw-accordion>
      <tw-accordion-item value="custom" itemTitle="Fallback Title">
        <span twAccordionHeader class="custom-header">Custom Header</span>
        Content
      </tw-accordion-item>
    </tw-accordion>
  `,
  standalone: true,
  imports: [TwAccordionComponent, TwAccordionItemComponent, TwAccordionHeaderDirective],
})
class CustomHeaderHostComponent {}

describe('TwAccordionItemComponent with custom header', () => {
  let fixture: ComponentFixture<CustomHeaderHostComponent>;
  let itemEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomHeaderHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomHeaderHostComponent);
    fixture.detectChanges();
    itemEl = fixture.debugElement.query(By.directive(TwAccordionItemComponent)).nativeElement;
  });

  it('should render the projected header content', () => {
    const header = itemEl.querySelector('.custom-header');
    expect(header).toBeTruthy();
    expect(header?.textContent).toContain('Custom Header');
  });

  it('should not render the itemTitle alongside the custom header', () => {
    expect(itemEl.textContent).not.toContain('Fallback Title');
  });
});

@Component({
  template: `
    <tw-accordion>
      <tw-accordion-item itemTitle="First">One</tw-accordion-item>
      <tw-accordion-item itemTitle="Second">Two</tw-accordion-item>
    </tw-accordion>
  `,
  standalone: true,
  imports: [TwAccordionComponent, TwAccordionItemComponent],
})
class NoValueHostComponent {}

describe('TwAccordionComponent with items without a value', () => {
  it('should start with every item collapsed when no defaultValue is set', async () => {
    await TestBed.configureTestingModule({ imports: [NoValueHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(NoValueHostComponent);
    fixture.detectChanges();

    const headers = fixture.debugElement.queryAll(By.css('tw-accordion-item button'));
    expect(headers.length).toBe(2);
    for (const header of headers) {
      expect(header.nativeElement.getAttribute('aria-expanded')).toBe('false');
    }
  });
});

@Component({
  template: `
    <tw-accordion [headingLevel]="accordionLevel()">
      <tw-accordion-item value="a" itemTitle="A">A</tw-accordion-item>
      <tw-accordion-item value="b" itemTitle="B">B</tw-accordion-item>
    </tw-accordion>
    <tw-accordion>
      <tw-accordion-item value="c" itemTitle="C" [headingLevel]="itemLevel()">C</tw-accordion-item>
    </tw-accordion>
  `,
  standalone: true,
  imports: [TwAccordionComponent, TwAccordionItemComponent],
})
class HeadingLevelHostComponent {
  accordionLevel = signal<number>(2);
  itemLevel = signal<number>(4);
}

describe('TwAccordion headingLevel', () => {
  let fixture: ComponentFixture<HeadingLevelHostComponent>;

  const levels = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="heading"]')].map(h =>
      h.getAttribute('aria-level')
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeadingLevelHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HeadingLevelHostComponent);
    fixture.detectChanges();
  });

  it('applies the accordion level to all items and honours an item-level override', () => {
    expect(levels()).toEqual(['2', '2', '4']);
  });

  it('updates when the level changes and falls back to 3 for out-of-range values', () => {
    fixture.componentInstance.accordionLevel.set(5);
    fixture.componentInstance.itemLevel.set(9);
    fixture.detectChanges();
    expect(levels()).toEqual(['5', '5', '3']);
  });
});
