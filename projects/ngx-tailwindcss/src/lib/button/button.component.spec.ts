import { Component, DebugElement, signal, ViewChild } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonSize,
  ButtonVariant,
  TwButtonComponent,
  TwButtonLinkComponent,
} from './button.component';
import { TwClassService } from '../core/tw-class.service';

@Component({
  template: `
    <tw-button
      [variant]="variant()"
      [size]="size()"
      [disabled]="disabled()"
      [loading]="loading()"
      [fullWidth]="fullWidth()"
      [iconOnly]="iconOnly()"
      [ripple]="ripple()"
      [classOverride]="classOverride()"
      [classReplace]="classReplace()"
      (click)="onClick()"
      data-testid="test-button"
    >
      {{ buttonText() }}
    </tw-button>
  `,
  standalone: true,
  imports: [TwButtonComponent],
})
class TestHostComponent {
  @ViewChild(TwButtonComponent) button!: TwButtonComponent;
  variant = signal<ButtonVariant>('primary');
  size = signal<ButtonSize>('md');
  disabled = signal(false);
  loading = signal(false);
  fullWidth = signal(false);
  iconOnly = signal(false);
  ripple = signal(true);
  classOverride = signal('');
  classReplace = signal('');
  buttonText = signal('Click me');
  clickCount = 0;

  onClick(): void {
    this.clickCount++;
  }
}

