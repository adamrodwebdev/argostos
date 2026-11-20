import { ACTION_IDS, type ActionId } from '../../rules/combat';
import type { HuntEvents } from '../hunt/HuntEvents';

/** One of the thumb's actions: written once, plugged in by its id. */
export interface ActionStrategy {
  readonly id: ActionId;
  /** Ready again after this long (s); 0: no wait (the breath's gauge limits it instead). */
  readonly cooldownS: number;
  /** Does it now; false when it could not (nothing to do it with): no cooldown then. */
  perform(): boolean;
  /** One step of `dt` seconds after the hero moved (a ram's contacts, for one). */
  step(dt: number): void;
}

/** The actions the player asked for since the last step (a button, a click, a key). */
export class ActionRequests {
  private readonly asked = new Set<ActionId>();

  request(action: ActionId): void {
    this.asked.add(action);
  }

  /** True when `action` was asked; it is then taken off the list. */
  take(action: ActionId): boolean {
    return this.asked.delete(action);
  }

  /** What was not done this step is dropped: a press never fires seconds later. */
  clear(): void {
    this.asked.clear();
  }
}

/**
 * The hero's actions in a hunt: which are unlocked (they arrive one by one over the first
 * hunts), and when each is ready again. Each action is a strategy in a registry by its id.
 */
export class HeroActions {
  private readonly open = new Set<ActionId>();
  private readonly cooling = new Map<ActionId, number>();

  constructor(
    private readonly strategies: ReadonlyMap<ActionId, ActionStrategy>,
    private readonly events: HuntEvents,
  ) {}

  isUnlocked(action: ActionId): boolean {
    return this.open.has(action);
  }

  /** How much of its wait is left, from 0 (ready) to 1 (just used): the button's sweep. */
  cooldownShare(action: ActionId): number {
    const strategy = this.strategies.get(action);
    const left = this.cooling.get(action) ?? 0;
    if (!strategy || strategy.cooldownS <= 0 || left <= 0) return 0;
    return Math.min(1, left / strategy.cooldownS);
  }

  /** Its button appears. */
  unlock(action: ActionId): void {
    if (this.open.has(action) || !this.strategies.has(action)) return;
    this.open.add(action);
    this.events.emit('actionUnlocked', { action });
  }

  /** Does what was asked, of what is unlocked and ready. */
  perform(requests: ActionRequests): void {
    for (const action of ACTION_IDS) {
      if (!requests.take(action) || !this.open.has(action)) continue;
      if ((this.cooling.get(action) ?? 0) > 0) continue;
      const strategy = this.strategies.get(action);
      if (strategy?.perform()) this.cooling.set(action, strategy.cooldownS);
    }
    requests.clear();
  }

  step(dt: number): void {
    for (const [action, left] of this.cooling) this.cooling.set(action, Math.max(0, left - dt));
    for (const strategy of this.strategies.values()) strategy.step(dt);
  }
}
