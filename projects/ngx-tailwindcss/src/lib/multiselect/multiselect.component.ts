import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  output,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TwClassService } from '../core/tw-class.service';

export interface MultiSelectOption {
  label: string;
  value: unknown;
  disabled?: boolean;
  icon?: string;
}

export interface MultiSelectGroup {
  label: string;
  options: MultiSelectOption[];
}

export type MultiSelectSize = 'sm' | 'md' | 'lg';
export type MultiSelectVariant = 'default' | 'filled';
export type MultiSelectAppendTo = 'body' | 'self';

/** Keyboard-navigation sentinel for the "Select All" row */
const SELECT_ALL = Symbol('select-all');
type NavItem = MultiSelectOption | typeof SELECT_ALL;

const MULTISELECT_SIZES: Record<MultiSelectSize, { trigger: string; text: string; clear: string }> =
  {
    // `clear` offsets the clear button over its reserved slot: padding + chevron (w-5) + gap-2
    sm: { trigger: 'px-3 py-1.5 min-h-8', text: 'text-sm', clear: 'right-10' },
    md: { trigger: 'px-4 py-2.5 min-h-10', text: 'text-base', clear: 'right-11' },
    lg: { trigger: 'px-5 py-3 min-h-12', text: 'text-lg', clear: 'right-12' },
  };

/**
 * Multi-select/Dropdown component with Tailwind CSS styling.
 * Supports multiple selections and grouped options.
 *
 * @example
 * ```html
 * <tw-multiselect [options]="options" [(ngModel)]="selected" placeholder="Choose..."></tw-multiselect>
 * <tw-multiselect [groups]="groups" [filter]="true" label="Countries"></tw-multiselect>
 * <tw-multiselect [options]="options" appendTo="body" [maxSelections]="3"></tw-multiselect>
 * ```
 */
@Component({
  selector: 'tw-multiselect',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TwMultiSelectComponent),
      multi: true,
    },
  ],
  templateUrl: './multiselect.component.html',
})
export class TwMultiSelectComponent implements ControlValueAccessor, OnDestroy, AfterViewInit {
  @ViewChild('triggerButton') triggerButton!: ElementRef<HTMLButtonElement>;
  @ViewChild('filterInput') filterInput?: ElementRef<HTMLInputElement>;
  @ViewChild('clearButton') clearButton?: ElementRef<HTMLButtonElement>;

  /** Options to display (flat list) */
  readonly options = input<MultiSelectOption[]>([]);

  /** Grouped options to display */
  readonly groups = input<MultiSelectGroup[]>([]);

  /** Placeholder text */
  readonly placeholder = input('Select options');

  /** Label text */
  readonly label = input('');

  /** Enable search/filter */
  readonly filter = input(false, { transform: booleanAttribute });

  /** Size variant */
  readonly size = input<MultiSelectSize>('md');

  /** Visual variant */
  readonly variant = input<MultiSelectVariant>('default');

  /** Where to append dropdown */
  readonly appendTo = input<MultiSelectAppendTo>('self');

  /** Disabled state */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Show checkboxes */
  readonly showCheckbox = input(true, { transform: booleanAttribute });

  /** Show select all option */
  readonly showSelectAll = input(true, { transform: booleanAttribute });

  /** Maximum number of selections allowed (0 = unlimited) */
  readonly maxSelections = input(0);

  /** Custom class for dropdown */
  readonly dropdownClass = input('');

  /** Custom class for trigger button */
  readonly triggerClass = input('');

  /** Selection change event */
  readonly selectionChange = output<unknown[]>();

  protected readonly twClass = inject(TwClassService);
  protected readonly elementRef = inject(ElementRef);
  protected readonly document = inject(DOCUMENT);
  protected readonly platformId = inject(PLATFORM_ID);

  protected isOpen = signal(false);
  protected filterValue = signal('');
  protected selectedValues = signal<Set<unknown>>(new Set());
  protected dropdownPosition = signal<{ top: number; left: number; width: number } | null>(null);
  /** Disabled state set through the forms API (setDisabledState) */
  private readonly cvaDisabled = signal(false);
  /** Effective disabled state: the `disabled` input OR the forms API state */
  protected readonly _disabled = computed(() => this.disabled() || this.cvaDisabled());
  protected activeIndex = signal(-1);

