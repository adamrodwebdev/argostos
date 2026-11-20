/*
 * The interface's icons, from the validated mockup: one SVG sprite added to the page when the
 * game loads (never in the first paint), each icon used by its id. Paths are our own data.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

interface IconShape {
  /** Filled paths. */
  readonly fill?: readonly string[];
  /** Stroked paths (2 px, round caps), and circles (cx, cy, r) filled. */
  readonly stroke?: readonly string[];
  readonly strokeWidth?: number;
  readonly circles?: readonly (readonly [number, number, number])[];
}

export const ICON_IDS = [
  'pause',
  'crystal',
  'truck',
  'drone',
  'eye',
  'breath',
  'star',
  'ram',
  'tail',
  'rock',
  'mleft',
  'mright',
  'ripple',
  'hand',
  'slow',
  'replay',
  'play',
  'close',
  'sound',
] as const;
export type IconId = (typeof ICON_IDS)[number];

const SHAPES: ReadonlyMap<IconId, IconShape> = new Map<IconId, IconShape>([
  ['pause', { fill: ['M7 5h3.6v14H7zM13.4 5H17v14h-3.6z'] }],
  ['crystal', { fill: ['M12 2l6.5 4.2v11.6L12 22l-6.5-4.2V6.2z'] }],
  [
    'truck',
    {
      fill: ['M1.5 7.5h12V14h-12zM14 6h4.3l1.7 3.2V14H14z'],
      circles: [
        [5, 16.6, 2.8],
        [15.8, 16.6, 2.8],
      ],
    },
  ],
  [
    'drone',
    {
      fill: [
        'M8 9.5h8l2 2.5-2 2.5H8L6 12zM2 7h7v1.7H2zM15 7h7v1.7h-7zM5 8.7h1.5v2H5zM17.5 8.7H19v2h-1.5z',
      ],
      circles: [[12, 17, 1.6]],
    },
  ],
  [
    'eye',
    {
      fill: [
        'M12 6C6.5 6 3 12 3 12s3.5 6 9 6 9-6 9-6-3.5-6-9-6zm0 9.3a3.3 3.3 0 1 1 0-6.6 3.3 3.3 0 0 1 0 6.6z',
      ],
    },
  ],
  [
    'breath',
    {
      fill: ['M12 2l4.6 7.3-1.3 4.1 2.9-1.9c.6 5.4-2.6 10-6.2 10s-6.8-4.4-6.2-9.6l2.9 2.3-1-4.6z'],
    },
  ],
  [
    'star',
    { fill: ['M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z'] },
  ],
  [
    'ram',
    { fill: ['M11 4.5 21 12l-10 7.5z'], stroke: ['M2.5 8h6M1.5 12h7M2.5 16h6'], strokeWidth: 2.2 },
  ],
  [
    'tail',
    { stroke: ['M3.5 19.5c7.5-.8 12.6-5.2 14.6-13', 'M14.2 4.6 19 5.4l-.4 4.9'], strokeWidth: 2.8 },
  ],
  [
    'rock',
    {
      fill: ['M10.5 6.5 16 4.6l5 3.6-.9 6.6-5.6 3.2-4.8-3z'],
      stroke: ['M2 8.5h5.5M1 12.5h6.5M2.5 16.5h5'],
    },
  ],
  [
    'mleft',
    {
      stroke: ['M12 2.2a6 6 0 0 1 6 6v7.6a6 6 0 0 1-12 0V8.2a6 6 0 0 1 6-6z'],
      strokeWidth: 1.8,
      fill: ['M11.6 3.2v6.6H7v-1.6a4.7 4.7 0 0 1 4.6-5z'],
    },
  ],
  [
    'mright',
    {
      stroke: ['M12 2.2a6 6 0 0 1 6 6v7.6a6 6 0 0 1-12 0V8.2a6 6 0 0 1 6-6z'],
      strokeWidth: 1.8,
      fill: ['M12.4 3.2v6.6H17v-1.6a4.7 4.7 0 0 0-4.6-5z'],
    },
  ],
  [
    'ripple',
    { stroke: ['M7 16.2a7 7 0 0 1 10 0M3.8 12.8a11.5 11.5 0 0 1 16.4 0'], circles: [[12, 19, 2]] },
  ],
  [
    'hand',
    {
      fill: [
        'M8 12.2V3a1.6 1.6 0 0 1 3.2 0v6.4a1.6 1.6 0 0 1 3.1.4 1.6 1.6 0 0 1 3.1.6 1.6 1.6 0 0 1 3.1.9v4.9c0 3.9-2.6 6.3-6.2 6.3h-1.5c-2 0-3.4-.8-4.5-2.4l-3.1-4.5a1.7 1.7 0 0 1 2.6-2.1L8 15.3z',
      ],
    },
  ],
  ['slow', { stroke: ['M2 12.5c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6-1'], strokeWidth: 2.3 }],
  ['replay', { fill: ['M12 5a7 7 0 1 1-6.7 9h2.1A5 5 0 1 0 12 7v3L7.5 6 12 2z'] }],
  ['play', { fill: ['M7 4.5v15l12.5-7.5z'] }],
  [
    'close',
    {
      fill: [
        'M5.6 4.2 12 10.6l6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4z',
      ],
    },
  ],
  [
    'sound',
    {
      fill: ['M3 9h4l5-4v14l-5-4H3z'],
      stroke: ['M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12'],
    },
  ],
]);

/** The sprite of every icon, made once and put at the start of `body` (hidden). */
export function installIcons(document: Document): void {
  if (document.getElementById('game-icons')) return;
  const sprite = document.createElementNS(SVG_NS, 'svg');
  sprite.id = 'game-icons';
  sprite.setAttribute('aria-hidden', 'true');
  sprite.setAttribute('width', '0');
  sprite.setAttribute('height', '0');
  sprite.style.position = 'absolute';
  for (const [id, shape] of SHAPES) {
    const symbol = document.createElementNS(SVG_NS, 'symbol');
    symbol.id = `i-${id}`;
    symbol.setAttribute('viewBox', '0 0 24 24');
    for (const d of shape.fill ?? []) symbol.append(path(document, d));
    for (const d of shape.stroke ?? []) {
      const line = path(document, d);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', 'currentColor');
      line.setAttribute('stroke-width', String(shape.strokeWidth ?? 2));
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-linejoin', 'round');
      symbol.append(line);
    }
    for (const [cx, cy, r] of shape.circles ?? []) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', String(r));
      symbol.append(circle);
    }
    sprite.append(symbol);
  }
  document.body.prepend(sprite);
}

/** An icon (decorative: hidden from assistive technology; its button carries the name). */
export function icon(document: Document, id: IconId, className = ''): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) svg.setAttribute('class', className);
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${id}`);
  svg.append(use);
  return svg;
}

function path(document: Document, d: string): SVGPathElement {
  const element = document.createElementNS(SVG_NS, 'path');
  element.setAttribute('d', d);
  return element;
}
