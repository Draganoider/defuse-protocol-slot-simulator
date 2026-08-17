import { AUDIO_ASSET_URLS, DEFERRED_AUDIO_CUES, routeMusicCues } from './audio-assets';
import { recordDiagnostic, recordDiagnosticRateLimited } from '../diagnostics/diagnostic-log';
import type { AudioCue, AudioSettings, AudioStatus, ScheduledAudioCue } from './types';

type StatusListener = (status: AudioStatus) => void;

/** Level the base-operation bed drops to while route music is playing. */
const AMBIENCE_FEATURE_DUCK = 0.12;

/** Everything play needs before a route is entered. Route stems load on demand. */
const ESSENTIAL_CUES = (Object.keys(AUDIO_ASSET_URLS) as AudioCue[])
  .filter((cue) => !DEFERRED_AUDIO_CUES.includes(cue));

export class AudioDirector {
  private context?: AudioContext;
  private master?: GainNode;
  private ambienceBus?: GainNode;
  private ambienceDuck?: GainNode;
  private effectsBus?: GainNode;
  private musicBus?: GainNode;
  private ambienceSource?: AudioBufferSourceNode;
  private featureMusic?: {
    route: 'alpha' | 'bravo';
    sources: readonly AudioBufferSourceNode[];
    gains: readonly GainNode[];
    /** Gain of the intensity layer, driven by feature state. */
    drive: GainNode;
  };
  private featureIntensity = 0;
  private desiredFeatureRoute?: 'alpha' | 'bravo';
  private buffers = new Map<AudioCue, AudioBuffer>();
  private loading?: Promise<void>;
  private pendingLoads = new Map<AudioCue, Promise<void>>();
  private disposed = false;
  private readyLogged = false;
  private activeCues = new Map<AudioBufferSourceNode, GainNode>();

  constructor(private settings: AudioSettings, private readonly onStatus: StatusListener) {}