  protected readonly listboxId = `tw-multiselect-listbox-${Math.random().toString(36).slice(2, 9)}`;
  protected readonly triggerId = `${this.listboxId}-trigger`;
  protected readonly selectAllId = `${this.listboxId}-select-all`;

  private onChangeFn: (value: unknown[]) => void = () => {};
  private onTouchedFn: () => void = () => {};
  private clickListener: ((event: MouseEvent) => void) | null = null;
  private resizeListener: (() => void) | null = null;
  private scrollListener: (() => void) | null = null;

  protected allOptions = computed(() => {
    const groups = this.groups();
    if (groups.length > 0) {
      return groups.flatMap(g => g.options);
    }
    return this.options();
  });

  protected enabledOptions = computed(() => this.allOptions().filter(opt => !opt.disabled));

  /**
   * The number of enabled options a "Select All" can effectively reach,
   * capped by maxSelections when set.
   */
  protected selectAllTarget = computed(() => {
    const enabledCount = this.enabledOptions().length;
    const capacity = this.selectionCapacity();
    return capacity === null ? enabledCount : Math.min(capacity, enabledCount);
  });

  /** Select All cannot select everything when maxSelections is lower than the option count */
  protected selectAllLimited = computed(() => {
    const capacity = this.selectionCapacity();
    return capacity !== null && capacity < this.enabledOptions().length;
  });

  /** Number of selected values Select All cannot change (disabled or unknown options) */
  private lockedCount = computed(() => {
    const enabledValues = new Set(this.enabledOptions().map(opt => opt.value));
    return [...this.selectedValues()].filter(value => !enabledValues.has(value)).length;
  });

  /** Enabled options that may be selected under maxSelections (null = unlimited) */
  private selectionCapacity = computed(() => {
    const max = this.maxSelections();
    return max > 0 ? Math.max(0, max - this.lockedCount()) : null;
  });

  /** Number of currently selected enabled options (ignores disabled pre-selected values) */
  protected selectedEnabledCount = computed(() => {
    const selected = this.selectedValues();
    return this.enabledOptions().filter(opt => selected.has(opt.value)).length;
  });

  protected selectedOptions = computed(() => {
    const selected = this.selectedValues();
    return this.allOptions().filter(opt => selected.has(opt.value));
  });

  protected displayText = computed(() => {
    const selected = this.selectedOptions();
    if (selected.length === 0) return this.placeholder();
    if (selected.length === 1) return selected[0].label;
    return `${selected.length} selected`;
  });

  protected filteredGroups = computed(() => {
    const groups = this.groups();
    const filter = this.filterValue().toLowerCase();
    if (!filter) return groups;

    return groups
      .map(group => ({
        ...group,
        options: group.options.filter(opt => opt.label.toLowerCase().includes(filter)),
      }))
      .filter(group => group.options.length > 0);
  });

  protected filteredOptions = computed(() => {
    const options = this.options();
    const filter = this.filterValue().toLowerCase();
    if (!filter) return options;

    return options.filter(opt => opt.label.toLowerCase().includes(filter));
  });

  /** Currently visible options in display order (flattened across groups) */
  protected visibleOptions = computed(() => {
    if (this.groups().length > 0) {
      return this.filteredGroups().flatMap(g => g.options);
    }
    return this.filteredOptions();
  });

  /** Whether the "Select All" row is rendered */
  protected showSelectAllRow = computed(
    () => this.showSelectAll() && !this.selectAllLimited() && this.allOptions().length > 0
  );

  /** Select All has nothing to toggle when every option is disabled */
  protected selectAllDisabled = computed(() => this.enabledOptions().length === 0);

  /** Keyboard-navigable rows in display order: Select All (when shown), then visible options */
  private navItems = computed<NavItem[]>(() =>
    this.showSelectAllRow() ? [SELECT_ALL, ...this.visibleOptions()] : this.visibleOptions()
  );

  protected activeOptionId = computed(() => {
    const item = this.navItems()[this.activeIndex()];
    if (item === undefined) return null;
    return item === SELECT_ALL ? this.selectAllId : this.optionId(item);
  });

  protected isSelectAllActive = computed(() => this.navItems()[this.activeIndex()] === SELECT_ALL);

