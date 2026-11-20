import { describe, expect, test } from 'vitest';
import { BreathAction } from '../../../src/logic/actions/BreathAction';
import {
  ActionRequests,
  HeroActions,
  type ActionStrategy,
} from '../../../src/logic/actions/HeroActions';
import { RamAction, type ActingHero } from '../../../src/logic/actions/RamAction';
import { Rocks } from '../../../src/logic/actions/Rocks';
import { StrikeAction } from '../../../src/logic/actions/StrikeAction';
import type { HitEvent } from '../../../src/logic/hunt/HuntEvents';
import { Targets } from '../../../src/logic/machine/Targets';
import type { Box } from '../../../src/logic/truck/Truck';
import { BREATH, hitRow, RAM, ramDamage, STRIKE, type ActionId } from '../../../src/rules/combat';
import { ARENA, STEP_SECONDS } from '../../../src/rules/world';
import { arena, wave } from '../arena';

/** A hero the actions can push around: where he is, where he heads, how fast. */
class StandIn implements ActingHero {
  speed = 0;
  readonly radius = 0.9;
  constructor(
    public x: number,
    public z: number,
    public heading = 0,
  ) {}
  boost(speed: number): void {
    this.speed = Math.max(this.speed, speed);
  }
  recoil(share: number): void {
    this.speed *= share;
  }
}

/** The fleet's world with one truck, the actions over it, and a hero standing in. */
function scene(
  hero: StandIn,
  machines: Parameters<typeof wave>[0]['machines'] = ['armoredHauler'],
) {
  const world = arena(21);
  world.fleet.sendWave(wave({ machines, x: 70 }), 0);
  const targets = new Targets([() => world.fleet.all]);
  targets.refresh();
  const rocks = new Rocks(4, {
    surface: world.surface,
    targets,
    combat: world.combat,
    events: world.events,
    stepSeconds: STEP_SECONDS,
    minX: -20,
    maxX: ARENA.widthM + 20,
    bottomZ: -48,
  });
  const acting = { hero, targets, combat: world.combat, events: world.events };
  const ram = new RamAction(acting);
  const strike = new StrikeAction({ ...acting, rocks });
  const breath = new BreathAction({ hero, dome: world.dome, events: world.events });
  const actions = new HeroActions(
    new Map<ActionId, ActionStrategy>([
      ['ram', ram],
      ['strike', strike],
      ['breath', breath],
    ]),
    world.events,
  );
  const hits: HitEvent[] = [];
  world.events.on('hit', (event) => hits.push(event));
  const requests = new ActionRequests();
  const press = (action: 'ram' | 'strike' | 'breath') => {
    requests.request(action);
    actions.perform(requests);
  };
  const step = () => {
    targets.refresh();
    actions.step(STEP_SECONDS);
    rocks.step();
    world.tick();
  };
  const truck = world.fleet.all[0]!;
  const box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  truck.bodyBox(box);
  return { world, actions, ram, strike, breath, rocks, hits, press, step, truck, box };
}

describe('HeroActions: the actions arrive one by one, each with its wait', () => {
  test('a locked action does nothing; once unlocked (told once) it works', () => {
    const hero = new StandIn(20, -5);
    const { world, actions, press } = scene(hero);
    const unlocked: string[] = [];
    world.events.on('actionUnlocked', ({ action }) => unlocked.push(action));
    press('ram');
    expect(hero.speed).toBe(0);
    actions.unlock('ram');
    actions.unlock('ram');
    expect(unlocked).toEqual(['ram']);
    press('ram');
    expect(hero.speed).toBe(RAM.speed);
  });

  test('the ram waits its cooldown before it works again; its sweep goes from 1 to 0', () => {
    const hero = new StandIn(20, -5);
    const { actions, press, step } = scene(hero);
    actions.unlock('ram');
    press('ram');
    expect(actions.cooldownShare('ram')).toBe(1);
    hero.speed = 0;
    press('ram');
    expect(hero.speed).toBe(0);
    for (let i = 0; i < Math.round(RAM.cooldownS / STEP_SECONDS / 2); i++) step();
    expect(actions.cooldownShare('ram')).toBeCloseTo(0.5, 1);
    for (let i = 0; i < Math.round(RAM.cooldownS / STEP_SECONDS / 2) + 1; i++) step();
    expect(actions.cooldownShare('ram')).toBe(0);
    press('ram');
    expect(hero.speed).toBe(RAM.speed);
  });
});

