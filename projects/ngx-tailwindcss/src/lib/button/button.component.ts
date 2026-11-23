import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostBinding,
  inject,
  input,
  Input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';
import { twClassValue } from '../core/class-value';
import { TwRippleDirective } from '../directives/ripple.directive';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'ghost'
  | 'outline'
  | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ButtonType = 'button' | 'submit' | 'reset';

const BUTTON_BASE_CLASSES = `
  inline-flex items-center justify-center gap-2
  font-medium
  rounded-lg
  transition-all duration-200 ease-out
  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
`;

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm hover:shadow focus-visible:ring-blue-500',
  secondary:
    'bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white shadow-sm hover:shadow focus-visible:ring-slate-500',
  success:
    'bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white shadow-sm hover:shadow focus-visible:ring-emerald-700',
  warning:
    'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-amber-950 shadow-sm hover:shadow focus-visible:ring-amber-600',
  danger:
    'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm hover:shadow focus-visible:ring-rose-500',
  info: 'bg-cyan-700 hover:bg-cyan-800 active:bg-cyan-900 text-white shadow-sm hover:shadow focus-visible:ring-cyan-700',
  ghost:
    'bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 active:bg-slate-200 dark:active:bg-zinc-700 text-slate-700 dark:text-zinc-300 focus-visible:ring-slate-500',
  outline:
    'bg-white dark:bg-zinc-800 border-2 border-slate-500 dark:border-zinc-500 hover:border-slate-600 dark:hover:border-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700 active:bg-slate-200 dark:active:bg-zinc-600 text-slate-800 dark:text-zinc-200 shadow-sm focus-visible:ring-slate-500',
  link: 'bg-transparent text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline active:text-blue-800 dark:active:text-blue-200 focus-visible:ring-blue-500 p-0 shadow-none',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  xs: 'text-xs px-4 py-2.5 min-h-9',
  sm: 'text-sm px-6 py-3 min-h-10',
  md: 'text-base px-8 py-3.5 min-h-11',
  lg: 'text-lg px-10 py-4 min-h-12',
  xl: 'text-xl px-12 py-5 min-h-14',
};

const ICON_SIZES: Record<ButtonSize, string> = {
  xs: '[&_svg]:w-3 [&_svg]:h-3',
  sm: '[&_svg]:w-4 [&_svg]:h-4',
  md: '[&_svg]:w-5 [&_svg]:h-5',
  lg: '[&_svg]:w-5 [&_svg]:h-5',
  xl: '[&_svg]:w-6 [&_svg]:h-6',
};

const ICON_ONLY_SIZES: Record<ButtonSize, string> = {
  xs: 'p-2 min-h-8 min-w-8',
  sm: 'p-2.5 min-h-9 min-w-9',
  md: 'p-3 min-h-10 min-w-10',
  lg: 'p-3.5 min-h-12 min-w-12',
  xl: 'p-4 min-h-14 min-w-14',
};

const SPINNER_SIZES: Record<ButtonSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
};

/**
 * Highly customizable button component with Tailwind CSS styling
 *
 * @example
 * ```html
 * <tw-button>Default Button</tw-button>
 * <tw-button variant="primary" size="lg">Large Primary</tw-button>
 * <tw-button variant="outline" [loading]="isLoading">Submit</tw-button>
 * <tw-button variant="danger" [disabled]="!canDelete">Delete</tw-button>
 * <tw-button type="submit">Save</tw-button>
 * ```
 */
@Component({
  selector: 'tw-button',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './button.component.html',
  hostDirectives: [TwRippleDirective],
  host: {
    '[class]': 'computedClasses()',
    '[attr.disabled]': 'hostDisabledAttr()',
    '[attr.aria-disabled]': 'isDisabled()',
    '[attr.aria-busy]': '_loading()',
    '[attr.role]': 'hostRole',
    '[attr.tabindex]': 'isDisabled() ? -1 : 0',
    // Display and position come from the classes (`inline-flex`; the ripple makes a
    // static host `relative`), so `class="hidden md:inline-flex"` or `class="fixed ..."`
    // is not overridden by an inline style.
    '[style.overflow]': '"hidden"',
    '(keydown)': 'onHostKeydown($event)',
  },
})
export class TwButtonComponent {
  private readonly twClass = inject(TwClassService);
  private readonly elementRef = inject(ElementRef);
  private readonly rippleDirective = inject(TwRippleDirective);

