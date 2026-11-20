import { InvalidInput, orElse, readBoolean, readChoice, readNumber } from './input';

/*
 * Pointer and touch events are a door too: what a device (or a script posing as one) reports is
 * read strictly before it steers anything. A position must be a finite number, it is clamped to
 * the play area; a pointer's kind is an allow-list; anything else is ignored, never guessed.
 */

export const POINTER_KINDS = ['mouse', 'pen', 'touch'] as const;
export type PointerKind = (typeof POINTER_KINDS)[number];

/** The fields of a pointer event the game reads, still unchecked. */
export interface RawPointer {
  readonly pointerId: unknown;
  readonly pointerType: unknown;
  readonly clientX: unknown;
  readonly clientY: unknown;
  readonly isPrimary: unknown;
}

/** The play area on the page (CSS px): its top-left corner and its size. */
export interface PlayArea {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A pointer read at the door: a known kind, a position inside the play area (CSS px). */
export interface PointerSample {
  readonly id: number;
  readonly kind: PointerKind;
  readonly x: number;
  readonly y: number;
  readonly primary: boolean;
}

/** Far beyond any screen: what lies outside is refused, not clamped (a broken reading). */
const COORDINATE = { min: -1e6, max: 1e6 } as const;
const POINTER_ID = { min: -1, max: 2_147_483_647, integer: true } as const;

/** Reads one pointer event; `null` when anything in it does not fit. */
export function readPointer(raw: RawPointer, area: PlayArea): PointerSample | null {
  return orElse<PointerSample | null>(() => {
    if (!(area.width > 0) || !(area.height > 0)) throw new InvalidInput('area', 'out-of-range');
    const clientX = readNumber(raw.clientX, COORDINATE, 'clientX');
    const clientY = readNumber(raw.clientY, COORDINATE, 'clientY');
    return {
      id: readNumber(raw.pointerId, POINTER_ID, 'pointerId'),
      kind: readChoice(raw.pointerType, POINTER_KINDS, 'pointerType'),
      x: Math.min(area.width, Math.max(0, clientX - area.left)),
      y: Math.min(area.height, Math.max(0, clientY - area.top)),
      primary: readBoolean(raw.isPrimary, 'isPrimary'),
    };
  }, null);
}