describe('RamAction: a burst that hits hard', () => {
  test('his head meeting a machine during the burst hits it once, a strong hit at full speed', () => {
    const hero = new StandIn(0, 0);
    const { actions, press, step, hits, box } = scene(hero);
    hero.x = box.left - 1.5;
    hero.z = (box.bottom + box.top) / 2;
    actions.unlock('ram');
    press('ram');
    const speed = hero.speed;
    for (let i = 0; i < 10; i++) {
      hero.x += 0.3;
      step();
    }
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: 'ram', ...asHit(ramDamage(speed)) });
    expect(hits[0]?.strong).toBe(true);
    expect(hero.speed).toBeLessThan(speed);
  });
});

describe('StrikeAction: one button, a tail up close and a rock at range', () => {
  test('up close it is a tail slap that takes the tail’s plate', () => {
    const hero = new StandIn(0, 0);
    const { actions, strike, press, hits, box } = scene(hero);
    hero.x = (box.left + box.right) / 2;
    hero.z = box.bottom - STRIKE.tailRangeM + 1;
    expect(strike.mode).toBe('tail');
    actions.unlock('strike');
    press('strike');
    expect(hits.map((hit) => [hit.kind, hit.damage])).toEqual([['tail', hitRow('tail').damage]]);
  });

  test('at range it flings a rock that flies to the machine and hits it', () => {
    const hero = new StandIn(0, 0);
    const { actions, strike, press, step, hits, box } = scene(hero);
    hero.x = (box.left + box.right) / 2 - 20;
    hero.z = -6;
    expect(strike.mode).toBe('rock');
    actions.unlock('strike');
    press('strike');
    expect(hits).toEqual([]);
    for (let i = 0; i < 90 && hits.length === 0; i++) step();
    expect(hits.map((hit) => [hit.kind, hit.damage])).toEqual([['rock', hitRow('rock').damage]]);
  });

  test('with nothing in range the rock flies straight ahead and lands in the sand', () => {
    const hero = new StandIn(20, -2, 0.3);
    const { world, actions, press, step, hits, box } = scene(hero);
    expect(box.left - hero.x).toBeGreaterThan(STRIKE.rockRangeM);
    const landed: number[] = [];
    world.events.on('rockLanded', ({ x }) => landed.push(x));
    actions.unlock('strike');
    press('strike');
    for (let i = 0; i < 180; i++) step();
    expect(hits).toEqual([]);
    expect(landed).toHaveLength(1);
    expect(landed[0]).toBeGreaterThan(hero.x);
  });
});

describe('BreathAction: the glass dome, from a gauge that fills by eating', () => {
  test('it comes full: a dome rises over the sand above him and holds the trucks under it', () => {
    const hero = new StandIn(0, -6);
    const { world, actions, breath, press, step, truck, box } = scene(hero, ['hauler']);
    hero.x = (box.left + box.right) / 2;
    actions.unlock('breath');
    expect(breath.fill).toBe(1);
    press('breath');
    expect(world.dome.isStanding).toBe(true);
    expect(world.dome.x).toBeCloseTo(hero.x);
    expect(breath.fill).toBe(0);
    for (let i = 0; i < 30; i++) step();
    expect(truck.isTrapped).toBe(true);
  });

  test('an empty gauge breathes nothing; each machine eaten gives back its share', () => {
    const hero = new StandIn(40, -6);
    const { world, actions, breath, press } = scene(hero);
    actions.unlock('breath');
    press('breath');
    world.dome.step(BREATH.domeFormS + BREATH.domeHoldS + 1);
    press('breath');
    expect(world.dome.isStanding).toBe(false);
    const eaten = { targetId: 1, machine: 'hauler', crystals: 8, x: 0, z: 0 } as const;
    world.events.emit('destroyed', eaten);
    expect(breath.fill).toBe(BREATH.perMachine);
    world.events.emit('destroyed', eaten);
    expect(breath.fill).toBe(1);
  });
});

function asHit(damage: { amount: number; strong: boolean }) {
  return { damage: damage.amount, strong: damage.strong };
}
