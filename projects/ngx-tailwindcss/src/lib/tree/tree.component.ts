import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  inject,
  input,
  linkedSignal,
  numberAttribute,
  Output,
  signal,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';

export interface TreeNode {
  key?: string | number;
  label: string;
  icon?: TemplateRef<any>;
  expanded?: boolean;
  selected?: boolean;
  disabled?: boolean;
  visible?: boolean;
  children?: TreeNode[];
  data?: any;
  badge?: string;
  styleClass?: string;
}

export type TreeSelectionMode = 'none' | 'single' | 'multiple' | 'checkbox';

interface TreeNodeViewState {
  selected: boolean;
  indeterminate: boolean;
  nodeClass: string;
  labelClass: string;
}

/**
 * Tree component with Tailwind CSS styling
 *
 * @example
 * ```html
 * <tw-tree [nodes]="treeNodes" selectionMode="checkbox"></tw-tree>
 * <tw-tree [nodes]="nodes" (onNodeSelect)="handleSelect($event)"></tw-tree>
 * ```
 */
@Component({
  selector: 'tw-tree',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tree.component.html',
})
export class TwTreeComponent {
  private readonly twClass = inject(TwClassService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Tree nodes */
  readonly nodes = input<TreeNode[]>([]);

  /** Selection mode */
  readonly selectionMode = input<TreeSelectionMode>('none');

  /** Indent size in pixels */
  readonly indentSize = input(24, { transform: numberAttribute });

  /** Whether to propagate selection to children */
  readonly propagateSelectionDown = input(true);

  /** Whether to propagate selection to parent */
  readonly propagateSelectionUp = input(true);

  /** Additional classes */
  readonly classOverride = input('');

  /** Node select event */
  @Output() onNodeSelect = new EventEmitter<TreeNode>();

  /** Node unselect event */
  @Output() onNodeUnselect = new EventEmitter<TreeNode>();

  /** Node expand event */
  @Output() onNodeExpand = new EventEmitter<TreeNode>();

  /** Node collapse event */
  @Output() onNodeCollapse = new EventEmitter<TreeNode>();

  /** Selection change event */
  @Output() selectionChange = new EventEmitter<TreeNode[]>();

  /** Selection is held as a Set internally for O(1) lookups; emitted as an array. */
  protected selection = signal<ReadonlySet<TreeNode>>(new Set());

  /**
   * Node currently owning the roving tabindex. Reset when `nodes` is replaced, so a
   * node from the old tree can't leave the new tree without any tabbable item.
   */
  protected readonly focusedNode = linkedSignal<TreeNode[], TreeNode | null>({
    source: this.nodes,
    computation: () => null,
  });

  protected containerClasses = computed(() => {
    return this.twClass.merge('py-2', this.classOverride());
  });

  /**
   * Per-node view state (selected/indeterminate flags and classes), computed in a
   * single pass over the tree whenever the nodes input or the selection changes.
   */
  private readonly nodeViewState = computed(() => {
    const selection = this.selection();
    const states = new Map<TreeNode, TreeNodeViewState>();

    const visit = (node: TreeNode): { total: number; selectedCount: number } => {
      let total = 0;
      let selectedCount = 0;
      for (const child of node.children ?? []) {
        const childResult = visit(child);
        total += childResult.total + 1;
        selectedCount += childResult.selectedCount + (selection.has(child) ? 1 : 0);
      }

      const selected = selection.has(node);
      states.set(node, {
        selected,
        indeterminate: total > 0 && selectedCount > 0 && selectedCount < total,
        nodeClass: this.twClass.merge(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer',
          'hover:bg-slate-100',
          selected ? 'bg-blue-50' : '',
          node.disabled ? 'opacity-50 cursor-not-allowed' : '',
          node.styleClass || ''
        ),
        labelClass: this.twClass.merge(
          'text-sm select-none',
          node.disabled ? 'text-slate-400' : 'text-slate-700'
        ),
      });
      return { total, selectedCount };
    };

    this.nodes().forEach(visit);
    return states;
  });

  /** Child-to-parent lookup used for upward selection propagation. */
  private readonly parentMap = computed(() => {
    const map = new Map<TreeNode, TreeNode | null>();
    const visit = (node: TreeNode, parent: TreeNode | null) => {
      map.set(node, parent);
      node.children?.forEach(child => {
        visit(child, node);
      });
    };
    this.nodes().forEach(node => {
      visit(node, null);
    });
    return map;
  });

  protected nodeClasses(node: TreeNode, level: number): string {
    return this.nodeViewState().get(node)?.nodeClass ?? '';
  }

  protected labelClasses(node: TreeNode): string {
    return this.nodeViewState().get(node)?.labelClass ?? '';
  }

  isSelected(node: TreeNode): boolean {
    return this.selection().has(node);
  }

  isIndeterminate(node: TreeNode): boolean {
    return this.nodeViewState().get(node)?.indeterminate ?? false;
  }

  onNodeClick(node: TreeNode): void {
    if (node.disabled) return;

    // Toggle expand/collapse if node has children
    if (node.children && node.children.length > 0) {
      this.toggleNode(node);
    }

    // Handle selection
    if (this.selectionMode() === 'single') {
      this.selection.set(new Set([node]));
      this.onNodeSelect.emit(node);
      this.selectionChange.emit(this.getSelection());
    } else if (this.selectionMode() === 'multiple') {
      const next = new Set(this.selection());
      if (next.has(node)) {
        next.delete(node);
        this.onNodeUnselect.emit(node);
      } else {
        next.add(node);
        this.onNodeSelect.emit(node);
      }
      this.selection.set(next);
      this.selectionChange.emit([...next]);
    }
  }

  onCheckboxChange(node: TreeNode, event: Event): void {
    this.setChecked(node, (event.target as HTMLInputElement).checked);
  }

  /** aria-selected for single/multiple selection; omitted otherwise. */
  protected ariaSelected(node: TreeNode): boolean | null {
    const mode = this.selectionMode();
    return mode === 'single' || mode === 'multiple' ? this.isSelected(node) : null;
  }

  /** aria-checked (tri-state) for checkbox selection; omitted otherwise. */
  protected ariaChecked(node: TreeNode): 'true' | 'false' | 'mixed' | null {
    if (this.selectionMode() !== 'checkbox') return null;
    if (this.isIndeterminate(node)) return 'mixed';
    return this.isSelected(node) ? 'true' : 'false';
  }

  private setChecked(node: TreeNode, checked: boolean): void {
    if (node.disabled) return;

    const next = new Set(this.selection());

    if (checked) {
      this.selectNodeInto(next, node);
    } else {
      this.unselectNodeFrom(next, node);
    }

    if (this.propagateSelectionUp()) {
      this.updateAncestors(next, node);
    }

    this.selection.set(next);
    this.selectionChange.emit([...next]);
  }

  toggleNode(node: TreeNode): void {
    node.expanded = !node.expanded;
    // Collapsing hides the focused descendant: hand the roving tabindex to the
    // collapsed node so the tree stays reachable with Tab
    if (!node.expanded) this.ensureFocusedNodeVisible(node);
    // Node objects are mutated in place, so the OnPush view must be marked explicitly
    // (programmatic calls do not originate from a template event in this view)
    this.cdr.markForCheck();

    if (node.expanded) {
      this.onNodeExpand.emit(node);
    } else {
      this.onNodeCollapse.emit(node);
    }
  }

  protected nodeTabIndex(node: TreeNode): number {
    const focused = this.focusedNode();
    if (focused) {
      return node === focused ? 0 : -1;
    }
    const firstRoot = this.nodes().find(n => n.visible !== false);
    return node === firstRoot ? 0 : -1;
  }

  protected onNodeKeydown(event: KeyboardEvent, node: TreeNode): void {
    // Keydown bubbles through ancestor treeitems; only the focused item handles it
    if (event.target !== event.currentTarget) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const visible = this.getVisibleNodes();
        this.focusNodeAt(visible, Math.min(visible.indexOf(node) + 1, visible.length - 1));
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const visible = this.getVisibleNodes();
        this.focusNodeAt(visible, Math.max(visible.indexOf(node) - 1, 0));
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        if (node.children?.length && !node.expanded) {
          this.toggleNode(node);
        } else if (node.children?.length) {
          // Already expanded: move to the first child
          const visible = this.getVisibleNodes();
          this.focusNodeAt(visible, visible.indexOf(node) + 1);
        }
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        if (node.children?.length && node.expanded) {
          this.toggleNode(node);
        } else {
          // Collapsed or leaf: move to the parent node
          const parent = this.parentMap().get(node);
          if (parent) {
            const visible = this.getVisibleNodes();
            this.focusNodeAt(visible, visible.indexOf(parent));
          }
        }
        break;
      }
      case ' ': {
        event.preventDefault();
        if (this.selectionMode() === 'checkbox') {
          // Space toggles the item's checkbox (the checkbox itself is not focusable)
          this.setChecked(node, !this.isSelected(node));
        } else {
          this.onNodeClick(node);
        }
        break;
      }
      case 'Enter': {
        event.preventDefault();
        this.onNodeClick(node);
        break;
      }
    }
  }

  private focusNodeAt(visible: TreeNode[], index: number): void {
    const target = visible[index];
    if (!target) return;
    this.focusedNode.set(target);
    // Query treeitems in DOM order: a @ViewChildren QueryList over the recursive
    // template outlet is ordered by view insertion, not by visual position
    const items = this.elementRef.nativeElement.querySelectorAll<HTMLElement>('[role="treeitem"]');
    items[index]?.focus();
  }

  /** Nodes currently rendered, in DOM order (visible and all ancestors expanded). */
  private getVisibleNodes(): TreeNode[] {
    const visible: TreeNode[] = [];
    const visit = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.visible === false) continue;
        visible.push(node);
        if (node.children && node.children.length > 0 && node.expanded) {
          visit(node.children);
        }
      }
    };
    visit(this.nodes());
    return visible;
  }

  private selectNodeInto(selection: Set<TreeNode>, node: TreeNode): void {
    if (!selection.has(node)) {
      selection.add(node);
      this.onNodeSelect.emit(node);
    }

    if (this.propagateSelectionDown() && node.children) {
      node.children.forEach(child => {
        this.selectNodeInto(selection, child);
      });
    }
  }

  private unselectNodeFrom(selection: Set<TreeNode>, node: TreeNode): void {
    if (selection.has(node)) {
      selection.delete(node);
      this.onNodeUnselect.emit(node);
    }

    if (this.propagateSelectionDown() && node.children) {
      node.children.forEach(child => {
        this.unselectNodeFrom(selection, child);
      });
    }
  }

  /**
   * Walks up from the given node: a parent becomes selected when all of its
   * direct children are selected, and is deselected otherwise.
   */
  private updateAncestors(selection: Set<TreeNode>, node: TreeNode): void {
    const parents = this.parentMap();
    let parent = parents.get(node) ?? null;

    while (parent) {
      const children = parent.children ?? [];
      const allSelected = children.length > 0 && children.every(child => selection.has(child));

      if (allSelected) {
        if (!selection.has(parent)) {
          selection.add(parent);
          this.onNodeSelect.emit(parent);
        }
      } else if (selection.has(parent)) {
        selection.delete(parent);
        this.onNodeUnselect.emit(parent);
      }

      parent = parents.get(parent) ?? null;
    }
  }

  /** Expand all nodes */
  expandAll(): void {
    const expandNodes = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          node.expanded = true;
          expandNodes(node.children);
        }
      });
    };
    expandNodes(this.nodes());
    this.cdr.markForCheck();
  }

  /** Collapse all nodes */
  collapseAll(): void {
    const collapseNodes = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        node.expanded = false;
        if (node.children) {
          collapseNodes(node.children);
        }
      });
    };
    collapseNodes(this.nodes());
    this.ensureFocusedNodeVisible(null);
    this.cdr.markForCheck();
  }

  /** Moves the roving tabindex to `fallback` (or the first root) if its node got hidden. */
  private ensureFocusedNodeVisible(fallback: TreeNode | null): void {
    const focused = this.focusedNode();
    if (focused && !this.getVisibleNodes().includes(focused)) {
      this.focusedNode.set(fallback);
    }
  }

  /** Get selected nodes */
  getSelection(): TreeNode[] {
    return [...this.selection()];
  }

  /** Clear selection */
  clearSelection(): void {
    this.selection.set(new Set());
    this.selectionChange.emit([]);
  }
}
