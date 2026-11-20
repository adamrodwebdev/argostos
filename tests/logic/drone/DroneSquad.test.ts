import { describe, expect, test } from 'vitest';
import { DroneSquad } from '../../../src/logic/drone/DroneSquad';
import { plainDamage } from '../../../src/rules/combat';
import { bodyHp, machineRow } from '../../../src/rules/machines';
import { NOISE_RINGS, SONAR } from '../../../src/rules/sonar';
import { STEP_SECONDS } from '../../../src/rules/world';
import { arena, AWAY } from '../arena';

function squad(seed: number) {
  const world = arena(seed);
  const drones = new DroneSquad({
    surface: world.surface,
    events: world.events,
    thrower: world.thrower,
    combat: world.combat,
    stepSeconds: STEP_SECONDS,
  });
  const spotted: number[] = [];
  world.events.on('spotted', ({ droneId }) => spotted.push(droneId));
  return { world, drones, spotted };
}

describe('DroneSquad: the sonar hears a loud hero, never a quiet one', () => {
  test('a quiet hero swims right under a drone unheard', () => {
    const { drones, spotted } = squad(31);
    drones.send({ atS: 0, x: 80, spanM: 10 });
    const drone = drones.all[0]!;
    for (let i = 0; i < 60 * 5; i++) {
      drones.step({ x: drone.x, z: drone.sonarZ - 4, noise: NOISE_RINGS.quietBelow - 0.01 }, AWAY);
    }
    expect(spotted).toEqual([]);
    expect(drones.spotted).toBe(false);
  });

  test('a loud hero within reach is spotted once, and the drone follows him', () => {
    const { drones, spotted } = squad(32);
    drones.send({ atS: 0, x: 80, spanM: 10 });
    const drone = drones.all[0]!;
    const hero = { x: 80 + SONAR.rangeM, z: drone.sonarZ - 2, noise: 1 };
    for (let i = 0; i < 60 * 4; i++) drones.step(hero, AWAY);
    expect(spotted).toEqual([drone.id]);
    expect(drone.isMarking).toBe(true);
    expect(Math.abs(drone.x - hero.x)).toBeLessThan(1);
  });

  test('a loud hero far from every drone stays unheard', () => {
    const { drones, spotted } = squad(33);
    drones.send({ atS: 0, x: 40, spanM: 5 });
    const hero = { x: 140, z: -10, noise: 1 };
    for (let i = 0; i < 60 * 3; i++) drones.step(hero, AWAY);
    expect(spotted).toEqual([]);
  });
});

describe('DroneSquad: a drone brought down falls into the sand', () => {
  test('rocks take its plate; at zero it falls, crashes and gives its crystals', () => {
    const { world, drones } = squad(34);
    const crystals: number[] = [];
    world.events.on('destroyed', ({ crystals: gained }) => crystals.push(gained));
    drones.send({ atS: 0, x: 80, spanM: 10 });
    const drone = drones.all[0]!;
    const rocks = Math.ceil(bodyHp(machineRow('drone')) / plainDamage('rock').amount);
    for (let i = 0; i < rocks; i++) world.combat.hit(drone, 'rock', plainDamage('rock'));
    expect(drone.isFalling).toBe(true);
    for (let i = 0; i < 60 * 4 && drones.all.length > 0; i++) {
      drones.step({ x: 0, z: -20, noise: 0 }, AWAY);
    }
    expect(drones.all).toHaveLength(0);
    expect(crystals).toEqual([machineRow('drone').crystals]);
  });

  test('a leaping bite that reaches a drone brings it down at once', () => {
    const { drones } = squad(35);
    drones.send({ atS: 0, x: 80, spanM: 10 });
    const drone = drones.all[0]!;
    drones.step({ x: 80, z: -20, noise: 0 }, { x: drone.x, z: drone.z - 0.8, heading: 1.5 });
    expect(drone.isFalling).toBe(true);
  });
});
