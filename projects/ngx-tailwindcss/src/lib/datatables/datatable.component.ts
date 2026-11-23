import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TwClassService } from '../core/tw-class.service';
import { TableColumn, TableSize, TableVariant, TwTableComponent } from '../table/table.component';

let nextDatatableId = 0;

@Component({
  selector: 'tw-datatables',
  standalone: true,
  imports: [CommonModule, TwTableComponent],
  templateUrl: './datatable.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwDatatablesComponent {
  private readonly twClass = inject(TwClassService);

  public readonly data = input<unknown[]>([]);
  /**
   * Column definitions forwarded to the underlying tw-table.
   * Columns are sortable by default; set `sortable: false` on a column to disable sorting for it.
   */
  public readonly columns = input<TableColumn[]>([]);
  public readonly title = input('');
  public readonly subtitle = input<string | undefined>(undefined);
  public readonly description = input<string | undefined>(undefined);
  public readonly tableSize = input<TableSize>('md');
  public readonly tableVariant = input<TableVariant>('striped');
  public readonly selectable = input(false);
  public readonly selectionMode = input<'single' | 'multiple'>('multiple');
  public readonly showGlobalFilter = input(true);
  public readonly paginator = input(true);
  public readonly rows = input(10);
  public readonly hoverable = input(true);
  public readonly responsive = input(true);
  public readonly emptyMessage = input('No records found');
  public readonly classOverride = input('');
  public readonly containerClass = input('');
  public readonly toolbarClass = input('');
  /** Accessible name of the table when no `title` is shown */
  public readonly ariaLabel = input('');

  /** Id of the visible title, which names the table */
  protected readonly titleId = `tw-datatables-${nextDatatableId++}-title`;

  public readonly selectionChange = output<unknown[]>();
  public readonly rowClick = output<unknown>();
  public readonly sortChange = output<{ field: string; order: number }>();
  public readonly pageChange = output<{ page: number; rows: number }>();

  protected readonly baseContainerClass =
    'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-6 space-y-6';

  protected readonly baseToolbarClass = 'flex items-center gap-2 flex-wrap';

  // Merged (not concatenated) so consumer overrides such as `bg-*`/`p-*` actually win
  protected readonly containerClassList = computed(() =>
    this.twClass.merge(this.baseContainerClass, this.containerClass())
  );

  protected readonly toolbarClassList = computed(() =>
    this.twClass.merge(this.baseToolbarClass, this.toolbarClass())
  );
}
