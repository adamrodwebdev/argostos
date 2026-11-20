/**
 * Lets the browser breathe between two parts of a long job (the game's start): resolves in a
 * new task, so each part is a task of its own and the page answers in between.
 */
export function nextTask(window: Window): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}
