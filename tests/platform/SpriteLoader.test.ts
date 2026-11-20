import { describe, expect, test } from 'vitest';
import { SpriteLoader } from '../../src/platform/SpriteLoader';
import type { SpriteFile } from '../../src/rules/truckManifest';

const FILE: SpriteFile = { file: 'hauler-body-32.webp', width: 4, height: 2, bytes: 6 };
const URLS = new Map([['hauler-body-32.webp', '/assets/hauler-body-32-abc123.webp']]);

interface Served {
  readonly status?: number;
  readonly type?: string;
  readonly length?: string;
  readonly bytes?: number;
  readonly decoded?: { width: number; height: number };
}

/** A window whose fetch serves one answer and whose decoder reports a size. */
function windowServing(served: Served): Window {
  const body = new Blob([new Uint8Array(served.bytes ?? 6)]);
  const headers = new Headers({ 'content-type': served.type ?? 'image/webp' });
  if (served.length !== undefined) headers.set('content-length', served.length);
  const fake = {
    fetch: () => Promise.resolve(new Response(body, { status: served.status ?? 200, headers })),
    createImageBitmap: () =>
      Promise.resolve({ ...(served.decoded ?? { width: 4, height: 2 }), close: () => undefined }),
  };
  return fake as unknown as Window;
}

async function refusal(served: Served, file: SpriteFile = FILE): Promise<string> {
  try {
    await new SpriteLoader(URLS, windowServing(served)).load(file);
    return 'accepted';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('SpriteLoader: a sprite is checked at the door before it is decoded', () => {
  test('a sprite of the build, of the right type, weight and size, is decoded', async () => {
    expect(await refusal({})).toBe('accepted');
  });

  test('a file not in the build is never fetched', async () => {
    expect(await refusal({}, { ...FILE, file: 'hauler-body-64.webp' })).toMatch(/not in the build/);
  });

  test('an HTTP error is refused', async () => {
    expect(await refusal({ status: 404 })).toMatch(/HTTP 404/);
  });

  test.each(['text/html', 'image/png', 'application/octet-stream'])(
    'a file served as %s is refused',
    async (type) => {
      expect(await refusal({ type })).toMatch(/not WebP/);
    },
  );

  test.each(['99999999', '1e3', '-1', '12abc'])(
    'an announced size of %s is refused before the body is read',
    async (length) => {
      expect(await refusal({ length })).toMatch(/announced size refused/);
    },
  );

  test('a file of another weight than its manifest says is refused', async () => {
    expect(await refusal({ bytes: 7 })).toMatch(/7 bytes, 6 expected/);
  });

  test('a picture of another size than its manifest says is refused', async () => {
    expect(await refusal({ decoded: { width: 4, height: 3 } })).toMatch(/not the manifest's size/);
  });
});
