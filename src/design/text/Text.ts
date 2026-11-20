/*
 * Every visible string goes through this table from the first line (English is the base
 * language; French and Indonesian come once the final version is approved). Keys, never text
 * in the code; numbers through `Intl` in the language shown.
 */

const EN = {
  title: 'Argostos',
  loading: 'Loading the desert…',
  failed: 'The desert could not load. Reload the page to try again.',
  trucksFailed: 'The trucks could not load: the hunt goes on without them.',
  canvas:
    'The desert of Sandopia seen in section. Argostos, a glass worm, swims under the dunes toward your finger or pointer, bursts out and swallows the trucks of a mining company.',
  readoutFrame: 'frame',
  readoutStep: 'step',
  readoutPaint: 'paint',
  readoutCells: 'cells',
  readoutAwake: 'awake',
  readoutNoise: 'noise',
  readoutSpeed: 'speed',
  readoutEaten: 'eaten',
  readoutParticles: 'particles',
  soundMute: 'Mute the sound',
  pause: 'Pause',
  paused: 'Paused',
  resume: 'Resume',
  restartHunt: 'Restart hunt',
  close: 'Close',
  sound: 'Sound',
  scanner: 'Arena scanner',
  crystals: 'Crystals',
  spotted: 'Spotted',
  hintFollowVibrations: 'Follow the vibrations',
  ram: 'Ram',
  strikeTail: 'Strike: tail',
  strikeRock: 'Strike: rock',
  breath: 'Breathe glass',
  huntKicker: 'Glass Desert · Hunt {n}',
  huntComplete: 'Hunt complete',
  convoyGotAway: 'The convoy got away',
  truckGotAway: 'The truck got away',
  whySpotted: 'Spotted by sonar',
  whyAttacked: 'They fled your attack',
  whyEscaped: 'A prey reached the exit',
  tipSpotted: 'Move slowly near drones',
  tipAttacked: 'Trap convoys in glass',
  tipEscaped: 'Bite before the exits',
  kept: 'kept',
  crystalsEarned: 'Crystals earned',
  trucksTaken: 'Trucks taken',
  dronesDowned: 'Drones downed',
  nextHunt: 'Next hunt',
  replay: 'Replay',
  tryAgain: 'Try again',
  starUnseen: 'Unseen',
  starDoubleBite: 'Double bite',
  starGlassOnly: 'Glass only',
  starWon: 'won',
  starMissed: 'not won',
  testerCode: 'Tester code',
  copy: 'Copy',
  copied: 'Copied',
} as const;

export type TextKey = keyof typeof EN;

const LOCALES: ReadonlyMap<string, Readonly<Record<TextKey, string>>> = new Map([['en', EN]]);

export class Text {
  private readonly strings: Readonly<Record<TextKey, string>>;
  private readonly decimal: Intl.NumberFormat;
  private readonly whole: Intl.NumberFormat;

  constructor(readonly locale = 'en') {
    this.strings = LOCALES.get(locale) ?? EN;
    this.decimal = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    this.whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  }

  get(key: TextKey): string {
    return this.strings[key];
  }

  /** A number with one decimal (12.3). */
  decimalOf(value: number): string {
    return this.decimal.format(value);
  }

  /** A whole number, grouped for this language (163,840). */
  wholeOf(value: number): string {
    return this.whole.format(value);
  }

  /** A string with its `{n}` replaced by a whole number in this language. */
  withNumber(key: TextKey, n: number): string {
    return this.get(key).replace('{n}', this.wholeOf(n));
  }
}
