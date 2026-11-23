import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  NgZone,
  numberAttribute,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, interval, switchMap } from 'rxjs';
import { prepareHiDpiCanvas, watchDevicePixelRatio } from './canvas-hidpi';

export type LooperVariant = 'default' | 'minimal' | 'compact' | 'studio';
export type LooperSize = 'sm' | 'md' | 'lg';
export type LooperState = 'idle' | 'recording' | 'playing' | 'overdubbing' | 'stopped';

export interface LoopLayer {
  id: number;
  audioBuffer: AudioBuffer | null;
  volume: number; // 0-1
  muted: boolean;
  name: string;
}

export interface LooperEvent {
  type:
    | 'record-start'
    | 'record-stop'
    | 'play'
    | 'stop'
    | 'overdub-start'
    | 'overdub-stop'
    | 'clear'
    | 'undo'
    | 'redo';
  timestamp: number;
  layerId?: number;
}

/**
 * Loop Pedal / Looper component for recording and playing audio loops
 *
 * @example
 * ```html
 * <tw-looper></tw-looper>
 * <tw-looper [maxLayers]="4" [showWaveform]="true"></tw-looper>
 * ```
 */
@Component({
  selector: 'tw-looper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './looper.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block',
  },
})
export class TwLooperComponent implements OnDestroy {
  private readonly zone = inject(NgZone);

  // Canvas reference
  readonly waveformCanvas = viewChild<ElementRef<HTMLCanvasElement>>('waveformCanvas');

  // Configuration
  readonly variant = input<LooperVariant>('default');
  readonly size = input<LooperSize>('md');
  readonly maxLayers = input(4, { transform: numberAttribute });
  readonly maxDuration = input(60, { transform: numberAttribute }); // Max loop duration in seconds
  readonly showWaveform = input(true);
  readonly showLayers = input(true);
  readonly showTimer = input(true);
  readonly showControls = input(true);
  readonly showUndoRedo = input(true);
  readonly showSpeedControl = input(false);
  readonly showVolumeControl = input(true);
  readonly autoPlay = input(true); // Auto-play after first recording
  readonly countIn = input(false); // Count-in before recording
  readonly countInBeats = input(4, { transform: numberAttribute });
  readonly clickTrack = input(false); // Metronome during recording
  readonly clickBpm = input(120, { transform: numberAttribute });
  readonly disabled = input(false);
  readonly classOverride = input('');

  // Audio input (optional external source)
  readonly audioSource = input<MediaStreamAudioSourceNode | null>(null);

  // Outputs
  readonly stateChange = output<LooperState>();
  readonly loopEvent = output<LooperEvent>();
  readonly layerChange = output<LoopLayer[]>();
  readonly durationChange = output<number>();
  /** Emits when microphone access or audio setup fails */
  readonly error = output<string>();

  // Internal state
  protected readonly state = signal<LooperState>('idle');
  protected readonly layers = signal<LoopLayer[]>([]);
  protected readonly currentLayerIndex = signal(0);
  protected readonly loopDuration = signal(0); // Duration in seconds
  protected readonly currentPosition = signal(0); // Current playback position
  protected readonly masterVolume = signal(1);
  protected readonly playbackSpeed = signal(1);
  protected readonly isCountingIn = signal(false);
  protected readonly countInBeat = signal(0);

  // Undo/redo history
  private undoStack: AudioBuffer[] = [];
  private redoStack: AudioBuffer[] = [];
  // Signal mirror of redoStack.length so canRedo() is reactive
  private readonly redoCount = signal(0);

