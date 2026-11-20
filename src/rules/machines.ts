/*
 * The Company's machines, as data rows (the roadmap's technical rule): a new machine made of
 * known behaviours is one more row, never more code. The numbers count plate and steel, never
 * wounds: the machines run without drivers, nobody is in them (PEGI 12).
 */

export const MACHINE_IDS = ['hauler', 'armoredHauler', 'drone'] as const;
export type MachineId = (typeof MACHINE_IDS)[number];

/** How a machine moves: on the sand on its wheels, or in the air on its rotors. */
export type MachineKind = 'truck' | 'drone';

/**
 * The parts a machine is made of. In P2 every machine has one, its whole body; the tyres and
 * the camera are the ids the later parts take (a truck's tyre, a drone's camera), each with
 * its plate and what breaking it does. No row uses them yet.
 */
export const PART_IDS = ['body', 'tyre', 'camera'] as const;
export type PartId = (typeof PART_IDS)[number];

/**
 * What breaking a part does to its machine (later: a lost tyre slows a truck and makes it
 * wobble, a lost camera blinds a drone). None yet: the slot is there for the strategies.
 */
export const PART_EFFECT_IDS = ['none'] as const;
export type PartEffectId = (typeof PART_EFFECT_IDS)[number];

export interface PartRow {
  readonly id: PartId;
  /** Hit points of plate. */
  readonly hp: number;
  readonly effect: PartEffectId;
}

export interface MachineRow {
  readonly kind: MachineKind;
  /** Its parts; the body carries its life (at zero the machine gives out). */
  readonly parts: readonly PartRow[];
  /**
   * A life bar over it once touched. Light prey that fall in one bite never show one (the
   * mockup's rule); a test checks that every machine without a bar falls in one bite.
   */
  readonly bar: boolean;
  /** Crystals the hero gains when it falls. */
  readonly crystals: number;
  /** Its cruising speed, and how fast it flees for an exit once alarmed (m/s). */
  readonly cruiseSpeed: number;
  readonly fleeSpeed: number;
  /** The world stands still this long when it falls (ms): heavier, longer (60 to 120). */
  readonly hitStopMs: number;
  /** Steel plates bolted on its sides (drawn over the truck's sprite). */
  readonly plated: boolean;
}

export const MACHINES: ReadonlyMap<MachineId, MachineRow> = new Map<MachineId, MachineRow>([
  [
    'hauler',
    {
      kind: 'truck',
      parts: [{ id: 'body', hp: 50, effect: 'none' }],
      bar: false,
      crystals: 8,
      cruiseSpeed: 5.5,
      fleeSpeed: 9,
      hitStopMs: 90,
      plated: false,
    },
  ],
  [
    'armoredHauler',
    {
      kind: 'truck',
      parts: [{ id: 'body', hp: 150, effect: 'none' }],
      bar: true,
      crystals: 16,
      cruiseSpeed: 4.5,
      fleeSpeed: 7.5,
      hitStopMs: 120,
      plated: true,
    },
  ],
  [
    'drone',
    {
      kind: 'drone',
      parts: [{ id: 'body', hp: 30, effect: 'none' }],
      bar: true,
      crystals: 10,
      cruiseSpeed: 3.5,
      fleeSpeed: 0,
      hitStopMs: 60,
      plated: false,
    },
  ],
]);

/** The plate of a machine's body: its life. */
export function bodyHp(row: MachineRow): number {
  return row.parts.find((part) => part.id === 'body')?.hp ?? 0;
}

/** The row of a machine (every id has one: the table is checked by a test). */
export function machineRow(id: MachineId): MachineRow {
  const row = MACHINES.get(id);
  if (!row) throw new Error(`no row for the machine ${id}`);
  return row;
}