describe('TwButtonComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let buttonEl: DebugElement;
  let buttonNative: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    buttonEl = fixture.debugElement.query(By.directive(TwButtonComponent));
    buttonNative = buttonEl.nativeElement;
  });

  it('should create the button', () => {
    expect(buttonEl).toBeTruthy();
    expect(component.button).toBeTruthy();
  });

  it('should render button text', () => {
    expect(buttonNative.textContent).toContain('Click me');
  });

  it('should have role="button"', () => {
    expect(buttonNative.getAttribute('role')).toBe('button');
  });

  describe('variants', () => {
    it('should apply default primary variant classes', () => {
      const classes = buttonNative.className;
      expect(classes).toBeTruthy();
      expect(classes).toContain('bg-blue-600');
    });

    it('should update classes when variant changes', () => {
      component.variant.set('danger');
      fixture.detectChanges();

      expect(buttonNative.className).toContain('bg-rose-600');
      expect(buttonNative.className).not.toContain('bg-blue-600');
    });

    it('should use AA-contrast text on warning, success and info buttons', () => {
      component.variant.set('warning');
      fixture.detectChanges();
      // white on amber-500 is ~2.2:1
      expect(buttonNative.className).toContain('text-amber-950');
      expect(buttonNative.className).not.toContain('text-white');

      component.variant.set('success');
      fixture.detectChanges();
      expect(buttonNative.className).toContain('bg-emerald-700');

      component.variant.set('info');
      fixture.detectChanges();
      expect(buttonNative.className).toContain('bg-cyan-700');
    });

    it('should lighten the link variant in dark mode', () => {
      component.variant.set('link');
      fixture.detectChanges();
      // blue-600 on a dark background is ~3.6:1
      expect(buttonNative.className).toContain('dark:text-blue-400');
    });

    it('should draw a >= 3:1 focus ring on warning, success and info buttons', () => {
      // the -500 rings are ~2.2-2.5:1 against the white offset and page
      for (const [variant, ring] of [
        ['warning', 'focus-visible:ring-amber-600'],
        ['success', 'focus-visible:ring-emerald-700'],
        ['info', 'focus-visible:ring-cyan-700'],
      ] as const) {
        component.variant.set(variant);
        fixture.detectChanges();
        expect(buttonNative.className).toContain(ring);
      }
    });
  });

  describe('sizes', () => {
    it('should apply default md size classes', () => {
      const classes = buttonNative.className;
      expect(classes).toContain('text-base');
    });

    it('should update classes when size changes', () => {
      component.size.set('lg');
      fixture.detectChanges();

      expect(buttonNative.className).toContain('text-lg');
    });
  });

  describe('disabled state', () => {
    it('should set disabled attribute', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      expect(buttonNative.getAttribute('disabled')).toBe('true');
    });

    it('should set aria-disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      expect(buttonNative.getAttribute('aria-disabled')).toBe('true');
    });

    it('should set tabindex to -1 when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      expect(buttonNative.getAttribute('tabindex')).toBe('-1');
    });

    it('should apply disabled classes', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      expect(buttonNative.className).toContain('disabled:opacity-50');
    });

    it('should apply inert classes directly when disabled', () => {
      expect(buttonNative.classList.contains('pointer-events-none')).toBe(false);

      component.disabled.set(true);
      fixture.detectChanges();

      // classList checks are exact-token, so these cannot be satisfied
      // by the disabled:* variant classes
      expect(buttonNative.classList.contains('opacity-50')).toBe(true);
      expect(buttonNative.classList.contains('cursor-not-allowed')).toBe(true);
      expect(buttonNative.classList.contains('pointer-events-none')).toBe(true);
    });

    it('should not fire consumer click handlers when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      buttonNative.click();
      fixture.detectChanges();

      expect(component.clickCount).toBe(0);
    });

    it('should fire consumer click handlers when enabled', () => {
      buttonNative.click();
      fixture.detectChanges();

      expect(component.clickCount).toBe(1);
    });
  });

  describe('keyboard activation', () => {
    it('should fire click on Enter', () => {
      buttonNative.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(component.clickCount).toBe(1);
    });

    it('should fire click on Space', () => {
      buttonNative.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      fixture.detectChanges();

      expect(component.clickCount).toBe(1);
    });

    it('should not fire click on Enter when disabled', () => {
      component.disabled.set(true);
      fixture.detectChanges();

      buttonNative.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(component.clickCount).toBe(0);
    });
  });

  describe('loading state', () => {
    it('should show loading spinner', () => {
      component.loading.set(true);
      fixture.detectChanges();

      const spinner = buttonNative.querySelector('svg.animate-spin');
      expect(spinner).toBeTruthy();
    });

    it('should set aria-busy when loading', () => {
      component.loading.set(true);
      fixture.detectChanges();

      expect(buttonNative.getAttribute('aria-busy')).toBe('true');
    });

    it('should set disabled attribute when loading', () => {
      component.loading.set(true);
      fixture.detectChanges();

      expect(buttonNative.getAttribute('disabled')).toBe('true');
    });

    it('should have aria-busy when loading', () => {
      component.loading.set(true);
      fixture.detectChanges();

      expect(buttonNative.getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('fullWidth', () => {
    it('should apply w-full when fullWidth', () => {
      expect(buttonNative.className).not.toContain('w-full');

      component.fullWidth.set(true);
      fixture.detectChanges();

      expect(buttonNative.className).toContain('w-full');
    });
  });

  describe('iconOnly', () => {
    it('should apply icon-only classes when iconOnly', () => {
      component.iconOnly.set(true);
      fixture.detectChanges();

      expect(buttonNative.className).toContain('gap-0');
      expect(buttonNative.className).toContain('p-3');
    });
  });

  describe('class customization', () => {
    it('should have base button classes', () => {
      const classes = buttonNative.className;
      expect(classes).toContain('inline-flex');
      expect(classes).toContain('items-center');
    });

    it('should not pin display with an inline style', () => {
      // An inline display would beat `class="hidden md:inline-flex"`
      expect(buttonNative.style.display).toBe('');
    });

    it('keeps the host a flex box when classReplace sets no display', () => {
      component.classReplace.set('px-6 py-2 bg-black text-white');
      fixture.detectChanges();

      expect(buttonNative.className.split(' ').sort()).toEqual(
        ['bg-black', 'inline-flex', 'px-6', 'py-2', 'text-white'].sort()
      );
    });

    it('lets classReplace set its own display', () => {
      component.classReplace.set('hidden md:flex px-6');
      fixture.detectChanges();

      const classes = buttonNative.className.split(' ');
      expect(classes).not.toContain('inline-flex');
      expect(classes).toContain('hidden');
      expect(classes).toContain('md:flex');
    });
  });

  describe('public methods', () => {
    it('should provide nativeElement accessor', () => {
      expect(component.button.nativeElement).toBe(buttonNative);
    });

    it('should provide focus method', () => {
      const focusSpy = vi.spyOn(buttonNative, 'focus');
      component.button.focus();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should provide blur method', () => {
      const blurSpy = vi.spyOn(buttonNative, 'blur');
      component.button.blur();
      expect(blurSpy).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have tabindex 0 by default', () => {
      expect(buttonNative.getAttribute('tabindex')).toBe('0');
    });

    it('should have proper ARIA attributes', () => {
      expect(buttonNative.getAttribute('role')).toBe('button');
      expect(buttonNative.getAttribute('aria-disabled')).toBe('false');
    });
  });
});

@Component({
  template: `
    <a tw-button [variant]="variant()" [disabled]="disabled()" href="#" data-testid="button-link">
      Link Button
    </a>
  `,
  standalone: true,
  imports: [TwButtonLinkComponent],
})
class TestLinkComponent {
  @ViewChild(TwButtonLinkComponent) buttonLink!: TwButtonLinkComponent;
  variant = signal<ButtonVariant>('primary');
  disabled = signal(false);
}

describe('TwButtonLinkComponent', () => {
  let fixture: ComponentFixture<TestLinkComponent>;
  let component: TestLinkComponent;
  let linkEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestLinkComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestLinkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    linkEl = fixture.debugElement.query(By.directive(TwButtonLinkComponent)).nativeElement;
  });

  it('should create the link button', () => {
    expect(linkEl).toBeTruthy();
    expect(component.buttonLink).toBeTruthy();
  });

  it('should render as anchor element', () => {
    expect(linkEl.tagName.toLowerCase()).toBe('a');
  });

  it('should have href attribute', () => {
    expect(linkEl.getAttribute('href')).toBe('#');
  });

  it('should keep native link semantics (no role="button" or disabled attribute)', () => {
    expect(linkEl.hasAttribute('role')).toBe(false);

    component.disabled.set(true);
    fixture.detectChanges();

    expect(linkEl.hasAttribute('role')).toBe(false);
    expect(linkEl.hasAttribute('disabled')).toBe(false);
    expect(linkEl.getAttribute('aria-disabled')).toBe('true');
  });

  it('should apply pointer-events none when disabled', () => {
    component.disabled.set(true);
    fixture.detectChanges();

    expect(linkEl.style.pointerEvents).toBe('none');
  });

  it('should set aria-disabled when disabled', () => {
    component.disabled.set(true);
    fixture.detectChanges();

    expect(linkEl.getAttribute('aria-disabled')).toBe('true');
  });

  it('should not have pointer-events none when enabled', () => {
    component.disabled.set(false);
    fixture.detectChanges();

    expect(linkEl.style.pointerEvents).not.toBe('none');
  });

  it('should not pin display with an inline style', () => {
    expect(linkEl.style.display).toBe('');
  });
});

@Component({
  template: `<tw-button class="hidden fixed">Hidden</tw-button>`,
  standalone: true,
  imports: [TwButtonComponent],
})
class TestDisplayClassHostComponent {}

describe('TwButtonComponent display and position classes', () => {
  let style: HTMLStyleElement;

  beforeEach(async () => {
    style = document.createElement('style');
    style.textContent = '.hidden { display: none; } .fixed { position: fixed; }';
    document.head.append(style);
    await TestBed.configureTestingModule({
      imports: [TestDisplayClassHostComponent],
      providers: [TwClassService],
    }).compileComponents();
  });

  afterEach(() => {
    style.remove();
  });

  it('lets display and position utility classes apply to the host', () => {
    const fixture = TestBed.createComponent(TestDisplayClassHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('tw-button') as HTMLElement;

    expect(host.className).toContain('hidden');
    expect(host.className).toContain('fixed');
    expect(getComputedStyle(host).display).toBe('none');
    expect(getComputedStyle(host).position).toBe('fixed');
  });
});

@Component({
  template: `
    <tw-button>
      <svg twButtonIcon class="icon">Icon</svg>
      Button with icon
      <svg twButtonIconEnd class="icon-end">End Icon</svg>
    </tw-button>
  `,
  standalone: true,
  imports: [TwButtonComponent],
})
class ButtonWithIconsComponent {}

describe('TwButtonComponent with icons', () => {
  let fixture: ComponentFixture<ButtonWithIconsComponent>;
  let buttonEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonWithIconsComponent],
      providers: [TwClassService],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonWithIconsComponent);
    fixture.detectChanges();
    buttonEl = fixture.debugElement.query(By.directive(TwButtonComponent)).nativeElement;
  });

  it('should render leading icon', () => {
    const icon = buttonEl.querySelector('.icon');
    expect(icon).toBeTruthy();
  });

  it('should render trailing icon', () => {
    const iconEnd = buttonEl.querySelector('.icon-end');
    expect(iconEnd).toBeTruthy();
  });

  it('should render button text', () => {
    expect(buttonEl.textContent).toContain('Button with icon');
  });
});

