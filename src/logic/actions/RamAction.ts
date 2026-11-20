import { RAM, ramDamage } from '../../rules/combat';
import type { HuntEvents } from '../hunt/HuntEvents';
import type { Combat } from '../machine/Combat';
import { distanceToBox } from '../machine/Target';
import type { Targets } from '../machine/Targets';
import type { Box } from '../truck/Truck';
import type { ActionStrategy } from './HeroActions';

/** What the actions know of the hero, and ask of him. */
export interface ActingHero {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  readonly speed: number;
  readonly radius: number;
  boost(speed: number, seconds: number): void;
  recoil(share: number): void;
}

export interface RamWorld {
  readonly hero: ActingHero;
  readonly targets: Targets;
  readonly combat: Combat;
  readonly events: HuntEvents;
}

/** The head's reach (in body radii ahead of its centre) and what a hit leaves of his speed. */
const HEAD_REACH = 1.2;
const RECOIL_KEEP = 0.55;

/**
 * The ram (left click, J, its button): a burst of speed that hits hard. Every machine his head
 * meets while the burst lasts takes a hit, once, harder the faster he goes (a full-speed ram is
 * a strong hit); the impact costs him some speed. Ready again after a short wait.
 */
export class RamAction implements ActionStrategy {
  readonly id = 'ram';
  readonly cooldownS = RAM.cooldownS;
  private left = 0;
  private readonly struck = new Set<number>();
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };

  constructor(private readonly world: RamWorld) {}

  perform(): boolean {
    const { hero, events } = this.world;
    hero.boost(RAM.speed, RAM.seconds);
    this.left = RAM.seconds;
    this.struck.clear();
    events.emit('actionUsed', { action: 'ram', mode: null, x: hero.x, z: hero.z });
    return true;
  }

  step(dt: number): void {
    if (this.left <= 0) return;
    this.left -= dt;
    const { hero, targets, combat } = this.world;
    const reach = hero.radius * HEAD_REACH;
    const hx = hero.x + Math.cos(hero.heading) * reach;
    const hz = hero.z + Math.sin(hero.heading) * reach;
    for (const target of targets.all) {
      if (this.struck.has(target.id)) continue;
      target.bodyBox(this.box);
      if (distanceToBox(hx, hz, this.box) > hero.radius) continue;
      this.struck.add(target.id);
      combat.hit(target, 'ram', ramDamage(hero.speed));
      hero.recoil(RECOIL_KEEP);
    }
  }
}
