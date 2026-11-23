import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trackNativeEscapeLayer } from './native-escape-layer.util';

export interface ShortcutBinding {
  id: string;
  command: string;
  description?: string;
  category?: string;
  keys: string[];
  defaultKeys: string[];
  isCustom?: boolean;
}

@Component({
  selector: 'tw-shortcuts-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shortcuts-editor.component.html',
})
export class TwShortcutsEditorComponent {
  public readonly shortcuts = input<ShortcutBinding[]>([]);
  public readonly platform = input<'mac' | 'windows' | 'linux'>('mac');

  public readonly shortcutChanged = output<{ shortcut: ShortcutBinding; keys: string[] }>();
  public readonly shortcutReset = output<ShortcutBinding>();
  public readonly resetAllShortcuts = output();
  public readonly exportShortcuts = output();
  public readonly importShortcuts = output();

  public readonly searchQuery = signal('');
  public readonly selectedCategory = signal('');
  public readonly editingId = signal<string | null>(null);
  public readonly recordedKeys = signal<string[]>([]);
  public readonly conflictWarning = signal<string | null>(null);

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /**
   * Starting or ending a recording swaps the focused control out of the DOM;
   * once rendered, move focus to its replacement (if focus was not moved
   * elsewhere) so keyboard users keep their place.
   */
  private refocus(find: (host: HTMLElement) => HTMLElement | null | undefined): void {
    afterNextRender(
      () => {
        const host = this.elementRef.nativeElement;
        const active = host.ownerDocument.activeElement;
        if (active && active !== host.ownerDocument.body) return;
        find(host)?.focus();
      },
      { injector: this.injector }
    );
  }

  constructor() {
    // While recording, Escape cancels the recording only, not an enclosing dialog
    trackNativeEscapeLayer(this, () => this.editingId() !== null);

    // A recording whose row is filtered out (category/search changed with the
    // mouse) or removed would keep swallowing every key invisibly and silently
    // rebind a hidden shortcut; cancel it instead.
    effect(() => {
      const id = this.editingId();
      if (id !== null && !this.filteredShortcuts().some(s => s.id === id)) {
        untracked(() => {
          this.cancelEdit();
        });
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this.clearSaveTimer();
    });
  }

  private clearSaveTimer(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  public readonly categories = computed(() => {
    const cats = new Set<string>();
    this.shortcuts().forEach(s => {
      if (s.category) cats.add(s.category);
    });
    return [...cats].sort();
  });

  public readonly filteredShortcuts = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const category = this.selectedCategory();

    return this.shortcuts().filter(shortcut => {
      const matchesQuery =
        !query ||
        shortcut.command.toLowerCase().includes(query) ||
        shortcut.description?.toLowerCase().includes(query);
      const matchesCategory = !category || shortcut.category === category;
      return matchesQuery && matchesCategory;
    });
  });

  @HostListener('document:keydown', ['$event'])
  public handleKeydown(event: KeyboardEvent): void {
    if (!this.editingId()) return;

    event.preventDefault();
    event.stopPropagation();

    // A bare Escape cancels recording (focus is lost when recording starts,
    // so this is the only keyboard way out); Shift+Escape etc. still record
    if (
      event.key === 'Escape' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      this.cancelEdit();
      return;
    }

    const keys: string[] = [];
    if (event.metaKey) keys.push('Meta');
    if (event.ctrlKey) keys.push('Ctrl');
    if (event.altKey) keys.push('Alt');
    if (event.shiftKey) keys.push('Shift');

    // Add the actual key if it's not a modifier
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
      this.recordedKeys.set(keys);
    } else {
      keys.push(event.key);

      // Check for conflicts
      const conflict = this.findConflict(keys);
      if (conflict) {
        this.conflictWarning.set(`This shortcut is already used by "${conflict.command}"`);
      } else {
        this.conflictWarning.set(null);
      }

      this.recordedKeys.set(keys);

      // Save after a short delay; a newer keypress or cancel supersedes it, so a
      // stale timer can't save another recording (or another shortcut's).
      this.clearSaveTimer();
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        if (this.editingId() && !this.conflictWarning()) {
          this.saveEdit();
        }
      }, 500);
    }
  }

  public startEdit(shortcut: ShortcutBinding): void {
    this.clearSaveTimer();
    this.editingId.set(shortcut.id);
    this.recordedKeys.set([]);
    this.conflictWarning.set(null);
    this.refocus(host => host.querySelector<HTMLElement>('[data-shortcut-recording]'));
  }

  public cancelEdit(): void {
    this.clearSaveTimer();
    const id = this.editingId();
    if (id !== null) {
      this.refocus(host =>
        [...host.querySelectorAll<HTMLElement>('[data-shortcut-edit]')].find(
          el => el.dataset['shortcutEdit'] === id
        )
      );
    }
    this.editingId.set(null);
    this.recordedKeys.set([]);
    this.conflictWarning.set(null);
  }

  public saveEdit(): void {
    const id = this.editingId();
    const keys = this.recordedKeys();
    if (!id || keys.length === 0) return;

    const shortcut = this.shortcuts().find(s => s.id === id);
    if (shortcut) {
      this.shortcutChanged.emit({ shortcut, keys });
    }

    this.cancelEdit();
  }

  public resetShortcut(shortcut: ShortcutBinding): void {
    this.shortcutReset.emit(shortcut);
  }

  public formatKey(key: string): string {
    const platform = this.platform();
    const keyMap: Record<string, string> = {
      Meta: platform === 'mac' ? '⌘' : 'Win',
      Ctrl: platform === 'mac' ? '⌃' : 'Ctrl',
      Alt: platform === 'mac' ? '⌥' : 'Alt',
      Shift: platform === 'mac' ? '⇧' : 'Shift',
      Enter: '↵',
      Backspace: '⌫',
      Delete: '⌦',
      Escape: 'Esc',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      Tab: '⇥',
      ' ': 'Space',
      // Spelled out off macOS so it can't be mistaken for the '+' separator
      '+': platform === 'mac' ? '+' : 'Plus',
    };
    return keyMap[key] || key.toUpperCase();
  }

  private findConflict(keys: string[]): ShortcutBinding | null {
    // Compare case-insensitively (a recorded 's' must clash with a stored
    // 'S'), on sorted copies: sorting in place would reorder the recorded keys
    const normalize = (list: string[]) =>
      list
        .map(key => key.toLowerCase())
        .sort()
        .join('+');
    const keysStr = normalize(keys);
    const editingId = this.editingId();

    return (
      this.shortcuts().find(s => {
        if (s.id === editingId) return false;
        return normalize(s.keys) === keysStr;
      }) || null
    );
  }
}
