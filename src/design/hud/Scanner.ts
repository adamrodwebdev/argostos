import type { Hunt } from '../../logic/hunt/Hunt';
import { EXIT_GROUND } from '../../rules/terrainTraps';
import { ARENA } from '../../rules/world';
import { create } from './dom';
import { icon } from './icons';

/** Icons kept ready for trucks, drones and towers (more than a hunt ever shows at once). */
const TRUCK_MARKS = 12;
const DRONE_MARKS = 3;
const TOWER_MARKS = 2;
/** A mark moves on the strip only when it moved this much (% of the strip): fewer writes. */
const MOVE_PCT = 0.25;

/** Where the camera looks, across the arena (m): the scanner shows its window. */
export interface ViewSpan {
  readonly left: number;
  readonly right: number;
}

/**
 * The arena's scanner in the top row (the mockup's choice over arrows at the edges): the whole
 * arena in a strip, its two striped exits (as wide as the rock under the gates), the window the
 * screen shows, the trucks (with speed lines while they run for an exit), the drones, the
 * drilling towers (dimmed once fallen), and Argostos. Its frame turns cyan while an alarm is
 * up. Marks are made once and moved by their `left` (no element made per frame).
 */
export class Scanner {
  readonly element: HTMLElement;
  private readonly window: HTMLElement;
  private readonly hero: HTMLElement;
  private readonly trucks: HTMLElement[] = [];
  private readonly drones: HTMLElement[] = [];
  private readonly towers: HTMLElement[] = [];
  private readonly lastLeft = new Map<HTMLElement, number>();

  constructor(document: Document, label: string) {
    this.element = create(document, 'div', {
      className: 'g scan',
      attributes: { role: 'img', 'aria-label': label },
    });
    const land = create(document, 'i', { className: 'land' });
    const exitLeft = create(document, 'i', { className: 'exit l' });
    const exitRight = create(document, 'i', { className: 'exit r' });
    // The striped exits are as wide as the rock under the gates.
    for (const exit of [exitLeft, exitRight]) {
      exit.style.width = `${percent(EXIT_GROUND.widthM).toFixed(2)}%`;
    }
    this.window = create(document, 'i', { className: 'win' });
    this.element.append(land, exitLeft, exitRight, this.window);
    for (let i = 0; i < TRUCK_MARKS; i++) {
      const mark = create(document, 'i', { className: 'it m' });
      mark.append(icon(document, 'truck'));
      mark.hidden = true;
      this.trucks.push(mark);
      this.element.append(mark);
    }
    for (let i = 0; i < DRONE_MARKS; i++) {
      const mark = create(document, 'i', { className: 'it d' });
      mark.append(icon(document, 'drone'));
      mark.hidden = true;
      this.drones.push(mark);
      this.element.append(mark);
    }
    for (let i = 0; i < TOWER_MARKS; i++) {
      const mark = create(document, 'i', { className: 'it m t' });
      mark.append(icon(document, 'tower'));
      mark.hidden = true;
      this.towers.push(mark);
      this.element.append(mark);
    }
    this.hero = create(document, 'i', { className: 'it w' });
    this.element.append(this.hero);
  }

  update(hunt: Hunt, span: ViewSpan): void {
    let n = 0;
    for (const truck of hunt.trucks) {
      if (!truck.isDriving || n >= this.trucks.length) continue;
      const mark = this.trucks[n++]!;
      mark.hidden = false;
      this.place(mark, (truck.rig.rearX + truck.rig.frontX) / 2);
      mark.classList.toggle('run', truck.isFleeing && !truck.isTrapped);
      mark.classList.toggle('left', truck.rig.direction === -1);
      mark.classList.toggle('stalled', truck.isStalled);
    }
    for (let i = n; i < this.trucks.length; i++) this.trucks[i]!.hidden = true;
    n = 0;
    for (const drone of hunt.droneList) {
      if (!drone.isFlying || n >= this.drones.length) continue;
      const mark = this.drones[n++]!;
      mark.hidden = false;
      this.place(mark, drone.x);
    }
    for (let i = n; i < this.drones.length; i++) this.drones[i]!.hidden = true;
    n = 0;
    for (const tower of hunt.towerList) {
      if (n >= this.towers.length) break;
      const mark = this.towers[n++]!;
      mark.hidden = false;
      this.place(mark, tower.x);
      mark.classList.toggle('done', tower.fell);
    }
    for (let i = n; i < this.towers.length; i++) this.towers[i]!.hidden = true;
    this.place(this.hero, hunt.hero.x);
    this.hero.classList.toggle('left', Math.cos(hunt.hero.heading) < 0);
    const left = Math.max(0, span.left);
    const right = Math.min(ARENA.widthM, span.right);
    this.window.style.left = `${percent(left).toFixed(1)}%`;
    this.window.style.width = `${Math.max(0, percent(right) - percent(left)).toFixed(1)}%`;
    this.element.classList.toggle('alarm', hunt.alarmed);
  }

  private place(mark: HTMLElement, x: number): void {
    const at = percent(x);
    const last = this.lastLeft.get(mark);
    if (last !== undefined && Math.abs(last - at) < MOVE_PCT) return;
    this.lastLeft.set(mark, at);
    mark.style.left = `${at.toFixed(1)}%`;
  }
}

/** A place in the arena (m) as a share of the strip (%), kept on it. */
function percent(x: number): number {
  return Math.min(100, Math.max(0, (x / ARENA.widthM) * 100));
}
