import type { HuntEvents } from '../../logic/hunt/HuntEvents';
import type { Target } from '../../logic/machine/Target';
import type { Box } from '../../logic/truck/Truck';
import type { View } from '../View';
import { LabelPlacer, type ScreenBox } from './labelPlacement';

/** What the overlay reads of the hunt (never changes it). */
export interface OverlaySource {
  /** The machines on the sand and in the air, with their plate. */
  trucks(): readonly Target[];
  drones(): readonly Target[];
  /** The hero's head (m) and his body's radius: no number covers him. */
  readonly hero: { readonly x: number; readonly z: number; readonly radius: number };
}

export interface CombatOverlayOptions {
  readonly source: OverlaySource;
  readonly events: HuntEvents;
  /** The interface's boxes no number covers (CSS px, from the canvas's corner). */
  readonly keepOut: () => readonly ScreenBox[];
  /** The top of the area numbers may use (CSS px): just under the top row. */
  readonly ceiling: () => number;
}

/** Labels shown at once (numbers and crystals); the oldest gives way. */
const LABELS = 16;
/** A label lives this long (s), rises this far (CSS px), and fades over its last part (s). */
const LIFE_S = 0.95;
const RISE_PX = 30;
const FADE_S = 0.3;
/** A new hit on a machine whose number is this young (s) adds to it: they group. */
const GROUP_S = 0.45;
/** Number sizes (CSS px; 14 px at least, the mockup's 21 and 27), crystals a little bigger. */
const DAMAGE_PX = 21;
const STRONG_PX = 27;
const CRYSTAL_PX = 22;
/** The life bar: its height (CSS px), its width from the zoom, within bounds. */
const BAR_HEIGHT_PX = 6;
const BAR_PER_METRE = 4.5;
const BAR_MIN_PX = 26;
const BAR_MAX_PX = 56;
/** The bar floats this far above the machine's top (m). */
const BAR_ABOVE_M = 1.2;
const MINUS = '−';

const enum Kind {
  Damage = 0,
  Crystals = 1,
}

/**
 * Combat in numbers, drawn over the world: a small life bar over each machine that takes
 * several hits (never on one-bite prey), once touched; a number popping over the machine at
 * every hit (a strong hit bigger, hits close together grouped into one), placed by the rule
 * (above the machine, below the top row, never over Argostos or a button); the crystals a
 * machine gives when it falls. A pool of labels made once: nothing allocated per frame.
 */
export class CombatOverlay {
  private readonly targets = new Int32Array(LABELS).fill(-1);
  private readonly kinds = new Uint8Array(LABELS);
  private readonly amounts = new Float64Array(LABELS);
  private readonly ages = new Float64Array(LABELS).fill(LIFE_S);
  private readonly xs = new Float64Array(LABELS);
  private readonly zs = new Float64Array(LABELS);
  private readonly strong = new Uint8Array(LABELS);
  private readonly texts: string[] = Array.from({ length: LABELS }, () => '');
  private readonly placer = new LabelPlacer();
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private readonly at = { x: 0, y: 0 };
  private readonly head: ScreenBox = { left: 0, top: 0, right: 0, bottom: 0 };
  private readonly keepOut: ScreenBox[] = [];
  /** Boxes of the interface in device px, reused frame after frame. */
  private readonly uiBoxes: ScreenBox[] = Array.from({ length: 6 }, () => ({
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  }));
  private readonly bounds: ScreenBox = { left: 0, top: 0, right: 0, bottom: 0 };
  /** Fonts by size in device px (a handful: made once each). */
  private readonly fonts = new Map<number, string>();
  private next = 0;
  private last = 0;

  constructor(private readonly options: CombatOverlayOptions) {
    options.events.on('hit', ({ targetId, damage, strong, x, z }) => {
      this.addDamage(targetId, { amount: damage, strong }, x, z);
    });
    options.events.on('destroyed', ({ targetId, crystals, x, z }) => {
      this.add(Kind.Crystals, targetId, x, z);
      this.amounts[this.last] = crystals;
      this.texts[this.last] = `+${String(crystals)}`;
    });
  }

  /** Labels alive now (a test's eyes). */
  get labelCount(): number {
    let n = 0;
    for (const age of this.ages) if (age < LIFE_S) n++;
    return n;
  }

  frame(dt: number): void {
    for (let i = 0; i < LABELS; i++) this.ages[i] = Math.min(LIFE_S, this.ages[i]! + dt);
  }

  /** Draws the bars and the labels; `cssPpm` is the zoom, for the bars' width. */
  draw(context: CanvasRenderingContext2D, view: View, cssPpm: number): void {
    context.setTransform(1, 0, 0, 1, 0, 0);
    this.drawBars(context, view, cssPpm);
    this.gatherKeepOut(view);
    for (let i = 0; i < LABELS; i++) if (this.ages[i]! < LIFE_S) this.drawLabel(context, view, i);
    context.globalAlpha = 1;
  }

  private addDamage(
    targetId: number,
    hit: { readonly amount: number; readonly strong: boolean },
    x: number,
    z: number,
  ): void {
    for (let i = 0; i < LABELS; i++) {
      if (this.targets[i] !== targetId || this.kinds[i] !== Kind.Damage) continue;
      if (this.ages[i]! > GROUP_S) continue;
      this.amounts[i] = this.amounts[i]! + hit.amount;
      this.strong[i] = hit.strong || this.strong[i] === 1 ? 1 : 0;
      this.ages[i] = 0;
      this.texts[i] = MINUS + String(this.amounts[i]);
      return;
    }
    this.add(Kind.Damage, targetId, x, z);
    this.amounts[this.last] = hit.amount;
    this.strong[this.last] = hit.strong ? 1 : 0;
    this.texts[this.last] = MINUS + String(hit.amount);
  }

