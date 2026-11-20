import type { Hunt } from '../../logic/hunt/Hunt';
import type { HuntEvents } from '../../logic/hunt/HuntEvents';
import type { ActionId, StrikeMode } from '../../rules/combat';
import type { HintId } from '../../rules/hunts';
import type { Text, TextKey } from '../text/Text';
import { button, create } from './dom';
import { icon } from './icons';
import type { ScreenBox } from './labelPlacement';
import { Scanner, type ViewSpan } from './Scanner';

/** What the interface asks of the game. */
export interface HudCommands {
  act(action: ActionId): void;
  pause(): void;
}

/** The interface is rewritten this often (s): text and styles are not free. */
const EVERY_S = 0.05;
/** "Spotted" stays this long (s); the hint stays until the first bite, at most this long (s). */
const ALERT_S = 2.4;
const HINT_S = 10;
/** The boxes no damage number covers are measured again this often (s). */
const MEASURE_S = 0.5;

const HINTS: ReadonlyMap<HintId, TextKey> = new Map([['followVibrations', 'hintFollowVibrations']]);
const STRIKE_LABELS: ReadonlyMap<StrikeMode, TextKey> = new Map<StrikeMode, TextKey>([
  ['tail', 'strikeTail'],
  ['rock', 'strikeRock'],
]);

/**
 * The hunt's interface, over the playing frame (from the validated mockup): one row at the top
 * (the pause, the arena's scanner, the crystals), "Spotted" when a drone hears the hero, the
 * first hunt's hint, and the right thumb's actions, which arrive one by one: the breath (the
 * octagon, its gauge filling), the ram (its cooldown a sweep), the strike (its icon a tail up
 * close, a rock at range). The left half of the screen holds no button: one finger steers
 * anywhere. On a computer, small key hints sit by the buttons.
 */
export class HuntHud {
  readonly element: HTMLElement;
  private readonly top: HTMLElement;
  private readonly scanner: Scanner;
  private readonly gems: HTMLElement;
  private readonly alert: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly hand: HTMLElement;
  private readonly glow: HTMLElement;
  private readonly acts: HTMLElement;
  private readonly buttons = new Map<ActionId, HTMLElement>();
  private readonly ram: HTMLButtonElement;
  private readonly strike: HTMLButtonElement;
  private readonly breathWrap: HTMLElement;
  private readonly breath: HTMLButtonElement;
  private readonly boxes: ScreenBox[] = [];
  private sinceWrite = EVERY_S;
  private sinceMeasure = MEASURE_S;
  private alertLeft = 0;
  private hintLeft = 0;
  private mode: StrikeMode | null = null;
  private shownGems = -1;
  private readonly cd = new Map<ActionId, string>();

  constructor(
    private readonly document: Document,
    private readonly text: Text,
    commands: HudCommands,
  ) {
    this.element = create(document, 'div', { className: 'hud' });
    this.top = create(document, 'div', { className: 'hud-top' });
    const pause = button(document, {
      className: 'g ico pause',
      attributes: { 'aria-label': text.get('pause') },
    });
    pause.append(icon(document, 'pause'));
    pause.addEventListener('click', () => {
      commands.pause();
    });
    this.scanner = new Scanner(document, text.get('scanner'));
    const gems = create(document, 'p', { className: 'g gems' });
    this.gems = create(document, 'b', { text: '0' });
    gems.append(
      icon(document, 'crystal'),
      create(document, 'span', { className: 'visually-hidden', text: text.get('crystals') }),
      this.gems,
    );
    this.top.append(pause, this.scanner.element, gems);
    this.alert = create(document, 'p', { className: 'alert', attributes: { role: 'status' } });
    this.alert.append(
      icon(document, 'eye'),
      create(document, 'span', { text: text.get('spotted') }),
    );
    this.alert.hidden = true;
    this.hint = create(document, 'p', { className: 'g hint' });
    this.hint.hidden = true;
    this.hand = create(document, 'span', { className: 'hand' });
    this.hand.append(icon(document, 'hand'));
    this.hand.hidden = true;
    this.glow = create(document, 'div', { className: 'edge-glow' });
    this.glow.hidden = true;
    this.acts = create(document, 'div', { className: 'acts' });
    this.ram = this.actionButton({ action: 'ram', label: 'ram', icons: ['ram'] }, commands);
    this.strike = this.actionButton(
      { action: 'strike', label: 'strikeRock', icons: ['tail', 'rock'] },
      commands,
    );
    this.breathWrap = create(document, 'div', { className: 'breath-wrap' });
    this.breath = this.actionButton(
      { action: 'breath', label: 'breath', icons: ['breath'] },
      commands,
    );
    this.breath.className = 'breath';
    this.breathWrap.append(
      create(document, 'span', { className: 'ring' }),
      this.breath,
      create(document, 'kbd', { text: 'Space' }),
    );
    this.buttons.set('ram', this.ram);
    this.buttons.set('strike', this.strike);
    this.buttons.set('breath', this.breathWrap);
    const ramKey = create(document, 'kbd', { className: 'kh k-ram' });
    ramKey.append(icon(document, 'mleft'));
    const strikeKey = create(document, 'kbd', { className: 'kh k-str' });
    strikeKey.append(icon(document, 'mright'));
    this.acts.append(this.ram, this.strike, this.breathWrap, ramKey, strikeKey);
    this.element.append(this.top, this.alert, this.hint, this.hand, this.acts, this.glow);
  }

  /** The key hints by the buttons (a computer's keyboard and mouse), or the touch hand instead. */
  showKeyHints(on: boolean): void {
    this.element.toggleAttribute('data-keys', on);
  }

