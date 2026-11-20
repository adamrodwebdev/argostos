import { Text } from './design/text/Text';
import { readUrlOptions } from './rules/urlOptions';

/*
 * The entry point, kept small: the first paint is the HTML's own (the desert's colours and a
 * loading line); the game's code is fetched once the browser has painted it, in its own chunk.
 * The URL's options are read here, at the door.
 */

function element<T extends HTMLElement>(selector: string, kind: new () => T): T {
  const found = document.querySelector(selector);
  if (!(found instanceof kind)) throw new Error(`missing ${selector}`);
  return found;
}

const text = new Text('en');
const root = element('#game', HTMLElement);
const canvas = element('#world', HTMLCanvasElement);
const status = element('#status', HTMLElement);
const readout = element('#readout', HTMLElement);
canvas.setAttribute('aria-label', text.get('canvas'));
status.textContent = text.get('loading');
const options = readUrlOptions(window.location.search, window.location.hash);

async function boot(): Promise<void> {
  try {
    const { startGame } = await import('./game/GameApp');
    await startGame({ elements: { root, canvas, status, readout }, options, text, window });
  } catch (error) {
    status.textContent = text.get('failed');
    status.hidden = false;
    root.dataset.state = 'failed';
    console.error(error);
  }
}

// After the first paint: a frame, then a task, so the HTML's screen is on the glass first.
requestAnimationFrame(() => {
  setTimeout(() => {
    void boot();
  }, 0);
});
