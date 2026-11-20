import manifestJson from '../assets/truck/manifest.json';
import body32 from '../assets/truck/hauler-body-32.webp?url';
import body64 from '../assets/truck/hauler-body-64.webp?url';
import wheels32 from '../assets/truck/hauler-wheel-frames-32.webp?url';
import wheels64 from '../assets/truck/hauler-wheel-frames-64.webp?url';
import { DebugReadout } from '../design/hud/DebugReadout';
import { EndScreen } from '../design/hud/EndScreen';
import { FrameProbe } from '../design/hud/FrameProbe';
import '../design/hud/hud.css';
import { HuntHud } from '../design/hud/HuntHud';
import { installIcons } from '../design/hud/icons';
import { PauseSheet } from '../design/hud/PauseSheet';
import type { SoundPort } from '../design/sound/SoundPort';
import type { Text } from '../design/text/Text';
import { TruckArt } from '../design/truck/TruckArt';
import type { ViewLayout } from '../design/View';
import type { HuntEndedEvent } from '../logic/hunt/HuntEvents';
import { FirstIntent, HeadingIntent, TargetIntent } from '../logic/input/Steering';
import { SessionLog } from '../logic/session/SessionLog';
import { Clipboard } from '../platform/Clipboard';
import { FrameLoop, type FrameTarget } from '../platform/FrameLoop';
import { KeyInput } from '../platform/KeyInput';
import { WebPlatform, type PlatformPort } from '../platform/PlatformPort';
import { PointerInput } from '../platform/PointerInput';
import { SpriteLoader } from '../platform/SpriteLoader';
import { Stage } from '../platform/Stage';
import { SynthSound } from '../platform/SynthSound';
import { nextTask } from '../platform/tasks';
import type { ActionId } from '../rules/combat';
import { MAX_HUNT_NUMBER } from '../rules/hunts';
import type { KeyCommand } from '../rules/keyInput';
import type { MouseButton } from '../rules/pointerInput';
import { readTruckManifest, type SpriteSet, type TruckManifest } from '../rules/truckManifest';
import { encodeSession } from '../rules/sessionCode';
import type { UrlOptions } from '../rules/urlOptions';
import { fullThrottleDistance, pixelsPerMetre, playFrame } from '../rules/viewing';
import { HuntPlay, type PlaySetup } from './HuntPlay';

/** The build's own sprites, by the names the manifest gives them (never a URL built from data). */
const SPRITE_URLS: ReadonlyMap<string, string> = new Map([
  ['hauler-body-32.webp', body32],
  ['hauler-body-64.webp', body64],
  ['hauler-wheel-frames-32.webp', wheels32],
  ['hauler-wheel-frames-64.webp', wheels64],
]);

/** The mouse's buttons and the actions they ask. */
const MOUSE_ACTIONS: ReadonlyMap<MouseButton, ActionId> = new Map<MouseButton, ActionId>([
  ['primary', 'ram'],
  ['secondary', 'strike'],
]);

/** On the autopilot (measurements, filming), the next hunt starts this long after the end (ms). */
const AUTOPILOT_NEXT_MS = 2500;

/** The page's parts the game uses. */
export interface GameElements {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly status: HTMLElement;
  readonly readout: HTMLElement;
}

export interface GameStart {
  readonly elements: GameElements;
  readonly options: UrlOptions;
  readonly text: Text;
  readonly window: Window & typeof globalThis;
}

/** Where the game is: a hunt playing, its end screen, or the pause. */
type GameState = 'playing' | 'ended' | 'paused';

/**
 * The game's composition (loaded after the first paint): the stage, the inputs, the sound, the
 * interface and its screens, made once; a `HuntPlay` for each hunt. Everything is made here and
 * handed down; nothing reaches for a global.
 */
export class GameApp implements FrameTarget {
  /** The hunt being played: set by `open` before the loop starts, then by each new hunt. */
  private play!: HuntPlay;
  private state: GameState = 'playing';
  /** Crystals earned in this session, before the hunt being played. */
  private banked = 0;
  private readonly manifest: TruckManifest;
  private readonly stage: Stage;
  private readonly context: CanvasRenderingContext2D;
  private readonly art: TruckArt;
  private readonly pointer: PointerInput;
  private readonly keys: KeyInput;
  private readonly target = new TargetIntent();
  private readonly heading = new HeadingIntent();
  private readonly player = new FirstIntent([this.target, this.heading]);
  private readonly probe = new FrameProbe();
  private readonly readout: DebugReadout | null;
  private readonly loop: FrameLoop;
  private readonly loader: SpriteLoader;
  private readonly hud: HuntHud;
  private readonly endScreen: EndScreen;
  private readonly pauseSheet: PauseSheet;
  private readonly sound: SoundPort;
  private readonly reducedMotion: boolean;
  /** The portal's ports (ads, game events): nothing on our own site. */
  private readonly platform: PlatformPort = new WebPlatform();
  private layout: ViewLayout | null = null;
  private shown = false;
  private sinceArtCheck = 0;
  private strikes = 0;
  private readonly loading = new Set<number>();
  private readonly span = { left: 0, right: 0 };
  /** The session's log for remote testers: in memory only, read as a short code. */
  private readonly log = new SessionLog();
  private readonly clipboard: Clipboard;
  private shownCode = '';

