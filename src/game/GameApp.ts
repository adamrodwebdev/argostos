import manifestJson from '../assets/truck/manifest.json';
import body32 from '../assets/truck/hauler-body-32.webp?url';
import body64 from '../assets/truck/hauler-body-64.webp?url';
import wheels32 from '../assets/truck/hauler-wheel-frames-32.webp?url';
import wheels64 from '../assets/truck/hauler-wheel-frames-64.webp?url';
import { GameView } from '../design/GameView';
import { DebugReadout } from '../design/hud/DebugReadout';
import { FrameProbe } from '../design/hud/FrameProbe';
import type { Text } from '../design/text/Text';
import { TruckArt } from '../design/truck/TruckArt';
import type { ViewLayout } from '../design/View';
import { EventBus } from '../logic/EventBus';
import { FixedStepper } from '../logic/FixedStepper';
import { Hunt } from '../logic/hunt/Hunt';
import type { HuntEventMap } from '../logic/hunt/HuntEvents';
import { AutopilotIntent } from '../logic/input/AutopilotIntent';
import {
  FirstIntent,
  HeadingIntent,
  TargetIntent,
  type SteeringIntent,
} from '../logic/input/Steering';
import { SeededRandom } from '../logic/SeededRandom';
import { TimeScale } from '../logic/TimeScale';
import type { SoundPort } from '../design/sound/SoundPort';
import { FrameLoop, type FrameTarget } from '../platform/FrameLoop';
import { KeyInput } from '../platform/KeyInput';
import { WebPlatform, type PlatformPort } from '../platform/PlatformPort';
import { PointerInput } from '../platform/PointerInput';
import { SpriteLoader } from '../platform/SpriteLoader';
import { Stage } from '../platform/Stage';
import { SynthSound } from '../platform/SynthSound';
import { readTruckManifest, type SpriteSet, type TruckManifest } from '../rules/truckManifest';
import type { UrlOptions } from '../rules/urlOptions';
import { fullThrottleDistance, pixelsPerMetre, playFrame } from '../rules/viewing';
import { MAX_STEPS_PER_FRAME, STEP_SECONDS } from '../rules/world';

/** The build's own sprites, by the names the manifest gives them (never a URL built from data). */
const SPRITE_URLS: ReadonlyMap<string, string> = new Map([
  ['hauler-body-32.webp', body32],
  ['hauler-body-64.webp', body64],
  ['hauler-wheel-frames-32.webp', wheels32],
  ['hauler-wheel-frames-64.webp', wheels64],
]);

/** The page's parts the game uses. */
export interface GameElements {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly status: HTMLElement;
  readonly readout: HTMLElement;
  /** The mute toggle (pressed: muted). */
  readonly sound: HTMLButtonElement;
}

export interface GameStart {
  readonly elements: GameElements;
  readonly options: UrlOptions;
  readonly text: Text;
  readonly window: Window & typeof globalThis;
}

/** A different seed for the effects than the hunt's own: they never touch its chance. */
const EFFECTS_SEED = 0x5eed;

/**
 * The game's composition (loaded after the first paint): the hunt and its events, the view, the
 * inputs, the fixed-step loop. Everything is made here and handed down; nothing reaches for a
 * global.
 */
export class GameApp implements FrameTarget {
  private readonly hunt: Hunt;
  private readonly view: GameView;
  private readonly stage: Stage;
  private readonly art: TruckArt;
  private readonly pointer: PointerInput;
  private readonly keys: KeyInput;
  private readonly target = new TargetIntent();
  private readonly heading = new HeadingIntent();
  private readonly intent: SteeringIntent;
  private readonly stepper = new FixedStepper(STEP_SECONDS * 1000, MAX_STEPS_PER_FRAME);
  private readonly probe = new FrameProbe();
  private readonly readout: DebugReadout | null;
  private readonly loop: FrameLoop;
  private readonly loader: SpriteLoader;
  private layout: ViewLayout | null = null;
  private shown = false;
  private sinceArtCheck = 0;
  private readonly loading = new Set<number>();
  /** The hunt's time against the real clock: hit-stops and slow motion. */
  private readonly time = new TimeScale();
  private readonly sound: SoundPort;
  /** The portal's ports (ads, game events): nothing on our own site. */
  private readonly platform: PlatformPort = new WebPlatform();

  constructor(private readonly start: GameStart) {
    const { elements, options, window } = start;
    const manifest: TruckManifest = readTruckManifest(manifestJson);
    const events = new EventBus<HuntEventMap>();
    this.hunt = new Hunt({
      seed: options.seed,
      detail: options.detail,
      truck: manifest.geometry,
      events,
      number: options.hunt,
    });
    this.stage = new Stage(elements.canvas, window);
    const context = elements.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('2D canvas unavailable');
    this.art = new TruckArt(manifest);
    this.sound = new SynthSound(window, options.mute);
    this.view = new GameView({
      context,
      hunt: this.hunt,
      events,
      art: this.art,
      random: new SeededRandom(options.seed ^ EFFECTS_SEED),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      sound: this.sound,
      time: this.time,
    });
    this.pointer = new PointerInput(elements.canvas, () => this.stage.area());
    this.keys = new KeyInput(window);
    this.intent = options.autopilot
      ? new AutopilotIntent(this.hunt, STEP_SECONDS)
      : new FirstIntent([this.target, this.heading]);
    this.readout = options.debug
      ? new DebugReadout(elements.readout, start.text, this.probe)
      : null;
    this.loader = new SpriteLoader(SPRITE_URLS, window);
    this.loop = new FrameLoop(window, this);
    this.guardPage(elements);
    this.wireSound(elements);
    this.countStrikes(events, elements.root);
  }

