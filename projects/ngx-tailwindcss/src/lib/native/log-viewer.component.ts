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
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogEntry, LogFilter } from './native.types';

/**
 * Log viewer component
 * Displays log entries with filtering and search
 *
 * @example
 * ```html
 * <tw-log-viewer [entries]="logs" (entrySelect)="onLogSelect($event)"></tw-log-viewer>
 * ```
 */
@Component({
  selector: 'tw-log-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './log-viewer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tw-log-viewer block',
  },
})
export class TwLogViewerComponent implements AfterViewChecked {
  // Inputs
  public readonly entries = input<LogEntry[]>([]);
  public readonly showSource = input(true);

  // Outputs
  public readonly entrySelect = output<LogEntry>();
  public readonly clearLogs = output();
  public readonly exportClick = output<LogEntry[]>();

  // State
  protected readonly searchQuery = signal('');
  protected readonly activeLevels = signal<Set<LogEntry['level']>>(
    new Set(['debug', 'info', 'warn', 'error', 'fatal'])
  );
  protected readonly autoScroll = signal(true);
  protected readonly selectedEntry = signal<LogEntry | null>(null);

  protected readonly logLevels = [
    { value: 'debug' as const, label: 'DEBUG' },
    { value: 'info' as const, label: 'INFO' },
    { value: 'warn' as const, label: 'WARN' },
    { value: 'error' as const, label: 'ERROR' },
    { value: 'fatal' as const, label: 'FATAL' },
  ];

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private shouldScroll = false;

  constructor() {
    // Keep the newest entry in view while auto-scroll is enabled
    effect(() => {
      this.filteredEntries();
      if (this.autoScroll()) {
        this.shouldScroll = true;
      }
    });
  }

  public ngAfterViewChecked(): void {
    const el = this.scrollContainer()?.nativeElement;
    if (this.shouldScroll && el) {
      el.scrollTop = el.scrollHeight;
    }
    this.shouldScroll = false;
  }

  // Computed
  protected readonly filteredEntries = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const levels = this.activeLevels();

    return this.entries().filter(entry => {
      // Level filter
      if (!levels.has(entry.level)) return false;

      // Search filter
      if (query) {
        const searchText = [entry.message, entry.source || ''].join(' ').toLowerCase();
        if (!searchText.includes(query)) return false;
      }

      return true;
    });
  });

  protected toggleLevelFilter(level: LogEntry['level']): void {
    this.activeLevels.update(levels => {
      const newLevels = new Set(levels);
      if (newLevels.has(level)) {
        newLevels.delete(level);
      } else {
        newLevels.add(level);
      }
      return newLevels;
    });
  }

  protected onFilterChange(): void {
    // Filter change triggers computed update automatically
  }

  /** Row last focused; with the selection, it anchors the single row tab stop. */
  protected readonly focusedEntryId = signal<string | null>(null);

  /**
   * Roving tabindex: only one row is in the Tab order (a long log would
   * otherwise need one Tab per entry to get past it); arrows move between rows.
   */
  protected readonly tabStopEntryId = computed(() => {
    const entries = this.filteredEntries();
    const isShown = (id: string | null | undefined) =>
      id != null && entries.some(entry => entry.id === id);
    const focused = this.focusedEntryId();
    if (isShown(focused)) return focused;
    const selected = this.selectedEntry()?.id;
    if (isShown(selected)) return selected;
    return entries[0]?.id ?? null;
  });

  protected onRowKeydown(entry: LogEntry, event: KeyboardEvent): void {
    const row = event.currentTarget as HTMLElement;
    const rows = [...(row.parentElement?.children ?? [])] as HTMLElement[];
    const index = rows.indexOf(row);
    let target: HTMLElement | undefined;
    switch (event.key) {
      case 'Enter':
      case ' ': {
        event.preventDefault();
        this.selectEntry(entry);
        return;
      }
      case 'ArrowDown': {
        target = rows[index + 1];
        break;
      }
      case 'ArrowUp': {
        target = rows[index - 1];
        break;
      }
      case 'Home': {
        target = rows[0];
        break;
      }
      case 'End': {
        target = rows.at(-1);
        break;
      }
      default: {
        return;
      }
    }
    event.preventDefault();
    target?.focus();
  }

  protected selectEntry(entry: LogEntry): void {
    this.selectedEntry.set(entry);
    this.entrySelect.emit(entry);
  }

  protected formatTimestamp(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }

  protected getLevelFilterClasses(level: LogEntry['level']): string {
    const isActive = this.activeLevels().has(level);
    const base = 'transition-colors';

    if (!isActive) {
      return `${base} bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300`;
    }

    const levelClasses: Record<LogEntry['level'], string> = {
      debug: 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200',
      info: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
      warn: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
      error: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
      fatal: 'bg-red-200 dark:bg-red-800/50 text-red-800 dark:text-red-200',
    };

    return `${base} ${levelClasses[level]}`;
  }

  protected getLevelBadgeClasses(level: LogEntry['level']): string {
    const base = 'px-1.5 py-0.5 text-xs font-medium rounded';

    const levelClasses: Record<LogEntry['level'], string> = {
      debug: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
      info: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
      warn: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
      error: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
      fatal: 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-100',
    };

    return `${base} ${levelClasses[level]}`;
  }

  protected exportLogs(): void {
    this.exportClick.emit(this.filteredEntries());
  }
}
