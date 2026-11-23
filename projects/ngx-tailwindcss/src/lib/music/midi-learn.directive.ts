import {
  computed,
  Directive,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  untracked,
} from '@angular/core';
import { CCValueChangeEvent, MidiCCMapping, MidiService } from './midi.service';

type MidiLearnInputConfig = Pick<
  MidiCCMapping,
  'channel' | 'minValue' | 'maxValue' | 'inverted' | 'curve'
> & { ccNumber: number | null };

/**
 * Directive for MIDI Learn functionality
 *
 * Allows any control (fader, knob, slider, etc.) to be mapped to a MIDI CC.
 *
 * @example
 * ```html
 * <!-- Basic usage -->
 * <tw-volume-dial
 *   twMidiLearn="volume-dial"
 *   (midiValueChange)="onMidiValue($event)"
 * ></tw-volume-dial>
 *
 * <!-- With configuration -->
 * <tw-fader
 *   twMidiLearn="fader-1"
 *   [midiChannel]="-1"
 *   [midiMinValue]="-60"
 *   [midiMaxValue]="12"
 *   [midiCurve]="'logarithmic'"
 *   (midiValueChange)="setFaderValue($event.scaledValue)"
 *   (midiLearnStart)="showLearning()"
 *   (midiLearnComplete)="hideLearning()"
 * ></tw-fader>
 *
 * <!-- Manual trigger for MIDI Learn -->
 * <button (click)="startLearn()">Learn</button>
 * ```
 */
