import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwFocusTrapDirective } from '../directives';
import { claimNativeEscape, trackNativeEscapeLayer } from './native-escape-layer.util';

let nextAboutDialogId = 0;

/**
 * About dialog component
 * Shows application information, version, credits
 *
 * @example
 * ```html
 * <tw-about-dialog
 *   [open]="showAbout"
 *   appName="My App"
 *   version="1.0.0"
 *   [links]="[{ label: 'Website', url: 'https://example.com' }]"
 *   (close)="showAbout = false"
 * ></tw-about-dialog>
 * ```
 */
@Component({
  selector: 'tw-about-dialog',
  standalone: true,
  imports: [CommonModule, TwFocusTrapDirective],
  templateUrl: './about-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tw-about-dialog',
  },
})
export class TwAboutDialogComponent {
  /** Unique id so several dialogs on a page don't share an aria target. */
  protected readonly titleId = `tw-about-dialog-title-${nextAboutDialogId++}`;

  // Inputs
  public readonly open = input(false);
  public readonly appName = input('Application');
  public readonly appIcon = input<string | undefined>(undefined);
  public readonly version = input('1.0.0');
  public readonly description = input<string | undefined>(undefined);
  public readonly copyright = input<string | undefined>(undefined);
  public readonly credits = input<string[]>([]);
  public readonly links = input<Array<{ label: string; url: string }>>([]);
  public readonly showUpdateButton = input(true);
  public readonly showLicenseButton = input(false);

  // Outputs
  public readonly close = output();
  public readonly openChange = output<boolean>();
  public readonly checkForUpdates = output();
  public readonly viewLicense = output();

  constructor() {
    trackNativeEscapeLayer(this, this.open);
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (this.open() && claimNativeEscape(this, event)) {
      this.onClose();
    }
  }

  protected onClose(): void {
    this.close.emit();
    this.openChange.emit(false);
  }
}
