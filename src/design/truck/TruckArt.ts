import type { SpriteSet, TruckManifest } from '../../rules/truckManifest';

/** One scale of the truck's sprites, decoded and ready to draw. */
export interface LoadedSet {
  readonly set: SpriteSet;
  readonly body: CanvasImageSource;
  readonly wheels: CanvasImageSource;
}

/**
 * The truck's art: the sprite sets decoded so far (32 and 64 px per metre), and which one a
 * screen needs: the first sharp enough at its zoom, as the test bench chose them.
 */
export class TruckArt {
  private readonly loaded: LoadedSet[] = [];

  constructor(readonly manifest: TruckManifest) {}

  add(set: LoadedSet): void {
    this.loaded.push(set);
    this.loaded.sort((a, b) => a.set.pixelsPerMetre - b.set.pixelsPerMetre);
  }

  /** The set a screen at `devicePpm` should load (the sharpest needed, never wasted). */
  wanted(devicePpm: number): SpriteSet {
    const { sets } = this.manifest;
    return sets.find((set) => set.pixelsPerMetre >= devicePpm * 0.8) ?? sets[sets.length - 1]!;
  }

  /** The best set decoded so far for this zoom (null while none is ready). */
  best(devicePpm: number): LoadedSet | null {
    const wanted = this.wanted(devicePpm).pixelsPerMetre;
    return (
      this.loaded.find((set) => set.set.pixelsPerMetre >= wanted) ?? this.loaded.at(-1) ?? null
    );
  }

  has(set: SpriteSet): boolean {
    return this.loaded.some((loaded) => loaded.set.pixelsPerMetre === set.pixelsPerMetre);
  }
}
