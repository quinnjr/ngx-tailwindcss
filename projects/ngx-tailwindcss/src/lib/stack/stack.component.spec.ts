import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  StackAlign,
  StackDirection,
  StackJustify,
  StackSpacing,
  TwHStackComponent,
  TwStackComponent,
  TwVStackComponent,
} from './stack.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-stack
      [direction]="direction()"
      [spacing]="spacing()"
      [align]="align()"
      [justify]="justify()"
      [wrap]="wrap()"
      [fullWidth]="fullWidth()"
      [class]="classInput()"
    >
      <div>Item 1</div>
      <div>Item 2</div>
    </tw-stack>
  `,
  standalone: true,
  imports: [TwStackComponent],
})
class TestHostComponent {
  direction = signal<StackDirection>('vertical');
  spacing = signal<StackSpacing>('md');
  align = signal<StackAlign>('stretch');
  justify = signal<StackJustify>('start');
  wrap = signal(false);
  fullWidth = signal(false);
  classInput = signal('');
}

describe('TwStackComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  const stackDiv = (): HTMLElement =>
    fixture.debugElement.query(By.css('tw-stack div')).nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render projected content', () => {
    expect(stackDiv().textContent).toContain('Item 1');
    expect(stackDiv().textContent).toContain('Item 2');
  });

  it('should output vertical flex classes by default', () => {
    const { className } = stackDiv();
    expect(className).toContain('flex');
    expect(className).toContain('flex-col');
    expect(className).toContain('gap-4');
    expect(className).toContain('items-stretch');
    expect(className).toContain('justify-start');
  });

  it('should react to direction changes', () => {
    component.direction.set('horizontal-reverse');
    fixture.detectChanges();
    expect(stackDiv().className).toContain('flex-row-reverse');
  });

  it('should map spacing, align and justify to classes', () => {
    component.spacing.set('xl');
    component.align.set('center');
    component.justify.set('between');
    fixture.detectChanges();

    const { className } = stackDiv();
    expect(className).toContain('gap-8');
    expect(className).toContain('items-center');
    expect(className).toContain('justify-between');
  });

  it('should apply wrap and fullWidth classes', () => {
    component.wrap.set(true);
    component.fullWidth.set(true);
    fixture.detectChanges();

    const { className } = stackDiv();
    expect(className).toContain('flex-wrap');
    expect(className).toContain('w-full');
  });

  it('should append custom classes', () => {
    component.classInput.set('custom-class');
    fixture.detectChanges();
    expect(stackDiv().className).toContain('custom-class');
  });
});

describe('TwVStackComponent', () => {
  it('should output vertical flex classes', async () => {
    @Component({
      template: `<tw-vstack spacing="sm"><div>Item</div></tw-vstack>`,
      standalone: true,
      imports: [TwVStackComponent],
    })
    class VStackHostComponent {}

    await TestBed.configureTestingModule({
      imports: [VStackHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    const fixture = TestBed.createComponent(VStackHostComponent);
    fixture.detectChanges();

    const div = fixture.debugElement.query(By.css('tw-vstack div')).nativeElement as HTMLElement;
    expect(div.className).toContain('flex-col');
    expect(div.className).toContain('gap-2');
    expect(div.className).toContain('items-stretch');
  });
});

describe('TwHStackComponent', () => {
  it('should output horizontal flex classes with centered alignment', async () => {
    @Component({
      template: `<tw-hstack spacing="lg" [wrap]="true"><div>Item</div></tw-hstack>`,
      standalone: true,
      imports: [TwHStackComponent],
    })
    class HStackHostComponent {}

    await TestBed.configureTestingModule({
      imports: [HStackHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    const fixture = TestBed.createComponent(HStackHostComponent);
    fixture.detectChanges();

    const div = fixture.debugElement.query(By.css('tw-hstack div')).nativeElement as HTMLElement;
    expect(div.className).toContain('flex-row');
    expect(div.className).toContain('gap-6');
    expect(div.className).toContain('items-center');
    expect(div.className).toContain('flex-wrap');
  });
});

describe('Stack bare boolean attributes', () => {
  it('should treat bare wrap/fullWidth attributes as true', async () => {
    @Component({
      template: `
        <tw-stack wrap fullWidth><div>Item</div></tw-stack>
        <tw-hstack wrap><div>Item</div></tw-hstack>
      `,
      standalone: true,
      imports: [TwStackComponent, TwHStackComponent],
    })
    class BareAttrHostComponent {}

    await TestBed.configureTestingModule({
      imports: [BareAttrHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    const fixture = TestBed.createComponent(BareAttrHostComponent);
    fixture.detectChanges();

    const stack = fixture.debugElement.query(By.css('tw-stack div')).nativeElement as HTMLElement;
    expect(stack.className).toContain('flex-wrap');
    expect(stack.className).toContain('w-full');

    const hstack = fixture.debugElement.query(By.css('tw-hstack div')).nativeElement as HTMLElement;
    expect(hstack.className).toContain('flex-wrap');
  });
});

describe('Stack static class attribute', () => {
  it('forwards a static class to the inner element without painting it on the host too', async () => {
    @Component({
      template: `<tw-hstack class="tw-test-box p-4 extra"><div>Item</div></tw-hstack>`,
      standalone: true,
      imports: [TwHStackComponent],
    })
    class StaticClassHostComponent {}

    // Stand-in for utility classes defined by the app's stylesheet
    const style = document.createElement('style');
    style.textContent =
      '.tw-test-box { padding: 16px; border: 2px solid red; background: red; opacity: 0.5; }';
    document.head.append(style);

    try {
      await TestBed.configureTestingModule({
        imports: [StaticClassHostComponent],
        providers: [TwClassService],
      }).compileComponents();

      const fixture = TestBed.createComponent(StaticClassHostComponent);
      fixture.detectChanges();

      const host = fixture.debugElement.query(By.css('tw-hstack')).nativeElement as HTMLElement;
      const inner = host.querySelector('div') as HTMLElement;

      // Angular keeps the static class on the host as well as passing it to the input
      expect(host.classList.contains('tw-test-box')).toBe(true);
      expect(inner.className).toContain('tw-test-box');
      expect(inner.className).toContain('p-4');

      const hostStyle = getComputedStyle(host);
      expect(hostStyle.paddingTop).toBe('0px');
      expect(hostStyle.borderTopWidth).toBe('0px');
      expect(hostStyle.opacity).toBe('1');

      const innerStyle = getComputedStyle(inner);
      expect(innerStyle.paddingTop).toBe('16px');
      expect(innerStyle.borderTopWidth).toBe('2px');
    } finally {
      style.remove();
    }
  });
});