  /** A new hunt: what is unlocked shows at once, the hint if it has one, no alarm. */
  bind(hunt: Hunt, events: HuntEvents): void {
    this.alertLeft = 0;
    this.alert.hidden = true;
    this.glow.hidden = true;
    const hint = hunt.row.hint ? HINTS.get(hunt.row.hint) : undefined;
    this.hint.replaceChildren();
    if (hint) this.hint.append(icon(this.document, 'ripple'), this.text.get(hint));
    this.hintLeft = hint ? HINT_S : 0;
    this.hint.hidden = !hint;
    this.hand.hidden = !hint;
    for (const [action, element] of this.buttons) {
      element.hidden = !hunt.actions.isUnlocked(action);
      element.classList.remove('arrive');
    }
    this.layoutActions(hunt);
    events.on('spotted', () => {
      this.alertLeft = ALERT_S;
      this.alert.hidden = false;
      this.glow.hidden = false;
    });
    events.on('actionUnlocked', ({ action }) => {
      const element = this.buttons.get(action);
      if (!element) return;
      element.hidden = false;
      element.classList.add('arrive');
      this.layoutActions(hunt);
      this.sinceMeasure = MEASURE_S;
    });
    events.on('truckCaught', () => {
      this.hintLeft = Math.min(this.hintLeft, 1.2);
    });
    this.sinceWrite = EVERY_S;
    this.sinceMeasure = MEASURE_S;
  }

  /** The player touched the game: the hand that shows where to touch goes. */
  firstGesture(): void {
    this.hand.hidden = true;
  }

  /** Shown or hidden (the end screen and the pause cover it). */
  show(shown: boolean): void {
    this.element.hidden = !shown;
  }

  /** A frame: timers run, and a few times a second the interface follows the hunt. */
  frame(dt: number, hunt: Hunt, state: HudState): void {
    this.alertLeft = Math.max(0, this.alertLeft - dt);
    if (this.alertLeft === 0 && !this.alert.hidden) {
      this.alert.hidden = true;
      this.glow.hidden = true;
    }
    if (this.hintLeft > 0) {
      this.hintLeft = Math.max(0, this.hintLeft - dt);
      if (this.hintLeft === 0) this.hint.hidden = true;
    }
    this.sinceMeasure += dt;
    this.sinceWrite += dt;
    if (this.sinceWrite < EVERY_S) return;
    this.sinceWrite = 0;
    this.scanner.update(hunt, state.span);
    if (state.crystals !== this.shownGems) {
      this.shownGems = state.crystals;
      this.gems.textContent = this.text.wholeOf(state.crystals);
    }
    this.sweep('ram', hunt.actions.cooldownShare('ram'));
    this.sweep('strike', hunt.actions.cooldownShare('strike'));
    const fill = hunt.breath.fill;
    this.breath.style.setProperty('--fill', `${String(Math.round(fill * 100))}%`);
    this.breathWrap.classList.toggle('full', fill >= 1);
    if (hunt.actions.isUnlocked('strike')) this.strikeMode(hunt.strike.mode);
  }

  /**
   * The boxes of the interface no damage number covers (CSS px from the canvas's corner): the
   * top row and the thumb's buttons. Measured twice a second, not every frame.
   */
  keepOut(): readonly ScreenBox[] {
    if (this.sinceMeasure < MEASURE_S) return this.boxes;
    this.sinceMeasure = 0;
    this.boxes.length = 0;
    for (const element of [this.top, this.ram, this.strike, this.breathWrap]) {
      if (element.hidden || this.element.hidden) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0) {
        this.boxes.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
      }
    }
    return this.boxes;
  }

  /** The top of the area damage numbers may use (CSS px): just under the top row. */
  ceiling(): number {
    return this.top.getBoundingClientRect().bottom + 8;
  }

  private actionButton(parts: ActionParts, commands: HudCommands): HTMLButtonElement {
    const element = button(this.document, {
      className: `act ${parts.action}`,
      attributes: { 'aria-label': this.text.get(parts.label), tabindex: '-1' },
    });
    for (const id of parts.icons) element.append(icon(this.document, id, `i-${id}`));
    // At the touch, not at the release: the action answers at once.
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      commands.act(parts.action);
    });
    element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
    return element;
  }

  /** The cluster's layout: the breath alone in the first hunt, above the ram once it comes. */
  private layoutActions(hunt: Hunt): void {
    this.acts.toggleAttribute('data-ram', hunt.actions.isUnlocked('ram'));
    this.acts.toggleAttribute('data-strike', hunt.actions.isUnlocked('strike'));
  }

  private sweep(action: ActionId, share: number): void {
    const element = this.buttons.get(action);
    if (!element) return;
    const value = share > 0 ? `${String(Math.round(share * 100))}%` : '';
    if (this.cd.get(action) === value) return;
    this.cd.set(action, value);
    element.classList.toggle('cool', share > 0);
    if (value) element.style.setProperty('--cd', value);
  }

  private strikeMode(mode: StrikeMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.strike.dataset.mode = mode;
    const label = STRIKE_LABELS.get(mode);
    if (label) this.strike.setAttribute('aria-label', this.text.get(label));
  }
}

/** What the interface shows besides the hunt: the camera's window and the session's crystals. */
export interface HudState {
  readonly span: ViewSpan;
  readonly crystals: number;
}

interface ActionParts {
  readonly action: ActionId;
  readonly label: TextKey;
  readonly icons: readonly ('ram' | 'tail' | 'rock' | 'breath')[];
}