const flushTimers = (): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve);
  });

describe('TwButtonComponent form type', () => {
  @Component({
    template: `
      <form (submit)="onSubmit($event)">
        <input name="field" value="initial" />
        <tw-button [type]="type()" [disabled]="disabled()" (click)="onClick($event)">Go</tw-button>
      </form>
    `,
    standalone: true,
    imports: [TwButtonComponent],
  })
  class FormHostComponent {
    type = signal<'button' | 'submit' | 'reset'>('submit');
    disabled = signal(false);
    cancelClick = false;
    submitCount = 0;
    onSubmit(event: Event): void {
      event.preventDefault();
      this.submitCount++;
    }
    onClick(event: Event): void {
      if (this.cancelClick) event.preventDefault();
    }
  }

  let fixture: ComponentFixture<FormHostComponent>;
  let host: FormHostComponent;
  let buttonNative: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormHostComponent],
      providers: [TwClassService],
    }).compileComponents();
    fixture = TestBed.createComponent(FormHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    buttonNative = fixture.nativeElement.querySelector('tw-button');
  });

  it('should submit the enclosing form when type="submit"', async () => {
    buttonNative.click();
    await flushTimers();
    expect(host.submitCount).toBe(1);
  });

  it('should render a hidden native submit button for implicit submission', () => {
    const native = buttonNative.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(native).toBeTruthy();
    expect(native.getAttribute('tabindex')).toBe('-1');
    expect(native.getAttribute('aria-hidden')).toBe('true');
    expect(native.disabled).toBe(false);
  });

  it('should submit exactly once on implicit submission (Enter in a field)', async () => {
    // Browsers implement implicit submission by firing a click on the form's
    // default (first) submit button, which is the hidden native button.
    const native = buttonNative.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    let submitter: unknown;
    form.addEventListener('submit', e => (submitter = e.submitter));
    native.click();
    await flushTimers();
    expect(host.submitCount).toBe(1);
    expect(submitter).toBe(native);
  });

  it('should submit exactly once on click, using the native button as submitter', async () => {
    const native = buttonNative.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    let submitter: unknown;
    form.addEventListener('submit', e => (submitter = e.submitter));
    (buttonNative.querySelector('span') as HTMLElement).click();
    await flushTimers();
    expect(host.submitCount).toBe(1);
    expect(submitter).toBe(native);
  });

  it('should disable the hidden native submit button when disabled', async () => {
    host.disabled.set(true);
    fixture.detectChanges();
    const native = buttonNative.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(native.disabled).toBe(true);
    native.click();
    buttonNative.click();
    await flushTimers();
    expect(host.submitCount).toBe(0);
  });

  it('should not render a native submit button for type="button" or "reset"', () => {
    host.type.set('button');
    fixture.detectChanges();
    expect(buttonNative.querySelector('button')).toBeNull();
    host.type.set('reset');
    fixture.detectChanges();
    expect(buttonNative.querySelector('button')).toBeNull();
  });

  it('should submit on keyboard activation when type="submit"', async () => {
    buttonNative.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flushTimers();
    expect(host.submitCount).toBe(1);
  });

  it('should not submit when type="button"', async () => {
    host.type.set('button');
    fixture.detectChanges();
    buttonNative.click();
    await flushTimers();
    expect(host.submitCount).toBe(0);
  });

  it('should not submit when a click handler calls preventDefault', async () => {
    host.cancelClick = true;
    buttonNative.click();
    await flushTimers();
    expect(host.submitCount).toBe(0);
  });

  it('should reset the enclosing form when type="reset"', async () => {
    host.type.set('reset');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'changed';
    buttonNative.click();
    await flushTimers();
    expect(input.value).toBe('initial');
    expect(host.submitCount).toBe(0);
  });
});