  constructor(private readonly start: GameStart) {
    const { elements, options, window, text } = start;
    const { document } = window;
    this.manifest = readTruckManifest(manifestJson);
    this.stage = new Stage(elements.canvas, window);
    const context = elements.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('2D canvas unavailable');
    this.context = context;
    this.art = new TruckArt(this.manifest);
    this.sound = new SynthSound(window, options.mute);
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    installIcons(document);
    this.hud = new HuntHud(document, text, {
      act: (action) => {
        this.act(action);
      },
      pause: () => {
        this.pause();
      },
    });
    this.endScreen = new EndScreen(document, text, {
      next: () => {
        this.begin(Math.min(MAX_HUNT_NUMBER, this.play.hunt.number + 1));
      },
      again: () => {
        this.begin(this.play.hunt.number);
      },
    });
    this.pauseSheet = new PauseSheet(document, text, {
      resume: () => {
        this.resume();
      },
      restart: () => {
        this.begin(this.play.hunt.number);
      },
      sound: (on) => {
        this.sound.unlock();
        this.sound.setMuted(!on);
      },
      copyCode: () => this.clipboard.copy(this.shownCode),
    });
    this.clipboard = new Clipboard(window);
    elements.root.append(this.hud.element, this.endScreen.element, this.pauseSheet.element);
    this.pointer = new PointerInput(elements.canvas, () => this.stage.area(), {
      button: (pressed) => {
        const action = MOUSE_ACTIONS.get(pressed);
        if (action) this.act(action);
      },
      gesture: () => {
        this.hud.firstGesture();
        this.log.gesture();
      },
    });
    this.keys = new KeyInput(window, (command) => {
      this.command(command);
    });
    this.readout = options.debug ? new DebugReadout(elements.readout, text, this.probe) : null;
    this.loader = new SpriteLoader(SPRITE_URLS, window);
    this.loop = new FrameLoop(window, this);
    this.guardPage(elements);
    this.wireSound();
  }

  /**
   * The first hunt, in two tasks (its world, then its view and the interface bound to it), so
   * neither holds the page long while it starts.
   */
  async open(pause: () => Promise<void>): Promise<void> {
    const setup = this.setup(this.start.options.hunt);
    const world = HuntPlay.world(setup);
    await pause();
    this.play = this.adopt(new HuntPlay(setup, world));
    this.setState('playing');
    this.log.huntBegun(this.start.options.hunt);
  }

  run(): void {
    this.loop.start();
  }

  frame(elapsedMs: number): void {
    const started = this.loop.now();
    if (elapsedMs > 0) this.probe.interval.add(elapsedMs);
    const resized = this.stage.applyPendingSize();
    if (resized || !this.layout) this.layout = this.measure();
    const { play } = this;
    const running = this.state !== 'paused';
    if (this.state === 'playing') this.steer(this.layout);
    // A hit-stop holds the hunt, a slow motion slows it; the camera keeps the real time.
    const huntMs = running ? play.time.advance(elapsedMs) : 0;
    const steps = running ? play.advance(huntMs) : 0;
    const stepped = this.loop.now();
    if (steps > 0) this.probe.steps.add(stepped - started);
    const realDt = running ? elapsedMs / 1000 : 0;
    play.view.render({
      layout: this.layout,
      blend: play.stepper.blend,
      realDt,
      huntDt: huntMs / 1000,
    });
    this.probe.paint.add(this.loop.now() - stepped);
    this.log.tick(elapsedMs / 1000);
    this.hud.frame(realDt, play.hunt, { span: this.viewSpan(), crystals: this.crystals() });
    this.readout?.frame(elapsedMs / 1000, play.hunt, play.view.particleCount);
    this.keepArtReady(elapsedMs / 1000);
    if (!this.shown) {
      this.shown = true;
      this.start.elements.status.hidden = true;
      this.start.elements.root.dataset.state = 'playing';
      this.platform.gameplayStart();
    }
  }

  /** A new hunt: its world, its view, the interface bound to it. */
  private begin(number: number): void {
    this.banked = this.crystals();
    this.play = this.newPlay(number);
    this.endScreen.hide();
    this.pauseSheet.hide();
    this.setState('playing');
    this.sound.pause(false);
    this.platform.gameplayStart();
    this.log.huntBegun(number);
  }

  private newPlay(number: number): HuntPlay {
    const setup = this.setup(number);
    return this.adopt(new HuntPlay(setup, HuntPlay.world(setup)));
  }

