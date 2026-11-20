/*
 * The seam for the portals (Playgama, CrazyGames…), laid now so that ads and game events plug
 * in later without touching the game: the game talks only to these ports. Portal SDKs come in
 * step 8, once the final version is approved; until then the web platform does nothing.
 */

/** What an ad break did. */
export type AdOutcome = 'shown' | 'skipped' | 'unavailable';

/** Ads, for after a portal accepts the game (never during CrazyGames' Basic Launch). */
export interface AdsPort {
  /** A break between hunts; the game pauses and mutes while it plays. */
  showInterstitial(): Promise<AdOutcome>;
  /** An ad the player chose to watch for a reward: true when the reward is earned. */
  showRewarded(): Promise<boolean>;
}

/** The game's moments a portal wants to know (it measures play time from them). */
export interface GameplayPort {
  gameplayStart(): void;
  gameplayStop(): void;
}

export interface PlatformPort extends AdsPort, GameplayPort {
  readonly id: 'web';
}

/** Our own site: no ads, nobody to tell. */
export class WebPlatform implements PlatformPort {
  readonly id = 'web';

  showInterstitial(): Promise<AdOutcome> {
    return Promise.resolve('unavailable');
  }

  showRewarded(): Promise<boolean> {
    return Promise.resolve(false);
  }

  gameplayStart(): void {
    // No portal to tell.
  }

  gameplayStop(): void {
    // No portal to tell.
  }
}
