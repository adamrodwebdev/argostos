import type { Text } from '../text/Text';
import { button, create } from './dom';
import { icon } from './icons';

/** What the pause's buttons ask of the game. */
export interface PauseCommands {
  resume(): void;
  restart(): void;
  /** Sound on (true) or off. */
  sound(on: boolean): void;
  /** The tester's code to copy (null: not a tester's link). */
  copyCode(): Promise<boolean>;
}

/**
 * The pause (from the mockup): "Resume" first, "Restart hunt", the sound on or off; on a remote
 * tester's link, the session's short code to send back, with a button that copies it. Its
 * close button resumes too.
 */
export class PauseSheet {
  readonly element: HTMLElement;
  private readonly resume: HTMLButtonElement;
  private readonly soundToggle: HTMLButtonElement;
  private readonly code: HTMLElement;
  private readonly copy: HTMLButtonElement;
  private readonly testerRow: HTMLElement;

  constructor(
    document: Document,
    private readonly text: Text,
    commands: PauseCommands,
  ) {
    this.element = create(document, 'div', {
      className: 'pause-sheet',
      attributes: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pause-title' },
    });
    this.element.hidden = true;
    const sheet = create(document, 'div', { className: 'sheet gs' });
    const head = create(document, 'div', { className: 'sheet-head' });
    const close = button(document, {
      className: 'close',
      attributes: { 'aria-label': text.get('close') },
    });
    close.append(icon(document, 'close'));
    close.addEventListener('click', () => {
      commands.resume();
    });
    head.append(
      create(document, 'h2', {
        className: 'title',
        text: text.get('paused'),
        attributes: { id: 'pause-title' },
      }),
      close,
    );
    this.resume = button(document, { className: 'btn primary big' });
    this.resume.append(icon(document, 'play'), text.get('resume'));
    this.resume.addEventListener('click', () => {
      commands.resume();
    });
    const restart = button(document, { className: 'btn' });
    restart.append(icon(document, 'replay'), text.get('restartHunt'));
    restart.addEventListener('click', () => {
      commands.restart();
    });
    this.soundToggle = button(document, {
      className: 'tog',
      attributes: { 'aria-pressed': 'true' },
    });
    this.soundToggle.append(icon(document, 'sound'), text.get('sound'));
    this.soundToggle.addEventListener('click', () => {
      const on = this.soundToggle.getAttribute('aria-pressed') !== 'true';
      this.soundToggle.setAttribute('aria-pressed', String(on));
      commands.sound(on);
    });
    this.testerRow = create(document, 'div', { className: 'tester' });
    this.code = create(document, 'output', { className: 'code' });
    this.copy = button(document, { className: 'btn', text: text.get('copy') });
    this.copy.addEventListener('click', () => {
      void commands.copyCode().then((copied) => {
        this.copy.textContent = text.get(copied ? 'copied' : 'copy');
      });
    });
    this.testerRow.append(
      create(document, 'p', { className: 'tester-label', text: text.get('testerCode') }),
      this.code,
      this.copy,
    );
    this.testerRow.hidden = true;
    sheet.append(head, this.resume, restart, this.soundToggle, this.testerRow);
    this.element.append(create(document, 'div', { className: 'scrim' }), sheet);
  }

  get isShown(): boolean {
    return !this.element.hidden;
  }

  /** Opens it: the sound toggle as it is, the tester's code when there is one. */
  show(soundOn: boolean, testerCode: string | null): void {
    this.soundToggle.setAttribute('aria-pressed', String(soundOn));
    this.testerRow.hidden = testerCode === null;
    this.code.textContent = testerCode ?? '';
    this.copy.textContent = this.text.get('copy');
    this.element.hidden = false;
    this.resume.focus({ preventScroll: true });
  }

  hide(): void {
    this.element.hidden = true;
  }
}