  /** The page says how many takedowns began (`data-strikes`): the takedown script films from it. */
  private countStrikes(events: EventBus<HuntEventMap>, root: HTMLElement): void {
    let strikes = 0;
    events.on('takedownBeat', ({ beat }) => {
      if (beat !== 'strike') return;
      strikes++;
      root.dataset.strikes = String(strikes);
    });
  }

  /**
   * Sound starts at the player's first touch or key (the browsers' rule), pauses with the tab,
   * and the mute toggle silences it.
   */
  private wireSound(elements: GameElements): void {
    const { window } = this.start;
    const unlock = (): void => {
      this.sound.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.document.addEventListener('visibilitychange', () => {
      const hidden = window.document.hidden;
      this.sound.pause(hidden);
      if (hidden) this.platform.gameplayStop();
      else this.platform.gameplayStart();
    });
    const button = elements.sound;
    button.setAttribute('aria-label', this.start.text.get('soundMute'));
    button.setAttribute('aria-pressed', String(this.sound.muted));
    button.hidden = false;
    button.addEventListener('click', () => {
      this.sound.unlock();
      this.sound.setMuted(!this.sound.muted);
      button.setAttribute('aria-pressed', String(this.sound.muted));
    });
  }

  /** The play area holds still: no long-press menu, no page scroll or pull-to-refresh under it. */
  private guardPage(elements: GameElements): void {
    elements.root.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
    elements.canvas.addEventListener(
      'touchmove',
      (event) => {
        event.preventDefault();
      },
      { passive: false },
    );
  }

  run(): void {
    this.loop.start();
  }

  frame(elapsedMs: number): void {
    const started = this.loop.now();
    if (elapsedMs > 0) this.probe.interval.add(elapsedMs);
    const resized = this.stage.applyPendingSize();
    if (resized || !this.layout) this.layout = this.measure();
    this.steer(this.layout);
    // A hit-stop holds the hunt, a slow motion slows it; the camera keeps the real time.
    const huntMs = this.time.advance(elapsedMs);
    const steps = this.stepper.advance(huntMs);
    for (let i = 0; i < steps; i++) this.hunt.step(this.intent);
    const stepped = this.loop.now();
    if (steps > 0) this.probe.steps.add(stepped - started);
    const realDt = elapsedMs / 1000;
    this.view.render({
      layout: this.layout,
      blend: this.stepper.blend,
      realDt,
      huntDt: huntMs / 1000,
    });
    this.probe.paint.add(this.loop.now() - stepped);
    this.readout?.frame(realDt, this.hunt, this.view.particleCount);
    this.keepArtReady(realDt);
    if (!this.shown) {
      this.shown = true;
      this.start.elements.status.hidden = true;
      this.start.elements.root.dataset.state = 'playing';
      this.platform.gameplayStart();
    }
  }

  private measure(): ViewLayout {
    const { stage } = this;
    const frame = playFrame(stage.widthCss, stage.heightCss);
    return {
      widthPx: stage.canvas.width,
      heightPx: stage.canvas.height,
      pixelRatio: stage.pixelRatio,
      frame,
      cssPpm: pixelsPerMetre(frame),
    };
  }

  /** The finger or the pointer (canvas CSS px) becomes a target in the world, inside the frame. */
  private steer(layout: ViewLayout): void {
    this.heading.hold(this.keys.dx, this.keys.dz);
    if (!this.pointer.active) {
      this.target.release();
      return;
    }
    const { view } = this.view;
    const { frame, pixelRatio } = layout;
    const x = Math.min(frame.x + frame.width, Math.max(frame.x, this.pointer.targetX));
    this.target.aim(
      view.worldX(x * pixelRatio),
      view.worldZ(this.pointer.targetY * pixelRatio),
      fullThrottleDistance(frame, layout.cssPpm),
    );
  }

  /** Loads the truck's sprites at the scale the screen needs (now, and after a zoom). */
  private keepArtReady(dt: number): void {
    this.sinceArtCheck -= dt;
    if (this.sinceArtCheck > 0) return;
    this.sinceArtCheck = 1;
    const wanted = this.art.wanted(this.view.view.scale);
    if (this.art.has(wanted) || this.loading.has(wanted.pixelsPerMetre)) return;
    this.loading.add(wanted.pixelsPerMetre);
    void this.loadSet(wanted);
  }

  private async loadSet(set: SpriteSet): Promise<void> {
    try {
      const [body, wheels] = await Promise.all([
        this.loader.load(set.body),
        this.loader.load(set.wheelFrames),
      ]);
      this.art.add({ set, body, wheels });
    } catch (error) {
      const { status } = this.start.elements;
      status.textContent = this.start.text.get('trucksFailed');
      status.hidden = false;
      console.warn(error);
    }
  }
}

export function startGame(start: GameStart): GameApp {
  const game = new GameApp(start);
  game.run();
  return game;
}
