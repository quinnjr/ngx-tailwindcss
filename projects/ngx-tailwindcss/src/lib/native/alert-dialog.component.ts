import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertDialogType } from './native.types';

let nextAlertDialogId = 0;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Alert dialog component
 * Shows informational, warning, or error messages
 *
 * @example
 * ```html
 * <tw-alert-dialog
 *   [open]="showAlert"
 *   title="Success"
 *   message="Your changes have been saved."
 *   type="success"
 *   (confirm)="onDismiss()"
 * ></tw-alert-dialog>
 * ```
 */
@Component({
  selector: 'tw-alert-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tw-alert-dialog',
  },
})
export class TwAlertDialogComponent {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Unique ids so several dialogs on a page don't share aria targets. */
  protected readonly titleId = `tw-alert-dialog-title-${nextAlertDialogId}`;
  protected readonly messageId = `tw-alert-dialog-message-${nextAlertDialogId++}`;

  private previouslyFocused: HTMLElement | null = null;
  // Inputs
  public readonly open = input(false);
  public readonly title = input('');
  public readonly message = input('');
  public readonly type = input<AlertDialogType>('info');
  public readonly confirmLabel = input('OK');
  public readonly showDontAskAgain = input(false);

  // Outputs
  public readonly confirm = output<{ dontAskAgain: boolean }>();
  public readonly openChange = output<boolean>();

  // State
  protected readonly dontAskAgain = signal(false);

  constructor() {
    // Move focus into the dialog when it opens; restore it when it closes
    effect(() => {
      const isOpen = this.open();
      untracked(() => {
        if (typeof document === 'undefined') return;
        if (isOpen) {
          this.previouslyFocused = document.activeElement as HTMLElement | null;
          afterNextRender(() => this.getFocusable().at(-1)?.focus(), {
            injector: this.injector,
          });
        } else if (this.previouslyFocused) {
          const toRestore = this.previouslyFocused;
          this.previouslyFocused = null;
          if (toRestore.isConnected) toRestore.focus();
        }
      });
    });
  }

  /** Escape dismisses (acknowledges) the alert; Tab is trapped inside the dialog. */
  protected onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.onConfirm();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = this.getFocusable();
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1)!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !focusable.includes(active as HTMLElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !focusable.includes(active as HTMLElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  private getFocusable(): HTMLElement[] {
    const dialog = this.elementRef.nativeElement.querySelector('[role="alertdialog"]');
    return dialog ? [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)] : [];
  }

  // Computed styles
  protected readonly iconContainerClasses = computed(() => {
    const type = this.type();
    const base = 'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center';

    const typeClasses: Record<AlertDialogType, string> = {
      info: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
      success: 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400',
      error: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
    };

    return `${base} ${typeClasses[type]}`;
  });

  protected readonly buttonClasses = computed(() => {
    const type = this.type();
    const base = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';

    if (type === 'error') {
      return `${base} bg-red-600 text-white hover:bg-red-700`;
    }

    return `${base} bg-blue-600 text-white hover:bg-blue-700`;
  });

  protected onConfirm(): void {
    this.confirm.emit({ dontAskAgain: this.dontAskAgain() });
    this.openChange.emit(false);
  }
}
