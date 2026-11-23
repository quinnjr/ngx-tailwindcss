import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  NgZone,
  numberAttribute,
  OnDestroy,
  output,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { prepareHiDpiCanvas, watchDevicePixelRatio } from './canvas-hidpi';

export type EQFilterType =
  'lowpass' | 'highpass' | 'bandpass' | 'lowshelf' | 'highshelf' | 'peaking' | 'notch';
export type EQVariant = 'default' | 'dark' | 'vintage' | 'neon' | 'light' | 'highContrast';

export interface EQBand {
  id: string;
  frequency: number; // Hz (20 - 20000)
  gain: number; // dB (-24 to +24)
  q: number; // Q factor (0.1 to 18)
  type: EQFilterType;
  enabled: boolean;
  color?: string;
}

export interface EQBandChange {
  band: EQBand;
  property: 'frequency' | 'gain' | 'q' | 'type' | 'enabled';
}

const DEFAULT_BANDS: EQBand[] = [
  {
    id: 'band1',
    frequency: 80,
    gain: 0,
    q: 0.7,
    type: 'lowshelf',
    enabled: true,
    color: '#EF4444',
  },
  {
    id: 'band2',
    frequency: 250,
    gain: 0,
    q: 1,
    type: 'peaking',
    enabled: true,
    color: '#F97316',
  },
  {
    id: 'band3',
    frequency: 1000,
    gain: 0,
    q: 1,
    type: 'peaking',
    enabled: true,
    color: '#EAB308',
  },
  {
    id: 'band4',
    frequency: 4000,
    gain: 0,
    q: 1,
    type: 'peaking',
    enabled: true,
    color: '#22C55E',
  },
  {
    id: 'band5',
    frequency: 12_000,
    gain: 0,
    q: 0.7,
    type: 'highshelf',
    enabled: true,
    color: '#3B82F6',
  },
];

