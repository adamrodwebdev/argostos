import type { SoundCue, SoundPort } from '../design/sound/SoundPort';

/** The loudest the mix goes, and how many sounds may sound at once (older ones are dropped). */
const MASTER_GAIN = 0.55;
const MAX_VOICES = 14;
const NOISE_SECONDS = 2;

/**
 * The takedown's sounds, synthesised with Web Audio (nothing downloaded): a low thump for the
 * impact, a crunch of metal, glass that shatters, the whoosh and crackle of fuel catching fire,
 * a burst of sand. One noise buffer is made once; each cue is a handful of short-lived nodes.
 * The context starts at the player's first touch or key, pauses with the tab, and mutes.
 */
export class SynthSound implements SoundPort {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private quiet: boolean;
  private voices = 0;

  constructor(
    private readonly window: Window & typeof globalThis,
    startMuted: boolean,
  ) {
    this.quiet = startMuted;
  }

  get muted(): boolean {
    return this.quiet;
  }

  setMuted(muted: boolean): void {
    this.quiet = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, this.context.currentTime, 0.02);
    }
  }

  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    // Some browsers (and test shells) have no Web Audio: the game then stays silent.
    if (!('AudioContext' in this.window)) return;
    const context = new this.window.AudioContext();
    const master = context.createGain();
    master.gain.value = this.quiet ? 0 : MASTER_GAIN;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    this.noise = SynthSound.whiteNoise(context);
  }

  pause(paused: boolean): void {
    if (!this.context) return;
    if (paused) void this.context.suspend();
    else void this.context.resume();
  }

  play(cue: SoundCue, strength: number): void {
    const { context } = this;
    if (!context || this.quiet || context.state !== 'running' || this.voices >= MAX_VOICES) return;
    const s = Math.min(1, Math.max(0, strength));
    this.voices++;
    const end = this.cues.get(cue)?.(context, s) ?? 0;
    this.window.setTimeout(
      () => {
        this.voices--;
      },
      end * 1000 + 50,
    );
  }

  /** Each cue: builds its nodes on the context at strength s; returns how long it lasts (s). */
  private readonly cues: ReadonlyMap<SoundCue, (context: AudioContext, s: number) => number> =
    new Map([
      ['impact', (context, s) => this.impact(context, s)],
      ['crunch', (context, s) => this.crunch(context, s)],
      ['shatter', (context, s) => this.shatter(context, s)],
      ['whoosh', (context, s) => this.whoosh(context, s)],
      ['crackle', (context, s) => this.crackle(context, s)],
      ['sandBurst', (context, s) => this.sandBurst(context, s)],
      ['ping', (context, s) => this.ping(context, s)],
      ['alarm', (context, s) => this.alarm(context, s)],
      ['chime', (context, s) => this.chime(context, s)],
      ['swish', (context, s) => this.swish(context, s)],
    ]);

  /** A deep thump: a sine falling from 140 to 38 Hz, and a muffled thud of noise. */
  private impact(context: AudioContext, s: number): number {
    const now = context.currentTime;
    const body = context.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(140, now);
    body.frequency.exponentialRampToValueAtTime(38, now + 0.3);
    const gain = this.envelope(context, { peak: 0.95 * s, attack: 0.005, decay: 0.45 });
    body.connect(gain);
    body.start(now);
    body.stop(now + 0.5);
    this.noiseBurst(context, {
      type: 'lowpass',
      frequency: 420,
      q: 0.7,
      peak: 0.5 * s,
      decay: 0.22,
      at: 0,
    });
    return 0.5;
  }

  /** Metal giving way: bursts of band-passed noise and a few clanging partials. */
  private crunch(context: AudioContext, s: number): number {
    for (let i = 0; i < 5; i++) {
      this.noiseBurst(context, {
        type: 'bandpass',
        frequency: 1200 + i * 380,
        q: 1.4,
        peak: (0.55 - i * 0.06) * s,
        decay: 0.09,
        at: i * 0.055,
      });
    }
    const now = context.currentTime;
    for (const frequency of [420, 690, 1130]) {
      const partial = context.createOscillator();
      partial.type = 'triangle';
      partial.frequency.setValueAtTime(frequency, now);
      partial.frequency.exponentialRampToValueAtTime(frequency * 0.82, now + 0.25);
      const gain = this.envelope(context, { peak: 0.12 * s, attack: 0.003, decay: 0.25 });
      partial.connect(gain);
      partial.start(now);
      partial.stop(now + 0.3);
    }
    return 0.45;
  }

  /** Glass: a bright rush of noise and a scatter of high tinkles. */
  private shatter(context: AudioContext, s: number): number {
    this.noiseBurst(context, {
      type: 'highpass',
      frequency: 3200,
      q: 0.7,
      peak: 0.42 * s,
      decay: 0.28,
      at: 0,
    });
    const now = context.currentTime;
    for (let i = 0; i < 9; i++) {
      const at = now + 0.02 + ((i * 0.37) % 1) * 0.42;
      const tink = context.createOscillator();
      tink.type = 'sine';
      tink.frequency.value = 2600 + ((i * 1777) % 4200);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.14 * s, at + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
      tink.connect(gain);
      gain.connect(this.master!);
      tink.start(at);
      tink.stop(at + 0.08);
    }
    return 0.5;
  }

  /** Fuel catching fire: noise swept up through a low-pass, then down. */
  private whoosh(context: AudioContext, s: number): number {
    const now = context.currentTime;
    const source = this.noiseSource(context);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.22);
    filter.frequency.exponentialRampToValueAtTime(260, now + 0.85);
    const gain = this.envelope(context, { peak: 0.6 * s, attack: 0.08, decay: 0.8 });
    source.connect(filter);
    filter.connect(gain);
    source.start(now);
    source.stop(now + 0.95);
    return 0.95;
  }

  /** A fire crackling for a couple of seconds: tiny clicks over a low rumble. */
  private crackle(context: AudioContext, s: number): number {
    const length = 2.4;
    for (let i = 0; i < 34; i++) {
      const at = ((i * 0.61803) % 1) * length;
      this.noiseBurst(context, {
        type: 'bandpass',
        frequency: 1800 + ((i * 977) % 3200),
        q: 2.5,
        peak: (0.12 + ((i * 0.29) % 0.18)) * s * (1 - at / length),
        decay: 0.018,
        at,
      });
    }
    this.noiseBurst(context, {
      type: 'lowpass',
      frequency: 260,
      q: 0.5,
      peak: 0.12 * s,
      decay: length,
      at: 0,
    });
    return length;
  }

  /** Sand bursting out: low-passed noise, quick to rise, slower to settle. */
  private sandBurst(context: AudioContext, s: number): number {
    this.noiseBurst(context, {
      type: 'lowpass',
      frequency: 900,
      q: 0.6,
      peak: 0.5 * s,
      decay: 0.55,
      at: 0,
    });
    return 0.6;
  }

  /** The sonar: a soft sine falling from 1500 to 900 Hz, and its faint echo. */
  private ping(context: AudioContext, s: number): number {
    const now = context.currentTime;
    for (const [at, level] of [
      [0, 1],
      [0.18, 0.35],
    ] as const) {
      const tone = context.createOscillator();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(1500, now + at);
      tone.frequency.exponentialRampToValueAtTime(900, now + at + 0.25);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.18 * s * level, now + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.3);
      gain.connect(this.master!);
      tone.connect(gain);
      tone.start(now + at);
      tone.stop(now + at + 0.32);
    }
    return 0.55;
  }

  /** Spotted: two quick bright tones, high then higher. */
  private alarm(context: AudioContext, s: number): number {
    const now = context.currentTime;
    for (const [at, frequency] of [
      [0, 880],
      [0.12, 1320],
    ] as const) {
      const tone = context.createOscillator();
      tone.type = 'square';
      tone.frequency.value = frequency;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2600;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.16 * s, now + at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.11);
      tone.connect(filter);
      filter.connect(gain);
      gain.connect(this.master!);
      tone.start(now + at);
      tone.stop(now + at + 0.12);
    }
    return 0.3;
  }

  /** The glass dome forming: a few glassy partials ringing out. */
  private chime(context: AudioContext, s: number): number {
    const now = context.currentTime;
    for (const [frequency, level] of [
      [1046, 1],
      [1568, 0.6],
      [2637, 0.35],
      [3520, 0.2],
    ] as const) {
      const tone = context.createOscillator();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      const gain = this.envelope(context, { peak: 0.14 * s * level, attack: 0.01, decay: 1.1 });
      tone.connect(gain);
      tone.start(now);
      tone.stop(now + 1.2);
    }
    return 1.2;
  }

  /** The tail sweeping: a quick band-passed swish of noise, rising. */
  private swish(context: AudioContext, s: number): number {
    const now = context.currentTime;
    const source = this.noiseSource(context);
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.16);
    const gain = this.envelope(context, { peak: 0.45 * s, attack: 0.03, decay: 0.2 });
    source.connect(filter);
    filter.connect(gain);
    source.start(now);
    source.stop(now + 0.26);
    return 0.26;
  }

  private noiseSource(context: AudioContext): AudioBufferSourceNode {
    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    return source;
  }

  /** A burst of filtered noise starting `at` seconds from now. */
  private noiseBurst(context: AudioContext, burst: NoiseBurst): void {
    const start = context.currentTime + burst.at;
    const source = this.noiseSource(context);
    const filter = context.createBiquadFilter();
    filter.type = burst.type;
    filter.frequency.value = burst.frequency;
    filter.Q.value = burst.q;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, burst.peak), start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + burst.decay);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    source.start(start, Math.random() * NOISE_SECONDS);
    source.stop(start + burst.decay + 0.02);
  }

  /** A gain node with an attack and an exponential decay, plugged into the master. */
  private envelope(context: AudioContext, shape: Envelope): GainNode {
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, shape.peak), now + shape.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + shape.attack + shape.decay);
    gain.connect(this.master!);
    return gain;
  }

  /** Two seconds of white noise, made once (the platform layer may use the real chance). */
  private static whiteNoise(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(
      1,
      Math.round(context.sampleRate * NOISE_SECONDS),
      context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}

interface NoiseBurst {
  readonly type: BiquadFilterType;
  readonly frequency: number;
  readonly q: number;
  readonly peak: number;
  readonly decay: number;
  /** Seconds from now. */
  readonly at: number;
}

interface Envelope {
  readonly peak: number;
  readonly attack: number;
  readonly decay: number;
}
