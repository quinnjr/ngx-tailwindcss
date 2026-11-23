import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwClassService } from '../core/tw-class.service';

export interface TimelineEvent {
  id?: string | number;
  title?: string;
  description?: string;
  date?: string;
  icon?: TemplateRef<any>;
  content?: TemplateRef<any>;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
}

export type TimelineLayout = 'vertical' | 'horizontal';
export type TimelineAlign = 'left' | 'right' | 'alternate';

// `icon` is the colour of an icon drawn on the marker (>= 3:1; white on amber is ~2.2:1)
const TIMELINE_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  primary: { bg: 'bg-blue-600', border: 'border-blue-600', icon: 'text-white' },
  secondary: { bg: 'bg-slate-600', border: 'border-slate-600', icon: 'text-white' },
  success: { bg: 'bg-emerald-600', border: 'border-emerald-600', icon: 'text-white' },
  warning: { bg: 'bg-amber-500', border: 'border-amber-500', icon: 'text-amber-950' },
  danger: { bg: 'bg-rose-600', border: 'border-rose-600', icon: 'text-white' },
  info: { bg: 'bg-cyan-600', border: 'border-cyan-600', icon: 'text-white' },
};

/**
 * Timeline component with Tailwind CSS styling
 *
 * @example
 * ```html
 * <tw-timeline [events]="timelineEvents"></tw-timeline>
 * <tw-timeline [events]="events" align="alternate"></tw-timeline>
 * ```
 */
@Component({
  selector: 'tw-timeline',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline.component.html',
})
export class TwTimelineComponent {
  private readonly twClass = inject(TwClassService);

  /** Events to display */
  readonly events = input<TimelineEvent[]>([]);

  /** Layout direction */
  readonly layout = input<TimelineLayout>('vertical');

  /** Content alignment */
  readonly align = input<TimelineAlign>('left');

  /** Marker size */
  readonly markerSize = input<'sm' | 'md' | 'lg'>('md');

  /** Track by function for ngFor */
  readonly trackByFn = input<(event: TimelineEvent) => any>(
    (event: TimelineEvent) => event.id ?? event
  );

  /** Additional classes */
  readonly classOverride = input('');

  private readonly MARKER_SIZES = {
    sm: { dot: 'w-3 h-3', icon: 'w-8 h-8 text-sm' },
    md: { dot: 'w-4 h-4', icon: 'w-10 h-10 text-base' },
    lg: { dot: 'w-5 h-5', icon: 'w-12 h-12 text-lg' },
  };

  protected containerClasses = computed(() => {
    return this.twClass.merge(
      this.layout() === 'horizontal' ? 'flex' : 'flex flex-col',
      this.classOverride()
    );
  });

  /** Effective alignment for an item; 'alternate' resolves per index (even left, odd right) */
  protected effectiveAlign(index: number): 'left' | 'right' {
    const align = this.align();
    if (align === 'alternate') {
      return index % 2 === 0 ? 'left' : 'right';
    }
    return align;
  }

  protected itemClasses(index: number, isFirst: boolean, isLast: boolean) {
    return this.twClass.merge(
      'relative flex gap-4',
      this.layout() === 'horizontal' ? 'flex-col flex-1' : '',
      this.effectiveAlign(index) === 'right' ? 'flex-row-reverse' : '',
      isLast ? '' : 'pb-8'
    );
  }

  /**
   * Connector geometry per marker kind and size. The line runs through the centre of the
   * item's marker (markers have z-10, so they sit ON TOP of the line). Dot markers are
   * w-3/w-4/w-5 (centre 6/8/10px), icon markers w-8/w-10/w-12 (centre 16/20/24px); the
   * 2px line is offset by 1px to centre it. Static strings so Tailwind can see them.
   */
  private readonly CONNECTOR_GEOMETRY = {
    dot: {
      verticalTop: { sm: 'top-[6px]', md: 'top-[8px]', lg: 'top-[10px]' },
      verticalLeft: { sm: 'left-[5px]', md: 'left-[7px]', lg: 'left-[9px]' },
      verticalRight: { sm: 'right-[5px]', md: 'right-[7px]', lg: 'right-[9px]' },
      horizontalTop: { sm: 'top-[5px]', md: 'top-[7px]', lg: 'top-[9px]' },
      horizontalLeft: { sm: 'left-[6px]', md: 'left-[8px]', lg: 'left-[10px]' },
    },
    icon: {
      verticalTop: { sm: 'top-[16px]', md: 'top-[20px]', lg: 'top-[24px]' },
      verticalLeft: { sm: 'left-[15px]', md: 'left-[19px]', lg: 'left-[23px]' },
      verticalRight: { sm: 'right-[15px]', md: 'right-[19px]', lg: 'right-[23px]' },
      horizontalTop: { sm: 'top-[15px]', md: 'top-[19px]', lg: 'top-[23px]' },
      horizontalLeft: { sm: 'left-[16px]', md: 'left-[20px]', lg: 'left-[24px]' },
    },
  } as const;

  protected connectorClasses(index: number, event?: TimelineEvent) {
    const geometry = this.CONNECTOR_GEOMETRY[event?.icon ? 'icon' : 'dot'];
    const size = this.markerSize();

    if (this.layout() === 'horizontal') {
      // Items are equal-width columns with the marker at their top-left, so a line one item
      // wide starting at this marker's centre ends at the next marker's centre
      return this.twClass.merge(
        'absolute w-full h-0.5 bg-slate-300',
        geometry.horizontalTop[size],
        geometry.horizontalLeft[size]
      );
    }

    return this.twClass.merge(
      'absolute w-0.5 bg-slate-300 bottom-0',
      geometry.verticalTop[size],
      this.effectiveAlign(index) === 'right'
        ? geometry.verticalRight[size]
        : geometry.verticalLeft[size]
    );
  }

  protected markerContainerClasses() {
    return 'relative z-10 flex-shrink-0';
  }

  protected dotMarkerClasses(event: TimelineEvent) {
    const size = this.MARKER_SIZES[this.markerSize()].dot;
    const color = event.color || 'primary';
    const colorClasses = TIMELINE_COLORS[color];

    return this.twClass.merge(
      'rounded-full ring-4 ring-white dark:ring-slate-900',
      size,
      colorClasses.bg
    );
  }

  protected iconMarkerClasses(event: TimelineEvent) {
    const size = this.MARKER_SIZES[this.markerSize()].icon;
    const color = event.color || 'primary';
    const colorClasses = TIMELINE_COLORS[color];

    return this.twClass.merge(
      'rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900',
      size,
      colorClasses.bg,
      colorClasses.icon
    );
  }

  protected contentClasses(index: number) {
    return this.twClass.merge(
      'flex-1 min-w-0',
      this.effectiveAlign(index) === 'right' ? 'text-right' : ''
    );
  }

  protected dateClasses() {
    return 'text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide';
  }

  protected titleClasses() {
    return 'text-base font-semibold text-slate-900 dark:text-slate-100 mt-1';
  }

  protected descriptionClasses() {
    return 'text-sm text-slate-600 dark:text-slate-300 mt-1';
  }
}