  private setup(number: number): PlaySetup {
    const { options } = this.start;
    return {
      number,
      seed: options.seed,
      detail: options.detail,
      autopilot: options.autopilot,
      bot: options.bot,
      truck: this.manifest.geometry,
      context: this.context,
      art: this.art,
      sound: this.sound,
      reducedMotion: this.reducedMotion,
      player: this.player,
      keepOut: () => this.hud.keepOut(),
      ceiling: () => this.hud.ceiling(),
    };
  }

  /** A hunt to play: the interface bound to it, its events heard. */
  private adopt(play: HuntPlay): HuntPlay {
    this.hud.bind(play.hunt, play.events);
    play.events.on('huntEnded', (outcome) => {
      this.ended(outcome);
    });
    // The page says how many takedowns began (`data-strikes`): the takedown script films from it.
    play.events.on('takedownBeat', ({ beat }) => {
      if (beat !== 'strike') return;
      this.strikes++;
      this.start.elements.root.dataset.strikes = String(this.strikes);
    });
    this.start.elements.root.dataset.hunt = String(play.hunt.number);
    return play;
  }

  /** The hunt is over: its end screen over the world, which goes on behind it. */
  private ended(outcome: HuntEndedEvent): void {
    const { hunt } = this.play;
    this.endScreen.show({
      hunt: hunt.number,
      outcome,
      crystals: hunt.stats.crystals,
      trucks: hunt.stats.destroyed('hauler') + hunt.stats.destroyed('armoredHauler'),
      drones: hunt.stats.destroyed('drone'),
      stars: hunt.stats.stars,
    });
    this.setState('ended');
    this.log.huntEnded(outcome.result, outcome.reason);
    this.start.elements.root.dataset.result = outcome.result;
    this.platform.gameplayStop();
    if (this.start.options.autopilot) {
      this.start.window.setTimeout(() => {
        if (this.state === 'ended') this.begin(Math.min(MAX_HUNT_NUMBER, hunt.number + 1));
      }, AUTOPILOT_NEXT_MS);
    }
  }

  private act(action: ActionId): void {
    if (this.state !== 'playing') return;
    this.sound.unlock();
    this.hud.firstGesture();
    this.log.gesture();
    this.play.hunt.request(action);
  }

  private command(command: KeyCommand): void {
    if (command === 'pause') {
      if (this.state === 'paused') this.resume();
      else this.pause();
      return;
    }
    this.act(command);
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.setState('paused');
    this.log.paused(true);
    this.sound.pause(true);
    this.platform.gameplayStop();
    this.shownCode = encodeSession(this.log.facts());
    this.pauseSheet.show(!this.sound.muted, this.start.options.tester ? this.shownCode : null);
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.pauseSheet.hide();
    this.setState('playing');
    this.log.paused(false);
    this.sound.pause(false);
    this.platform.gameplayStart();
  }

  private setState(state: GameState): void {
    this.state = state;
    const { root } = this.start.elements;
    root.dataset.hunting = state;
    if (state === 'playing') delete root.dataset.result;
    this.hud.show(state === 'playing');
    this.keys.setPlaying(state === 'playing');
    if (state !== 'playing') this.target.release();
  }

  /** The session's crystals: those banked and those of the hunt being played. */
  private crystals(): number {
    return this.banked + this.play.hunt.stats.crystals;
  }

  /** Sound starts at the player's first touch or key (the browsers' rule); a hidden tab pauses. */
  private wireSound(): void {
    const { window } = this.start;
    const unlock = (): void => {
      this.sound.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.document.addEventListener('visibilitychange', () => {
      if (!window.document.hidden) return;
      this.pause();
      this.sound.pause(true);
      this.platform.gameplayStop();
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

  /** The arena the screen shows (m), for the scanner's window. */
  private viewSpan(): { left: number; right: number } {
    const { view } = this.play.view;
    this.span.left = view.worldX(view.frameLeftPx);
    this.span.right = view.worldX(view.frameRightPx);
    return this.span;
  }

  /** The finger or the pointer (canvas CSS px) becomes a target in the world, inside the frame. */
  private steer(layout: ViewLayout): void {
    this.heading.hold(this.keys.dx, this.keys.dz);
    if (this.keys.dx !== 0 || this.keys.dz !== 0) this.log.gesture();
    if (!this.pointer.active) {
      this.target.release();
      return;
    }
    const { view } = this.play.view;
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
    const wanted = this.art.wanted(this.play.view.view.scale);
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

/**
 * Starts the game in a few tasks (the interface, the first hunt's world, its view), the page
 * answering in between: no long task while it starts.
 */
export async function startGame(start: GameStart): Promise<GameApp> {
  const pause = () => nextTask(start.window);
  const game = new GameApp(start);
  await pause();
  await game.open(pause);
  game.run();
  return game;
}
