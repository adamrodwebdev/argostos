import { plainDamage, STRIKE, strikeModeFor, type StrikeMode } from '../../rules/combat';
import type { HuntEvents } from '../hunt/HuntEvents';
import type { Combat } from '../machine/Combat';
import type { Targets } from '../machine/Targets';
import type { Box } from '../truck/Truck';
import type { ActionStrategy } from './HeroActions';
import type { ActingHero } from './RamAction';
import type { Rocks } from './Rocks';

export interface StrikeWorld {
  readonly hero: ActingHero;
  readonly targets: Targets;
  readonly combat: Combat;
  readonly rocks: Rocks;
  readonly events: HuntEvents;
}

/** Rocks leave the jaws this far ahead of the head's centre (in body radii). */
const JAWS_REACH = 1.6;

/**
 * The strike (right click, K, its button): one action whose effect depends on the distance
 * (validated 20 November). A machine within the tail's reach takes a tail slap; farther, a rock
 * is flung at the nearest machine in range, or straight ahead with none. The button's icon
 * follows `mode`.
 */
export class StrikeAction implements ActionStrategy {
  readonly id = 'strike';
  readonly cooldownS = STRIKE.cooldownS;
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };

  constructor(private readonly world: StrikeWorld) {}

  /** What the strike would do now: a tail slap when a machine is within the tail's reach. */
  get mode(): StrikeMode {
    const { hero, targets } = this.world;
    targets.nearest(hero.x, hero.z);
    return strikeModeFor(targets.lastDistance);
  }

  perform(): boolean {
    const { hero, targets, combat, rocks, events } = this.world;
    const target = targets.nearest(hero.x, hero.z);
    const distance = targets.lastDistance;
    const mode = strikeModeFor(distance);
    if (mode === 'tail' && target) {
      combat.hit(target, 'tail', plainDamage('tail'));
      target.bodyBox(this.box);
      events.emit('tailSwept', {
        targetId: target.id,
        x: (this.box.left + this.box.right) / 2,
        z: (this.box.bottom + this.box.top) / 2,
      });
    } else {
      const reach = hero.radius * JAWS_REACH;
      rocks.throwAt(
        hero.x + Math.cos(hero.heading) * reach,
        hero.z + Math.sin(hero.heading) * reach,
        distance <= STRIKE.rockRangeM ? target : null,
        hero.heading,
      );
    }
    events.emit('actionUsed', { action: 'strike', mode, x: hero.x, z: hero.z });
    return true;
  }

  step(): void {
    // A strike is instant: its rocks fly on their own.
  }
}
