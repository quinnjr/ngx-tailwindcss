import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  linkedSignal,
  numberAttribute,
  OnDestroy,
  output,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwTransportComponent } from './transport.component';
import { TwScrubberComponent } from './scrubber.component';
import { TwTimeDisplayComponent } from './time-display.component';
import { TwWaveformComponent } from './waveform.component';

export type AudioPlayerVariant = 'default' | 'minimal' | 'compact' | 'full';
export type AudioPlayerTheme = 'dark' | 'light' | 'transparent';

export interface AudioTrack {
  src: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
}

@Component({
  selector: 'tw-audio-player',
  standalone: true,
  imports: [
    CommonModule,
    TwTransportComponent,
    TwScrubberComponent,
    TwTimeDisplayComponent,
    TwWaveformComponent,
  ],
  templateUrl: './audio-player.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
})
export class TwAudioPlayerComponent implements OnDestroy {
  @ViewChild('audioElement') private readonly audioRef!: ElementRef<HTMLAudioElement>;

  readonly track = input<AudioTrack | null>(null);
  readonly src = input<string>(''); // Alternative to track
  readonly autoplay = input(false);
  readonly loop = input(false);
  readonly muted = input(false);
  readonly volume = input(0.8, { transform: numberAttribute });
  readonly variant = input<AudioPlayerVariant>('default');
  readonly theme = input<AudioPlayerTheme>('dark');
  readonly showWaveform = input(false);
  readonly showArtwork = input(true);
  readonly showVolume = input(true);
  readonly showTime = input(true);
  readonly classOverride = input('');

  readonly play = output();
  readonly pause = output();
  readonly ended = output();
  readonly timeUpdate = output<number>();
  readonly volumeChange = output<number>();
  readonly error = output<string>();

  protected readonly isPlaying = signal(false);
  protected readonly currentTime = signal(0);
  protected readonly duration = signal(0);
  protected readonly buffered = signal(0);
  // Track the inputs, but can be changed locally (volume slider, mute/loop buttons)
  // (clamped: HTMLMediaElement.volume throws outside 0..1)
  protected readonly internalVolume = linkedSignal(() => {
    const v = this.volume();
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  });
  protected readonly isMuted = linkedSignal(() => this.muted());
  protected readonly isLooping = linkedSignal(() => this.loop());
  protected readonly isExpanded = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly audioBuffer = signal<AudioBuffer | null>(null);

  private audioContext: AudioContext | null = null;
  private destroyed = false;

  constructor() {
    // (Re)load the waveform whenever the source changes or the waveform is enabled
    effect(() => {
      const src = this.audioSrc();
      const show = this.showWaveform();
      untracked(() => {
        this.audioBuffer.set(null);
        if (show && src) {
          void this.loadAudioBuffer(src);
        }
      });
    });
  }

  protected readonly progress = computed(() => {
    const dur = this.duration();
    if (dur === 0) return 0;
    return this.currentTime() / dur;
  });

  protected readonly bufferedProgress = computed(() => {
    const dur = this.duration();
    if (dur === 0) return 0;
    return this.buffered() / dur;
  });

  protected readonly audioSrc = computed(() => {
    return this.track()?.src || this.src();
  });

  protected readonly trackInfo = computed(() => {
    const track = this.track();
    return {
      title: track?.title || 'Unknown Track',
      artist: track?.artist || 'Unknown Artist',
      album: track?.album,
      artwork: track?.artwork,
    };
  });

  protected readonly containerClasses = computed(() => {
    const variant = this.variant();
    const theme = this.theme();
    // relative: contains the absolutely positioned loading overlay
    const base = 'relative rounded-xl overflow-hidden';

    const themeClasses: Record<AudioPlayerTheme, string> = {
      dark: 'bg-slate-900 text-white',
      light: 'bg-white text-slate-900 border border-slate-200',
      transparent: 'bg-transparent',
    };

    const variantClasses: Record<AudioPlayerVariant, string> = {
      default: 'p-4',
      minimal: 'p-2',
      compact: 'p-3',
      full: 'p-6',
    };

    return [base, themeClasses[theme], variantClasses[variant], this.classOverride()]
      .filter(Boolean)
      .join(' ');
  });