describe('TwButtonComponent class attribute', () => {
  @Component({
    template: `<tw-button class="bg-sky-700 hover:bg-sky-800 text-white">Static</tw-button
      ><tw-button variant="outline" [class]="dynamic()" classOverride="shadow-none">Bound</tw-button
      ><a tw-button href="#" class="bg-sky-700">Link</a>`,
    standalone: true,
    imports: [TwButtonComponent, TwButtonLinkComponent],
  })
  class ClassHostComponent {
    dynamic = signal('text-sky-600');
  }

  let fixture: ComponentFixture<ClassHostComponent>;
  const hosts = (): HTMLElement[] =>
    fixture.debugElement
      .queryAll(By.css('tw-button, a[tw-button]'))
      .map(de => de.nativeElement as HTMLElement);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ClassHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(ClassHostComponent);
    fixture.detectChanges();
  });

  it('lets a static class override the conflicting variant colours', () => {
    const [button] = hosts();
    expect(button.classList).toContain('bg-sky-700');
    expect(button.classList).toContain('hover:bg-sky-800');
    expect(button.classList).not.toContain('bg-blue-600');
    expect(button.classList).not.toContain('hover:bg-blue-700');
    expect(button.classList).toContain('rounded-lg');
  });

  it('merges a bound class and still applies classOverride', () => {
    const button = hosts()[1];
    expect(button.classList).toContain('text-sky-600');
    expect(button.classList).not.toContain('text-slate-800');
    expect(button.classList).toContain('shadow-none');
    expect(button.classList).not.toContain('shadow-sm');

    fixture.componentInstance.dynamic.set('text-rose-600');
    fixture.detectChanges();
    expect(button.classList).toContain('text-rose-600');
    expect(button.classList).not.toContain('text-sky-600');
  });

  it('merges a static class on link buttons', () => {
    const link = hosts()[2];
    expect(link.classList).toContain('bg-sky-700');
    expect(link.classList).not.toContain('bg-blue-600');
  });
});