  protected triggerClasses = computed(() => {
    const sizeClasses = MULTISELECT_SIZES[this.size()].trigger;
    const textClasses = MULTISELECT_SIZES[this.size()].text;

    const baseClasses = [
      'flex items-center justify-between w-full rounded-md border transition-colors',
      textClasses,
      sizeClasses,
    ];

    if (this._disabled()) {
      baseClasses.push(
        'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-300 dark:border-slate-700'
      );
    } else if (this.variant() === 'filled') {
      baseClasses.push(
        'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-100 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
      );
    } else {
      baseClasses.push(
        'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100'
      );
    }

    return this.twClass.merge(baseClasses.join(' '), this.triggerClass());
  });

  protected showClearButton = computed(() => this.selectedValues().size > 0 && !this._disabled());

  protected clearButtonClasses = computed(() =>
    [
      'absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded',
      'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
      MULTISELECT_SIZES[this.size()].clear,
    ].join(' ')
  );

  protected dropdownClasses = computed(() => {
    const baseClasses = [
      'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10',
      'focus:outline-none',
    ];

    return this.twClass.merge(baseClasses.join(' '), this.dropdownClass());
  });

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.clickListener = this.onDocumentClick.bind(this);
      this.document.addEventListener('click', this.clickListener);

      this.resizeListener = () => {
        if (this.isOpen() && this.appendTo() === 'body') {
          this.updateDropdownPosition();
        }
      };
      window.addEventListener('resize', this.resizeListener);

