# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Repository set-up: readme, roadmap, licence notice, line endings and ignored files.
- Prototype milestone P1:
  - tooling: Vite, strict TypeScript, ESLint and oxlint, Prettier, Vitest, a Playwright smoke
    test in Chrome (320 × 568 upright and on its side, 390 × 844, 1280 × 800), and a CI
    workflow (lint, types, unit tests, build, smoke) on pull requests and pushes to `dev`;
  - the desert in section: an arena 160 m wide simulated grain by grain (Lumirift's falling
    sand scaled up, with sleeping chunks), a fixed simulation step at any refresh rate, the
    clock and chance injected and seeded;
  - Argostos, a code-drawn stand-in: a segmented glass worm that follows the finger or the
    pointer, faster and louder the farther it is, swimming through the sand without tunnels
    (the desert keeps every grain), bursting out of the dunes when he rises fast;
  - the Company's truck from its sprites: 12-frame wheels, spring suspension, tyre dust;
  - a cinematic takedown (swallowed from below) built as a strategy in a registry: lift and
    tip, wheels and panels torn off as rigid debris that settle on the sand, glass, sparks,
    fuel fire and smoke, the body folded, charred and dragged under, a sand plume; hit-stop,
    camera jolt, slow motion on a hunt's last prey;
  - sound synthesised with Web Audio behind a sound port, with a mute button;
  - a platform port for the portals' ads and game events (a no-op on our own site);
  - the page: full viewport in both orientations, a 2:1 playing frame on wide screens, the
    first paint from the HTML, light and dark interface tokens, the cursor rule, zoom allowed
    with only the play area held still;
  - typed readers at every door (URL options, pointer and touch, keys, the sprite manifest and
    files) with tables of hostile inputs in the tests;
  - scripts to measure the frame time and to film a takedown frame by frame.
- Prototype milestone P2:
  - hunts as data rows played by a director: convoys and drones on time, actions unlocked on
    time (hunt 1: the breath at 20 s; hunt 2: the ram; hunt 3: the strike), a success once every
    convoy is taken, a failure when a prey drives out of an exit;
  - combat in numbers: machines with plate from their rows (a list of parts, the body for now),
    one-bite prey without a life bar, a bar on the armoured truck and the drone, a number over
    the machine at every hit, placed by rule (under the top row, never over Argostos or a
    button) and grouped when hits come close; a machine at zero stalls until the bite that
    finishes it; the hit-stop weighed by the machine;
  - the actions as strategies in a registry: the ram (a burst, a strong hit at full speed, its
    cooldown a sweep), the strike (a tail slap up close, a rock flung at range, its icon by
    range), the breath (a glass dome that holds the trucks, its gauge refilled by eating);
  - convoys that patrol, turn back before the exits, and flee when alarmed by the sonar or an
    attack, as their row says; armoured trucks with steel plates;
  - sonar drones that hear a loud hero (cyan rings against his amber ones), mark and follow him,
    and fall to rocks or a leaping bite; the scanner of the arena in the top row;
  - the hunt's interface from the validated mockup: the top row, "Spotted", the first hunt's
    hint, the right thumb's cluster (54 to 96 px, never in the left half) with key hints on a
    computer, the end screen (crystals, machines taken, three stars, Next hunt and Replay) and
    the failure screen (why, the crystals kept, a four-word tip, Try again), the pause;
  - the mouse's buttons (ram, strike) and the keys Space, J, K and P;
  - a takedown framed mid-screen on a phone held upright, the sky above it;
  - the desert past the exits drawn with the arena's strata on wide windows, and the exits'
    striped poles;
  - a session log for remote testers, read as a 16-character code (no personal data, nothing
    stored or sent), and `npm run session-code` to read one;
  - a place for the runes to come: the hero's recent path, a rune port, empty rune and relic
    tables;
  - the end-to-end tests in Chrome, Firefox and WebKit (`E2E_ENGINE`; the CI plays all three),
    the overflow sweep from 320 to 2560 px, and `npm run lighthouse` (worst of three runs).

### Changed

- The first paint is the game's title; the game starts in three short tasks (Lighthouse: 100 in
  the four categories, mobile and desktop).
- The sound's on/off moves into the pause.
