import { bodyRadiusAt } from '../../rules/swimming';
import { PathTrail, type PointOut } from './PathTrail';

/** The body's shape: its length, its radius and how finely it is sampled. */
export interface BodyShape {
  readonly lengthM: number;
  readonly radiusM: number;
  /** Points along the body for the sand it fills (one per grid cell or so). */
  readonly fillPoints: number;
  /** Points along the body for its drawing (its segments). */
  readonly posePoints: number;
}

/**
 * The hero's body, laid along the path his head swam: where each part of it is now, and was one
 * step ago (the drawing blends the two at the screen's own rate). Every part passes exactly
 * where the head passed, so the body never slides through the sand.
 */
export class HeroBody {
  private readonly trail: PathTrail;
  /** Centres and radii of the points that fill the sand (head first). */
  readonly fillXs: Float64Array;
  readonly fillZs: Float64Array;
  readonly fillRadii: Float64Array;
  /** Centres of the drawn points, this step and the step before (head first). */
  readonly poseXs: Float64Array;
  readonly poseZs: Float64Array;
  readonly lastPoseXs: Float64Array;
  readonly lastPoseZs: Float64Array;
  /** Path length swum so far (m): the drawing's undulation and paddles run on distance. */
  private swum = 0;
  private headX = 0;
  private headZ = 0;
  private readonly point: PointOut = { x: 0, z: 0 };

  constructor(readonly shape: BodyShape) {
    this.trail = new PathTrail(shape.lengthM / (shape.fillPoints - 1), shape.lengthM + 1);
    this.fillXs = new Float64Array(shape.fillPoints);
    this.fillZs = new Float64Array(shape.fillPoints);
    this.fillRadii = Float64Array.from({ length: shape.fillPoints }, (_, k) =>
      bodyRadiusAt(k / (shape.fillPoints - 1), shape.radiusM),
    );
    this.poseXs = new Float64Array(shape.posePoints);
    this.poseZs = new Float64Array(shape.posePoints);
    this.lastPoseXs = new Float64Array(shape.posePoints);
    this.lastPoseZs = new Float64Array(shape.posePoints);
  }

  get distanceSwum(): number {
    return this.swum;
  }

  /** Lays the body straight behind a head at (x, z) facing `heading`. */
  lay(x: number, z: number, heading: number): void {
    this.trail.reset(x, z, heading);
    this.headX = x;
    this.headZ = z;
    this.sample();
    this.lastPoseXs.set(this.poseXs);
    this.lastPoseZs.set(this.poseZs);
  }

  /** The head moved to (x, z): the body follows along the path. */
  follow(x: number, z: number): void {
    this.swum += Math.hypot(x - this.headX, z - this.headZ);
    this.headX = x;
    this.headZ = z;
    this.trail.advance(x, z);
    this.lastPoseXs.set(this.poseXs);
    this.lastPoseZs.set(this.poseZs);
    this.sample();
  }

  private sample(): void {
    const { lengthM, fillPoints, posePoints } = this.shape;
    const out = this.point;
    for (let k = 0; k < fillPoints; k++) {
      this.trail.pointAt((k / (fillPoints - 1)) * lengthM, out);
      this.fillXs[k] = out.x;
      this.fillZs[k] = out.z;
    }
    for (let k = 0; k < posePoints; k++) {
      this.trail.pointAt((k / (posePoints - 1)) * lengthM, out);
      this.poseXs[k] = out.x;
      this.poseZs[k] = out.z;
    }
  }
}
