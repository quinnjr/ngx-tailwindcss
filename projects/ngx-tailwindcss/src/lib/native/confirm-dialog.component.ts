import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwFocusTrapDirective } from '../directives';
import { claimNativeEscape, trackNativeEscapeLayer } from './native-escape-layer.util';
import { AlertDialogType } from './native.types';

let nextConfirmDialogId = 0;

/**
 * Confirmation dialog component
 * Asks user to confirm or cancel an action
 *
 * @example
 * ```html
 * <tw-confirm-dialog
 *   [open]="showConfirm"
 *   title="Delete file?"
 *   message="This action cannot be undone."
 *   [destructive]="true"
 *   (confirm)="onDelete()"
 *   (cancel)="showConfirm = false"
 * ></tw-confirm-dialog>
 * ```
 */
@Component({
  selector: 'tw-native-confirm-dialog',
  standalone: true,
  imports: [CommonModule, TwFocusTrapDirective],
  templateUrl: './confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tw-native-confirm-dialog',
  },
})
export class TwNativeConfirmDialogComponent {
  /** Unique ids so several dialogs on a page don't share aria targets. */
  protected readonly titleId = `tw-confirm-dialog-title-${nextConfirmDialogId}`;
  protected readonly messageId = `tw-confirm-dialog-message-${nextConfirmDialogId++}`;

  // Inputs
  public readonly open = input(false);
  public readonly title = input('Confirm');
  public readonly message = input('Are you sure?');
  public readonly type = input<AlertDialogType>('info');
  public readonly confirmLabel = input('Confirm');
  public readonly cancelLabel = input('Cancel');
  public readonly destructive = input(false);

  // Outputs
  public readonly confirm = output();
  public readonly cancel = output();
  public readonly openChange = output<boolean>();

  constructor() {
    trackNativeEscapeLayer(this, this.open);
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (this.open() && claimNativeEscape(this, event)) {
      this.onCancel();
    }
  }

  @HostListener('document:keydown.enter', ['$event'])
  protected onEnter(event: Event): void {
    if (!this.open()) return;

    // Let focused controls (e.g. the Cancel button) handle Enter themselves;
    // otherwise Enter on Cancel would also confirm.
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('button, a, input, textarea, select')) return;

    this.onConfirm();
  }

  // Computed styles
  protected readonly iconContainerClasses = computed(() => {
    const base = 'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center';

    if (this.destructive()) {
      return `${base} bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400`;
    }

    const typeClasses: Record<AlertDialogType, string> = {
      info: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
      success: 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400',
      error: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
    };

    return `${base} ${typeClasses[this.type()] ?? typeClasses.info}`;
  });

  protected readonly confirmButtonClasses = computed(() => {
    const base = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';

    if (this.destructive()) {
      return `${base} bg-red-600 text-white hover:bg-red-700`;
    }

    return `${base} bg-blue-600 text-white hover:bg-blue-700`;
  });

  protected onConfirm(): void {
    this.confirm.emit();
    this.openChange.emit(false);
  }

  protected onCancel(): void {
    this.cancel.emit();
    this.openChange.emit(false);
  }
}