  // Audio context and nodes
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private sourceNodes: AudioBufferSourceNode[] = [];
  private gainNodes: GainNode[] = [];
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private recordingStartTime = 0;
  private animationFrame: number | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private layerIdCounter = 0;
  private micErrorMessage: string | null = null;
  private clickTrackTimer: ReturnType<typeof setInterval> | null = null;
  // Whether this component acquired mediaStream itself (and must stop its tracks)
  private ownsMediaStream = false;
  private destroyed = false;
  // Start playback automatically once the first recording has been decoded
  private pendingAutoPlay = false;
  // A take is being set up (awaiting mic access / count-in); blocks re-entry
  private takeStarting = false;
  // Bumped by clear(): a take still being set up must not start afterwards
  private takeGeneration = 0;
  // Playhead anchor: loop position (s) at playbackAnchorTime (AudioContext time)
  private playbackAnchorTime = 0;
  private playbackAnchorPosition = 0;
  // Redraws the (otherwise static) waveform after a device pixel ratio change
  private readonly stopDprWatch = watchDevicePixelRatio(() => {
    if (this.layers().length > 0) {
      this.drawWaveform();
    }
  });

  constructor() {
    // Position ticker only runs while playing/overdubbing (idle otherwise)
    toObservable(this.state)
      .pipe(
        switchMap(s => (s === 'playing' || s === 'overdubbing' ? interval(50) : EMPTY)),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.updatePosition();
      });
  }

  ngOnDestroy(): void {
    this.stopDprWatch();
    this.destroyed = true;
    this.cleanup();
  }

  private async initAudio(): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.connect(this.audioContext.destination);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;

    // Record from the external source's stream when one is provided
    const externalSource = this.audioSource();
    if (externalSource) {
      this.mediaStream = externalSource.mediaStream;
      this.ownsMediaStream = false;
      this.micErrorMessage = null;
      return;
    }

    // Otherwise get microphone access
    if (!this.mediaStream) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Destroyed while the permission prompt was pending: release the mic
        if (this.destroyed) {
          stream.getTracks().forEach(track => {
            track.stop();
          });
          return;
        }
        this.mediaStream = stream;
        this.ownsMediaStream = true;
        this.micErrorMessage = null;
      } catch (error) {
        this.micErrorMessage =
          error instanceof Error && error.message
            ? error.message
            : 'Failed to get microphone access';
      }
    }
  }

  private cleanup(): void {
    this.stopAllPlayback();
    this.stopClickTrack();

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;

    // Only stop tracks we acquired; an external audioSource stream belongs to the caller
    if (this.mediaStream && this.ownsMediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
      });
    }
    this.mediaStream = null;

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }

  // Main control methods
  async record(): Promise<void> {
    // Starting a second take (including while one is still being set up, e.g.
    // during the count-in) would orphan the running MediaRecorder and the mic
    if (this.disabled() || this.takeStarting || this.isTakeActive()) return;

    this.takeStarting = true;
    const generation = this.takeGeneration;
    try {
      await this.initAudio();
      if (this.destroyed || !this.audioContext || generation !== this.takeGeneration) return;

      // Microphone unavailable: surface the error and do NOT enter recording state
      if (!this.mediaStream) {
        this.error.emit(this.micErrorMessage ?? 'No microphone available for recording');
        return;
      }

      // Count-in if enabled
      if (this.countIn() && this.state() === 'idle') {
        await this.performCountIn();
        // Destroyed or cleared during the count-in
        if (
          this.destroyed ||
          !this.audioContext ||
          !this.mediaStream ||
          generation !== this.takeGeneration
        ) {
          return;
        }
      }
    } finally {
      this.takeStarting = false;
    }

    this.setState('recording');
    this.recordedChunks = [];
    this.recordingStartTime = this.audioContext.currentTime;

    // Start recording
    this.mediaRecorder = new MediaRecorder(this.mediaStream);
    this.mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };
    this.mediaRecorder.onstop = () => this.processRecording();
    this.mediaRecorder.start(100); // Collect data every 100ms

    this.startClickTrack();
    this.emitEvent('record-start');
    this.startWaveformAnimation();
  }

  stopRecording(): Promise<void> {
    if (this.state() !== 'recording' && this.state() !== 'overdubbing') return Promise.resolve();

    const wasOverdubbing = this.state() === 'overdubbing';

    this.stopClickTrack();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // A take recorded over a playing loop leaves its layers running: the
    // 'stopped' state must not keep playing audio behind a Play button
    if (!wasOverdubbing) {
      this.stopAllPlayback();
    }
    this.setState(wasOverdubbing ? 'playing' : 'stopped');
    this.emitEvent(wasOverdubbing ? 'overdub-stop' : 'record-stop');

    // The new layer only exists once MediaRecorder's onstop has decoded it,
    // so defer auto-play until processRecording() adds the layer.
    if (this.autoPlay() && !wasOverdubbing) {
      this.pendingAutoPlay = true;
    }

    return Promise.resolve();
  }

  play(): void {
    if (this.disabled()) return;
    // Finish an in-progress take first; otherwise its recorder and click track
    // keep running with no way to stop them once the state is 'playing'
    if (this.isTakeActive()) {
      void this.stopRecording();
    }
    if (this.layers().length === 0) return;

    this.setState('playing');
    this.currentPosition.set(0);
    this.playAllLayers();
    this.emitEvent('play');
    this.startWaveformAnimation();
  }

  stop(): void {
    // Finish an in-progress take (its layer is still added), but an explicit
    // stop must not be followed by auto-play
    if (this.isTakeActive()) {
      void this.stopRecording();
    }
    this.pendingAutoPlay = false;
    this.stopAllPlayback();
    this.setState('stopped');
    this.currentPosition.set(0);
    this.emitEvent('stop');
  }

  async overdub(): Promise<void> {
    // Same re-entry guard as record(): never orphan a running MediaRecorder
    if (this.disabled() || this.loopDuration() === 0 || this.takeStarting || this.isTakeActive()) {
      return;
    }

    this.takeStarting = true;
    const generation = this.takeGeneration;
    try {
      await this.initAudio();
    } finally {
      this.takeStarting = false;
    }
    if (this.destroyed || !this.audioContext || generation !== this.takeGeneration) return;

    // Microphone unavailable: surface the error and do NOT enter overdub state
    if (!this.mediaStream) {
      this.error.emit(this.micErrorMessage ?? 'No microphone available for recording');
      return;
    }

    // Start playing existing layers
    this.playAllLayers();

    // Start recording new layer
    this.setState('overdubbing');
    this.recordedChunks = [];
    this.recordingStartTime = this.audioContext.currentTime;

    this.mediaRecorder = new MediaRecorder(this.mediaStream);
    this.mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };
    this.mediaRecorder.onstop = () => this.processRecording();
    this.mediaRecorder.start(100);

    this.startClickTrack();
    this.emitEvent('overdub-start');
  }

  clear(): void {
    // Cancel a take that is still being set up (mic prompt / count-in)
    this.takeGeneration++;
    // Abandon any in-progress take: otherwise the recorder (and click track)
    // keeps running with no way to stop it once the state is 'idle'
    this.stopClickTrack();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];

    this.stopAllPlayback();
    this.layers.set([]);
    this.loopDuration.set(0);
    this.currentPosition.set(0);
    this.undoStack = [];
    this.redoStack = [];
    this.redoCount.set(0);
    this.pendingAutoPlay = false;
    this.setState('idle');
    this.emitEvent('clear');
    this.layerChange.emit([]);
    this.durationChange.emit(0);
    this.clearWaveform();
  }

  undo(): void {
    const currentLayers = this.layers();
    if (currentLayers.length === 0) return;

    const lastLayer = currentLayers.at(-1)!;
    if (lastLayer.audioBuffer) {
      this.redoStack.push(lastLayer.audioBuffer);
      this.redoCount.set(this.redoStack.length);
    }

    this.stopLayerPlayback(currentLayers.length - 1);
    this.layers.set(currentLayers.slice(0, -1));
    this.emitEvent('undo');
    this.layerChange.emit(this.layers());
    this.drawWaveform();
  }

  redo(): void {
    if (this.redoStack.length === 0 || this.layers().length >= this.maxLayers()) return;

    const buffer = this.redoStack.pop()!;
    this.redoCount.set(this.redoStack.length);
    const newLayer: LoopLayer = {
      id: this.layerIdCounter++,
      audioBuffer: buffer,
      volume: 1,
      muted: false,
      name: `Layer ${this.layers().length + 1}`,
    };

    this.layers.update(layers => [...layers, newLayer]);
    this.startLayerPlayback(this.layers().length - 1);
    this.emitEvent('redo');
    this.layerChange.emit(this.layers());
    this.drawWaveform();
  }

  // Layer controls
  setLayerVolume(layerId: number, volume: number): void {
    this.layers.update(layers =>
      layers.map(l => (l.id === layerId ? { ...l, volume: Math.max(0, Math.min(1, volume)) } : l))
    );

    // Update gain node if playing (a muted layer stays silent)
    const layerIndex = this.layers().findIndex(l => l.id === layerId);
    const layer = this.layers()[layerIndex];
    if (layer && this.gainNodes[layerIndex]) {
      this.gainNodes[layerIndex].gain.value = layer.muted ? 0 : layer.volume;
    }

    this.layerChange.emit(this.layers());
  }

  toggleLayerMute(layerId: number): void {
    this.layers.update(layers =>
      layers.map(l => (l.id === layerId ? { ...l, muted: !l.muted } : l))
    );

    // Update gain node if playing
    const layer = this.layers().find(l => l.id === layerId);
    const layerIndex = this.layers().findIndex(l => l.id === layerId);
    if (layer && layerIndex >= 0 && this.gainNodes[layerIndex]) {
      this.gainNodes[layerIndex].gain.value = layer.muted ? 0 : layer.volume;
    }

    this.layerChange.emit(this.layers());
  }

  deleteLayer(layerId: number): void {
    const layerIndex = this.layers().findIndex(l => l.id === layerId);
    const layer = this.layers()[layerIndex];
    if (layer?.audioBuffer) {
      this.undoStack.push(layer.audioBuffer);
    }

    // Silence the deleted layer and keep node arrays aligned with layers()
    if (layerIndex >= 0) {
      this.stopLayerPlayback(layerIndex);
    }

    this.layers.update(layers => layers.filter(l => l.id !== layerId));
    this.layerChange.emit(this.layers());
    this.drawWaveform();

    if (this.layers().length === 0) {
      this.clear();
    }
  }

  // Volume and speed controls
  setMasterVolume(volume: number): void {
    this.masterVolume.set(Math.max(0, Math.min(1, volume)));
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = this.masterVolume();
    }
  }

  setPlaybackSpeed(speed: number): void {
    // Re-anchor the playhead so the position stays continuous across the change
    if (this.audioContext && this.sourceNodes.length > 0) {
      this.playbackAnchorPosition = this.computePosition();
      this.playbackAnchorTime = this.audioContext.currentTime;
    }
    this.playbackSpeed.set(Math.max(0.5, Math.min(2, speed)));
    // Apply to live sources so the change is audible immediately
    for (const source of this.sourceNodes) {
      if (source) {
        source.playbackRate.value = this.playbackSpeed();
      }
    }
  }

  // Helper methods
  private isTakeActive(): boolean {
    return this.state() === 'recording' || this.state() === 'overdubbing';
  }

  private setState(newState: LooperState): void {
    this.state.set(newState);
    this.stateChange.emit(newState);
  }

  private emitEvent(type: LooperEvent['type'], layerId?: number): void {
    this.loopEvent.emit({
      type,
      timestamp: Date.now(),
      layerId,
    });
  }

  private async performCountIn(): Promise<void> {
    if (!this.audioContext) return;

    this.isCountingIn.set(true);
    const beatDuration = 60 / this.clickBpm();

    for (let i = 0; i < this.countInBeats(); i++) {
      this.countInBeat.set(i + 1);
      this.playClickSound(i === 0);
      await this.sleep(beatDuration * 1000);
    }

    this.isCountingIn.set(false);
    this.countInBeat.set(0);
  }

  private playClickSound(accent: boolean): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.value = accent ? 1200 : 800;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);

    osc.start();
    osc.stop(this.audioContext.currentTime + 0.05);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  // Click track (metronome) heard while recording/overdubbing
  private startClickTrack(): void {
    if (!this.clickTrack() || !this.audioContext) return;

    this.stopClickTrack();
    const beatMs = (60 / this.clickBpm()) * 1000;
    let beat = 0;

    // No template state is touched here, so keep the timer out of the zone
    this.zone.runOutsideAngular(() => {
      this.playClickSound(true);
      this.clickTrackTimer = setInterval(() => {
        beat = (beat + 1) % 4;
        this.playClickSound(beat === 0);
      }, beatMs);
    });
  }

  private stopClickTrack(): void {
    if (this.clickTrackTimer) {
      clearInterval(this.clickTrackTimer);
      this.clickTrackTimer = null;
    }
  }

  private async processRecording(): Promise<void> {
    if (!this.audioContext || this.recordedChunks.length === 0) return;

    const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
    const arrayBuffer = await blob.arrayBuffer();

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Set loop duration from first recording
      if (this.loopDuration() === 0) {
        const duration = Math.min(audioBuffer.duration, this.maxDuration());
        this.loopDuration.set(duration);
        this.durationChange.emit(duration);
      }

      // Create new layer
      if (this.layers().length < this.maxLayers()) {
        const newLayer: LoopLayer = {
          id: this.layerIdCounter++,
          audioBuffer,
          volume: 1,
          muted: false,
          name: `Layer ${this.layers().length + 1}`,
        };

        this.layers.update(layers => [...layers, newLayer]);
        this.layerChange.emit(this.layers());
        this.redoStack = []; // Clear redo stack on new recording
        this.redoCount.set(0);
        // An overdub layer joins the already-running loop immediately
        this.startLayerPlayback(this.layers().length - 1);
        this.drawWaveform();
      }

      if (this.pendingAutoPlay) {
        this.pendingAutoPlay = false;
        if (this.state() === 'stopped') {
          this.play();
        }
      }
    } catch (error) {
      this.pendingAutoPlay = false;
      console.error('Error decoding audio:', error);
    }
  }

  private playAllLayers(): void {
    if (!this.audioContext || !this.masterGainNode) return;

    this.stopAllPlayback();

    // Playhead is measured from when playback actually starts
    this.playbackAnchorTime = this.audioContext.currentTime;
    this.playbackAnchorPosition = 0;

    this.layers().forEach((_layer, index) => {
      this.startLayerPlayback(index, true);
    });
  }

  /** Start one layer in sync with the loop. */
  private startLayerPlayback(index: number, force = false): void {
    if (!this.audioContext || !this.masterGainNode) return;
    // Outside of playAllLayers, only join a loop that is already running
    if (!force && this.state() !== 'playing' && this.state() !== 'overdubbing') return;

    const layer = this.layers()[index];
    if (!layer?.audioBuffer) return;

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();

    source.buffer = layer.audioBuffer;
    source.loop = true;
    // Every layer loops on the master loop length so overdubs stay in sync
    const loopDuration = Math.min(this.loopDuration(), layer.audioBuffer.duration);
    if (loopDuration > 0) {
      source.loopStart = 0;
      source.loopEnd = loopDuration;
    }
    source.playbackRate.value = this.playbackSpeed();

    // Muted layers still run (silently) so unmuting takes effect immediately
    gain.gain.value = layer.muted ? 0 : layer.volume;

    source.connect(gain);
    gain.connect(this.masterGainNode);

    const offset = loopDuration > 0 ? this.computePosition() % loopDuration : 0;
    source.start(0, offset);

    this.sourceNodes[index] = source;
    this.gainNodes[index] = gain;
  }

  /** Stop one layer's source and drop it from the index-aligned node arrays. */
  private stopLayerPlayback(index: number): void {
    const source = this.sourceNodes[index];
    if (source) {
      try {
        source.stop();
      } catch {
        // Source might not be started
      }
    }
    if (index < this.sourceNodes.length) this.sourceNodes.splice(index, 1);
    if (index < this.gainNodes.length) this.gainNodes.splice(index, 1);
  }

  private stopAllPlayback(): void {
    this.sourceNodes.forEach(source => {
      try {
        source.stop();
      } catch {
        // Source might not be started
      }
    });
    this.sourceNodes = [];
    this.gainNodes = [];
  }

  /** Current loop position (s), measured from when playback actually started. */
  private computePosition(): number {
    const loopDuration = this.loopDuration();
    if (!this.audioContext || loopDuration === 0) return 0;

    const elapsed =
      (this.audioContext.currentTime - this.playbackAnchorTime) * this.playbackSpeed();
    return (this.playbackAnchorPosition + elapsed) % loopDuration;
  }

  private updatePosition(): void {
    if (!this.audioContext || this.loopDuration() === 0) return;
    this.currentPosition.set(this.computePosition());
  }

  // Waveform visualization
  private startWaveformAnimation(): void {
    if (!this.showWaveform()) return;

    const canvas = this.waveformCanvas()?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    // Never run two frame loops at once (e.g. play() while a loop is pending)
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Draw loop never writes template state, so keep it out of the zone
    this.zone.runOutsideAngular(() => {
      this.drawWaveformFrame();
    });
  }

  private drawWaveformFrame(): void {
    if (
      !this.ctx ||
      (this.state() !== 'playing' && this.state() !== 'recording' && this.state() !== 'overdubbing')
    ) {
      return;
    }

    this.drawWaveform();
    this.animationFrame = requestAnimationFrame(() => {
      this.drawWaveformFrame();
    });
  }

  private drawWaveform(): void {
    const canvas = this.waveformCanvas()?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size the backing store for the device pixel ratio; drawing uses the
    // nominal (CSS) canvas size
    const { width, height } = this.canvasSize();
    prepareHiDpiCanvas(canvas, ctx, width, height);

    // Clear canvas
    ctx.fillStyle = 'rgb(30, 41, 59)'; // slate-800
    ctx.fillRect(0, 0, width, height);

    // Draw combined waveform from all layers
    const layers = this.layers();
    if (layers.length === 0) return;

    ctx.strokeStyle = 'rgb(59, 130, 246)'; // blue-500
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Sample the first layer's audio data for visualization
    const firstLayerWithBuffer = layers.find(l => l.audioBuffer && !l.muted);
    if (firstLayerWithBuffer?.audioBuffer) {
      const data = firstLayerWithBuffer.audioBuffer.getChannelData(0);
      for (let i = 0; i < width; i++) {
        // Spread the samples evenly over the columns: a fixed ceil()'d step runs
        // past the end of the buffer, leaving trailing columns with no samples
        // (min 1 / max -1), which drew full-height spikes at the right edge
        const start = Math.floor((i * data.length) / width);
        const end = Math.max(start + 1, Math.floor(((i + 1) * data.length) / width));
        if (start >= data.length) break;

        let min = 1;
        let max = -1;

        for (let j = start; j < end && j < data.length; j++) {
          const datum = data[j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }

        // Canvas y grows downward: positive samples plot above the centre
        const yMin = ((1 - min) / 2) * height;
        const yMax = ((1 - max) / 2) * height;

        if (i === 0) {
          ctx.moveTo(i, yMin);
        } else {
          ctx.lineTo(i, yMin);
          ctx.lineTo(i, yMax);
        }
      }
    }

    ctx.stroke();

    // Draw playhead
    if (this.loopDuration() > 0 && (this.state() === 'playing' || this.state() === 'overdubbing')) {
      const playheadX = (this.currentPosition() / this.loopDuration()) * width;
      ctx.strokeStyle = 'rgb(234, 179, 8)'; // amber-500
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }

  private clearWaveform(): void {
    const canvas = this.waveformCanvas()?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = this.canvasSize();
    prepareHiDpiCanvas(canvas, ctx, width, height);
    ctx.fillStyle = 'rgb(30, 41, 59)';
    ctx.fillRect(0, 0, width, height);
  }

  // Computed classes
  protected readonly containerClasses = computed(() => {
    const variant = this.variant();
    const size = this.size();

    // relative: positioning context for the absolute count-in overlay, which
    // otherwise escapes the looper and covers the page
    const base = 'relative flex flex-col rounded-xl overflow-hidden';

    const variantClasses: Record<LooperVariant, string> = {
      default: 'bg-slate-900 border border-slate-700 p-4',
      minimal: 'bg-transparent p-2',
      compact: 'bg-slate-800 border border-slate-700 p-2',
      studio: 'bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-600 p-4 shadow-xl',
    };

    const sizeClasses: Record<LooperSize, string> = {
      sm: 'gap-2 min-w-[240px]',
      md: 'gap-3 min-w-[320px]',
      lg: 'gap-4 min-w-[400px]',
    };

    return [base, variantClasses[variant], sizeClasses[size], this.classOverride()]
      .filter(Boolean)
      .join(' ');
  });

  // The minimal variant is transparent and sits on the (typically light) page
  // background, where the slate-300/400 text used on the dark panels is
  // ~1.5-2.6:1; it uses darker shades there, restoring them in dark mode.
  protected readonly labelClass = computed(() =>
    this.variant() === 'minimal' ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400'
  );

  protected readonly valueClass = computed(() =>
    this.variant() === 'minimal' ? 'text-slate-800 dark:text-slate-300' : 'text-slate-300'
  );

  // Layer rows: the dark half-transparent row turns mid-grey on a light page,
  // where neither light nor dark text reaches 4.5:1
  protected readonly layerRowClass = computed(() =>
    this.variant() === 'minimal' ? 'bg-slate-500/10' : 'bg-slate-800/50'
  );

  // Layer delete icon on hover: red-500 on its red-500/20 hover fill is ~2.6:1 on a light page
  protected readonly deleteButtonClass = computed(() =>
    this.variant() === 'minimal'
      ? 'text-slate-600 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-500'
      : 'text-slate-400 hover:text-red-500'
  );

  // Idle overdub icon: amber-500 on its amber-500/20 button is ~1.8:1 on a light page
  protected readonly overdubIconClass = computed(() =>
    this.variant() === 'minimal' ? 'text-amber-700 dark:text-amber-500' : 'text-amber-500'
  );

  protected readonly buttonSizeClasses = computed(() => {
    const size = this.size();
    return {
      sm: 'w-10 h-10 text-sm',
      md: 'w-12 h-12 text-base',
      lg: 'w-14 h-14 text-lg',
    }[size];
  });

  protected readonly canvasSize = computed(() => {
    const size = this.size();
    return {
      sm: { width: 220, height: 60 },
      md: { width: 300, height: 80 },
      lg: { width: 380, height: 100 },
    }[size];
  });

  // Display values
  protected readonly formattedDuration = computed(() => {
    const duration = this.loopDuration();
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    const ms = Math.floor((duration % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  });

  protected readonly formattedPosition = computed(() => {
    const pos = this.currentPosition();
    const mins = Math.floor(pos / 60);
    const secs = Math.floor(pos % 60);
    const ms = Math.floor((pos % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  });

  protected readonly progressPercent = computed(() => {
    const duration = this.loopDuration();
    if (duration === 0) return 0;
    return (this.currentPosition() / duration) * 100;
  });

  protected readonly canUndo = computed(() => this.layers().length > 0);
  protected readonly canRedo = computed(() => this.redoCount() > 0);
  protected readonly canOverdub = computed(
    () => this.loopDuration() > 0 && this.layers().length < this.maxLayers()
  );
  protected readonly isActive = computed(
    () => this.state() !== 'idle' && this.state() !== 'stopped'
  );
}
