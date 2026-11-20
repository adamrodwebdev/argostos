import { orElse, readChoice } from '../rules/input';
import { POINTER_KINDS } from '../rules/pointerInput';

/**
 * Tells `show` whether the key hints belong on this screen: a fine pointer and a keyboard (a
 * computer), never a touch screen. Decided at the start (a screen that can be touched, or no fine
 * pointer, hides them), then turned off for good the first time a finger touches the page.
 */
export function watchKeyHints(window: Window, show: (on: boolean) => void): void {
  let shown = keyHintsFit(window);
  show(shown);
  window.addEventListener(
    'pointerdown',
    (event) => {
      // The pointer's kind is read at the door, through the pointers' allow-list.
      const kind = orElse(() => readChoice(event.pointerType, POINTER_KINDS, 'pointerType'), null);
      if (kind !== 'touch' || !shown) return;
      shown = false;
      show(false);
    },
    { passive: true },
  );
}

/** A fine pointer, and nothing that says the screen can be touched. */
function keyHintsFit(window: Window): boolean {
  const touchable =
    window.navigator.maxTouchPoints > 0 ||
    'ontouchstart' in window ||
    window.matchMedia('(any-pointer: coarse)').matches;
  return window.matchMedia('(pointer: fine)').matches && !touchable;
}
