import { orElse, parseNumber } from '../rules/input';
import { SPRITE_MAX_BYTES, type SpriteFile } from '../rules/truckManifest';

const SIZE = { min: 0, max: SPRITE_MAX_BYTES, integer: true } as const;

/**
 * Fetches and decodes a sprite of the game's own, checked at the door: the file must be one of
 * the build's (an allow-list of names to URLs, never a URL built from data), answer 200 as a
 * WebP, weigh exactly what its manifest says (under a size limit, checked before decoding), and
 * decode to the size the manifest gives.
 */
export class SpriteLoader {
  constructor(
    private readonly urls: ReadonlyMap<string, string>,
    private readonly window: Window,
  ) {}

  async load(file: SpriteFile): Promise<ImageBitmap> {
    const url = this.urls.get(file.file);
    if (url === undefined) throw new Error(`sprite not in the build: ${file.file}`);
    const response = await this.window.fetch(url);
    if (!response.ok) throw new Error(`${file.file}: HTTP ${response.status}`);
    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('image/webp'))
      throw new Error(`${file.file}: not WebP (${type.slice(0, 40)})`);
    // An announced size over the limit is refused before the body is read.
    const declared = response.headers.get('content-length');
    if (declared !== null && orElse(() => parseNumber(declared, SIZE, 'content-length'), -1) < 0) {
      throw new Error(`${file.file}: announced size refused`);
    }
    const blob = await response.blob();
    if (blob.size > SPRITE_MAX_BYTES || blob.size !== file.bytes) {
      throw new Error(`${file.file}: ${blob.size} bytes, ${file.bytes} expected`);
    }
    const image = await this.window.createImageBitmap(blob);
    if (image.width !== file.width || image.height !== file.height) {
      image.close();
      throw new Error(`${file.file}: ${image.width} × ${image.height}, not the manifest's size`);
    }
    return image;
  }
}