  updateSettings(settings: AudioSettings): void {
    this.settings = settings;
    if (!this.context || !this.master || !this.ambienceBus || !this.effectsBus || !this.musicBus) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.masterVolume, now, 0.025);
    this.ambienceBus.gain.setTargetAtTime(settings.ambienceVolume, now, 0.025);
    this.effectsBus.gain.setTargetAtTime(settings.effectsVolume, now, 0.025);
    this.musicBus.gain.setTargetAtTime(settings.musicVolume, now, 0.04);
  }

  async activate(): Promise<boolean> {
    if (this.disposed) return false;
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) {
        this.onStatus('unavailable');
        return false;
      }
      try {
        this.context = new AudioContextConstructor();
        this.master = this.context.createGain();
        this.ambienceBus = this.context.createGain();
        this.effectsBus = this.context.createGain();
        this.musicBus = this.context.createGain();
        // The base bed is a musical loop in its own key and tempo, so it is ducked rather
        // than layered while route music plays. Its own volume control stays on the bus.
        this.ambienceDuck = this.context.createGain();
        this.ambienceDuck.connect(this.ambienceBus);
        this.ambienceBus.connect(this.master);
        this.effectsBus.connect(this.master);
        this.musicBus.connect(this.master);
        this.master.connect(this.context.destination);
        this.updateSettings(this.settings);
        this.context.addEventListener('statechange', () => {
          recordDiagnosticRateLimited('audio-context-state', { state: this.context?.state ?? 'closed' }, 500);
        });
        recordDiagnostic('audio-context-created', { sampleRate: this.context.sampleRate });
      } catch {
        recordDiagnostic('audio-unavailable', { stage: 'context-create' });
        this.onStatus('unavailable');
        return false;
      }
    }
    if (this.buffers.size >= ESSENTIAL_CUES.length && this.ambienceSource) {
      try {
        if (this.context.state !== 'running') await this.context.resume();
        this.onStatus('ready');
        return true;
      } catch {
        this.onStatus('unavailable');
        return false;
      }
    }
    this.onStatus('loading');
    try {
      await this.context.resume();
      await this.loadBuffers();
      if (this.disposed) return false;
      this.startAmbience();
      this.syncFeatureMusic();
      this.onStatus('ready');
      if (!this.readyLogged) {
        this.readyLogged = true;
        recordDiagnostic('audio-ready', { buffers: this.buffers.size });
      }
      return true;
    } catch {
      recordDiagnostic('audio-unavailable', { stage: 'load-or-resume' });
      this.onStatus('unavailable');
      return false;
    }
  }

  playPlan(plan: readonly ScheduledAudioCue[]): void {
    if (plan.length === 0) return;
    void this.playWhenReady(plan);
  }

  setFeatureRoute(route?: 'alpha' | 'bravo'): void {
    this.desiredFeatureRoute = route;
    this.applyAmbienceDuck();
    if (!route) {
      this.stopFeatureMusic();
      return;
    }
    void this.activate().then(async (active) => {
      if (!active) return;
      const [coreCue, driveCue] = routeMusicCues(route);
      try {
        await Promise.all([this.loadCue(coreCue), this.loadCue(driveCue)]);
      } catch {
        recordDiagnostic('feature-music-unavailable', { route });
        return;
      }
      if (this.disposed || this.desiredFeatureRoute !== route) return;
      this.syncFeatureMusic();
    });
  }

  private async playWhenReady(plan: readonly ScheduledAudioCue[]): Promise<void> {
    if (!(await this.activate()) || !this.context || !this.effectsBus) return;
    for (const item of plan) this.startCue(item.cue, item.delayMs, item.gain ?? 1);
  }

  private startCue(cue: ScheduledAudioCue['cue'], delayMs: number, gainValue: number): void {
    const buffer = this.buffers.get(cue);
    if (!buffer || !this.context || !this.effectsBus) return;
    if (this.activeCues.size >= 32) {
      recordDiagnosticRateLimited('audio-cue-dropped', { activeCues: this.activeCues.size, cue }, 1_000);
      return;
    }
    const source = this.context.createBufferSource();
    const cueGain = this.context.createGain();
    source.buffer = buffer;
    cueGain.gain.value = gainValue;
    source.connect(cueGain);
    cueGain.connect(this.effectsBus);
    this.activeCues.set(source, cueGain);
    source.onended = () => {
      source.disconnect();
      cueGain.disconnect();
      this.activeCues.delete(source);
    };
    try {
      source.start(this.context.currentTime + Math.max(0, delayMs) / 1_000);
    } catch {
      source.onended = null;
      source.disconnect();
      cueGain.disconnect();
      this.activeCues.delete(source);
      recordDiagnosticRateLimited('audio-cue-start-failed', { cue }, 1_000);
    }
  }

  private async loadCue(cue: AudioCue): Promise<void> {
    if (this.buffers.has(cue) || !this.context) return;
    const pending = this.pendingLoads.get(cue);
    if (pending) return pending;
    const context = this.context;
    const load = (async () => {
      const response = await fetch(AUDIO_ASSET_URLS[cue]);
      if (!response.ok) throw new Error(`Audio asset could not be loaded: ${cue}`);
      this.buffers.set(cue, await context.decodeAudioData(await response.arrayBuffer()));
    })();
    this.pendingLoads.set(cue, load);
    try {
      await load;
    } finally {
      this.pendingLoads.delete(cue);
    }
  }

  /**
   * Fetches only what play needs immediately. Route music is several hundred kilobytes per
   * route and is not needed until a route is entered, so it is deferred to that moment.
   */
  private loadBuffers(): Promise<void> {
    if (this.loading) return this.loading;
    if (!this.context) return Promise.reject(new Error('Audio context is not initialized.'));
    this.loading = Promise.all(ESSENTIAL_CUES.map((cue) => this.loadCue(cue))).then(() => undefined);
    return this.loading;
  }

  private startAmbience(): void {
    if (this.ambienceSource || !this.context || !this.ambienceDuck) return;
    const buffer = this.buffers.get('ambience');
    if (!buffer) return;
    this.ambienceSource = this.context.createBufferSource();
    this.ambienceSource.buffer = buffer;
    this.ambienceSource.loop = true;
    this.ambienceSource.connect(this.ambienceDuck);
    this.ambienceSource.start();
    this.applyAmbienceDuck();
  }

  private applyAmbienceDuck(): void {
    if (!this.context || !this.ambienceDuck) return;
    const target = this.desiredFeatureRoute ? AMBIENCE_FEATURE_DUCK : 1;
    this.ambienceDuck.gain.setTargetAtTime(target, this.context.currentTime, 0.25);
  }

  /**
   * Starts every stem of a route at one context time. They are identical lengths from one
   * seed, so starting together keeps them phase locked for the whole feature; from then on
   * only the intensity layer's gain moves.
   */
  private syncFeatureMusic(): void {
    const route = this.desiredFeatureRoute;
    if (!route || !this.context || !this.musicBus) return;
    if (this.featureMusic?.route === route) return;
    const [coreCue, driveCue] = routeMusicCues(route);
    const coreBuffer = this.buffers.get(coreCue);
    const driveBuffer = this.buffers.get(driveCue);
    if (!coreBuffer || !driveBuffer) return;
    this.stopFeatureMusic();

    const startAt = this.context.currentTime + 0.06;
    const sources: AudioBufferSourceNode[] = [];
    const gains: GainNode[] = [];
    for (const buffer of [coreBuffer, driveBuffer]) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.musicBus);
      source.start(startAt);
      sources.push(source);
      gains.push(gain);
    }
    const entry = { route, sources, gains, drive: gains[1] };
    this.featureMusic = entry;
    sources[0].onended = () => {
      for (const node of entry.sources) node.disconnect();
      for (const node of entry.gains) node.disconnect();
      if (this.featureMusic === entry) this.featureMusic = undefined;
    };
    gains[0].gain.setTargetAtTime(1, this.context.currentTime, 0.18);
    this.applyFeatureIntensity();
    recordDiagnostic('feature-music-started', { route, stems: sources.length });
  }

  /**
   * Sets how much of the intensity layer is audible, from 0 to 1. The bed never stops, so
   * the music thickens and thins with the feature rather than switching between tracks.
   */
  setFeatureIntensity(intensity: number): void {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(intensity) ? intensity : 0));
    if (Math.abs(clamped - this.featureIntensity) < 0.01) return;
    this.featureIntensity = clamped;
    this.applyFeatureIntensity();
  }

  private applyFeatureIntensity(): void {
    if (!this.context || !this.featureMusic) return;
    // A floor keeps the layer present rather than absent at the start of a feature.
    const level = 0.22 + (this.featureIntensity * 0.78);
    this.featureMusic.drive.gain.setTargetAtTime(level, this.context.currentTime, 0.5);
  }

  private stopFeatureMusic(): void {
    const active = this.featureMusic;
    if (!active || !this.context) return;
    this.featureMusic = undefined;
    const now = this.context.currentTime;
    for (const gain of active.gains) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.12);
    }
    for (const source of active.sources) {
      try { source.stop(now + 0.45); } catch { /* Source may already have ended. */ }
    }
    recordDiagnostic('feature-music-stopped', { route: active.route });
  }

  dispose(): void {
    this.disposed = true;
    for (const [source, gain] of this.activeCues) {
      source.onended = null;
      try { source.stop(); } catch { /* Source may already have ended. */ }
      source.disconnect();
      gain.disconnect();
    }
    this.activeCues.clear();
    try {
      if (this.featureMusic) {
        for (const source of this.featureMusic.sources) {
          source.onended = null;
          source.stop();
          source.disconnect();
        }
        for (const gain of this.featureMusic.gains) gain.disconnect();
      }
      this.ambienceSource?.stop();
      this.ambienceSource?.disconnect();
      this.ambienceDuck?.disconnect();
      this.ambienceBus?.disconnect();
      this.effectsBus?.disconnect();
      this.musicBus?.disconnect();
      this.master?.disconnect();
      void this.context?.close();
    } catch {
      // Contexts can already be closed by browser lifecycle events.
    }
    this.ambienceSource = undefined;
    this.buffers.clear();
    recordDiagnostic('audio-disposed');
  }
}
