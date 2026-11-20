import type { PartEffectId, PartId, PartRow } from '../../rules/machines';
import { Integrity } from './Integrity';

/**
 * What breaking a part does to its machine: one strategy per effect, plugged in by its id
 * (later: a lost tyre slows a truck and makes it wobble, a lost camera blinds a drone).
 */
export interface PartEffect {
  readonly id: PartEffectId;
  /** The part's plate is gone. */
  broke(): void;
}

/** No effect: P2's only part is the body, whose loss is the machine giving out. */
class NoEffect implements PartEffect {
  readonly id = 'none';

  broke(): void {
    // Nothing more: the combat tells the machine it gave out.
  }
}

/** One part of a machine: its own plate, and what breaking it does. */
export class Part {
  readonly id: PartId;
  readonly integrity: Integrity;
  readonly effect: PartEffect;

  constructor(row: PartRow) {
    this.id = row.id;
    this.integrity = new Integrity(row.hp);
    this.effect = new NoEffect();
  }
}

/** A machine's parts, made from its row; the body carries its life. */
export class MachineParts {
  readonly all: readonly Part[];
  readonly body: Part;

  constructor(rows: readonly PartRow[]) {
    this.all = rows.map((row) => new Part(row));
    const body = this.all.find((part) => part.id === 'body');
    if (!body) throw new Error('a machine needs a body');
    this.body = body;
  }

  /** The part `id`, or the body when the machine has no such part. */
  part(id: PartId): Part {
    return this.all.find((part) => part.id === id) ?? this.body;
  }
}
