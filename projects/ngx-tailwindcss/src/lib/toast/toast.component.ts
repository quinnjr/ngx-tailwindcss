import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injectable,
  Input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export type ToastPosition =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface ToastOptions {
  variant?: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  action?: { label: string; onClick: () => void };
}

interface Toast extends ToastOptions {
  id: string;
}

@Injectable({ providedIn: 'root' })
export class TwToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private readonly _position = signal<ToastPosition>('top-right');
  /** Pending auto-dismiss timers, keyed by toast id, so dismissal can cancel them. */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private _maxToasts = 10;

  readonly toasts = this._toasts.asReadonly();
  readonly position = this._position.asReadonly();

  setPosition(position: ToastPosition): void {
    this._position.set(position);
  }

  /** Cap the number of simultaneously shown toasts; the oldest are evicted. */
  setMaxToasts(max: number): void {
    this._maxToasts = Math.max(1, max);
  }

  show(options: ToastOptions): string {
    const id = Math.random().toString(36).slice(2, 9);
    const toast: Toast = {
      id,
      variant: options.variant || 'info',
      title: options.title,
      message: options.message,
      duration: options.duration ?? 5000,
      dismissible: options.dismissible ?? true,
      action: options.action,
    };

    this._toasts.update(toasts => {
      const next = [...toasts, toast];
      // Evict oldest toasts beyond the cap and cancel their timers
      while (next.length > this._maxToasts) {
        const evicted = next.shift()!;
        this.clearTimer(evicted.id);
      }
      return next;
    });

    if (toast.duration && toast.duration > 0) {
      this.timers.set(
        id,
        setTimeout(() => {
          this.dismiss(id);
        }, toast.duration)
      );
    }

    return id;
  }

  success(message: string, title?: string): string {
    return this.show({ variant: 'success', message, title });
  }

  error(message: string, title?: string): string {
    return this.show({ variant: 'danger', message, title });
  }

  warning(message: string, title?: string): string {
    return this.show({ variant: 'warning', message, title });
  }

  info(message: string, title?: string): string {
    return this.show({ variant: 'info', message, title });
  }

  dismiss(id: string): void {
    this.clearTimer(id);
    this._toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  dismissAll(): void {
    this.timers.forEach(timer => {
      clearTimeout(timer);
    });
    this.timers.clear();
    this._toasts.set([]);
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}

/**
 * Element focus came from when it entered each toast (keyed by toast host), so it
 * can be handed back on dismissal. Weakly held: removed toasts are collected.
 */
const toastFocusOrigins = new WeakMap<Element, HTMLElement>();

/**
 * Where focus should go when the toast `host` (which holds focus) is removed: the first
 * button of the nearest following, else preceding, toast that is not also being removed,
 * else back where focus came from.
 */
function focusTargetAfterRemoval(
  host: Element,
  isRemoved: (toast: Element) => boolean = () => false
): HTMLElement | null {
  for (const step of ['nextElementSibling', 'previousElementSibling'] as const) {
    for (let el = host[step]; el; el = el[step]) {
      if (el.tagName !== 'TW-TOAST' || isRemoved(el)) continue;
      const button = el.querySelector<HTMLElement>('button');
      if (button) return button;
    }
  }
  const origin = toastFocusOrigins.get(host);
  return origin?.isConnected ? origin : null;
}

@Component({
  selector: 'tw-toast',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast.component.html',
  host: { '(focusin)': 'onFocusIn($event)' },
})
export class TwToastComponent {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() set variant(value: ToastVariant) {
    this._variant.set(value);
  }
  @Input() set title(value: string) {
    this._title.set(value);
  }
  @Input() set message(value: string) {
    this._message.set(value);
  }
  @Input() set dismissible(value: boolean) {
    this._dismissible.set(value);
  }
  @Input() set action(value: { label: string; onClick: () => void } | undefined) {
    this._action.set(value);
  }
  @Input() dismiss: () => void = () => {};

  protected _variant = signal<ToastVariant>('info');
  protected _title = signal('');
  protected _message = signal('');
  protected _dismissible = signal(true);
  protected _action = signal<{ label: string; onClick: () => void } | undefined>(undefined);

  protected variantValue = computed(() => this._variant());
  protected titleValue = computed(() => this._title());
  protected messageValue = computed(() => this._message());
  protected dismissibleValue = computed(() => this._dismissible());
  protected actionValue = computed(() => this._action());

  /** Only urgent variants interrupt as alerts; the rest are polite status messages. */
  protected roleValue = computed(() =>
    this._variant() === 'danger' || this._variant() === 'warning' ? 'alert' : 'status'
  );

  protected toastClasses = computed(() => {
    return [
      'w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-700 p-4',
      'animate-[toast-in_0.3s_ease-out]',
    ].join(' ');
  });

  protected iconClasses = computed(() => {
    const variant = this._variant();

    const variantClasses: Record<ToastVariant, string> = {
      info: 'text-blue-600 dark:text-blue-400',
      success: 'text-emerald-700 dark:text-emerald-400',
      warning: 'text-amber-700 dark:text-amber-400',
      danger: 'text-rose-600 dark:text-rose-400',
      neutral: 'text-slate-500 dark:text-slate-400',
    };

    return ['flex-shrink-0', variantClasses[variant]].join(' ');
  });

  protected onFocusIn(event: FocusEvent): void {
    const from = event.relatedTarget;
    const host = this.elementRef.nativeElement;
    if (!(from instanceof HTMLElement) || host.contains(from)) return;
    // Focus handed over from another toast (Tab or dismissal hand-off) keeps that
    // toast's origin, so the chain still ends where focus originally came from
    const fromToast = from.closest('tw-toast');
    const inherited = fromToast ? toastFocusOrigins.get(fromToast) : undefined;
    const origin = fromToast ? inherited : from;
    if (origin) {
      toastFocusOrigins.set(host, origin);
    }
  }

  protected onDismiss(): void {
    const host = this.elementRef.nativeElement;
    // Dismissing removes the focused close button: move focus to a neighbouring
    // toast (or back where it came from) rather than losing it to the body
    const target = host.contains(host.ownerDocument.activeElement)
      ? this.focusAfterDismiss()
      : null;
    this.dismiss();
    target?.focus();
  }

  private focusAfterDismiss(): HTMLElement | null {
    return focusTargetAfterRemoval(this.elementRef.nativeElement);
  }
}

@Component({
  selector: 'tw-toast-container',
  standalone: true,
  imports: [CommonModule, TwToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-container.component.html',
  // Unencapsulated: emulated encapsulation renames @keyframes, but the toast's
  // global Tailwind class `animate-[toast-in_...]` references the plain name
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class TwToastContainerComponent {
  private readonly toastService: TwToastService;
  protected toasts;
  protected position;

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor(toastService: TwToastService) {
    this.toastService = toastService;
    this.toasts = this.toastService.toasts;
    this.position = this.toastService.position;

    // A toast removed while it holds focus (auto-dismiss timer, eviction, dismissAll,
    // service.dismiss) would drop focus to the body. This view effect runs before the
    // template removes the toast, so hand focus to a surviving toast or the origin first.
    effect(() => {
      const ids = new Set(this.toasts().map(t => t.id));
      const container = this.elementRef.nativeElement;
      const active = container.ownerDocument?.activeElement;
      const toast = active?.closest?.('tw-toast[data-toast-id]');
      if (!toast || !container.contains(toast)) return;
      const isRemoved = (el: Element) => !ids.has(el.getAttribute('data-toast-id') ?? '');
      if (!isRemoved(toast)) return;
      focusTargetAfterRemoval(toast, isRemoved)?.focus();
    });
  }

  protected containerClasses = computed(() => {
    const position = this.position();

    const positionClasses: Record<ToastPosition, string> = {
      'top-left': 'top-4 left-4',
      'top-center': 'top-4 left-1/2 -translate-x-1/2',
      'top-right': 'top-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
      'bottom-right': 'bottom-4 right-4',
    };

    return [
      'fixed z-50 flex flex-col gap-3 max-h-screen overflow-hidden pointer-events-none',
      '[&>*]:pointer-events-auto',
      positionClasses[position],
    ].join(' ');
  });

  /** Cached per-id dismiss closures so bindings stay referentially stable across CD runs. */
  private readonly dismissFns = new Map<string, () => void>();

  getDismissFunction(id: string): () => void {
    let fn = this.dismissFns.get(id);
    if (!fn) {
      // Prune closures for toasts that no longer exist before caching a new one
      const activeIds = new Set(this.toasts().map(t => t.id));
      for (const cachedId of this.dismissFns.keys()) {
        if (!activeIds.has(cachedId)) {
          this.dismissFns.delete(cachedId);
        }
      }
      fn = () => {
        this.toastService.dismiss(id);
      };
      this.dismissFns.set(id, fn);
    }
    return fn;
  }
}
