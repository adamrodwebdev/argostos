import type { Damage, HitKind } from '../../rules/combat';
import type { HuntEvents } from '../hunt/HuntEvents';
import type { Box } from '../truck/Truck';
import type { Target } from './Target';

/**
 * Takes plate off the machines: every hit (bite, ram, tail, rock) goes through here, so its
 * number, its alarm (a convoy that flees when one of it is hit listens for it) and the moment a
 * machine gives out are told the same way, whatever hit it.
 */
export class Combat {
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };

  constructor(private readonly events: HuntEvents) {}

  /**
   * `target` takes a hit of `kind`. A machine out of the hunt, or already at zero (stalled,
   * waiting for the bite that finishes it), takes nothing.
   */
  hit(target: Target, kind: HitKind, damage: Damage): void {
    if (!target.hittable || target.integrity.spent || damage.amount <= 0) return;
    target.integrity.take(damage.amount);
    target.bodyBox(this.box);
    const x = (this.box.left + this.box.right) / 2;
    this.events.emit('hit', {
      targetId: target.id,
      machine: target.machine,
      kind,
      damage: damage.amount,
      strong: damage.strong,
      x,
      z: this.box.top,
      waveId: target.waveId,
    });
    // Still standing: the hit only took plate off.
    if (target.integrity.hp > 0) return;
    target.giveOut();
    this.events.emit('gaveOut', {
      targetId: target.id,
      machine: target.machine,
      x,
      z: (this.box.bottom + this.box.top) / 2,
    });
  }
}