@Component({
  selector: 'tw-parametric-eq',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parametric-eq.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
})
export class TwParametricEQComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly zone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private stopDprWatch: (() => void) | null = null;

  constructor() {
    // Redraw when any render-affecting input or interaction state changes.
    // Without an analyser the EQ view is static, so this replaces the old
    // unconditional 60fps loop.
    effect(() => {
      this.bands();
      this.width();
      this.height();
      this.variant();
      this.showGrid();
      this.showLabels();
      this.showCurve();
      this.minFreq();
      this.maxFreq();
      this.minGain();
      this.maxGain();
      this.selectedBandId();
      this.hoverBandId();
      this.isDragging();
      this.analyserNode();

      this.requestDraw();
    });
  }

  readonly bands = input<EQBand[]>(DEFAULT_BANDS);
  readonly width = input(600, { transform: numberAttribute });
  readonly height = input(200, { transform: numberAttribute });
  readonly minFreq = input(20, { transform: numberAttribute });
  readonly maxFreq = input(20_000, { transform: numberAttribute });
  readonly minGain = input(-24, { transform: numberAttribute });
  readonly maxGain = input(24, { transform: numberAttribute });
  readonly variant = input<EQVariant>('default');
  readonly showGrid = input(true);
  readonly showLabels = input(true);
  readonly showCurve = input(true);
  readonly interactive = input(true);
  readonly analyserNode = input<AnalyserNode | undefined>(undefined);
  readonly classOverride = input('');

  readonly bandChange = output<EQBandChange>();
  readonly bandsChange = output<EQBand[]>();

  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private frequencyData: Uint8Array<ArrayBuffer> | null = null;

  protected readonly selectedBandId = signal<string | null>(null);
  protected readonly isDragging = signal(false);
  protected readonly dragType = signal<'frequency' | 'gain' | 'q' | null>(null);
  protected readonly hoverBandId = signal<string | null>(null);

  protected readonly colors = computed(() => {
    const variant = this.variant();
    switch (variant) {
      case 'dark': {
        return {
          background: '#0F172A',
          grid: '#334155',
          // slate-400: readable (>=4.5:1) axis labels on the dark background
          gridText: '#94A3B8',
          nodeText: '#FFFFFF',
          curve: '#3B82F6',
          curveFill: 'rgba(59, 130, 246, 0.2)',
          spectrum: 'rgba(59, 130, 246, 0.3)',
        };
      }
      case 'vintage': {
        return {
          background: '#1C1917',
          grid: '#44403C',
          gridText: '#A8A29E', // stone-400
          nodeText: '#FFFFFF',
          curve: '#F59E0B',
          curveFill: 'rgba(245, 158, 11, 0.2)',
          spectrum: 'rgba(245, 158, 11, 0.3)',
        };
      }
      case 'neon': {
        return {
          background: '#000000',
          grid: '#1E1E1E',
          gridText: '#999999',
          nodeText: '#FFFFFF',
          curve: '#00FFFF',
          curveFill: 'rgba(0, 255, 255, 0.15)',
          spectrum: 'rgba(255, 0, 255, 0.3)',
        };
      }
      case 'light': {
        return {
          background: '#FFFFFF',
          grid: '#E2E8F0',
          gridText: '#64748B',
          nodeText: '#0F172A',
          curve: '#2563EB',
          curveFill: 'rgba(37, 99, 235, 0.15)',
          spectrum: 'rgba(37, 99, 235, 0.2)',
        };
      }
      case 'highContrast': {
        return {
          background: '#000000',
          grid: '#FFFFFF',
          gridText: '#FFFFFF',
          nodeText: '#FFFFFF',
          curve: '#FFFF00',
          curveFill: 'rgba(255, 255, 0, 0.3)',
          spectrum: 'rgba(0, 255, 0, 0.4)',
        };
      }
      default: {
        return {
          background: '#1E293B',
          grid: '#475569',
          gridText: '#94A3B8',
          nodeText: '#FFFFFF',
          curve: '#10B981',
          curveFill: 'rgba(16, 185, 129, 0.2)',
          spectrum: 'rgba(16, 185, 129, 0.3)',
        };
      }
    }
  });

  // Selected-band readout panel. The translucent slate-800 panel with white /
  // slate-400 text is ~1.2-3:1 on the light variant's white surroundings.
  protected readonly panelClasses = computed(() =>
    this.variant() === 'light'
      ? { panel: 'bg-slate-100', label: 'text-slate-600', value: 'text-slate-900' }
      : { panel: 'bg-slate-800/50', label: 'text-slate-400', value: 'text-white' }
  );

  /**
   * Text colour for a band chip: white or slate-900, whichever contrasts more
   * with the band colour (white on the default orange/yellow/green bands was
   * ~1.9-2.8:1).
   */
  protected bandTextColor(color: string | undefined): string {
    const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color ?? '')?.[1];
    if (!hex) return '#FFFFFF';
    const full = hex.length === 3 ? hex.replaceAll(/./g, c => c + c) : hex;
    const [r, g, b] = [0, 2, 4].map(i => {
      const c = Number.parseInt(full.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // slate-900 (#0F172A) has a relative luminance of ~0.0089
    const onWhite = 1.05 / (luminance + 0.05);
    const onDark = (luminance + 0.05) / 0.0589;
    return onDark > onWhite ? '#0F172A' : '#FFFFFF';
  }

  protected readonly containerClasses = computed(() => {
    const base = 'relative rounded-lg overflow-hidden';
    return [base, this.classOverride()].filter(Boolean).join(' ');
  });

  ngAfterViewInit(): void {
    // No canvas rendering during SSR (getContext / rAF are unavailable)
    if (!isPlatformBrowser(this.platformId)) return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.requestDraw();
    // The view is static without an analyser: redraw at the new resolution
    // after browser zoom or a move to a screen with a different density
    this.stopDprWatch = watchDevicePixelRatio(() => {
      this.requestDraw();
    });
  }

  ngOnDestroy(): void {
    this.stopDprWatch?.();
    this.stopDprWatch = null;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private requestDraw(): void {
    if (!this.ctx) return;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    // Drawing never writes template state, so keep frames out of the zone
    this.zone.runOutsideAngular(() => {
      this.animationFrameId = requestAnimationFrame(() => {
        this.draw();
      });
    });
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (!this.interactive()) return;

    const pos = this.getCanvasPosition(event);
    const band = this.findBandAtPosition(pos.x, pos.y);

    if (band) {
      this.selectedBandId.set(band.id);
      this.isDragging.set(true);
      this.dragType.set(event.shiftKey ? 'q' : 'gain');
      event.preventDefault();
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const pos = this.getCanvasPosition(event);

    if (this.isDragging() && this.selectedBandId()) {
      this.handleDrag(pos.x, pos.y, event.shiftKey);
    } else {
      const band = this.findBandAtPosition(pos.x, pos.y);
      this.hoverBandId.set(band?.id ?? null);
    }
  }

  @HostListener('mouseup')
  @HostListener('mouseleave')
  onMouseUp(): void {
    this.isDragging.set(false);
    this.dragType.set(null);
  }

  @HostListener('dblclick', ['$event'])
  onDoubleClick(event: MouseEvent): void {
    if (!this.interactive()) return;

    const pos = this.getCanvasPosition(event);
    const band = this.findBandAtPosition(pos.x, pos.y);

    if (band) {
      // Reset band to 0 gain on double-click
      const updatedBands = this.bands().map(b => (b.id === band.id ? { ...b, gain: 0 } : b));
      this.bandsChange.emit(updatedBands);
      this.bandChange.emit({ band: { ...band, gain: 0 }, property: 'gain' });
    }
  }

  private handleDrag(x: number, y: number, shiftKey: boolean): void {
    const bandId = this.selectedBandId();
    if (!bandId) return;

    const currentBands = this.bands();
    const bandIndex = currentBands.findIndex(b => b.id === bandId);
    if (bandIndex === -1) return;

    const band = currentBands[bandIndex];
    const freq = this.xToFrequency(x);
    const gain = this.yToGain(y);

    let updatedBand: EQBand;
    let property: 'frequency' | 'gain' | 'q';

    if (shiftKey || this.dragType() === 'q') {
      // Adjust Q based on vertical distance from center
      const centerY = this.height() / 2;
      const distance = Math.abs(y - centerY);
      const q = Math.max(0.1, Math.min(18, distance / 10));
      updatedBand = { ...band, q };
      property = 'q';
    } else {
      // Adjust frequency and gain
      updatedBand = {
        ...band,
        frequency: Math.max(this.minFreq(), Math.min(this.maxFreq(), freq)),
        gain: Math.max(this.minGain(), Math.min(this.maxGain(), gain)),
      };
      property = 'frequency';
    }

    const updatedBands = [...currentBands];
    updatedBands[bandIndex] = updatedBand;

    this.bandsChange.emit(updatedBands);
    this.bandChange.emit({ band: updatedBand, property });
  }

  private draw(): void {
    if (!this.ctx) return;

    const canvas = this.canvasRef.nativeElement;
    const width = this.width();
    const height = this.height();
    const colors = this.colors();

    // Size the backing store for the device pixel ratio; drawing and pointer
    // hit-testing both stay in CSS pixels
    prepareHiDpiCanvas(canvas, this.ctx, width, height);

    // Clear and fill background
    this.ctx.fillStyle = colors.background;
    this.ctx.fillRect(0, 0, width, height);

    // Draw spectrum analyzer if available
    const analyser = this.analyserNode();
    if (analyser) {
      if (this.frequencyData?.length !== analyser.frequencyBinCount) {
        this.frequencyData = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(this.frequencyData);
      this.drawSpectrum(colors.spectrum);
    }

    // Draw grid
    if (this.showGrid()) {
      this.drawGrid(colors.grid, colors.gridText);
    }

    // Draw EQ curve
    if (this.showCurve()) {
      this.drawEQCurve(colors.curve, colors.curveFill);
    }

    // Draw band nodes
    this.drawBandNodes();

    // Only keep animating while a live spectrum is displayed; static content
    // is redrawn on demand by the input-tracking effect
    this.animationFrameId = analyser
      ? requestAnimationFrame(() => {
          this.draw();
        })
      : null;
  }

  private drawGrid(gridColor: string, textColor: string): void {
    if (!this.ctx) return;

    const width = this.width();
    const height = this.height();

    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 0.5;

    // Frequency lines (logarithmic scale)
    const freqLines = [50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000];
    for (const freq of freqLines) {
      if (freq < this.minFreq() || freq > this.maxFreq()) continue;
      const x = this.frequencyToX(freq);
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();

      if (this.showLabels()) {
        this.ctx.fillStyle = textColor;
        this.ctx.font = '10px system-ui';
        this.ctx.textAlign = 'center';
        const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
        this.ctx.fillText(label, x, height - 4);
      }
    }

    // Gain lines
    const gainLines = [-18, -12, -6, 0, 6, 12, 18];
    for (const gain of gainLines) {
      const y = this.gainToY(gain);
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();

      if (this.showLabels()) {
        this.ctx.fillStyle = textColor;
        this.ctx.font = '10px system-ui';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${gain > 0 ? '+' : ''}${gain}`, 4, y - 2);
      }
    }

    // 0dB center line (thicker)
    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 1;
    const centerY = this.gainToY(0);
    this.ctx.beginPath();
    this.ctx.moveTo(0, centerY);
    this.ctx.lineTo(width, centerY);
    this.ctx.stroke();
  }

  private drawSpectrum(color: string): void {
    if (!this.ctx || !this.frequencyData) return;

    const width = this.width();
    const height = this.height();
    const bufferLength = this.frequencyData.length;
    // FFT bin i is centred at i * (nyquist / binCount) Hz
    const sampleRate = this.analyserNode()?.context?.sampleRate ?? 44_100;
    const binHz = sampleRate / 2 / bufferLength;
    const minFreq = this.minFreq();
    const maxFreq = this.maxFreq();

    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(0, height);

    for (let i = 0; i < bufferLength; i++) {
      const freq = i * binHz;
      if (freq < minFreq) continue;
      if (freq > maxFreq) break;
      const x = this.frequencyToX(freq);
      const value = this.frequencyData[i] / 255;
      const y = height - value * height;
      this.ctx.lineTo(x, y);
    }

    this.ctx.lineTo(width, height);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawEQCurve(strokeColor: string, fillColor: string): void {
    if (!this.ctx) return;

    const width = this.width();
    const height = this.height();
    const bands = this.bands();

    // Calculate combined frequency response
    const points: Array<{ x: number; y: number }> = [];
    const numPoints = 200;

    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * width;
      const freq = this.xToFrequency(x);
      let totalGain = 0;

      for (const band of bands) {
        if (!band.enabled) continue;
        totalGain += this.calculateBandResponse(freq, band);
      }

      const y = this.gainToY(totalGain);
      points.push({ x, y });
    }

    // Draw filled area
    this.ctx.fillStyle = fillColor;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.gainToY(0));
    for (const point of points) {
      this.ctx.lineTo(point.x, point.y);
    }
    this.ctx.lineTo(width, this.gainToY(0));
    this.ctx.closePath();
    this.ctx.fill();

    // Draw curve line
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.stroke();
  }

  private drawBandNodes(): void {
    if (!this.ctx) return;

    const bands = this.bands();
    const selectedId = this.selectedBandId();
    const hoverId = this.hoverBandId();

    for (const band of bands) {
      if (!band.enabled) continue;

      const x = this.frequencyToX(band.frequency);
      const y = this.gainToY(band.gain);
      const isSelected = band.id === selectedId;
      const isHovered = band.id === hoverId;
      const radius = isSelected || isHovered ? 10 : 8;

      // Draw Q indicator (vertical line)
      const qHeight = Math.min(80, band.q * 8);
      this.ctx.strokeStyle = band.color || '#fff';
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([2, 2]);
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - qHeight / 2);
      this.ctx.lineTo(x, y + qHeight / 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Draw node circle
      this.ctx.fillStyle = band.color || '#fff';
      this.ctx.strokeStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.5)';
      this.ctx.lineWidth = isSelected ? 3 : 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Draw frequency label if hovered or selected
      if (isHovered || isSelected) {
        this.ctx.fillStyle = this.colors().nodeText;
        this.ctx.font = '11px system-ui';
        this.ctx.textAlign = 'center';
        const freqLabel =
          band.frequency >= 1000
            ? `${(band.frequency / 1000).toFixed(1)}kHz`
            : `${Math.round(band.frequency)}Hz`;
        const gainLabel = `${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)}dB`;
        this.ctx.fillText(freqLabel, x, y - radius - 14);
        this.ctx.fillText(gainLabel, x, y - radius - 2);
      }
    }
  }

  private calculateBandResponse(freq: number, band: EQBand): number {
    // Simplified bell curve approximation
    const logFreq = Math.log10(freq);
    const logBandFreq = Math.log10(band.frequency);
    const bandwidth = 1 / band.q;

    switch (band.type) {
      case 'peaking':
      case 'bandpass': {
        const distance = Math.abs(logFreq - logBandFreq);
        const response = Math.exp((-distance * distance) / (bandwidth * bandwidth));
        return band.gain * response;
      }
      case 'lowshelf': {
        const transition = (logFreq - logBandFreq) / bandwidth;
        const response = 1 / (1 + Math.exp(transition * 4));
        return band.gain * response;
      }
      case 'highshelf': {
        const transition = (logFreq - logBandFreq) / bandwidth;
        const response = 1 / (1 + Math.exp(-transition * 4));
        return band.gain * response;
      }
      case 'lowpass': {
        if (freq > band.frequency) {
          const rolloff = (band.frequency / freq) ** (band.q * 2);
          return -24 * (1 - rolloff);
        }
        return 0;
      }
      case 'highpass': {
        if (freq < band.frequency) {
          const rolloff = (freq / band.frequency) ** (band.q * 2);
          return -24 * (1 - rolloff);
        }
        return 0;
      }
      case 'notch': {
        const distance = Math.abs(logFreq - logBandFreq);
        const response = 1 - Math.exp((-distance * distance) / (bandwidth * bandwidth * 0.1));
        return band.gain * (1 - response);
      }
      default: {
        return 0;
      }
    }
  }

  private frequencyToX(freq: number): number {
    const minLog = Math.log10(this.minFreq());
    const maxLog = Math.log10(this.maxFreq());
    const freqLog = Math.log10(freq);
    return ((freqLog - minLog) / (maxLog - minLog)) * this.width();
  }

  private xToFrequency(x: number): number {
    const minLog = Math.log10(this.minFreq());
    const maxLog = Math.log10(this.maxFreq());
    const ratio = x / this.width();
    return 10 ** (minLog + ratio * (maxLog - minLog));
  }

  // Linear gain axis: maxGain at the top, minGain at the bottom (works for
  // asymmetric ranges, where 0 dB is not the vertical centre)
  private gainToY(gain: number): number {
    const height = this.height();
    const range = this.maxGain() - this.minGain();
    return ((this.maxGain() - gain) / range) * height;
  }

  private yToGain(y: number): number {
    const height = this.height();
    const range = this.maxGain() - this.minGain();
    return this.maxGain() - (y / height) * range;
  }

  private getCanvasPosition(event: MouseEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private findBandAtPosition(x: number, y: number): EQBand | null {
    const bands = this.bands();
    const hitRadius = 15;

    for (const band of bands) {
      if (!band.enabled) continue;

      const bandX = this.frequencyToX(band.frequency);
      const bandY = this.gainToY(band.gain);
      const distance = Math.hypot(x - bandX, y - bandY);

      if (distance <= hitRadius) {
        return band;
      }
    }

    return null;
  }

  protected toggleBand(band: EQBand): void {
    if (!this.interactive()) return;
    const updatedBands = this.bands().map(b =>
      b.id === band.id ? { ...b, enabled: !b.enabled } : b
    );
    this.bandsChange.emit(updatedBands);
    this.bandChange.emit({ band: { ...band, enabled: !band.enabled }, property: 'enabled' });
  }

  protected selectBand(band: EQBand): void {
    this.selectedBandId.set(band.id);
  }

  // Keyboard control for the focused band: arrows adjust gain (up/down) and
  // frequency (left/right); Home/End jump gain to 0/max. Enter/Space keep the
  // native button behaviour (select, same as a click); enabling/disabling has
  // its own switch so keyboard, mouse and screen readers all agree.
  protected onBandKeydown(event: KeyboardEvent, band: EQBand): void {
    if (!this.interactive()) return;

    const freqFactor = event.shiftKey ? 2 ** (1 / 3) : 2 ** (1 / 12); // major third / semitone
    let updatedBand: EQBand | null = null;
    let property: 'frequency' | 'gain' = 'gain';

    switch (event.key) {
      case 'ArrowUp': {
        updatedBand = { ...band, gain: Math.min(this.maxGain(), band.gain + 0.5) };
        break;
      }
      case 'ArrowDown': {
        updatedBand = { ...band, gain: Math.max(this.minGain(), band.gain - 0.5) };
        break;
      }
      case 'ArrowRight': {
        updatedBand = {
          ...band,
          frequency: Math.min(this.maxFreq(), Math.round(band.frequency * freqFactor)),
        };
        property = 'frequency';
        break;
      }
      case 'ArrowLeft': {
        updatedBand = {
          ...band,
          frequency: Math.max(this.minFreq(), Math.round(band.frequency / freqFactor)),
        };
        property = 'frequency';
        break;
      }
      case 'Home': {
        updatedBand = { ...band, gain: 0 };
        break;
      }
      case 'End': {
        updatedBand = { ...band, gain: this.maxGain() };
        break;
      }
      default: {
        return;
      }
    }

    event.preventDefault();
    this.selectedBandId.set(band.id);

    const updatedBands = this.bands().map(b => (b.id === band.id ? updatedBand : b));
    this.bandsChange.emit(updatedBands);
    this.bandChange.emit({ band: updatedBand, property });
  }

  private bandFrequencyLabel(band: EQBand): string {
    return band.frequency >= 1000
      ? `${(band.frequency / 1000).toFixed(1)} kilohertz`
      : `${Math.round(band.frequency)} hertz`;
  }

  /**
   * Visible label of a band's select button. Dragging a node produces
   * fractional frequencies, so sub-kHz values are rounded like everywhere else.
   */
  protected bandButtonLabel(band: EQBand): string {
    return band.frequency >= 1000
      ? `${(band.frequency / 1000).toFixed(1)}kHz`
      : `${Math.round(band.frequency)}Hz`;
  }

  /** Accessible name of a band's enable switch (its state is exposed via aria-checked) */
  protected bandToggleLabel(band: EQBand): string {
    return `Enable EQ band at ${this.bandFrequencyLabel(band)}`;
  }

  protected bandAriaLabel(band: EQBand): string {
    const freqLabel = this.bandFrequencyLabel(band);
    const gainLabel = `${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)} dB`;
    return `EQ band at ${freqLabel}, ${gainLabel}${band.enabled ? '' : ', disabled'}`;
  }
}
