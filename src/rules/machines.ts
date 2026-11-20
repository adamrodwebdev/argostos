/*
 * The Company's machines, as data rows (the roadmap's technical rule): a new machine made of
 * known behaviours is one more row, never more code. The numbers count plate and steel, never
 * wounds: the machines run without drivers, nobody is in them (PEGI 12).
 */

export const MACHINE_IDS = ['hauler', 'armoredHauler', 'drone'] as const;
export type MachineId = (typeof MACHINE_IDS)[number];

/** How a machine moves: on the sand on its wheels, or in the air on its rotors. */
export type MachineKind = 'truck' | 'drone';

export interface MachineRow {
  readonly kind: MachineKind;
  /** Hit points of plate. */
  readonly hp: number;
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
      hp: 50,
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
      hp: 150,
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
      hp: 30,
      bar: true,
      crystals: 10,
      cruiseSpeed: 3.5,
      fleeSpeed: 0,
      hitStopMs: 60,
      plated: false,
    },
  ],
]);

/** The row of a machine (every id has one: the table is checked by a test). */
export function machineRow(id: MachineId): MachineRow {
  const row = MACHINES.get(id);
  if (!row) throw new Error(`no row for the machine ${id}`);
  return row;
}