  // Internal signals for reactive state
  protected readonly _variant = signal<ButtonVariant>('primary');
  protected readonly _size = signal<ButtonSize>('md');
  protected readonly _disabled = signal(false);
  protected readonly _loading = signal(false);
  protected readonly _fullWidth = signal(false);
  protected readonly _iconOnly = signal(false);
  protected readonly _ripple = signal(true);
  protected readonly _rippleColor = signal('rgba(255, 255, 255, 0.4)');
  protected readonly _classOverride = signal('');
  protected readonly _classReplace = signal('');
  protected readonly _type = signal<ButtonType>('button');

  // Input setters that update signals
  @Input() set variant(value: ButtonVariant) {
    this._variant.set(value);
  }
  @Input() set size(value: ButtonSize) {
    this._size.set(value);
  }
  @Input({ transform: booleanAttribute }) set disabled(value: boolean) {
    this._disabled.set(value);
  }
  @Input({ transform: booleanAttribute }) set loading(value: boolean) {
    this._loading.set(value);
  }
  @Input({ transform: booleanAttribute }) set fullWidth(value: boolean) {
    this._fullWidth.set(value);
  }
  @Input({ transform: booleanAttribute }) set iconOnly(value: boolean) {
    this._iconOnly.set(value);
  }
  @Input({ transform: booleanAttribute }) set ripple(value: boolean) {
    this._ripple.set(value);
  }
  @Input() set rippleColor(value: string) {
    this._rippleColor.set(value);
  }
  /**
   * Additional classes, merged over the defaults so they override conflicting ones
   * (`class="bg-sky-700 text-white"`). Signal input so a static or bound `class`
   * goes through the merge instead of competing with the host classes.
   */
  readonly class = input('', { transform: twClassValue });
  @Input() set classOverride(value: string) {
    this._classOverride.set(value);
  }
  @Input() set classReplace(value: string) {
    this._classReplace.set(value);
  }
  /**
   * Form behavior, mirroring the native `<button type>`: `submit` submits and
   * `reset` resets the enclosing `<form>` when clicked. Defaults to `button` (no form action).
   */
  @Input() set type(value: ButtonType | null | undefined) {
    this._type.set(value ?? 'button');
  }

  // Computed signals
  protected readonly isDisabled = computed(() => this._disabled() || this._loading());

  protected readonly computedClasses = computed(() => {
    if (this._classReplace()) {
      return this._classReplace();
    }

    const variantClasses = BUTTON_VARIANTS[this._variant()];
    const sizeClasses = this._iconOnly()
      ? ICON_ONLY_SIZES[this._size()]
      : BUTTON_SIZES[this._size()];
    const iconClasses = ICON_SIZES[this._size()];

    const conditionalClasses: string[] = [];
    if (this._fullWidth()) conditionalClasses.push('w-full');
    if (this._loading()) conditionalClasses.push('cursor-wait');
    if (this._iconOnly()) conditionalClasses.push('gap-0');
    // The host is a custom element, so CSS :disabled never matches;
    // apply the inert styles directly when disabled.
    if (this.isDisabled()) {
      conditionalClasses.push('opacity-50 cursor-not-allowed pointer-events-none');
    }

    return this.twClass.merge(
      BUTTON_BASE_CLASSES,
      variantClasses,
      sizeClasses,
      iconClasses,
      conditionalClasses.join(' '),
      this.class(),
      this._classOverride()
    );
  });

  protected readonly spinnerSizeClass = computed(() => SPINNER_SIZES[this._size()]);

  /** Host role; overridden by subclasses whose host already has native semantics */
  protected readonly hostRole: string | null = 'button';

