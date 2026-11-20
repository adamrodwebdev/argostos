import { InputRecord, InvalidInput, readNumber } from './input';

/*
 * The truck's sprite sheet, as Blender wrote it (manifest.json beside the sprites): the frame
 * the sprites cover, the hubs, the wheel and the files at each scale. Read field by field at the
 * door, own fields only, every number finite and in range, every file name on a pattern.
 */

/** The truck in metres, seen from its left, driving right, measured from its rear hub. */
export interface TruckGeometry {
  /** Distance between the two hubs. */
  readonly wheelbaseM: number;
  readonly wheelRadiusM: number;
  /** The sprite frame's edges, from the rear hub (negative: behind it, or below it). */
  readonly frameLeftM: number;
  readonly frameRightM: number;
  readonly frameTopM: number;
  readonly frameBottomM: number;
}

/** The wheel's strip of rendered frames: the light stays put while the rim turns. */
export interface WheelStrip {
  readonly frames: number;
  /** The wheel looks the same every `periodDeg` (its lugs); a frame every `stepDeg`. */
  readonly periodDeg: number;
  readonly stepDeg: number;
}

export interface SpriteFile {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

/** The sprites at one scale (pixels per metre). */
export interface SpriteSet {
  readonly pixelsPerMetre: number;
  readonly body: SpriteFile;
  readonly wheelFrames: SpriteFile;
  /** Width of one frame of the wheel strip (px). */
  readonly frameWidth: number;
}

export interface TruckManifest {
  readonly geometry: TruckGeometry;
  readonly wheel: WheelStrip;
  /** Smallest scale first. */
  readonly sets: readonly SpriteSet[];
}

/** A sprite file's largest size (bytes), checked again on the file itself when it is fetched. */
export const SPRITE_MAX_BYTES = 1_048_576;
const FILE_NAME = /^hauler-(?:body|wheel-frames)-(?:32|64)\.webp$/;
const SCALES: readonly (readonly [key: string, pixelsPerMetre: number])[] = [
  ['32', 32],
  ['64', 64],
];
const PIXELS = { min: 1, max: 8192, integer: true } as const;

function metres(min: number, max: number) {
  return { min, max } as const;
}

/** A hub's [y, z] (m): y along the truck (screen right is −y), z its height. */
function readHub(hubs: InputRecord, key: 'front' | 'rear'): readonly [number, number] {
  const field = `manifest.hubs_m.${key}`;
  const pair = hubs.list(key, {
    maxItems: 2,
    item: (item, path) => readNumber(item, metres(-50, 50), path),
  });
  const [y, z] = pair;
  if (y === undefined || z === undefined) throw new InvalidInput(field, 'not-a-list');
  if (z < 0 || z > 20) throw new InvalidInput(`${field}[1]`, 'out-of-range');
  return [y, z];
}

function readFile(record: InputRecord): SpriteFile {
  return {
    file: record.text('file', { maxLength: 40, required: true, pattern: FILE_NAME }),
    width: record.number('w', PIXELS),
    height: record.number('h', PIXELS),
    bytes: record.number('bytes', { min: 1, max: SPRITE_MAX_BYTES, integer: true }),
  };
}

/** Reads the manifest (already parsed JSON); throws `InvalidInput` naming the bad field. */
export function readTruckManifest(value: unknown): TruckManifest {
  const root = InputRecord.from(value, 'manifest');
  const frame = root.record('frame_m');
  const hubs = root.record('hubs_m');
  const wheel = root.record('wheel');
  const files = root.record('files');
  const leftY = frame.number('left_y', metres(-50, 50));
  const topZ = frame.number('top_z', metres(0, 50));
  const width = frame.number('width', metres(0.5, 100));
  const height = frame.number('height', metres(0.5, 100));
  const [frontY] = readHub(hubs, 'front');
  const [rearY, hubZ] = readHub(hubs, 'rear');
  if (!(rearY - frontY > 0.5)) throw new InvalidInput('manifest.hubs_m', 'out-of-range');
  const sets: SpriteSet[] = [];
  for (const [key, pixelsPerMetre] of SCALES) {
    if (!files.has(key)) continue;
    const set = files.record(key);
    const strip = set.record('wheel_frames');
    sets.push({
      pixelsPerMetre,
      body: readFile(set.record('body')),
      wheelFrames: readFile(strip),
      frameWidth: strip.number('frame_w', PIXELS),
    });
  }
  if (sets.length === 0) throw new InvalidInput('manifest.files', 'empty');
  // The frame's left edge is the truck's rear end: screen right is −y.
  const frameLeftM = -(leftY - rearY);
  return {
    geometry: {
      wheelbaseM: rearY - frontY,
      wheelRadiusM: wheel.number('radius_m', metres(0.2, 5)),
      frameLeftM,
      frameRightM: frameLeftM + width,
      frameTopM: topZ - hubZ,
      frameBottomM: topZ - hubZ - height,
    },
    wheel: {
      frames: wheel.number('frames', { min: 1, max: 64, integer: true }),
      periodDeg: wheel.number('period_deg', metres(1, 360)),
      stepDeg: wheel.number('step_deg', metres(0.1, 90)),
    },
    sets,
  };
}
