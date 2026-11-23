import {
  Component,
  effect,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TwFocusTrapDirective } from '../directives';
import { claimNativeEscape, trackNativeEscapeLayer } from './native-escape-layer.util';

export type PromptInputType = 'text' | 'password' | 'number' | 'email' | 'url';

let nextPromptDialogId = 0;

@Component({
  selector: 'tw-prompt-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TwFocusTrapDirective],
  templateUrl: './prompt-dialog.component.html',
})
export class TwPromptDialogComponent {
  public readonly title = input('Enter a value');
  public readonly message = input('');
  public readonly defaultValue = input('');
  public readonly placeholder = input('');
  public readonly inputType = input<PromptInputType>('text');
  public readonly confirmText = input('OK');
  public readonly cancelText = input('Cancel');
  public readonly required = input(false);
  public readonly minLength = input<number | null>(null);
  public readonly maxLength = input<number | null>(null);
  public readonly pattern = input<string | null>(null);
  public readonly customValidator = input<((value: string) => string | null) | null>(null);

  public readonly confirmed = output<string>();
  public readonly cancelled = output();

  public readonly inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');

  public readonly isOpen = signal(false);
  public readonly inputValue = signal('');
  public readonly validationError = signal<string | null>(null);
  /** True once the user has edited or left the field (or tried to confirm). */
  protected readonly touched = signal(false);
  protected readonly errorId = `tw-prompt-dialog-error-${nextPromptDialogId++}`;

  constructor() {
    trackNativeEscapeLayer(this, this.isOpen);

    effect(() => {
      // The initial value is set by open(); resetting it here would discard
      // a value passed to open(value).
      if (this.isOpen()) {
        setTimeout(() => {
          this.inputElement()?.nativeElement.focus();
          this.inputElement()?.nativeElement.select();
        }, 50);
      }
    });

    // Validate as the user types (once the field has been touched)
    effect(() => {
      const value = this.inputValue();
      this.validationError.set(this.touched() ? this.validate(value) : null);
    });
  }

  public open(defaultValue?: string): void {
    if (defaultValue === undefined) {
      this.inputValue.set(this.defaultValue());
    } else {
      this.inputValue.set(defaultValue);
    }
    this.touched.set(false);
    this.validationError.set(null);
    this.isOpen.set(true);
  }

  public close(): void {
    this.isOpen.set(false);
  }

  public confirm(): void {
    const value = this.inputValue();
    const error = this.validate(value);
    this.touched.set(true);

    if (error) {
      this.validationError.set(error);
      return;
    }

    this.confirmed.emit(value);
    this.close();
  }

  /** Escape cancels from anywhere in the dialog, not only from the input. */
  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (this.isOpen() && claimNativeEscape(this, event)) this.cancel();
  }

  public cancel(): void {
    this.cancelled.emit();
    this.close();
  }

  public isValid(): boolean {
    return this.validate(this.inputValue()) === null;
  }

  protected onInput(value: string): void {
    this.inputValue.set(value);
    this.touched.set(true);
  }

  protected onBlur(): void {
    this.touched.set(true);
  }

  private validate(value: string): string | null {
    // Required check
    if (this.required() && !value) {
      return 'This field is required';
    }

    // Min length
    const minLen = this.minLength();
    if (minLen !== null && value.length < minLen) {
      return `Minimum ${minLen} characters required`;
    }

    // Max length
    const maxLen = this.maxLength();
    if (maxLen !== null && value.length > maxLen) {
      return `Maximum ${maxLen} characters allowed`;
    }

    // Pattern
    const pattern = this.pattern();
    if (pattern && value) {
      let regex: RegExp | null = null;
      try {
        regex = new RegExp(pattern);
      } catch {
        // An invalid developer-supplied pattern must not break the dialog
        console.warn(`tw-prompt-dialog: ignoring invalid pattern "${pattern}"`);
      }
      if (regex && !regex.test(value)) {
        return 'Invalid format';
      }
    }

    // Custom validator
    const customValidator = this.customValidator();
    if (customValidator) {
      const customError = customValidator(value);
      if (customError) {
        return customError;
      }
    }

    return null;
  }
}
