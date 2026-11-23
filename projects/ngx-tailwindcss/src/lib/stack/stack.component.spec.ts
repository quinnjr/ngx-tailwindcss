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

  const stackEl = (): HTMLElement => fixture.debugElement.query(By.css('tw-stack')).nativeElement;

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
    expect(stackEl().textContent).toContain('Item 1');
    expect(stackEl().textContent).toContain('Item 2');
  });

  it('should output vertical flex classes by default', () => {
    const { className } = stackEl();
    expect(className).toContain('flex');
    expect(className).toContain('flex-col');
    expect(className).toContain('gap-4');
    expect(className).toContain('items-stretch');
    expect(className).toContain('justify-start');
  });

  it('should react to direction changes', () => {
    component.direction.set('horizontal-reverse');
    fixture.detectChanges();
    expect(stackEl().className).toContain('flex-row-reverse');
  });

  it('should map spacing, align and justify to classes', () => {
    component.spacing.set('xl');
    component.align.set('center');
    component.justify.set('between');
    fixture.detectChanges();

    const { className } = stackEl();
    expect(className).toContain('gap-8');
    expect(className).toContain('items-center');
    expect(className).toContain('justify-between');
  });

  it('should apply wrap and fullWidth classes', () => {
    component.wrap.set(true);
    component.fullWidth.set(true);
    fixture.detectChanges();

    const { className } = stackEl();
    expect(className).toContain('flex-wrap');
    expect(className).toContain('w-full');
  });

  it('should append custom classes', () => {
    component.classInput.set('custom-class');
    fixture.detectChanges();
    expect(stackEl().className).toContain('custom-class');
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

    const div = fixture.debugElement.query(By.css('tw-vstack')).nativeElement as HTMLElement;
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

    const div = fixture.debugElement.query(By.css('tw-hstack')).nativeElement as HTMLElement;
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

    const stack = fixture.debugElement.query(By.css('tw-stack')).nativeElement as HTMLElement;
    expect(stack.className).toContain('flex-wrap');
    expect(stack.className).toContain('w-full');

    const hstack = fixture.debugElement.query(By.css('tw-hstack')).nativeElement as HTMLElement;
    expect(hstack.className).toContain('flex-wrap');
  });
});

describe('Stack class attribute (host is the styled box)', () => {
  @Component({
    template: `<tw-stack class="tw-test-box gap-2" [direction]="direction()"
        ><span>a</span><span>b</span></tw-stack
      ><tw-vstack class="hidden md:flex"><span>x</span></tw-vstack
      ><tw-hstack [class]="dynamic()"><span>x</span></tw-hstack>`,
    standalone: true,
    imports: [TwStackComponent, TwVStackComponent, TwHStackComponent],
  })
  class ClassHostComponent {
    direction = signal<StackDirection>('vertical');
    dynamic = signal('p-4');
  }

  let fixture: ComponentFixture<ClassHostComponent>;
  const el = (selector: string): HTMLElement =>
    fixture.debugElement.query(By.css(selector)).nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassHostComponent],
      providers: [TwClassService],
    }).compileComponents();
    fixture = TestBed.createComponent(ClassHostComponent);
    fixture.detectChanges();
  });

  it('renders no wrapper element, so a forwarded class applies exactly once', () => {
    const host = el('tw-stack');
    expect(host.querySelector('div')).toBeNull();
    expect([...host.children].map(c => c.tagName)).toEqual(['SPAN', 'SPAN']);
    expect(host.classList.contains('tw-test-box')).toBe(true);
    expect(host.classList.contains('flex')).toBe(true);
  });

  it('paints utilities such as padding/border on the host itself', () => {
    const style = document.createElement('style');
    style.textContent = '.tw-test-box { padding: 16px; border: 2px solid red; }';
    document.head.append(style);
    try {
      const hostStyle = getComputedStyle(el('tw-stack'));
      expect(hostStyle.paddingTop).toBe('16px');
      expect(hostStyle.borderTopWidth).toBe('2px');
    } finally {
      style.remove();
    }
  });

  it('lets a static class override the conflicting default class', () => {
    const host = el('tw-stack');
    expect(host.classList.contains('gap-2')).toBe(true);
    expect(host.classList.contains('gap-4')).toBe(false);
  });

  it('lets a display utility replace the default flex display', () => {
    const host = el('tw-vstack');
    expect(host.classList.contains('hidden')).toBe(true);
    expect(host.classList.contains('md:flex')).toBe(true);
    expect(host.classList.contains('flex')).toBe(false);
  });

  it('keeps static classes when other inputs change', () => {
    fixture.componentInstance.direction.set('horizontal');
    fixture.detectChanges();
    const host = el('tw-stack');
    expect(host.classList.contains('flex-row')).toBe(true);
    expect(host.classList.contains('flex-col')).toBe(false);
    expect(host.classList.contains('tw-test-box')).toBe(true);
    expect(host.classList.contains('gap-2')).toBe(true);
  });

  it('replaces a bound [class] value on change', () => {
    expect(el('tw-hstack').classList.contains('p-4')).toBe(true);
    fixture.componentInstance.dynamic.set('p-2');
    fixture.detectChanges();
    const host = el('tw-hstack');
    expect(host.classList.contains('p-2')).toBe(true);
    expect(host.classList.contains('p-4')).toBe(false);
    expect(host.classList.contains('flex-row')).toBe(true);
  });
});
