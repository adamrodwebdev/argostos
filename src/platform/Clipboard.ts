/**
 * Copies text to the clipboard (the tester's session code), at the player's click only. A
 * browser that refuses (no permission, an insecure page) answers false: the code stays on
 * screen to copy by hand.
 */
export class Clipboard {
  constructor(private readonly window: Window) {}

  async copy(text: string): Promise<boolean> {
    try {
      await this.window.navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
