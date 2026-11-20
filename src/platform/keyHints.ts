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
      // Read as one closed value: only a finger turns the hints off.
      if (event.pointerType !== 'touch' || !shown) return;
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
