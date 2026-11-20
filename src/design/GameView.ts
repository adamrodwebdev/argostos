import type { Hunt } from '../logic/hunt/Hunt';
import type { HuntEvents } from '../logic/hunt/HuntEvents';
import type { Box } from '../logic/truck/Truck';
import type { RandomSource } from '../rules/random';
import { Camera, type Followed } from './Camera';
import { Effects } from './fx/Effects';
import { FireSources } from './fx/FireSources';
import { HeroPainter } from './hero/HeroPainter';
import { BackdropPainter } from './painters/BackdropPainter';
import { SandPainter } from './painters/SandPainter';
import { SprayPainter } from './painters/SprayPainter';
import { SIDE_SHADE } from './palette';
import type { SoundPort } from './sound/SoundPort';
import { TakedownEffects, type TimeControl } from './takedown/TakedownEffects';
import type { TruckArt } from './truck/TruckArt';
import { TruckPainter } from './truck/TruckPainter';
import { View, type ViewLayout } from './View';

export interface GameViewOptions {
  readonly context: CanvasRenderingContext2D;
  readonly hunt: Hunt;
  readonly events: HuntEvents;
  readonly art: TruckArt;
  /** Chance for the cosmetic effects only (never the hunt's own). */
  readonly random: RandomSource;
  readonly reducedMotion: boolean;
  readonly sound: SoundPort;
  /** The hunt's time: held at a bite, slowed for a hunt's last prey. */
  readonly time: TimeControl;
}

/**
 * One frame to draw: the canvas's layout, the blend between the last two steps, and two times:
 * the real one (the camera, which keeps moving in a hit-stop) and the hunt's (the effects).
 */
export interface ViewFrame {
  readonly layout: ViewLayout;
  readonly blend: number;
  readonly realDt: number;
  readonly huntDt: number;
}

/** Prey this close to his jaws (m) makes them open wide. */
const JAWS_SENSE_M = 7;

/**
 * Draws a hunt: the camera frames the hero, then the sky and far dunes, the sand, the trucks
 * and their wrecks, the hero, the thrown sand and the effects. Actors stay inside the playing
 * frame (2:1 at most); beyond it the art goes on, dimmed. It listens to the hunt's events for
 * its effects and sounds, and decides nothing in the hunt.
 */
export class GameView {
  readonly view = new View();
  private readonly camera: Camera;
  private readonly backdrop: BackdropPainter;
  private readonly sand: SandPainter;
  private readonly spray: SprayPainter;
  private readonly hero: HeroPainter;
  private readonly trucks: TruckPainter;
  private readonly effects: Effects;
  private readonly fires: FireSources;
  private readonly takedowns: TakedownEffects;
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private readonly ground: (x: number) => number;
  private readonly focus = { x: 0, z: 0, velocityX: 0, velocityZ: 0, takedown: true };

  constructor(private readonly options: GameViewOptions) {
    const { hunt, random, reducedMotion, events } = options;
    this.ground = (x) => hunt.surface.heightAt(x);
    this.camera = new Camera({ view: this.view, bottomZ: hunt.measures.bottomZ, reducedMotion });
    this.backdrop = new BackdropPainter(hunt.profile, hunt.measures);
    this.sand = new SandPainter(hunt.grid, hunt.measures);
    this.spray = new SprayPainter(hunt.spray, hunt.measures.cellM);
    this.hero = new HeroPainter(hunt.hero);
    this.effects = new Effects(random, reducedMotion);
    this.fires = new FireSources(this.effects, random);
    this.trucks = new TruckPainter({
      art: options.art,
      trucks: () => hunt.trucks,
      wreckage: hunt.wreckage,
      ground: this.ground,
      effects: this.effects,
      random,
    });
    // Each takedown beat's look, sound and feel.
    this.takedowns = new TakedownEffects({
      events,
      effects: this.effects,
      fires: this.fires,
      camera: this.camera,
      time: options.time,
      sound: options.sound,
      ground: this.ground,
    });
    events.on('truckCaught', () => {
      this.hero.jaws.snap();
    });
    events.on('breach', () => {
      this.camera.jolt(0.2);
    });
    events.on('dive', () => {
      this.camera.jolt(0.1);
    });
  }

  /** Particles alive now (the debug readout), and the takedown effects (for a test's eyes). */
  get particleCount(): number {
    return this.effects.count;
  }
  get takedownEffects(): TakedownEffects {
    return this.takedowns;
  }

  render(frame: ViewFrame): void {
    const { context, hunt } = this.options;
    const { layout, blend, realDt, huntDt } = frame;
    const { view } = this;
    this.camera.frame(this.framed(), layout, realDt);
    this.sand.refresh();
    this.effects.step(huntDt, this.ground);
    this.fires.step(huntDt, hunt);
    this.trucks.frame(huntDt);
    this.hero.frame(huntDt, this.eagerness());
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    this.backdrop.draw(context, view);
    this.sand.draw(context, view);
    context.save();
    context.beginPath();
    context.rect(view.frameLeftPx, 0, view.frameRightPx - view.frameLeftPx, view.heightPx);
    context.clip();
    this.trucks.draw(context, view, blend);
    this.hero.draw(context, view, blend);
    this.spray.draw(context, view);
    this.effects.draw(context, view);
    context.restore();
    this.shadeSides(context);
  }

  /**
   * What the camera frames: the hero, or, while a takedown plays, the wreck mid-screen with the
   * sky above it for what it throws, the hero beside it (the moment stays on screen while he
   * dives away with it).
   */
  private framed(): Followed {
    const { hero, trucks } = this.options.hunt;
    const caught = trucks.find((truck) => truck.isCaught);
    if (!caught) return hero;
    const focus = this.focus;
    focus.x = (hero.x + caught.wreck.x) / 2;
    focus.z = caught.wreck.z;
    return focus;
  }

  /** How keen his jaws are: prey near them, or a leap on the way up. */
  private eagerness(): number {
    const { hero } = this.options.hunt;
    const reach = hero.radius * 1.6;
    const jx = hero.x + Math.cos(hero.heading) * reach;
    const jz = hero.z + Math.sin(hero.heading) * reach;
    let eager = hero.medium === 'air' && hero.velocityZ > 0 ? 0.7 : 0;
    for (const truck of this.options.hunt.trucks) {
      if (!truck.isDriving) continue;
      truck.bodyBox(this.box);
      const dx = Math.max(this.box.left - jx, 0, jx - this.box.right);
      const dz = Math.max(this.box.bottom - jz, 0, jz - this.box.top);
      eager = Math.max(eager, 1 - Math.hypot(dx, dz) / JAWS_SENSE_M);
    }
    return eager;
  }

  /** Beyond a 2:1 frame: the art, dimmed toward the screen's edges. */
  private shadeSides(context: CanvasRenderingContext2D): void {
    const { view } = this;
    const left = view.frameLeftPx;
    const right = view.frameRightPx;
    if (left <= 0) return;
    for (const [from, to] of [
      [left, 0],
      [right, view.widthPx],
    ] as const) {
      const gradient = context.createLinearGradient(from, 0, to, 0);
      gradient.addColorStop(0, SIDE_SHADE[0]);
      gradient.addColorStop(1, SIDE_SHADE[1]);
      context.fillStyle = gradient;
      context.fillRect(Math.min(from, to), 0, Math.abs(to - from), view.heightPx);
    }
  }
}
