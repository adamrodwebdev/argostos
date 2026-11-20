import { BREATH } from '../../rules/combat';
import type { HuntEvents } from '../hunt/HuntEvents';
import type { ActionStrategy } from './HeroActions';
import type { ActingHero } from './RamAction';
import type { GlassDome } from './GlassDome';

export interface BreathWorld {
  readonly hero: ActingHero;
  readonly dome: GlassDome;
  readonly events: HuntEvents;
}

/**
 * The breath (Space, the octagon button): Argostos breathes glass and a dome rises over the
 * sand above him, holding the trucks inside. It takes the whole gauge, which fills again as he
 * eats (each machine destroyed gives back its share); it comes full when it unlocks.
 */
export class BreathAction implements ActionStrategy {
  readonly id = 'breath';
  readonly cooldownS = 0;
  private gauge = 1;

  constructor(private readonly world: BreathWorld) {
    world.events.on('destroyed', () => {
      this.gauge = Math.min(1, this.gauge + BREATH.perMachine);
    });
  }

  /** The gauge, from 0 to 1 (full: a dome is ready). */
  get fill(): number {
    return this.gauge;
  }

  perform(): boolean {
    if (this.gauge < 1) return false;
    const { hero, dome, events } = this.world;
    dome.raise(hero.x);
    this.gauge = 0;
    events.emit('actionUsed', { action: 'breath', mode: null, x: hero.x, z: hero.z });
    return true;
  }

  step(): void {
    // The dome stands and shatters on its own.
  }
}
