import type { HuntEvents } from '../../logic/hunt/HuntEvents';
import type { Tower } from '../../logic/tower/Tower';
import { TOWER } from '../../rules/terrainTraps';
import type { Effects } from '../fx/Effects';
import { clipAboveSand } from '../painters/sandClip';
import type { SoundPort } from '../sound/SoundPort';
import type { View } from '../View';

export interface TowerPainterOptions {
  readonly towers: () => readonly Tower[];
  readonly events: HuntEvents;
  readonly effects: Effects;
  readonly sound: SoundPort;
  /** The sand's height under any x (m). */
  readonly ground: (x: number) => number;
}

/** The mast's bottom and top over its deck (m, the mockup's drawing), its joint between. */
const MAST_FOOT = 1.7;
const MAST_TOP = 19.6;
const JOINT = (MAST_FOOT + MAST_TOP) / 2;
const FOOT_HALF = 1.9;
const TOP_HALF = 0.55;
/** Guy cables: from this high on the mast to anchors this far out on the sand (m). */
const CABLE_AT = 12;
const CABLE_OUT = 10;
/** Once down, the mast twists at its joint by this much (radians), over this long (s). */
const BEND = 0.14;
const BEND_S = 0.3;
/** The crash throws dust along the mast at this many places. */
const CRASH_DUST = 6;
const UP = Math.PI / 2;

/**
 * The Company's drilling towers (drawn in code from the mockup until their Blender kit): a deck
 * with its hazard stripes and an empty pump house, a lattice mast with a cyan beacon, held by two
 * guy cables. It leans as the sand gives under it; its cables snap with sparks and a groan as it
 * topples; it twists as it crashes, raising dust along its length, and what sinks into the dunes
 * is cut away at their rim.
 */
export class TowerPainter {
  private readonly emit = { x: 0, z: 0, vx: 0, vz: 0, life: 0 };

  constructor(private readonly options: TowerPainterOptions) {
    const { events } = options;
    events.on('towerToppled', ({ towerId, way }) => {
      const tower = this.find(towerId);
      if (tower) this.snapCables(tower, way);
    });
    events.on('takedownBeat', ({ beat, machine, truckId }) => {
      if (machine !== 'drillTower' || beat !== 'strike') return;
      const tower = this.find(truckId);
      if (tower) this.crashDust(tower);
    });
  }

  draw(context: CanvasRenderingContext2D, view: View): void {
    for (const tower of this.options.towers()) {
      const tipX = tower.x + Math.sin(tower.lean) * (MAST_TOP + 2);
      context.save();
      clipAboveSand(context, view, this.options.ground, {
        left: Math.min(tower.x - TOWER.baseHalfM - CABLE_OUT, tipX - 3),
        right: Math.max(tower.x + TOWER.baseHalfM + CABLE_OUT, tipX + 3),
      });
      if (tower.isStanding) this.drawCables(context, view, tower);
      this.drawTower(context, view, tower);
      context.restore();
    }
  }

  private find(id: number): Tower | undefined {
    return this.options.towers().find((tower) => tower.id === id);
  }

  /** Where a point of the tower (along its mast `up`, across it `side`, m) is in the world. */
  private at(tower: Tower, up: number, side: number): { x: number; z: number } {
    const sin = Math.sin(tower.lean);
    const cos = Math.cos(tower.lean);
    return { x: tower.x + sin * up + cos * side, z: tower.baseZ + cos * up - sin * side };
  }

  private drawCables(context: CanvasRenderingContext2D, view: View, tower: Tower): void {
    const { ground } = this.options;
    context.strokeStyle = 'rgb(40 42 46 / 0.85)';
    context.lineWidth = Math.max(view.pixelRatio, 0.07 * view.scale);
    context.beginPath();
    for (const side of SIDES) {
      const from = this.at(tower, CABLE_AT, side * halfWidthAt(CABLE_AT));
      const anchor = tower.x + side * CABLE_OUT;
      context.moveTo(view.screenX(from.x), view.screenY(from.z));
      context.lineTo(view.screenX(anchor), view.screenY(ground(anchor)));
    }
    context.stroke();
  }

  private drawTower(context: CanvasRenderingContext2D, view: View, tower: Tower): void {
    const s = view.scale;
    context.translate(view.screenX(tower.x), view.screenY(tower.baseZ));
    context.rotate(tower.lean);
    context.scale(s, s);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    // The drill string and the deck's legs go down into the sand.
    stroke(context, DRILL_PEN, [[0, 0, 0, 9]]);
    stroke(context, LEG_PEN, [
      [-3.3, 0, -3.9, 3.2],
      [3.3, 0, 3.9, 3.2],
    ]);
    context.fillStyle = '#5a5f65';
    context.fillRect(-TOWER.baseHalfM, -MAST_FOOT, 2 * TOWER.baseHalfM, MAST_FOOT);
    this.drawStripes(context);
    // The pump house (empty: a dark window) and its cyan strip.
    context.fillStyle = '#c4572a';
    context.fillRect(1.9, -4.8, 2.9, 3.1);
    context.fillStyle = '#18252d';
    context.fillRect(2.25, -4.4, 1.9, 1.25);
    context.fillStyle = '#62e6f2';
    context.fillRect(1.9, -1.95, 2.9, 0.2);
    // The mast, in two halves: down on the dunes it twists at the joint.
    drawMast(context, MAST_FOOT, JOINT);
    const bend = tower.isDown ? BEND * Math.min(1, tower.downSeconds / BEND_S) : 0;
    context.translate(0, -JOINT);
    context.rotate(Math.sign(tower.lean) * bend);
    context.translate(0, JOINT);
    drawMast(context, JOINT, MAST_TOP);
    context.fillStyle = '#9b4b25';
    context.fillRect(-1.15, -20.7, 2.3, 1.2);
    this.drawBeacon(context, tower.isStanding);
  }

