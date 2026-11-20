import { GameView } from '../design/GameView';
import type { ScreenBox } from '../design/hud/labelPlacement';
import type { SoundPort } from '../design/sound/SoundPort';
import type { TruckArt } from '../design/truck/TruckArt';
import { EventBus } from '../logic/EventBus';
import { FixedStepper } from '../logic/FixedStepper';
import { Hunt } from '../logic/hunt/Hunt';
import type { HuntEventMap } from '../logic/hunt/HuntEvents';
import { AutopilotIntent, type Autopilot } from '../logic/input/AutopilotIntent';
import { SapperIntent } from '../logic/input/SapperIntent';
import { IdleIntent, type SteeringIntent } from '../logic/input/Steering';
import { SeededRandom } from '../logic/SeededRandom';
import { TimeScale } from '../logic/TimeScale';
import type { TruckGeometry } from '../rules/truckManifest';
import type { BotStyle } from '../rules/urlOptions';
import type { GridDetail } from '../rules/world';
import { MAX_STEPS_PER_FRAME, STEP_SECONDS } from '../rules/world';

/** What a hunt is played with, besides its number. */
export interface PlaySetup {
  readonly number: number;
  readonly seed: number;
  readonly detail: GridDetail;
  readonly autopilot: boolean;
  /** How the autopilot plays, when it is on. */
  readonly bot: BotStyle;
  readonly truck: TruckGeometry;
  readonly context: CanvasRenderingContext2D;
  readonly art: TruckArt;
  readonly sound: SoundPort;
  readonly reducedMotion: boolean;
  /** The player's steering (the finger, the pointer, the keys). */
  readonly player: SteeringIntent;
  /** The interface's boxes no damage number covers, and the top of their area (CSS px). */
  readonly keepOut: () => readonly ScreenBox[];
  readonly ceiling: () => number;
}

/** A hunt's world and its events, made before its view. */
export interface WorldPart {
  readonly events: EventBus<HuntEventMap>;
  readonly hunt: Hunt;
}

/** A different seed for the effects than the hunt's own: they never touch its chance. */
const EFFECTS_SEED = 0x5eed;
/** Each hunt number has its own desert (the first keeps the URL's seed). */
const SEED_STEP = 7919;
/** The autopilot's ways of playing: one more is one more line here. */
const BOTS: ReadonlyMap<BotStyle, (hunt: Hunt) => Autopilot> = new Map<
  BotStyle,
  (hunt: Hunt) => Autopilot
>([
  ['hunter', (hunt) => new AutopilotIntent(hunt, STEP_SECONDS)],
  ['sapper', (hunt) => new SapperIntent(hunt, STEP_SECONDS)],
]);

/**
 * One hunt being played: its events, the hunt, its view, its fixed steps and its time (held at
 * a bite, slowed for the last prey). Made for each hunt and dropped after it, so nothing of a
 * hunt (a listener, a hit-stop) reaches the next.
 */
export class HuntPlay {
  readonly events: EventBus<HuntEventMap>;
  readonly hunt: Hunt;
  readonly view: GameView;
  readonly time = new TimeScale();
  readonly stepper = new FixedStepper(STEP_SECONDS * 1000, MAX_STEPS_PER_FRAME);
  private readonly autopilot: Autopilot | null;
  private readonly player: SteeringIntent;
  private readonly idle = new IdleIntent();

  /** The hunt's world (its sand, hero, convoys): the longest part, built on its own. */
  static world(setup: PlaySetup): WorldPart {
    const events = new EventBus<HuntEventMap>();
    const hunt = new Hunt({
      seed: HuntPlay.seedOf(setup),
      detail: setup.detail,
      truck: setup.truck,
      events,
      number: setup.number,
    });
    return { events, hunt };
  }

  private static seedOf(setup: PlaySetup): number {
    return (setup.seed + (setup.number - 1) * SEED_STEP) % 2_147_483_647;
  }

  /** The hunt played from its world (`HuntPlay.world`), with its view. */
  constructor(setup: PlaySetup, world: WorldPart) {
    const seed = HuntPlay.seedOf(setup);
    this.events = world.events;
    this.hunt = world.hunt;
    this.autopilot = setup.autopilot ? (BOTS.get(setup.bot)?.(this.hunt) ?? null) : null;
    this.player = setup.player;
    this.view = new GameView({
      context: setup.context,
      hunt: this.hunt,
      events: this.events,
      art: setup.art,
      random: new SeededRandom(seed ^ EFFECTS_SEED),
      reducedMotion: setup.reducedMotion,
      sound: setup.sound,
      time: this.time,
      keepOut: setup.keepOut,
      ceiling: setup.ceiling,
    });
  }

  /** Runs the steps a frame of `huntMs` of the hunt's time owes. */
  advance(huntMs: number): number {
    const steps = this.stepper.advance(huntMs);
    for (let i = 0; i < steps; i++) {
      // Once the hunt is told over, nobody steers: the world goes on behind the end screen.
      if (this.hunt.isOver) {
        this.hunt.step(this.idle);
        continue;
      }
      this.autopilot?.act();
      this.hunt.step(this.autopilot ?? this.player);
    }
    return steps;
  }
}
