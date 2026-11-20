/*
 * The elements of the desert and how each kind of cell moves. Pure data: the grid applies the
 * motion. Lumirift's elements (water, oil, seeds…) come back one per region, each with its row
 * here and its rule in the grid; the prototype's desert needs only these.
 */

/** What a cell holds. 0 is always the air. */
export const Element = {
  Air: 0,
  Sand: 1,
  Rock: 2,
} as const;
export type ElementId = (typeof Element)[keyof typeof Element];

/** How a cell moves. */
export const Matter = {
  /** Nothing: the air. */
  Void: 0,
  /** Falls, then slides down a side: sand. */
  Powder: 1,
  /** Holds still: the bedrock. */
  Solid: 2,
} as const;
export type MatterId = (typeof Matter)[keyof typeof Matter];

/** Matter of each element, by id (the physics reads it for every grain it moves). */
export const MATTER_OF: Readonly<Uint8Array> = Uint8Array.from([
  Matter.Void, // Air
  Matter.Powder, // Sand
  Matter.Solid, // Rock
]);

/** Elements a body may push aside as it swims (rock stays where it is). */
export function isLoose(element: number): boolean {
  return MATTER_OF[element] === Matter.Powder;
}
