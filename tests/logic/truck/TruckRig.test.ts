import { describe, expect, test } from 'vitest';
import manifestJson from '../../../src/assets/truck/manifest.json';
import { TruckRig } from '../../../src/logic/truck/TruckRig';
import { machineRow } from '../../../src/rules/machines';
import { readTruckManifest } from '../../../src/rules/truckManifest';

const GEOMETRY = readTruckManifest(manifestJson).geometry;
const DT = 1 / 60;
/** The plain hauler's cruising speed (m/s). */
const CRUISE = machineRow('hauler').cruiseSpeed;

/** Sand flat at z = 0, with a mound 1 m high and 6 m wide around x = 30 when asked. */
function sand(mound = false) {
  return {
    heightAt: (x: number) => (mound ? Math.max(0, 1 - Math.abs(x - 30) / 3) : 0),
  };
}

function drive(rig: TruckRig, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) rig.step(CRUISE, DT);
}

describe('TruckRig: the truck rolls on the sand, its wheels never slide', () => {
  test('at rest on flat sand, the hubs are one radius above it', () => {
    const rig = new TruckRig(GEOMETRY, sand(), { x: 0, direction: 1 });
    expect(rig.rearWheelZ).toBeCloseTo(GEOMETRY.wheelRadiusM);
    expect(rig.frontWheelZ).toBeCloseTo(GEOMETRY.wheelRadiusM);
    expect(rig.frontX - rig.rearX).toBeCloseTo(GEOMETRY.wheelbaseM);
  });

  test('it speeds up gently to its cruise and the wheels turn by the distance driven', () => {
    const rig = new TruckRig(GEOMETRY, sand(), { x: 0, direction: 1 });
    drive(rig, 10);
    expect(rig.speed).toBeCloseTo(CRUISE);
    expect(rig.wheelAngle * GEOMETRY.wheelRadiusM).toBeCloseTo(rig.rearX, 6);
  });

  test('driving left, it moves left and its wheels still roll forward', () => {
    const rig = new TruckRig(GEOMETRY, sand(), { x: 100, direction: -1 });
    drive(rig, 5);
    expect(rig.rearX).toBeLessThan(100);
    expect(rig.frontX).toBeLessThan(rig.rearX);
    expect(rig.wheelAngle).toBeGreaterThan(0);
  });

  test('over a mound the body rises, tilts, and settles again on the far side', () => {
    const rig = new TruckRig(GEOMETRY, sand(true), { x: 10, direction: 1 });
    let highest = 0;
    let steepest = 0;
    for (let i = 0; i < 60 * 12; i++) {
      rig.step(CRUISE, DT);
      highest = Math.max(highest, rig.rearHubZ);
      steepest = Math.max(steepest, Math.abs(rig.pitch));
    }
    expect(highest).toBeGreaterThan(GEOMETRY.wheelRadiusM + 0.5);
    expect(steepest).toBeGreaterThan(0.05);
    expect(rig.rearX).toBeGreaterThan(40);
    expect(rig.rearHubZ).toBeCloseTo(GEOMETRY.wheelRadiusM, 1);
    expect(Math.abs(rig.pitch)).toBeLessThan(0.02);
  });
});
