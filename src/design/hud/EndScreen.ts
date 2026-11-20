import type { FailureReason, HuntEndedEvent } from '../../logic/hunt/HuntEvents';
import type { Stars } from '../../logic/hunt/HuntStats';
import type { Text, TextKey } from '../text/Text';
import { button, create } from './dom';
import { icon, type IconId } from './icons';

/** What the end screen tells. */
export interface HuntReport {
  readonly hunt: number;
  readonly outcome: HuntEndedEvent;
  readonly crystals: number;
  readonly trucks: number;
  readonly drones: number;
  readonly stars: Stars;
}

/** What its buttons ask of the game. */
export interface EndCommands {
  /** The next hunt (after a success). */
  next(): void;
  /** The same hunt again (after a success: "Replay"; after a failure: "Try again"). */
  again(): void;
}

/** Why a hunt failed, in three or four words, and the four-word tip that goes with it. */
const FAILURES: ReadonlyMap<FailureReason, readonly [TextKey, TextKey]> = new Map<
  FailureReason,
  readonly [TextKey, TextKey]
>([
  ['spotted', ['whySpotted', 'tipSpotted']],
  ['attacked', ['whyAttacked', 'tipAttacked']],
  ['escaped', ['whyEscaped', 'tipEscaped']],
]);

const STAR_KEYS: readonly (readonly [keyof Stars, TextKey])[] = [
  ['unseen', 'starUnseen'],
  ['doubleBite', 'starDoubleBite'],
  ['glassOnly', 'starGlassOnly'],
];

/**
 * The end of a hunt (from the mockup), over the world that goes on behind it: the crystals in
 * big, what was taken and the experts' three stars after a success, "Next hunt" always in the
 * same place and "Replay" under it; after a failure, why in a few words, the crystals kept, a
 * four-word tip and "Try again" (the same hunt). The colony comes in the vertical slice.
 */
export class EndScreen {
  readonly element: HTMLElement;
  private primary: HTMLButtonElement | null = null;

  constructor(
    private readonly document: Document,
    private readonly text: Text,
    private readonly commands: EndCommands,
  ) {
    this.element = create(document, 'div', {
      className: 'screen-end',
      attributes: { role: 'dialog', 'aria-modal': 'false' },
    });
    this.element.hidden = true;
  }

  get isShown(): boolean {
    return !this.element.hidden;
  }

  show(report: HuntReport): void {
    const { document, text } = this;
    const won = report.outcome.result === 'success';
    const title = won
      ? text.get('huntComplete')
      : text.get(report.outcome.convoySize > 1 ? 'convoyGotAway' : 'truckGotAway');
    const head = create(document, 'div', { className: 'head' });
    const titleId = 'end-title';
    head.append(
      create(document, 'p', {
        className: 'kicker',
        text: text.withNumber('huntKicker', report.hunt),
      }),
      create(document, 'h2', { className: 'title', text: title, attributes: { id: titleId } }),
    );
    this.element.setAttribute('aria-labelledby', titleId);
    const plaque = create(document, 'div', { className: 'g plaque' });
    if (won) {
      plaque.append(
        this.loot(report.crystals, null),
        this.sources(report),
        this.stars(report.stars),
      );
    } else {
      const [why, tip] =
        FAILURES.get(report.outcome.reason ?? 'escaped') ?? FAILURES.get('escaped')!;
      plaque.append(
        this.line({ className: 'why-fail', icon: 'eye', text: text.get(why) }),
        this.loot(report.crystals, text.get('kept')),
        this.line({ className: 'tip', icon: 'slow', text: text.get(tip) }),
      );
    }
    const acts = create(document, 'div', { className: 'acts-end' });
    if (won) {
      const next = this.action({ label: 'nextHunt', icon: 'play', primary: true }, () => {
        this.commands.next();
      });
      const replay = this.action({ label: 'replay', icon: 'replay', primary: false }, () => {
        this.commands.again();
      });
      acts.append(next, replay);
      this.primary = next;
    } else {
      const again = this.action({ label: 'tryAgain', icon: 'replay', primary: true }, () => {
        this.commands.again();
      });
      acts.append(again);
      this.primary = again;
    }
    this.element.replaceChildren(
      create(document, 'div', { className: 'scrim' }),
      head,
      plaque,
      acts,
    );
    this.element.classList.toggle('fail', !won);
    this.element.hidden = false;
    this.primary.focus({ preventScroll: true });
  }

  hide(): void {
    this.element.hidden = true;
    this.element.replaceChildren();
    this.primary = null;
  }

  private loot(crystals: number, note: string | null): HTMLElement {
    const loot = create(this.document, 'p', { className: 'loot' });
    loot.append(
      icon(this.document, 'crystal'),
      create(this.document, 'span', {
        className: 'visually-hidden',
        text: this.text.get('crystalsEarned'),
      }),
      create(this.document, 'b', { text: `+${this.text.wholeOf(crystals)}` }),
    );
    if (note) loot.append(create(this.document, 'small', { text: note }));
    return loot;
  }

  private sources(report: HuntReport): HTMLElement {
    const list = create(this.document, 'ul', { className: 'src' });
    for (const [id, count, label] of [
      ['truck', report.trucks, 'trucksTaken'],
      ['drone', report.drones, 'dronesDowned'],
    ] as const) {
      if (count === 0) continue;
      const item = create(this.document, 'li');
      item.append(
        icon(this.document, id),
        create(this.document, 'span', { className: 'visually-hidden', text: this.text.get(label) }),
        this.text.wholeOf(count),
      );
      list.append(item);
    }
    return list;
  }

  private stars(stars: Stars): HTMLElement {
    const list = create(this.document, 'ul', { className: 'stars' });
    for (const [key, label] of STAR_KEYS) {
      const won = stars[key];
      const item = create(this.document, 'li', { className: won ? 'on' : '' });
      item.append(
        icon(this.document, 'star'),
        create(this.document, 'span', { text: this.text.get(label) }),
        create(this.document, 'span', {
          className: 'visually-hidden',
          text: this.text.get(won ? 'starWon' : 'starMissed'),
        }),
      );
      list.append(item);
    }
    return list;
  }

  private line(parts: { className: string; icon: IconId; text: string }): HTMLElement {
    const line = create(this.document, 'p', { className: parts.className });
    line.append(icon(this.document, parts.icon), parts.text);
    return line;
  }

  private action(parts: ActionLook, then: () => void): HTMLButtonElement {
    const element = button(this.document, {
      className: parts.primary ? 'btn primary big' : 'btn',
    });
    element.append(icon(this.document, parts.icon), this.text.get(parts.label));
    element.addEventListener('click', then);
    return element;
  }
}

interface ActionLook {
  readonly label: TextKey;
  readonly icon: IconId;
  readonly primary: boolean;
}
