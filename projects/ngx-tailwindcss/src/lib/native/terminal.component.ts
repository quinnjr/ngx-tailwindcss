import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalLine, TerminalVariant } from './native.types';

/**
 * Terminal / Console output component
 * Displays command output; strips ANSI escape codes for safe display, with
 * line colors derived from each line's type
 *
 * @example
 * ```html
 * <tw-terminal [lines]="output" (command)="onCommand($event)"></tw-terminal>
 * ```
 */
@Component({
  selector: 'tw-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './terminal.component.html',
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tw-terminal',
  },
})
export class TwTerminalComponent implements AfterViewChecked {
  @ViewChild('outputArea') private readonly outputArea!: ElementRef<HTMLDivElement>;

  // Inputs
  public readonly lines = input<TerminalLine[]>([]);
  public readonly variant = input<TerminalVariant>('default');
  public readonly title = input('Terminal');
  public readonly prompt = input('$ ');
  public readonly inputPlaceholder = input('Enter command...');
  public readonly showHeader = input(true);
  public readonly showInput = input(true);
  public readonly showCursor = input(true);
  public readonly showTimestamps = input(false);
  public readonly showClearButton = input(true);
  public readonly showCopyButton = input(true);
  public readonly autoScroll = input(true);
  public readonly maxLines = input(1000);

  // Outputs
  public readonly command = output<string>();
  public readonly clear = output();
  public readonly copy = output<string>();

  // State
  protected readonly currentInput = signal('');
  protected readonly isProcessing = signal(false);
  protected readonly commandHistory = signal<string[]>([]);
  protected readonly historyIndex = signal(-1);

  private shouldScroll = false;

  // Computed - cap the rendered output at the last maxLines() lines
  protected readonly displayedLines = computed(() => {
    const lines = this.lines();
    const max = this.maxLines();
    return lines.length > max ? lines.slice(-max) : lines;
  });

  constructor() {
    // Scroll to the newest output whenever lines are added
    effect(() => {
      this.displayedLines();
      this.shouldScroll = true;
    });
  }

  public ngAfterViewChecked(): void {
    if (this.shouldScroll && this.autoScroll() && this.outputArea?.nativeElement) {
      this.outputArea.nativeElement.scrollTop = this.outputArea.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  // Computed classes
  protected readonly containerClasses = computed(() => {
    const variant = this.variant();
    const base = 'flex flex-col h-full overflow-hidden';

    const variantClasses: Record<TerminalVariant, string> = {
      default: 'bg-gray-900 text-gray-100',
      dark: 'bg-black text-gray-200',
      light: 'bg-white text-gray-900 border border-gray-200',
      retro: 'bg-black text-green-400',
    };

    return `${base} ${variantClasses[variant]}`;
  });

  protected getLineClasses(line: TerminalLine): string {
    // The light variant renders on a white background, so it needs dark text
    const typeClasses: Record<TerminalLine['type'], string> =
      this.variant() === 'light'
        ? {
            input: 'text-gray-900',
            output: 'text-gray-700',
            error: 'text-red-700',
            info: 'text-blue-700',
            success: 'text-green-700',
            warning: 'text-yellow-800',
          }
        : {
            input: 'text-gray-100',
            output: 'text-gray-300',
            error: 'text-red-400',
            info: 'text-blue-400',
            success: 'text-green-400',
            warning: 'text-yellow-400',
          };

    return typeClasses[line.type] || typeClasses.output;
  }

  protected formatTimestamp(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  protected stripAnsi(text: string): string {
    // Strip ANSI color codes from text
    // eslint-disable-next-line no-control-regex
    return text.replaceAll(/\x1B\[[0-9;]*m/g, '');
  }

  protected submitCommand(): void {
    const cmd = this.currentInput().trim();
    if (!cmd) return;

    // Add to history
    this.commandHistory.update(history => [...history, cmd]);
    this.historyIndex.set(-1);

    // Emit command
    this.command.emit(cmd);
    this.currentInput.set('');
    this.shouldScroll = true;
  }

  /**
   * Walk the command history. `direction` 1 = older (ArrowUp), -1 = newer
   * (ArrowDown); index -1 is the empty prompt, 0 the most recent command.
   */
  protected navigateHistory(direction: number, event?: Event): void {
    const history = this.commandHistory();
    if (history.length === 0) return;
    // Keep the caret from jumping to the start of the input on ArrowUp
    event?.preventDefault();

    let newIndex = this.historyIndex() + direction;

    if (newIndex < -1) newIndex = -1;
    if (newIndex >= history.length) newIndex = history.length - 1;

    this.historyIndex.set(newIndex);

    if (newIndex === -1) {
      this.currentInput.set('');
    } else {
      this.currentInput.set(history[history.length - 1 - newIndex]);
    }
  }

  protected async copyOutput(): Promise<void> {
    const text = this.lines()
      .map(line => line.content)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      this.copy.emit(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  // Public methods
  public setProcessing(processing: boolean): void {
    this.isProcessing.set(processing);
  }

  public scrollToBottom(): void {
    this.shouldScroll = true;
  }
}
