import { machineRow, type MachineRow } from '../../rules/machines';
import { pastLimit, TOWER } from '../../rules/terrainTraps';
import type { Integrity } from '../machine/Integrity';
import { MachineParts } from '../machine/MachineParts';
import type { Target } from '../machine/Target';
import type { SandSurface } from '../sand/GridSurface';
import type { Box } from '../truck/Truck';

type TowerState = 'standing' | 'toppling' | 'down' | 'gone';

/** What a tower's step brought: nothing, its topple, its crash on the sand, its burial. */
export type TowerMoment = 'none' | 'topples' | 'crashes' | 'buried';

/** Down on the sand when it lies this close to flat (radians). */
const LYING = (84 * Math.PI) / 180;

/**
 * A drilling tower of the Company (no one in it): it stands on a wide base on the sand, and the
 * sand decides how it stands. Undermined, the sand under one side of its base drops: it leans
 * that way and settles lower; past its limit it topples, crashes on the dunes and sinks into
 * them. A machine with plate too: brought to zero by the hero's hits, it topples as well.
 */
export class Tower implements Target {
  readonly machine = 'drillTower';
  readonly row: MachineRow = machineRow('drillTower');
  readonly waveId = -1;
  readonly velocityX = 0;
  readonly parts: MachineParts;
  readonly integrity: Integrity;
  private state: TowerState = 'standing';
  private leaning = 0;
  /** The sand it was built on, under its two sides and its middle (m), and its base then. */
  private readonly builtOn: readonly [number, number, number];
  private readonly builtBase: number;
  private base: number;
  private spin = 0;
  private down = 0;
  /** It began to topple since its last step (told once by the next). */
  private toppledNow = false;

  constructor(
    readonly id: number,
    readonly x: number,
    private readonly surface: SandSurface,
  ) {
    this.parts = new MachineParts(this.row.parts);
    this.integrity = this.parts.body.integrity;
    this.builtOn = [this.sandAt(-1), this.sandAt(0), this.sandAt(1)];
    this.builtBase = Math.min(...this.builtOn);
    this.base = this.builtBase;
  }

  /** How far it leans (radians, positive toward +x). */
  get lean(): number {
    return this.leaning;
  }
  /** The height of its base on the sand (m). */
  get baseZ(): number {
    return this.base;
  }
  get hittable(): boolean {
    return this.state === 'standing';
  }
  get isStanding(): boolean {
    return this.state === 'standing';
  }
  /** Down on the dunes, sinking. */
  get isDown(): boolean {
    return this.state === 'down';
  }
  get isGone(): boolean {
    return this.state === 'gone';
  }
  /** It fell (toppling, down, or gone). */
  get fell(): boolean {
    return this.state !== 'standing';
  }
  /** Seconds since it crashed on the dunes (0 before). */
  get downSeconds(): number {
    return this.down;
  }

  /** The box round its mast as it leans (m). */
  bodyBox(out: Box): void {
    const top = TOWER.heightM;
    const sin = Math.sin(this.leaning);
    const cos = Math.cos(this.leaning);
    const tipX = this.x + sin * top;
    out.left = Math.min(this.x - TOWER.baseHalfM, tipX - 1);
    out.right = Math.max(this.x + TOWER.baseHalfM, tipX + 1);
    out.bottom = this.base;
    out.top = this.base + Math.max(1.5, cos * top);
  }

  /** Its plate is gone: it topples the way it leans. */
  giveOut(): void {
    if (this.state === 'standing') this.topple();
  }

  /** One step of `dt` seconds: it stands as the sand lets it, or falls. */
  step(dt: number): TowerMoment {
    if (this.state === 'standing') this.stand(dt);
    if (this.toppledNow) {
      this.toppledNow = false;
      return 'topples';
    }
    if (this.state === 'toppling') return this.fall(dt);
    if (this.state === 'down') return this.sink(dt);
    return 'none';
  }

  /**
   * It settles on what holds its base: built level on the dunes, it leans toward the side whose
   * sand dropped since, and sinks as deep as the lowest drop (sand piled against it holds
   * nothing up).
   */
  private stand(dt: number): void {
    const [left0, middle0, right0] = this.builtOn;
    const left = Math.min(0, this.sandAt(-1) - left0);
    const middle = Math.min(0, this.sandAt(0) - middle0);
    const right = Math.min(0, this.sandAt(1) - right0);
    const settle = 1 - Math.exp(-TOWER.settle * dt);
    const lean = Math.atan2(left - right, 2 * TOWER.baseHalfM);
    this.leaning += (lean - this.leaning) * settle;
    this.base += (this.builtBase + Math.min(left, middle, right) - this.base) * settle;
    if (pastLimit(this.leaning, TOWER.tipDeg)) this.topple();
  }

  private topple(): void {
    this.state = 'toppling';
    this.toppledNow = true;
    if (this.leaning === 0) this.leaning = 0.01;
  }

  /** Toppling: it falls faster and faster, until it lies on the dunes. */
  private fall(dt: number): TowerMoment {
    const way = Math.sign(this.leaning);
    this.spin += way * TOWER.toppleGravity * Math.max(0.15, Math.abs(Math.sin(this.leaning))) * dt;
    this.leaning += this.spin * dt;
    if (Math.abs(this.leaning) < LYING) return 'none';
    this.leaning = way * LYING;
    this.state = 'down';
    return 'crashes';
  }

  /** Down: the moving ground swallows it. */
  private sink(dt: number): TowerMoment {
    this.down += dt;
    this.base -= TOWER.sinkSpeed * dt;
    if (this.down < TOWER.buriedAfterS) return 'none';
    this.state = 'gone';
    return 'buried';
  }

  /** The sand's height under its left side (−1), its middle (0) or its right side (1). */
  private sandAt(side: -1 | 0 | 1): number {
    return this.surface.heightAt(this.x + side * TOWER.baseHalfM);
  }
}
