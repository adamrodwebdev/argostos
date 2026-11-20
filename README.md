# Argostos

An HTML5 game in prototype. Argostos, a young glass worm, swims through the falling sand of
Sandopia and hunts the machines of a mining company: he digs, the dunes flow and close behind
him, and he bursts out under the trucks to destroy them.

Status: **step 4, the prototype, milestone P2** (see [ROADMAP.md](ROADMAP.md)). Nothing is
published yet; the game runs locally with `npm run dev`. Changes: [CHANGELOG.md](CHANGELOG.md).

## What the prototype does

P1, the world:

- **The desert in section**, an arena 160 m wide (about five phone screens) and 62 m deep,
  simulated grain by grain: 640 × 248 cells of 25 cm, sand that falls and slides, bedrock under
  it. The engine is Lumirift's falling sand, scaled up: the grid is cut into 16 × 16 chunks that
  sleep while nothing moves in them. Past the two exits the desert goes on with the same strata.
- **Argostos** (a code-drawn stand-in until his Blender sprites): a segmented glass worm that
  follows the finger or the pointer. The farther the finger from his head, the faster he swims
  and the louder he is. He swims through the sand rather than carving tunnels: the desert keeps
  every grain. A fast rise bursts out of the dunes into a leap; a slow one skims.
- **The Company's truck**, from its Blender sprites (12-frame wheels, spring suspension), and a
  **cinematic takedown** when Argostos swallows one from below: lift and tip, wheels and panels
  torn off as rigid debris, glass, sparks, fuel fire and smoke, the body folded and dragged
  under, a sand plume; hit-stop, camera jolt, slow motion on a hunt's last prey. On a phone held
  upright the takedown plays mid-screen, with the sky above it for what it throws. Machines
  only: the cabs are empty.

P2, the hunt:

- **Hunts with a start and an end**: each hunt is a row of data (when each convoy drives in,
  what alarms it, when the drones come, when each action unlocks). A hunt is won when every
  convoy is taken; it fails as soon as a prey drives out of an exit. Convoys patrol and turn
  back before the exits; a convoy alarmed (by a drone's sonar, or, from hunt 3, by an attack on
  one of it) runs for the exit ahead.
- **Combat in numbers**: machines carry plate (hit points, from their row). Light prey, like the
  first minute's truck, fall in one bite and show no life bar; the armoured truck and the drone
  show a small bar once touched. Every hit pops its number over the machine (a strong hit
  bigger, hits close together grouped), placed by rule: below the top row, never over Argostos
  or a button. A machine brought to zero stalls in sparks and smoke, and the next bite from
  below plays its takedown. A machine's health is a list of parts (one, its body, in P2), so
  breaking a tyre or a camera can come later.
- **The actions, one by one**: hunt 1 is steering and swallowing, with the breath (the glass
  dome that holds the trucks under it) arriving at 20 s, full; hunt 2 adds the ram (a burst that
  hits hard, its cooldown a sweep on its button); hunt 3 adds the strike (a tail slap up close, a
  rock thrown at range, its icon changing with the range).