  /** The deck's hazard stripes (yellow and black). */
  private drawStripes(context: CanvasRenderingContext2D): void {
    context.save();
    context.beginPath();
    context.rect(-TOWER.baseHalfM, -0.55, 2 * TOWER.baseHalfM, 0.55);
    context.clip();
    for (let i = -6; i < 12; i++) {
      context.fillStyle = i % 2 === 0 ? '#e8a21a' : '#1c1c1c';
      const x = -TOWER.baseHalfM + i * 0.8;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 0.4, -0.55);
      context.lineTo(x + 0.8, -0.55);
      context.lineTo(x + 0.4, 0);
      context.fill();
    }
    context.restore();
  }

  /** The beacon at its top: cyan while it stands, dead once it fell. */
  private drawBeacon(context: CanvasRenderingContext2D, lit: boolean): void {
    if (lit) {
      const glow = context.createRadialGradient(0, -21.2, 0, 0, -21.2, 2.4);
      glow.addColorStop(0, 'rgb(110 240 252 / 0.85)');
      glow.addColorStop(1, 'rgb(110 240 252 / 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(0, -21.2, 2.4, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = lit ? '#d8fcff' : '#3a4044';
    context.beginPath();
    context.arc(0, -21.2, 0.32, 0, Math.PI * 2);
    context.fill();
  }

  /** Its cables snap as it goes: sparks at both ends, steel groaning. */
  private snapCables(tower: Tower, way: 1 | -1): void {
    const { effects, sound, ground } = this.options;
    sound.play('crunch', 0.75);
    sound.play('impact', 0.35);
    for (const side of SIDES) {
      const from = this.at(tower, CABLE_AT, side * halfWidthAt(CABLE_AT));
      const anchor = tower.x + side * CABLE_OUT;
      for (const [x, z] of [
        [from.x, from.z],
        [anchor, ground(anchor) + 0.2],
      ] as const) {
        effects.burst({
          kind: 'spark',
          x,
          z,
          count: 16,
          speed: 7,
          angle: UP - way * 0.4,
          spread: 2.4,
          life: 0.45,
        });
      }
    }
  }

  /** It hits the dunes: dust rises all along it. */
  private crashDust(tower: Tower): void {
    const { effects, ground } = this.options;
    const { emit } = this;
    for (let i = 1; i <= CRASH_DUST; i++) {
      const point = this.at(tower, (MAST_TOP * i) / CRASH_DUST, 0);
      effects.burst({
        kind: 'dust',
        x: point.x,
        z: Math.max(point.z, ground(point.x)),
        count: 10,
        speed: 3,
        angle: UP,
        spread: 2.6,
        life: 1.6,
      });
    }
    emit.x = tower.x;
    emit.z = tower.baseZ;
    emit.vx = 0;
    emit.vz = 1;
    emit.life = 2;
    effects.one('smoke', emit);
  }
}

const SIDES: readonly (1 | -1)[] = [-1, 1];

/** A pen: a colour and a width (m). */
interface Pen {
  readonly colour: string;
  readonly width: number;
}
const DRILL_PEN: Pen = { colour: '#5d6166', width: 0.35 };
const LEG_PEN: Pen = { colour: '#474b50', width: 0.45 };

/** The mast's half-width at `up` m over the deck (it narrows to its top). */
function halfWidthAt(up: number): number {
  const share = (up - MAST_FOOT) / (MAST_TOP - MAST_FOOT);
  return FOOT_HALF + (TOP_HALF - FOOT_HALF) * Math.min(1, Math.max(0, share));
}

/** The mast between `from` and `to` m over the deck: its two legs and the lattice between. */
function drawMast(context: CanvasRenderingContext2D, from: number, to: number): void {
  context.strokeStyle = '#c4572a';
  context.lineWidth = 0.34;
  context.beginPath();
  for (const side of SIDES) {
    context.moveTo(side * halfWidthAt(from), -from);
    context.lineTo(side * halfWidthAt(to), -to);
  }
  context.stroke();
  context.lineWidth = 0.15;
  context.beginPath();
  const rungs = 4;
  for (let i = 0; i <= rungs; i++) {
    const up = from + ((to - from) * i) / rungs;
    const side = i % 2 === 0 ? -1 : 1;
    if (i === 0) context.moveTo(side * halfWidthAt(up), -up);
    else context.lineTo(side * halfWidthAt(up), -up);
  }
  context.stroke();
}

/** Straight strokes with one pen (x0, y0, x1, y1 in the tower's metres). */
function stroke(
  context: CanvasRenderingContext2D,
  pen: Pen,
  lines: readonly (readonly [number, number, number, number])[],
): void {
  context.strokeStyle = pen.colour;
  context.lineWidth = pen.width;
  context.beginPath();
  for (const [x0, y0, x1, y1] of lines) {
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
  }
  context.stroke();
}