  private add(kind: Kind, targetId: number, x: number, z: number): void {
    let slot = -1;
    for (let i = 0; i < LABELS; i++) {
      if (this.ages[i]! >= LIFE_S) {
        slot = i;
        break;
      }
    }
    if (slot < 0) {
      slot = this.next;
      this.next = (this.next + 1) % LABELS;
    }
    this.kinds[slot] = kind;
    this.targets[slot] = targetId;
    this.ages[slot] = 0;
    this.xs[slot] = x;
    this.zs[slot] = z;
    this.strong[slot] = 0;
    this.last = slot;
  }

  /** A bar over each machine that takes several hits, once touched (none on one-bite prey). */
  private drawBars(context: CanvasRenderingContext2D, view: View, cssPpm: number): void {
    const r = view.pixelRatio;
    const width = Math.min(BAR_MAX_PX, Math.max(BAR_MIN_PX, BAR_PER_METRE * cssPpm)) * r;
    this.drawBarsOf(context, view, this.options.source.trucks(), width);
    this.drawBarsOf(context, view, this.options.source.drones(), width);
  }

  private drawBarsOf(
    context: CanvasRenderingContext2D,
    view: View,
    machines: readonly Target[],
    width: number,
  ): void {
    const r = view.pixelRatio;
    const height = BAR_HEIGHT_PX * r;
    for (const machine of machines) {
      // In the hunt only (not in a takedown, not falling), and once touched.
      if (!machine.row.bar || !machine.hittable || machine.integrity.share >= 1) continue;
      machine.bodyBox(this.box);
      const x = view.screenX((this.box.left + this.box.right) / 2);
      const y = view.screenY(this.box.top + BAR_ABOVE_M);
      const share = machine.integrity.share;
      const left = x - width / 2;
      const pad = 1.5 * r;
      context.fillStyle = 'rgb(12 14 16 / 0.78)';
      context.fillRect(left - pad, y - pad, width + 2 * pad, height + 2 * pad);
      context.fillStyle = share > 0.5 ? '#ffd166' : '#ff8a3d';
      context.fillRect(left, y, width * share, height);
      context.lineWidth = (share === 0 ? 2 : 1) * r;
      context.strokeStyle = share === 0 ? '#ffffff' : 'rgb(255 255 255 / 0.8)';
      context.strokeRect(left - pad, y - pad, width + 2 * pad, height + 2 * pad);
    }
  }

  /** The boxes no number covers this frame, in device px: the hero's head, the interface. */
  private gatherKeepOut(view: View): void {
    const r = view.pixelRatio;
    const { hero } = this.options.source;
    const reach = hero.radius * 2.4 * view.scale;
    const hx = view.screenX(hero.x);
    const hz = view.screenY(hero.z);
    this.head.left = hx - reach;
    this.head.right = hx + reach;
    this.head.top = hz - reach;
    this.head.bottom = hz + reach;
    this.keepOut.length = 0;
    this.keepOut.push(this.head);
    const boxes = this.options.keepOut();
    for (let i = 0; i < boxes.length && i < this.uiBoxes.length; i++) {
      const from = boxes[i]!;
      const to = this.uiBoxes[i]!;
      to.left = from.left * r;
      to.top = from.top * r;
      to.right = from.right * r;
      to.bottom = from.bottom * r;
      this.keepOut.push(to);
    }
    this.bounds.left = view.frameLeftPx;
    this.bounds.right = view.frameRightPx;
    this.bounds.top = this.options.ceiling() * r;
    this.bounds.bottom = view.heightPx;
  }

  private drawLabel(context: CanvasRenderingContext2D, view: View, i: number): void {
    const r = view.pixelRatio;
    const age = this.ages[i]!;
    const crystal = this.kinds[i] === Kind.Crystals;
    const size = (crystal ? CRYSTAL_PX : this.strong[i] === 1 ? STRONG_PX : DAMAGE_PX) * r;
    const pop = age < 0.12 ? 1.25 - (age / 0.12) * 0.25 : 1;
    const text = this.texts[i]!;
    const width = (text.length * 0.62 + 0.5) * size;
    const height = size * 1.15;
    this.placer.place(
      {
        x: view.screenX(this.xs[i]!),
        y: view.screenY(this.zs[i]!) - (age / LIFE_S) * RISE_PX * r - 6 * r,
        width,
        height,
        bounds: this.bounds,
        keepOut: this.keepOut,
      },
      this.at,
    );
    context.globalAlpha = age > LIFE_S - FADE_S ? (LIFE_S - age) / FADE_S : 1;
    context.font = this.font(Math.round(size * pop));
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.lineWidth = 5 * r;
    context.strokeStyle = crystal ? 'rgb(107 44 0 / 0.95)' : 'rgb(90 29 0 / 0.95)';
    context.strokeText(text, this.at.x, this.at.y);
    context.fillStyle = crystal ? '#fff3c8' : '#ffffff';
    context.fillText(text, this.at.x, this.at.y);
  }

  private font(px: number): string {
    let font = this.fonts.get(px);
    if (!font) {
      font = `700 ${String(px)}px system-ui, sans-serif`;
      this.fonts.set(px, font);
    }
    return font;
  }
}
