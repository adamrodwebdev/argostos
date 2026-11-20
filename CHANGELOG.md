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