      this.scrollListener = () => {
        if (this.isOpen() && this.appendTo() === 'body') {
          this.updateDropdownPosition();
        }
      };
      // Capture so scrolls inside nested containers reposition the panel too
      window.addEventListener('scroll', this.scrollListener, true);
    }
  }

  ngOnDestroy(): void {
    if (this.clickListener) {
      this.document.removeEventListener('click', this.clickListener);
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, true);
    }
  }

  // ControlValueAccessor implementation
  writeValue(value: unknown[]): void {
    if (Array.isArray(value)) {
      this.selectedValues.set(new Set(value));
    } else {
      this.selectedValues.set(new Set());
    }
  }

  registerOnChange(fn: (value: unknown[]) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  toggleDropdown(): void {
    if (this._disabled()) return;

    if (this.isOpen()) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown(): void {
    // Position synchronously so the panel never paints unpositioned
    if (this.appendTo() === 'body') {
      this.updateDropdownPosition();
    }

    this.isOpen.set(true);
    this.activeIndex.set(-1);
    this.onTouchedFn();

    if (this.filter() && isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.filterInput?.nativeElement?.focus();
      }, 0);
    }
  }

  closeDropdown(returnFocus = false): void {
    this.isOpen.set(false);
    this.filterValue.set('');
    this.dropdownPosition.set(null);
    this.activeIndex.set(-1);

    if (returnFocus) {
      this.triggerButton?.nativeElement?.focus();
    }
  }

  toggleOption(option: MultiSelectOption): void {
    if (option.disabled) return;

    const selected = new Set(this.selectedValues());

    if (selected.has(option.value)) {
      selected.delete(option.value);
    } else {
      if (this.maxSelections() > 0 && selected.size >= this.maxSelections()) {
        return; // Max selections reached
      }
      selected.add(option.value);
    }

    this.selectedValues.set(selected);
    const values = [...selected];
    this.onChangeFn(values);
    this.selectionChange.emit(values);
  }

  toggleSelectAll(): void {
    const enabledOptions = this.enabledOptions();
    const enabledValues = new Set(enabledOptions.map(opt => opt.value));
    // Selections on disabled options are locked: Select All must not add or remove them
    const locked = [...this.selectedValues()].filter(value => !enabledValues.has(value));

    let values: unknown[];
    if (this.selectedEnabledCount() >= this.selectAllTarget()) {
      // Deselect all
      values = locked;
    } else {
      // Select all (respecting max selections)
      // Locked selections count toward maxSelections
      const capacity = this.selectionCapacity();
      const toSelect = capacity === null ? enabledOptions : enabledOptions.slice(0, capacity);
      values = [...locked, ...toSelect.map(opt => opt.value)];
    }
    this.selectedValues.set(new Set(values));
    this.onChangeFn(values);
    this.selectionChange.emit(values);
  }

  isSelected(option: MultiSelectOption): boolean {
    return this.selectedValues().has(option.value);
  }

  isAllSelected(): boolean {
    const target = this.selectAllTarget();
    return target > 0 && this.selectedEnabledCount() >= target;
  }

  isSomeSelected(): boolean {
    const count = this.selectedEnabledCount();
    return count > 0 && count < this.selectAllTarget();
  }

  protected isActive(option: MultiSelectOption): boolean {
    const index = this.activeIndex();
    return index >= 0 && this.navItems()[index] === option;
  }

  protected optionId(option: MultiSelectOption): string | null {
    const index = this.visibleOptions().indexOf(option);
    return index >= 0 ? `${this.listboxId}-option-${index}` : null;
  }

  clearAll(): void {
    this.selectedValues.set(new Set());
    this.onChangeFn([]);
    this.selectionChange.emit([]);
  }

  /** Clear button handler: the button disappears once cleared, so keep focus on the trigger */
  protected onClearClick(): void {
    this.clearAll();
    this.triggerButton?.nativeElement?.focus();
  }

  protected onFilterInput(event: Event): void {
    const filterInput = event.target as HTMLInputElement;
    this.filterValue.set(filterInput.value);
    this.activeIndex.set(-1);
  }

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (this._disabled()) return;
    // Let the clear button handle its own keys (native button activation)
    if (event.target === this.clearButton?.nativeElement) return;

    const isFilterInput = event.target === this.filterInput?.nativeElement;

    switch (event.key) {
      case 'Escape': {
        // Claim Escape while open so an enclosing modal/overlay stays open
        if (this.isOpen()) {
          event.preventDefault();
          this.closeDropdown(true);
        }
        break;
      }
      case 'ArrowDown': {
        event.preventDefault();
        if (this.isOpen()) {
          this.moveActiveIndex(1);
        } else {
          this.openDropdown();
        }
        break;
      }
      case 'ArrowUp': {
        if (this.isOpen()) {
          event.preventDefault();
          this.moveActiveIndex(-1);
        }
        break;
      }
      case 'Home': {
        if (this.isOpen() && !isFilterInput) {
          event.preventDefault();
          this.setActiveToEdge(true);
        }
        break;
      }
      case 'End': {
        if (this.isOpen() && !isFilterInput) {
          event.preventDefault();
          this.setActiveToEdge(false);
        }
        break;
      }
      case 'Enter':
      case ' ': {
        if (event.key === ' ' && isFilterInput) return;
        // Enter in the filter text field must never trigger implicit form submission
        if (isFilterInput) event.preventDefault();
        if (this.isOpen() && this.activeIndex() >= 0) {
          event.preventDefault();
          const item = this.navItems()[this.activeIndex()];
          if (item === SELECT_ALL) {
            if (!this.selectAllDisabled()) this.toggleSelectAll();
          } else if (item) {
            this.toggleOption(item);
          }
        }
        break;
      }
    }
  }

  private isNavItemDisabled(item: NavItem): boolean {
    return item === SELECT_ALL ? this.selectAllDisabled() : !!item.disabled;
  }

  private moveActiveIndex(delta: number): void {
    const items = this.navItems();
    if (items.length === 0) return;

    let index = this.activeIndex();
    for (const _ of items) {
      index = (index + delta + items.length) % items.length;
      if (!this.isNavItemDisabled(items[index])) break;
    }
    this.activeIndex.set(index);
  }

  private setActiveToEdge(first: boolean): void {
    const items = this.navItems();
    if (first) {
      const index = items.findIndex(item => !this.isNavItemDisabled(item));
      if (index >= 0) this.activeIndex.set(index);
      return;
    }
    for (let i = items.length - 1; i >= 0; i--) {
      if (!this.isNavItemDisabled(items[i])) {
        this.activeIndex.set(i);
        return;
      }
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscapePress(): void {
    if (this.isOpen()) {
      this.closeDropdown(true);
    }
  }

  private onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = this.elementRef.nativeElement.contains(target);

    if (!clickedInside && this.isOpen()) {
      this.closeDropdown();
    }
  }

  private updateDropdownPosition(): void {
    if (!this.triggerButton?.nativeElement) return;

    const rect = this.triggerButton.nativeElement.getBoundingClientRect();
    this.dropdownPosition.set({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }
}
