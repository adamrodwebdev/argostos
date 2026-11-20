import { describe, expect, test } from 'vitest';
import manifestJson from '../../src/assets/truck/manifest.json';
import { InvalidInput } from '../../src/rules/input';
import { readTruckManifest } from '../../src/rules/truckManifest';

/** A deep copy of the real manifest, as plain data to break field by field. */
function manifest(): Record<string, unknown> {
  return structuredClone(manifestJson);
}

function refusal(value: unknown): string {
  try {
    readTruckManifest(value);
    return 'accepted';
  } catch (error) {
    return error instanceof InvalidInput
      ? `${error.field}: ${error.problem}`
      : `threw ${String(error)}`;
  }
}

describe('readTruckManifest: the sprite sheet is read at the door', () => {
  test('the real manifest gives the truck in metres from its rear hub', () => {
    const { geometry, wheel, sets } = readTruckManifest(manifestJson);
    expect(geometry.wheelbaseM).toBeCloseTo(5.2);
    expect(geometry.wheelRadiusM).toBeCloseTo(1.45);
    expect(geometry.frameLeftM).toBeCloseTo(-3.2615);
    expect(geometry.frameRightM - geometry.frameLeftM).toBeCloseTo(13.09375);
    expect(geometry.frameTopM).toBeCloseTo(4.95);
    expect(wheel).toEqual({ frames: 12, periodDeg: 45, stepDeg: 3.75 });
    expect(sets.map((set) => set.pixelsPerMetre)).toEqual([32, 64]);
    expect(sets[0]?.body.file).toBe('hauler-body-32.webp');
    expect(sets[1]?.frameWidth).toBe(196);
  });

  test.each([
    ['not a record', () => 'manifest'],
    ['an array', () => [manifest()]],
    ['null', () => null],
  ])('%s is refused', (_case, make) => {
    expect(refusal(make())).toMatch(/^manifest: not-a-record$/);
  });

  test('a number given as text is refused', () => {
    const data = manifest();
    (data.frame_m as Record<string, unknown>).left_y = '6.1615';
    expect(refusal(data)).toBe('manifest.frame_m.left_y: not-a-number');
  });

  test('NaN and infinity are refused', () => {
    const data = manifest();
    (data.wheel as Record<string, unknown>).radius_m = Number.NaN;
    expect(refusal(data)).toBe('manifest.wheel.radius_m: not-a-number');
    const other = manifest();
    (other.frame_m as Record<string, unknown>).width = Number.POSITIVE_INFINITY;
    expect(refusal(other)).toBe('manifest.frame_m.width: not-a-number');
  });

  test('a wheel strip of 1.5 frames is refused', () => {
    const data = manifest();
    (data.wheel as Record<string, unknown>).frames = 1.5;
    expect(refusal(data)).toBe('manifest.wheel.frames: not-an-integer');
  });

  test.each([
    '../../index.html',
    'hauler-body-32.png',
    'hauler-body-32.webp?x=1',
    'HAULER-BODY-32.WEBP',
    'hauler-body-128.webp',
  ])('a file name off the pattern (%s) is refused', (name) => {
    const data = manifest();
    const files = data.files as Record<string, Record<string, Record<string, unknown>>>;
    files['32']!.body!.file = name;
    expect(refusal(data)).toBe('manifest.files.32.body.file: bad-format');
  });

  test('a sprite announced over the size limit is refused', () => {
    const data = manifest();
    const files = data.files as Record<string, Record<string, Record<string, unknown>>>;
    files['64']!.wheel_frames!.bytes = 50_000_000;
    expect(refusal(data)).toBe('manifest.files.64.wheel_frames.bytes: out-of-range');
  });

  test('a hub that is not a pair is refused', () => {
    const data = manifest();
    (data.hubs_m as Record<string, unknown>).rear = [2.9];
    expect(refusal(data)).toBe('manifest.hubs_m.rear: not-a-list');
    const three = manifest();
    (three.hubs_m as Record<string, unknown>).front = [1, 2, 3];
    expect(refusal(three)).toBe('manifest.hubs_m.front: too-many');
  });

  test('hubs in the wrong order (no wheelbase) are refused', () => {
    const data = manifest();
    (data.hubs_m as Record<string, unknown>).rear = [-2.3, 1.45];
    expect(refusal(data)).toBe('manifest.hubs_m: out-of-range');
  });

  test('inherited names are never read as fields', () => {
    const data = manifest();
    delete data.wheel;
    expect(refusal(data)).toBe('manifest.wheel: not-a-record');
    const files = manifest().files as Record<string, unknown>;
    const sneaky = Object.create(files) as Record<string, unknown>;
    expect(refusal({ ...manifest(), files: sneaky })).toBe('manifest.files: empty');
  });

  test('no sprite set at all is refused', () => {
    const data = manifest();
    data.files = {};
    expect(refusal(data)).toBe('manifest.files: empty');
  });
});
