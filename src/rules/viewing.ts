/*
 * How the world is framed on any screen. The game fills the viewport in both orientations; on a
 * window wider than 2:1 the playing frame stops at 2:1, centred, and the art fills the sides
 * (Playgama's rule): no player sees more of the arena for owning a wide screen.
 */

export const VIEW = {
  /** The widest playing frame, width over height. */
  maxAspect: 2,
  /** Height of world the frame shows (m) when the screen is tall enough. */
  heightM: 50,
  /** Width of world a narrow (portrait) frame still shows (m): the hero and his prey. */
  minWidthM: 28.8,
  /**
   * The smallest zoom (CSS px per metre): on a short landscape phone (568 × 320) the hero stays
   * 14 px thick and the truck 100 px long; the camera then follows him up and down.
   */
  minPpm: 8,
  /** A finger this share of the frame's short side away from the head asks for full speed. */
  throttleShare: 0.3,
} as const;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The playing frame inside a canvas of `width` × `height` CSS pixels. */
export function playFrame(width: number, height: number): Rect {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const frameWidth = Math.min(w, h * VIEW.maxAspect);
  return { x: (w - frameWidth) / 2, y: 0, width: frameWidth, height: h };
}

/** The zoom (CSS pixels per metre) that frames the world in this playing frame. */
export function pixelsPerMetre(frame: Rect): number {
  return Math.max(VIEW.minPpm, Math.min(frame.height / VIEW.heightM, frame.width / VIEW.minWidthM));
}

/** The finger distance (m) that asks for full speed in this frame, at this zoom. */
export function fullThrottleDistance(frame: Rect, ppm: number): number {
  return (Math.min(frame.width, frame.height) * VIEW.throttleShare) / ppm;
}