@Directive({
  selector: '[twMidiLearn]',
  standalone: true,
  host: {
    '[class.tw-midi-learning]': 'isLearning()',
    '[class.tw-midi-mapped]': 'isMapped()',
  },
})
export class TwMidiLearnDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef);
  private readonly midiService = inject(MidiService);

  /** Unique identifier for this control's MIDI mapping */
  readonly twMidiLearn = input.required<string>();

  /** MIDI channel to listen to (-1 for all channels) */
  readonly midiChannel = input(-1);

  /** Minimum output value */
  readonly midiMinValue = input(0);

  /** Maximum output value */
  readonly midiMaxValue = input(127);

  /** Whether to invert the value */
  readonly midiInverted = input(false);

  /** Value curve type */
  readonly midiCurve = input<'linear' | 'logarithmic' | 'exponential'>('linear');

  /** Pre-configured CC number (skip learn mode) */
  readonly midiCC = input<number | null>(null);

  /**
   * Enable right-click to start MIDI Learn.
   * Off by default so that merely applying the directive does not suppress
   * the browser context menu; set to `true` to opt in.
   */
  readonly enableContextMenuLearn = input(false);

  /** Emitted when a MIDI value is received for this control */
  readonly midiValueChange = output<CCValueChangeEvent>();

  /** Emitted when MIDI Learn mode starts for this control */
  readonly midiLearnStart = output();

  /** Emitted when MIDI Learn is complete */
  readonly midiLearnComplete = output<MidiCCMapping>();

  /** Emitted when MIDI Learn is cancelled */
  readonly midiLearnCancel = output();

  private ccUnsubscribe: (() => void) | null = null;
  private learnUnsubscribe: (() => void) | null = null;
  // Learn started by this control that has neither completed nor been
  // reported as cancelled yet
  private learnPending = false;
  // Mapping configuration last applied from this directive's inputs (null
  // until ngOnInit has applied the initial configuration)
  private appliedConfig: MidiLearnInputConfig | null = null;

  constructor() {
    // Learn mode can also end without completing outside this directive: the
    // service timeout, or another control starting its own learn. Report that
    // as a cancel so consumers do not stay stuck in a "learning" UI state.
    effect(() => {
      if (!this.isLearning() && this.learnPending) {
        this.learnPending = false;
        this.midiLearnCancel.emit();
      }
    });

    // Propagate later changes of the configuration inputs to this control's
    // mapping. Only inputs that actually changed are written, so mappings the
    // consumer imported or updated through the service are not clobbered.
    effect(() => {
      const config = this.readInputConfig();
      untracked(() => {
        this.syncInputConfig(config);
      });
    });
  }

  ngOnInit(): void {
    this.appliedConfig = this.readInputConfig();

    // Subscribe to CC changes
    this.ccUnsubscribe = this.midiService.onCCChange(event => {
      if (event.mappingId === this.twMidiLearn()) {
        this.midiValueChange.emit(event);
      }
    });

    // Subscribe to learn complete
    this.learnUnsubscribe = this.midiService.onLearnComplete(mapping => {
      if (mapping.id === this.twMidiLearn()) {
        this.learnPending = false;
        this.midiLearnComplete.emit(mapping);
      }
    });

    // If a CC number is pre-configured, add the mapping immediately
    const preConfiguredCC = this.midiCC();
    if (preConfiguredCC !== null) {
      this.midiService.addCCMapping({
        id: this.twMidiLearn(),
        ccNumber: preConfiguredCC,
        channel: this.midiChannel(),
        minValue: this.midiMinValue(),
        maxValue: this.midiMaxValue(),
        inverted: this.midiInverted(),
        curve: this.midiCurve(),
      });
    }
  }

  ngOnDestroy(): void {
    this.ccUnsubscribe?.();
    this.learnUnsubscribe?.();

    // Cancel learn if active for this control
    if (this.isLearning()) {
      this.midiService.cancelMidiLearn();
    }
  }

  private readInputConfig(): MidiLearnInputConfig {
    return {
      ccNumber: this.midiCC(),
      channel: this.midiChannel(),
      minValue: this.midiMinValue(),
      maxValue: this.midiMaxValue(),
      inverted: this.midiInverted(),
      curve: this.midiCurve(),
    };
  }

  private syncInputConfig(config: MidiLearnInputConfig): void {
    const previous = this.appliedConfig;
    // Before init the initial configuration is applied by ngOnInit
    if (!previous) return;
    this.appliedConfig = config;

    const updates: Partial<MidiCCMapping> = {};
    if (config.channel !== previous.channel) updates.channel = config.channel;
    if (config.minValue !== previous.minValue) updates.minValue = config.minValue;
    if (config.maxValue !== previous.maxValue) updates.maxValue = config.maxValue;
    if (config.inverted !== previous.inverted) updates.inverted = config.inverted;
    if (config.curve !== previous.curve) updates.curve = config.curve;
    if (config.ccNumber !== previous.ccNumber && config.ccNumber !== null) {
      updates.ccNumber = config.ccNumber;
    }
    if (Object.keys(updates).length === 0) return;

    const id = this.twMidiLearn();
    if (this.midiService.getCCMapping(id)) {
      this.midiService.updateCCMapping(id, updates);
    } else if (updates.ccNumber !== undefined) {
      // A new CC was configured with no mapping registered yet: map it
      this.midiService.addCCMapping({ id, ...config, ccNumber: updates.ccNumber });
    }
  }

  /**
   * Start MIDI Learn mode for this control
   */
  startLearn(): void {
    this.midiService.startMidiLearn(this.twMidiLearn());
    this.learnPending = true;
    this.midiLearnStart.emit();

    // Update mapping configuration when learn completes
    const existingMapping = this.midiService.getCCMapping(this.twMidiLearn());
    if (!existingMapping) {
      // Pre-register with our configuration (CC will be learned)
      this.midiService.addCCMapping({
        id: this.twMidiLearn(),
        ccNumber: -1, // Sentinel: not learned yet (0 is a real CC — Bank Select)
        channel: this.midiChannel(),
        minValue: this.midiMinValue(),
        maxValue: this.midiMaxValue(),
        inverted: this.midiInverted(),
        curve: this.midiCurve(),
      });
    }
  }

  /**
   * Cancel MIDI Learn mode
   */
  cancelLearn(): void {
    if (this.isLearning()) {
      this.learnPending = false;
      this.midiService.cancelMidiLearn();
      this.midiLearnCancel.emit();
    }
  }

  /**
   * Whether MIDI Learn is active for this control
   * (computed so the host class bindings only re-evaluate on signal changes)
   */
  readonly isLearning = computed(() => {
    const learnState = this.midiService.learnState();
    return learnState.active && learnState.targetId === this.twMidiLearn();
  });

  /**
   * Whether this control has a MIDI mapping
   * (computed so the host class bindings only re-evaluate on signal changes)
   */
  readonly isMapped = computed(() => {
    // A mapping pre-registered by startLearn() carries the ccNumber -1
    // sentinel until a CC is actually learned; that is not "mapped" yet
    const mapping = this.midiService.getCCMapping(this.twMidiLearn());
    return mapping !== undefined && mapping.ccNumber >= 0;
  });

  /**
   * Get the current mapping
   */
  getMapping(): MidiCCMapping | undefined {
    return this.midiService.getCCMapping(this.twMidiLearn());
  }

  /**
   * Clear the MIDI mapping for this control
   */
  clearMapping(): void {
    this.midiService.removeCCMapping(this.twMidiLearn());
  }

  /**
   * Update mapping configuration
   */
  updateMapping(updates: Partial<MidiCCMapping>): void {
    this.midiService.updateCCMapping(this.twMidiLearn(), updates);
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: MouseEvent): void {
    if (this.enableContextMenuLearn()) {
      event.preventDefault();
      this.startLearn();
    }
  }

  @HostListener('dblclick', ['$event'])
  onDoubleClick(event: MouseEvent): void {
    // Double-click to start learn (alternative to context menu)
    if (event.shiftKey) {
      event.preventDefault();
      this.startLearn();
    }
  }
}