  /** Host `disabled` attribute; overridden by subclasses where it is not valid */
  protected hostDisabledAttr(): true | null {
    return this.isDisabled() || null;
  }

  /** Whether `type="submit" | "reset"` acts on the enclosing form; overridden by link buttons */
  protected supportsFormActions(): boolean {
    return true;
  }

  /**
   * Visually hidden native submit button rendered when `type="submit"`. Browsers only
   * perform implicit submission (Enter in a text field) when the form has a real submit
   * button, so this proxy makes `<tw-button type="submit">` behave like a native one.
   */
  private readonly nativeSubmit = viewChild<ElementRef<HTMLButtonElement>>('nativeSubmit');

  constructor() {
    // Sync ripple directive state
    effect(() => {
      this.rippleDirective.rippleDisabled = !this._ripple() || this.isDisabled();
      this.rippleDirective.rippleColor = this._rippleColor();
    });

    // The host is a custom element, not a native <button>, so a disabled
    // attribute does not block activation; swallow clicks while disabled.
    // Registered here so it precedes consumer (click) listeners, making
    // stopImmediatePropagation actually suppress them.
    (this.elementRef.nativeElement as HTMLElement).addEventListener('click', (event: Event) => {
      if (this.isDisabled()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      // A click on the hidden native submit button (e.g. the browser's implicit
      // submission) is already submitting the form natively; don't submit twice.
      if (event.target === this.nativeSubmit()?.nativeElement) return;
      this.runFormAction(event);
    });
  }

  /**
   * Submit/reset the enclosing form like a native button would. The host is not a
   * native <button>, so the browser does not do this itself. Deferred until the click
   * has finished dispatching so consumer handlers can still cancel it via preventDefault().
   */
  private runFormAction(event: Event): void {
    const type = this._type();
    if (type === 'button' || !this.supportsFormActions()) return;

    const form = (this.elementRef.nativeElement as HTMLElement).closest('form');
    if (!form) return;

    setTimeout(() => {
      if (event.defaultPrevented) return;
      if (type === 'reset') {
        form.reset();
      } else if (typeof form.requestSubmit === 'function') {
        const submitter = this.nativeSubmit()?.nativeElement;
        form.requestSubmit(submitter?.form === form ? submitter : undefined);
      } else {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    });
  }

  /** Get the native button element */
  get nativeElement(): HTMLElement {
    return this.elementRef.nativeElement;
  }

  /** Programmatically focus the button */
  focus(): void {
    this.elementRef.nativeElement.focus();
  }

  /** Programmatically blur the button */
  blur(): void {
    this.elementRef.nativeElement.blur();
  }

  /** Keyboard activation (Enter/Space) for the role="button" host element */
  protected onHostKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    if (this.isDisabled()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    event.preventDefault();
    (this.elementRef.nativeElement as HTMLElement).click();
  }
}

/**
 * Anchor-style button for navigation
 */
@Component({
  selector: 'a[tw-button]',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './button-link.component.html',
  // Note: hostDirectives are inherited from TwButtonComponent, no need to redeclare
  host: {
    '[class]': 'computedClasses()',
    '[attr.aria-disabled]': '_disabled()',
    '[attr.tabindex]': '_disabled() ? -1 : 0',
    // Display and position come from the classes (`inline-flex`; the ripple makes a
    // static host `relative`), so `class="hidden md:inline-flex"` or `class="fixed ..."`
    // is not overridden by an inline style.
    '[style.overflow]': '"hidden"',
  },
})
export class TwButtonLinkComponent extends TwButtonComponent {
  // Keep native link semantics: no role="button" and no (invalid) disabled attribute on <a>
  protected override readonly hostRole = null;

  protected override hostDisabledAttr(): null {
    return null;
  }

  protected override supportsFormActions(): boolean {
    return false;
  }

  @HostBinding('style.pointer-events')
  get pointerEvents(): string | null {
    return this._disabled() ? 'none' : null;
  }
}
