/** The sounds of a takedown (a real recording can replace each cue later). */
export const SOUND_CUES = [
  'impact',
  'crunch',
  'shatter',
  'whoosh',
  'crackle',
  'sandBurst',
] as const;
export type SoundCue = (typeof SOUND_CUES)[number];

/**
 * Where the game's sounds go. For now a small Web Audio synthesis plays them (no file is
 * downloaded); real sounds replace it behind this same port. Muting is respected, and no sound
 * starts before the player's first touch or key (the browsers' rule).
 */
export interface SoundPort {
  readonly muted: boolean;
  /** A cue, at `strength` from 0 (faint) to 1 (full). */
  play(cue: SoundCue, strength: number): void;
  setMuted(muted: boolean): void;
  /** The player touched the game: sound may start. */
  unlock(): void;
  /** The tab is hidden (or shown again): sound pauses (or resumes). */
  pause(paused: boolean): void;
}

/** No sound at all (tests, a browser without Web Audio). */
export class SilentSound implements SoundPort {
  private quiet = true;

  get muted(): boolean {
    return this.quiet;
  }
  play(): void {
    // Nothing to play.
  }
  setMuted(muted: boolean): void {
    this.quiet = muted;
  }
  unlock(): void {
    // Nothing to start.
  }
  pause(): void {
    // Nothing to pause.
  }
}
