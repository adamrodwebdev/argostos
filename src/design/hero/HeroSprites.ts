import { GLASS } from '../palette';

/**
 * The hero's parts drawn once at the screen's scale, then copied every frame (never a blur or
 * a gradient built per frame): a glass ring of his body (with its dorsal cirrus), a paddle with
 * its bristles, his head, an eye's glow. Each faces +x, its back up (−y).
 */
export class HeroSprites {
  readonly ring: HTMLCanvasElement;
  readonly paddle: HTMLCanvasElement;
  readonly head: HTMLCanvasElement;
  readonly eyeGlow: HTMLCanvasElement;
  /** Device pixels per metre they were drawn at, and the body's radius (m). */
  readonly scale: number;
  readonly radiusM: number;

  constructor(scale: number, radiusM: number, segmentM: number) {
    this.scale = scale;
    this.radiusM = radiusM;
    const r = radiusM * scale;
    this.ring = HeroSprites.paintRing(Math.max(2, segmentM * scale * 1.28), r);
    this.paddle = HeroSprites.paintPaddle(r);
    this.head = HeroSprites.paintHead(r);
    this.eyeGlow = HeroSprites.paintGlow(Math.max(3, r * 0.42));
  }

  /** Where the head's centre sits in its sprite (px). */
  get headAnchorX(): number {
    return this.radiusM * this.scale * 1.3;
  }
  get headAnchorY(): number {
    return this.head.height / 2;
  }

  /** Where the ring's ellipse is centred in its sprite (px): the cirrus takes room on top. */
  get ringAnchorY(): number {
    return this.ring.height / 2 + this.radiusM * this.scale * 0.25;
  }

  private static canvas(
    width: number,
    height: number,
  ): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas unavailable');
    return [canvas, context];
  }

  /** A ring of glass: light on the back, dark at the belly, an outline, and a cirrus on top. */
  private static paintRing(width: number, r: number): HTMLCanvasElement {
    const [canvas, c] = HeroSprites.canvas(width + 4, r * 2.6 + 4);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + r * 0.25;
    const gradient = c.createLinearGradient(0, cy - r, 0, cy + r);
    gradient.addColorStop(0, GLASS.hi);
    gradient.addColorStop(0.35, GLASS.mid);
    gradient.addColorStop(0.85, GLASS.lo);
    gradient.addColorStop(1, GLASS.edge);
    c.fillStyle = gradient;
    c.beginPath();
    c.ellipse(cx, cy, width / 2, r, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = GLASS.edge;
    c.lineWidth = Math.max(0.7, r * 0.05);
    c.stroke();
    // The dorsal cirrus: a fine glass thread, swept back.
    c.strokeStyle = GLASS.bristle;
    c.lineCap = 'round';
    c.lineWidth = Math.max(0.6, r * 0.045);
    c.beginPath();
    c.moveTo(cx, cy - r * 0.85);
    c.quadraticCurveTo(cx - r * 0.25, cy - r * 1.1, cx - r * 0.55, cy - r * 1.2);
    c.stroke();
    return canvas;
  }

  /** A paddle (parapodium) pointing along +x from its base, with its fan of bristles. */
  private static paintPaddle(r: number): HTMLCanvasElement {
    const length = r * 1.05;
    const [canvas, c] = HeroSprites.canvas(length * 1.9 + 4, length * 1.2 + 4);
    const by = canvas.height / 2;
    const bx = 2;
    c.fillStyle = GLASS.fin;
    c.beginPath();
    c.moveTo(bx, by - r * 0.26);
    c.quadraticCurveTo(bx + length * 0.7, by - length * 0.25, bx + length, by);
    c.quadraticCurveTo(bx + length * 0.65, by + length * 0.3, bx, by + r * 0.26);
    c.fill();
    c.strokeStyle = GLASS.bristle;
    c.lineCap = 'round';
    c.lineWidth = Math.max(0.6, r * 0.05);
    for (let b = -2; b <= 2; b++) {
      const angle = b * 0.22;
      const bristle = length * (0.65 + 0.12 * (2 - Math.abs(b)));
      c.beginPath();
      c.moveTo(bx + length, by);
      c.lineTo(bx + length + Math.cos(angle) * bristle, by + Math.sin(angle) * bristle);
      c.stroke();
    }
    return canvas;
  }

  /** The head: a glass dome over the proboscis, with its outline and a highlight. */
  private static paintHead(r: number): HTMLCanvasElement {
    const [canvas, c] = HeroSprites.canvas(r * 4.2, r * 2.6);
    const cx = r * 1.3;
    const cy = canvas.height / 2;
    const gradient = c.createLinearGradient(0, cy - r, 0, cy + r);
    gradient.addColorStop(0, GLASS.hi);
    gradient.addColorStop(0.35, GLASS.mid);
    gradient.addColorStop(0.85, GLASS.lo);
    gradient.addColorStop(1, GLASS.edge);
    c.strokeStyle = GLASS.mid;
    c.lineWidth = r * 1.05;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx + r * 0.9, cy);
    c.lineTo(cx + r * 1.45, cy);
    c.stroke();
    c.strokeStyle = GLASS.rim;
    c.lineWidth = Math.max(1, r * 0.09);
    c.beginPath();
    c.moveTo(cx + r * 0.95, cy - r * 0.32);
    c.lineTo(cx + r * 1.42, cy - r * 0.32);
    c.stroke();
    c.fillStyle = gradient;
    c.beginPath();
    c.ellipse(cx + r * 0.2, cy, r * 1.08, r * 1.02, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = GLASS.edge;
    c.lineWidth = Math.max(0.8, r * 0.055);
    c.stroke();
    return canvas;
  }

  /** The glow round an amber eye. */
  private static paintGlow(radius: number): HTMLCanvasElement {
    const [canvas, c] = HeroSprites.canvas(radius * 2, radius * 2);
    const gradient = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, GLASS.eyeGlow);
    gradient.addColorStop(1, 'rgba(255,170,50,0)');
    c.fillStyle = gradient;
    c.fillRect(0, 0, radius * 2, radius * 2);
    return canvas;
  }
}
