import { CAMERA, takedownCentreZ } from '../rules/viewing';
import { ARENA } from '../rules/world';
import type { View, ViewLayout } from './View';

/** What the camera follows: a position and a velocity (m, m/s). */
export interface Followed {
  readonly x: number;
  readonly z: number;
  readonly velocityX: number;
  readonly velocityZ: number;
  /** A takedown plays there: framed mid-screen, room above it for what it throws. */
  readonly takedown?: boolean;
}

export interface CameraOptions {
  /** The view the camera frames each frame. */
  readonly view: View;
  /** The lowest the camera shows (m): the bottom of the arena. */
  readonly bottomZ: number;
  /** No shake for players who asked for less motion. */
  readonly reducedMotion: boolean;
}

/** How quickly the camera catches up (per second), across and up and down. */
const FOLLOW_X = 4;
const FOLLOW_Z = 2.5;
/** Up and down, it reaches a takedown faster: the bite comes while it still follows the rise. */
const FOLLOW_TAKEDOWN_Z = 7;
/** It looks ahead of the hero by this long of his (smoothed) motion, this far at most (m). */
const LOOK_AHEAD_S = 0.45;
const LOOK_AHEAD_MAX_M = 7;
/** How fast the velocity it looks ahead by is smoothed (per second). */
const LEAD_SMOOTHING = 2;
/** A shake at full trauma moves the view this far (CSS px), and trauma fades this fast (1/s). */
const SHAKE_PX = 7;
const TRAUMA_FADE = 2.6;

function clampLead(metres: number): number {
  return Math.max(-LOOK_AHEAD_MAX_M, Math.min(LOOK_AHEAD_MAX_M, metres));
}

/**
 * The side-scrolling camera: it keeps the hero in the playing frame, a little ahead of where he
 * goes, inside the arena, and shakes briefly on a bite (never with reduced motion). It moves
 * on the frame's real time: it decides nothing in the hunt.
 */
export class Camera {
  private x = ARENA.widthM / 2;
  private z = -10;
  private leadX = 0;
  private leadZ = 0;
  private trauma = 0;
  private clock = 0;
  private started = false;

  constructor(private readonly options: CameraOptions) {}

  /** A jolt (a bite, a burst): 0 to 1, added to what is still shaking. */
  jolt(amount: number): void {
    if (this.options.reducedMotion) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Follows the hero (or a takedown) for a frame of `dt` seconds, then frames the view. */
  frame(followed: Followed, layout: ViewLayout, dt: number): void {
    const lead = 1 - Math.exp(-LEAD_SMOOTHING * dt);
    this.leadX += (followed.velocityX - this.leadX) * lead;
    this.leadZ += (followed.velocityZ - this.leadZ) * lead;
    const takedown = followed.takedown === true;
    const aimZ = takedown
      ? takedownCentreZ(followed.z, layout.frame.height / layout.cssPpm)
      : followed.z + clampLead(this.leadZ * LOOK_AHEAD_S * 0.5);
    const tx = this.withinX(followed.x + clampLead(this.leadX * LOOK_AHEAD_S), layout);
    const tz = this.withinZ(aimZ, layout);
    if (!this.started) {
      this.x = tx;
      this.z = tz;
      this.started = true;
    } else {
      const followZ = takedown ? FOLLOW_TAKEDOWN_Z : FOLLOW_Z;
      this.x += (tx - this.x) * (1 - Math.exp(-FOLLOW_X * dt));
      this.z += (tz - this.z) * (1 - Math.exp(-followZ * dt));
    }
    this.clock += dt;
    this.trauma = Math.max(0, this.trauma - TRAUMA_FADE * dt);
    const shake = (this.trauma * this.trauma * SHAKE_PX) / layout.cssPpm;
    const dx = shake * Math.sin(this.clock * 61.3);
    const dz = shake * Math.sin(this.clock * 47.9 + 1.7);
    this.options.view.aim(
      this.withinX(this.x, layout) + dx,
      this.withinZ(this.z, layout) + dz,
      layout,
    );
  }

  /** Keeps the playing frame inside the arena across (or centred, when wider than it). */
  private withinX(x: number, layout: ViewLayout): number {
    const half = layout.frame.width / layout.cssPpm / 2;
    if (half * 2 >= ARENA.widthM) return ARENA.widthM / 2;
    return Math.max(half, Math.min(ARENA.widthM - half, x));
  }

  /** Keeps the frame between the bedrock and the sky's top (or centred, when taller). */
  private withinZ(z: number, layout: ViewLayout): number {
    const half = layout.frame.height / layout.cssPpm / 2;
    const { bottomZ } = this.options;
    const low = bottomZ + half;
    const high = CAMERA.skyTopM - half;
    if (low >= high) return (bottomZ + CAMERA.skyTopM) / 2;
    return Math.max(low, Math.min(high, z));
  }
}