  protected readonly textClasses = computed(() => {
    const theme = this.theme();
    return {
      title: theme === 'light' ? 'text-slate-900' : 'text-white',
      artist: theme === 'light' ? 'text-slate-600' : 'text-slate-400',
      time: theme === 'light' ? 'text-slate-500' : 'text-slate-400',
    };
  });

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.audioContext) {
      void this.audioContext.close();
    }
  }

  private async loadAudioBuffer(src: string): Promise<void> {
    // No Web Audio during SSR / in unsupported environments
    if (!src || this.destroyed || typeof AudioContext === 'undefined') return;

    try {
      this.isLoading.set(true);
      // Reuse one context across source changes
      this.audioContext ??= new AudioContext();
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      // Ignore a stale load superseded by a newer source (or by destroy)
      if (!this.destroyed && src === this.audioSrc()) {
        this.audioBuffer.set(audioBuffer);
      }
    } catch (error) {
      if (!this.destroyed) console.error('Error loading audio buffer:', error);
    } finally {
      // A superseded load must not clear the spinner of the newer one
      if (src === this.audioSrc()) this.isLoading.set(false);
    }
  }

  protected onPlay(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      // play() rejects when blocked by autoplay policy or interrupted by pause()
      Promise.resolve(audio.play()).catch(() => {
        this.isPlaying.set(!audio.paused);
      });
    }
  }

  protected onPause(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.pause();
    }
  }

  protected onStop(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      this.isPlaying.set(false);
    }
  }

  /** Seek from the waveform, which emits a 0-1 position */
  protected onSeek(position: number): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.currentTime = position * this.duration();
    }
  }

  /** Seek from the scrubber, which emits a time in seconds */
  protected onSeekTime(seconds: number): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.currentTime = Math.max(0, Math.min(this.duration(), seconds));
    }
  }

  protected onSkipBackward(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.currentTime = Math.max(0, audio.currentTime - 10);
    }
  }

  protected onSkipForward(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.currentTime = Math.min(this.duration(), audio.currentTime + 10);
    }
  }

  protected onVolumeChange(value: number): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.volume = value;
      this.internalVolume.set(value);
      this.volumeChange.emit(value);
    }
  }

  protected toggleMute(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.muted = !audio.muted;
      this.isMuted.set(audio.muted);
    }
  }

  protected toggleLoop(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      audio.loop = !audio.loop;
      this.isLooping.set(audio.loop);
    }
  }

  protected toggleExpand(): void {
    this.isExpanded.update(v => !v);
  }

  // Audio element event handlers
  protected onAudioPlay(): void {
    this.isPlaying.set(true);
    this.play.emit();
  }

  protected onAudioPause(): void {
    this.isPlaying.set(false);
    this.pause.emit();
  }

  protected onAudioEnded(): void {
    this.isPlaying.set(false);
    this.ended.emit();
  }

  protected onAudioTimeUpdate(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) {
      this.currentTime.set(audio.currentTime);
      this.timeUpdate.emit(audio.currentTime);
    }
  }

  protected onAudioDurationChange(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio && !Number.isNaN(audio.duration)) {
      this.duration.set(audio.duration);
    }
  }

  protected onAudioProgress(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio && audio.buffered.length > 0) {
      this.buffered.set(audio.buffered.end(audio.buffered.length - 1));
    }
  }

  protected onAudioError(): void {
    this.isLoading.set(false);
    // An empty src (no track yet) fails the media load by spec: not a real error
    if (!this.audioSrc()) return;
    this.error.emit('Error loading audio');
  }

  protected onAudioLoadStart(): void {
    this.isLoading.set(true);
  }

  /**
   * Loading is over once the element can play, has the metadata it was asked to
   * preload, or has suspended fetching. With preload="metadata" (or where the
   * browser defers loading until the user presses play, e.g. iOS) canplay may
   * never fire before playback, and the overlay would block the play button.
   */
  protected onAudioCanPlay(): void {
    this.isLoading.set(false);
  }
}