- **The scanner** of the arena in the top row (the prey off screen, the drones, the striped
  exits, the screen's window), and **the sonar drones**: their cyan rings go down into the sand,
  Argostos's amber rings grow with his speed; when they touch, "Spotted", the drone follows him
  and the convoys run. A quiet hero has no rings; a rock or a leaping bite brings a drone down.
- **The end of a hunt** over the living world: the crystals, what was taken, the experts' three
  stars (unseen, two machines in one leap, a convoy taken by the glass alone), Next hunt and
  Replay; a failure says why, keeps the crystals, gives a four-word tip and Try again. The
  pause holds Resume, Restart hunt and the sound.
- **A session log for remote testers**, in memory only: on a tester's link the pause shows a
  16-character code (time to the first gesture, time played, where they stopped, hunts begun,
  won and failed) to send back; nothing is stored or sent, nothing identifies anyone.
- **The page**: the first paint is the game's title over the desert's colours; the game fills
  the viewport in both orientations from a 320 × 568 phone up; on a window wider than 2:1 the
  playing frame and the interface stop at 2:1, centred.

## Controls

| Action    | Phone                        | Mouse                  | Keyboard                                         |
| --------- | ---------------------------- | ---------------------- | ------------------------------------------------ |
| Swim      | Argostos follows your finger | He follows the pointer | Arrows, or W A S D (Z Q S D on AZERTY keyboards) |
| Burst out | Rise fast toward the surface | Same                   | Same                                             |
| Bite      | Reach a machine from below   | Same                   | Same                                             |
| Breath    | The octagon under the thumb  | Its button             | Space                                            |
| Ram       | Its button under the thumb   | Left button            | J                                                |
| Strike    | Its button, beside the ram   | Right button           | K                                                |
| Pause     | The button at the top left   | Same                   | P                                                |

## URL options

Read strictly at the door; a value that does not fit keeps its default.

| Option      | Values                       | Default    | What it does                                                        |
| ----------- | ---------------------------- | ---------- | ------------------------------------------------------------------- |
| `seed`      | 0 to 2147483647              | 147        | The same seed builds the same desert and plays the same hunt        |
| `hunt`      | 1 to 99                      | 1          | The hunt to start with (past the table, the last hunt plays again)  |
| `detail`    | `coarse`, `standard`, `fine` | `standard` | The sand's cell: 33, 25 or 20 cm (to measure what the engine holds) |
| `autopilot` | `1`                          | off        | A bot hunts on its own and goes on to the next hunt (measurements)  |
| `debug`     | `1`                          | off        | A readout of the frame's cost, the grid, the hero's speed and noise |
| `mute`      | `1`                          | off        | Starts muted                                                        |
| `tester`    | `1`                          | off        | A remote tester's link: the pause shows the session's short code    |

## Stack and scripts

TypeScript (strict), Vite, canvas 2D, Vitest, Playwright, ESLint with typescript-eslint, oxlint,
Prettier, Lighthouse. No runtime dependency. Node 24 (`.nvmrc`).

| Script                                                | What it does                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`                                         | Development server on http://localhost:4361/                                                     |
| `npm run build` / `npm run preview`                   | Type-checked production build, and a server for it                                               |
| `npm run verify`                                      | Lint, format check, type-check, unit tests and build, as the CI runs them                        |
| `npm test`                                            | Unit tests (Vitest)                                                                              |
| `npm run test:e2e`                                    | End-to-end tests on the production build; `E2E_ENGINE=firefox` or `webkit` for the other engines |
| `npm run lighthouse -- [desktop]`                     | Lighthouse on the production build: three runs, the worst kept, failing under 100                |
| `npm run frame-time -- <url>`                         | Frame cost at phone and desktop sizes, CPU slowed 4× for the phones, hunts 1 and 3               |
| `npm run takedown-shots -- <url> <dir> [bite] [hunt]` | Films a takedown frame by frame, plus a contact sheet                                            |
| `npm run session-code -- <code>`                      | Reads a remote tester's session code                                                             |

## Architecture

Three layers that talk through events and narrow ports, plus the platform's adapters and one
composition root. Rules and logic never read the real clock or `Math.random` (a lint rule
enforces it): the clock is the fixed step, chance a seeded `RandomSource`. Everything that will
grow is a data row (machines, hunts, hits, actions, runes) and every behaviour a strategy in a
registry (takedowns, actions, part effects).

| Layer       | Folder                                                       | What lives there                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules       | `src/rules/`                                                 | Data and pure functions: the world's measures, the dunes and strata, swimming, driving, digging, the machines and their parts, the hits and actions (`combat.ts`), the hunts' rows, the sonar, the takedowns' rows, the view's framing and camera, the session code, the runes' empty tables, and the readers at the doors (`input.ts`, URL options, pointer, mouse buttons and keys, the truck's manifest) |
| Logic       | `src/logic/`                                                 | State that applies the rules: the sand grid, the hero (and his recent path), the trucks, convoys and fleet, the drones, the plate and the combat (`machine/`), the actions and the glass dome (`actions/`), the takedowns, the wreckage, the hunt, its director, stats and events, the session log, the fixed step and the time scale                                                                       |
| Design      | `src/design/`                                                | What reads state and draws or sounds, never deciding: the camera and the view, the painters, the drones and the dome, the particle pools and fires, the combat's and the takedowns' effects, the interface (`hud/`: top row, scanner, actions, damage numbers and life bars, end screen, pause), the sound port, the text table                                                                             |
| Platform    | `src/platform/`                                              | The browser's doors: the canvas and its size, the frame loop, pointer and keys, the sprite loader, the Web Audio synthesis, the clipboard, the portal port (ads and game events, a no-op on our site)                                                                                                                                                                                                       |
| Composition | `src/main.ts`, `src/game/GameApp.ts`, `src/game/HuntPlay.ts` | The entry point (small, painted first) and the game, loaded after the first paint and started in a few short tasks; a `HuntPlay` per hunt (its world, view, steps and time)                                                                                                                                                                                                                                 |

**A new machine** is a row in `src/rules/machines.ts`. **A new hunt** is a row in
`src/rules/hunts.ts`. **A new takedown** is a strategy (`src/logic/takedown/`, a
`TakedownStrategy`) registered in `Hunt`, plus its row in `src/rules/takedowns.ts`; its look
and sound come from the beats it emits. **A new action** is an `ActionStrategy` registered in
`Hunt`, plus its numbers in `src/rules/combat.ts` and its button in `HuntHud`.

## Tests

- **Unit** (`tests/`, Vitest): the sand (falling, sleeping chunks, determinism, mass kept), the
  hero, the takedowns and the wreckage, the plate and the bite (one-bite prey, several bites,
  stalls), the convoys (patrol, flight, escape, glass), the drones and the sonar, the actions
  (unlocks, cooldowns, the ram's strong hit, the strike's tail and rocks, the breath's gauge),
  the hunt's director and stars, a bot that never pays finishing hunts 1 to 4, the session code,
  the damage numbers' placement, the camera's framing, and every reader at the doors with its
  table of hostile inputs.
- **End to end** (`e2e/`, Playwright, Chrome by default; Firefox and WebKit with `E2E_ENGINE`,
  all three on the CI): the first paint, no console error, no sideways scroll, zoom allowed, the
  cursors, the interface inside the 2:1 frame, hunt 1's steering and hint, the breath at 20 s,
  hunt 3's three actions under the thumb (48 px or more, never in the left half), no browser
  menu on a right click, the pause, the tester's code, a whole hunt to its end screen and on to
  the next, and the overflow sweep from 320 to 2560 px (and 320 × 256).

## Performance

Measured on 20 November 2026 with `npm run frame-time` on the production build, in headless
Chrome on the development laptop (Ryzen 7 8845HS). The phones are emulated, with the processor
slowed 4× (roughly a mid-range phone). Mean / 95th percentile, in ms, with the autopilot hunting
(digging, hits, rocks, domes, drones, takedowns).

| Scenario                    | Viewport         | Sand cells | Frame interval | Hunt steps  | Drawing     |
| --------------------------- | ---------------- | ---------- | -------------- | ----------- | ----------- |
| Desktop                     | 1280 × 800 @1    | 158,720    | 6.1 / 6.2      | 0.14 / 0.30 | 0.40 / 0.50 |
| Desktop, DPR 2              | 1280 × 800 @2    | 158,720    | 6.1 / 6.2      | 0.14 / 0.30 | 0.46 / 0.70 |
| Phone                       | 390 × 844 @2.625 | 158,720    | 16.7 / 18.3    | 0.16 / 0.30 | 0.49 / 0.90 |
| Phone, CPU 4×               | 390 × 844 @2.625 | 158,720    | 16.7 / 18.3    | 0.60 / 1.00 | 1.97 / 3.00 |
| Phone, CPU 4×, hunt 3       | 390 × 844 @2.625 | 158,720    | 16.7 / 18.3    | 0.70 / 1.30 | 2.42 / 4.50 |
| Small phone, CPU 4×, hunt 3 | 320 × 568 @2     | 158,720    | 16.7 / 18.3    | 0.71 / 1.30 | 2.38 / 4.40 |
| Phone, CPU 4×, fine sand    | 390 × 844 @2.625 | 248,000    | 16.7 / 18.3    | 0.75 / 1.20 | 2.01 / 3.10 |

The desktop runs at the laptop's 165 Hz. Phones are capped at 60 frames a second, and on a
165 Hz screen a frame then lasts two or three refreshes of 6.06 ms: hence 16.7 / 18.3 when
nothing is late.

**Canvas 2D holds the arena** with room to spare: on a phone slowed 4×, in hunt 3, the worst
95th percentiles of the steps and the drawing add up to about 6 ms of the 16.7 ms a frame has.
WebGL2 comes in when the look needs it (sand lit like glass, strata without the steps of the
scaled image), when a real phone reads worse than the emulation, or when the arena grows. The
plan: the grid stays on the processor with the same rules; each frame uploads the changed rows
of chunks as a texture, and a fragment shader draws the sand from the cells and their shades;
the hero, trucks and particles follow as instanced quads; canvas 2D stays as the fallback. If
the steps pass about 4 ms on a real phone, the simulation moves to a worker, its grid handed
over in transferable buffers (portal iframes may refuse the headers a shared buffer needs).

**Lighthouse**, production build, worst of three runs: 100 in all four categories on mobile and
on desktop. The first paint is the page's own title; the game starts in three short tasks.

**Download**: the page 4.1 kB and its entry script 10.5 kB (1.9 and 4.5 kB gzipped), then the
game, loaded after the first paint, 147.5 kB of script and 12.6 kB of style (49.9 and 3.6 kB
gzipped), and one set of truck sprites per screen, 46.4 kB at 32 px per metre or 122.0 kB at
64 px per metre, fetched once the game runs. Nothing else is requested.

## Branches and deployment

All work goes on `dev`, through a branch and a pull request per step; `main` only receives
published versions, when the owner asks (`git switch main && git merge --ff-only dev && git push
origin main`). Nothing is deployed yet.

## Licence

© 2026 AdamRodWebDev. All rights reserved: see [LICENSE](LICENSE).
