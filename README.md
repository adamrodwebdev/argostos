# Argostos

An HTML5 game in prototype. Argostos, a young glass worm, swims through the falling sand of
Sandopia and hunts the machines of a mining company: he digs, the dunes flow and close behind
him, and he bursts out under the trucks to destroy them.

Status: **step 4, the prototype, milestone P1** (see [ROADMAP.md](ROADMAP.md)). Nothing is
published yet; the game runs locally with `npm run dev`. Changes: [CHANGELOG.md](CHANGELOG.md).

## What P1 does

- **The desert in section**, an arena 160 m wide (about five phone screens) and 62 m deep,
  simulated grain by grain: 640 × 248 cells of 25 cm, sand that falls and slides, bedrock under
  it. The engine is Lumirift's falling sand, scaled up: the grid is cut into 16 × 16 chunks that
  sleep while nothing moves in them.
- **Argostos** (a code-drawn stand-in until his Blender sprites): a segmented glass worm that
  follows the finger or the pointer. The farther the finger from his head, the faster he swims
  and the more noise he makes (a number from 0 to 1 that the sonar drones of P2 will read). He
  swims through the sand rather than carving tunnels: the sand he meets is pushed aside, thrown
  up or carried round his body and laid back behind him, so his wake closes and the desert
  keeps every grain. A fast rise bursts out of the dunes into a leap; a slow one skims.
- **The Company's truck**, from its Blender sprites: it drives on the moving sand, wheels turning
  on a strip of 12 rendered frames plus the small turn between two frames, body on a spring
  suspension that squats and dives.
- **A cinematic takedown**: Argostos strikes from below, the truck lifts and tips, its wheels
  and two panels tear off and tumble on the dunes (rigid bodies that bounce, roll, settle, throw
  sand where they land and sink), the cab's glass shatters, sparks spray, the fuel bursts into
  fire and smoke, the body folds in the jaws, chars and is dragged into the sand, and the sand
  plumes up and falls back. A short hit-stop, a camera jolt scaled to the hit, and a brief slow
  motion on a hunt's last prey (every fifth truck in P1). Machines only: the cabs are empty.
- **Sound**, synthesised with Web Audio (nothing downloaded): impact, metal crunch, glass,
  fire whoosh and crackle, sand burst. A mute button; nothing plays before the first touch.
- **The page**: the game fills the viewport in both orientations, from a 320 × 568 phone up; on
  a window wider than 2:1 the playing frame stops at 2:1, centred, the art dimmed on the sides.
  The first paint is the page's own (the desert's colours and a loading line); the game's code
  loads after it.

## Controls

| Action       | Phone                        | Mouse                  | Keyboard                                           |
| ------------ | ---------------------------- | ---------------------- | -------------------------------------------------- |
| Swim         | Argostos follows your finger | He follows the pointer | Arrows, or W A S D (Z Q S D on an AZERTY keyboard) |
| Burst out    | Rise fast toward the surface | Same                   | Same                                               |
| Take a truck | Reach it from below          | Same                   | Same                                               |
| Sound        | The button at the top right  | Same                   | Tab to it, then Enter                              |

## URL options

Read strictly at the door; a value that does not fit keeps its default.

| Option      | Values                       | Default    | What it does                                                        |
| ----------- | ---------------------------- | ---------- | ------------------------------------------------------------------- |
| `seed`      | 0 to 2147483647              | 147        | The same seed builds the same desert and plays the same hunt        |
| `detail`    | `coarse`, `standard`, `fine` | `standard` | The sand's cell: 33, 25 or 20 cm (to measure what the engine holds) |
| `autopilot` | `1`                          | off        | A bot hunts on its own (measurements, smoke tests, filming)         |
| `debug`     | `1`                          | off        | A readout of the frame's cost, the grid, the hero's speed and noise |
| `mute`      | `1`                          | off        | Starts muted                                                        |

## Stack and scripts

TypeScript (strict), Vite, canvas 2D, Vitest, Playwright, ESLint with typescript-eslint, oxlint,
Prettier. No runtime dependency. Node 24 (`.nvmrc`).

| Script                                         | What it does                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run dev`                                  | Development server on http://localhost:4361/                                                          |
| `npm run build` / `npm run preview`            | Type-checked production build, and a server for it                                                    |
| `npm run verify`                               | Lint, format check, type-check, unit tests and build, as the CI runs them                             |
| `npm test`                                     | Unit tests (Vitest)                                                                                   |
| `npm run test:e2e`                             | Smoke test on the production build (Chrome: 320 × 568 upright and on its side, 390 × 844, 1280 × 800) |
| `npm run frame-time -- <url>`                  | Frame cost at phone and desktop sizes, CPU slowed 4× for the phones                                   |
| `npm run takedown-shots -- <url> <dir> [bite]` | Films a takedown frame by frame, plus a contact sheet                                                 |

## Architecture

Three layers that talk through events and narrow ports, plus the platform's adapters and one
composition root. Rules and logic never read the real clock or `Math.random` (a lint rule
enforces it): the clock is the fixed step, chance a seeded `RandomSource`.

| Layer       | Folder                               | What lives there                                                                                                                                                                                                                                                                                                |
| ----------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules       | `src/rules/`                         | Data and pure functions: the world's measures, the elements, the dunes and strata, swimming (throttle, turning, noise), driving, digging, the takedowns' rows, the view's framing, and the readers at the doors (`input.ts`, URL options, pointer and keys, the truck's manifest)                               |
| Logic       | `src/logic/`                         | State that applies the rules: the sand grid with its sleeping chunks, the sand in flight, the hero (motion, body along his path, digging), the trucks and their rigs, the takedown strategies and their registry, the wreckage, the hunt and its events, the fixed step, the time scale (hit-stop, slow motion) |
| Design      | `src/design/`                        | What reads state and draws or sounds, never deciding: the camera and the view, the painters (sky, sand, hero, trucks and wrecks, sand in flight), the particle pools and fires, the takedown effects (a registry of beats), the sound port, the text table, the debug readout                                   |
| Platform    | `src/platform/`                      | The browser's doors: the canvas and its size, the frame loop, pointer and keys, the sprite loader, the Web Audio synthesis, the portal port (ads and game events, a no-op on our site)                                                                                                                          |
| Composition | `src/main.ts`, `src/game/GameApp.ts` | The entry point (small, painted first) and the game, loaded after the first paint, where everything is built and handed down                                                                                                                                                                                    |

**A new takedown** is a new strategy (`src/logic/takedown/`, implementing `TakedownStrategy`)
registered in `Hunt`, plus its row in `src/rules/takedowns.ts`; its look and sound come from the
beats it emits (`strike`, `tear`, `shatter`, `fuel`, `drag`, `buried`), mapped in
`src/design/takedown/TakedownEffects.ts`.

## Tests

- **Unit** (`tests/`, Vitest): the sand's rules (falling, sliding, sleeping chunks, waking,
  determinism), the hero (steering, speed and noise, burst and skim, bounds, mass conservation
  over many seeds, the wake closing), the takedowns (the beats in order, debris that settles and
  sinks, sand conserved through plumes and splashes), the truck rig, the fixed step, the frame
  cap, the time scale, the framing at every screen size from 320 × 568, and every reader at the
  doors with its table of hostile inputs.
- **Smoke** (`e2e/`, Playwright, Chrome only for now): loads, draws, no console error, no
  sideways scroll, zoom allowed, the mute button, the cursors.

## Performance

Measured on 20 November 2026 with `npm run frame-time` on the production build, in headless
Chrome on the development laptop (Ryzen 7 8845HS). The phones are emulated, with the processor
slowed 4× (roughly a mid-range phone); another program held the graphics card at 95 % during
the runs. Two runs, the worse figure kept. Mean / 95th percentile, in ms, with the autopilot
hunting (digging, bites, takedowns).

| Scenario                     | Viewport         | Sand cells | Frame interval | Hunt steps  | Drawing      |
| ---------------------------- | ---------------- | ---------- | -------------- | ----------- | ------------ |
| Desktop                      | 1280 × 800 @1    | 158,720    | 6.1 / 6.2      | 0.25 / 0.80 | 0.75 / 1.80  |
| Desktop, DPR 2               | 1280 × 800 @2    | 158,720    | 6.1 / 6.2      | 0.18 / 0.50 | 0.47 / 0.80  |
| Phone                        | 390 × 844 @2.625 | 158,720    | 16.7 / 18.3    | 0.17 / 0.50 | 0.41 / 0.80  |
| Phone, CPU 4×                | 390 × 844 @2.625 | 158,720    | 16.7 / 18.3    | 1.06 / 4.50 | 2.58 / 7.90  |
| Small phone, CPU 4×          | 320 × 568 @2     | 158,720    | 16.7 / 18.3    | 0.76 / 1.50 | 1.71 / 3.10  |
| Phone, CPU 4×, fine sand     | 390 × 844 @2.625 | 248,000    | 16.7 / 18.3    | 0.98 / 2.00 | 2.12 / 4.50  |
| Phone, CPU 4×, coarse sand ¹ | 390 × 844 @2.625 | 89,280     | 17.8 / 36.2    | 0.89 / 2.70 | 3.94 / 17.30 |

The desktop runs at the laptop's 165 Hz. Phones are capped at 60 frames a second, and on a
165 Hz screen a frame then lasts two or three refreshes of 6.06 ms: hence 16.7 / 18.3 when
nothing is late. ¹ One spike in one run; the other run read 16.7 / 18.3, 0.60 / 1.20 and
1.75 / 2.70.

**Canvas 2D holds the arena**, at 25 cm and at 20 cm, with room to spare: on a phone slowed 4×
the worst 95th percentiles of the steps and the drawing add up to about 12 ms of the 16.7 ms a
frame has. P1 therefore stays on canvas 2D. WebGL2 comes in when the look needs it (sand lit
like glass, strata without the steps of the scaled image), when a real phone reads worse than
the emulation, or when the arena grows. The plan: the grid stays on the processor with the same
rules; each frame uploads the changed rows of chunks as a texture (the spans `putImageData`
uploads today), and a fragment shader draws the sand from the cells and their shades; the
hero, trucks and particles follow as instanced quads; canvas 2D stays as the fallback. If the
steps pass about 4 ms on a real phone, the simulation moves to a worker, its grid handed over
in transferable buffers (portal iframes may refuse the headers a shared buffer needs).

**Download**: the page 4.8 kB and its entry script 8.0 kB (2.0 and 3.5 kB gzipped), then the
game, loaded after the first paint, 87.4 kB (30.8 kB gzipped), and one set of truck sprites per
screen, 46.4 kB at 32 px per metre or 122.0 kB at 64 px per metre, fetched once the game runs.
Nothing else is requested. **Start**: from a cold cache, on the emulated phone slowed 4× over a
slow 4G line (150 ms of latency, 1.6 Mbit/s), the first paint came at 0.24 to 0.70 s and the
game answered the finger at 0.89 to 0.99 s (three loads, 36.9 kB transferred).

## Branches and deployment

All work goes on `dev`, through a branch and a pull request per step; `main` only receives
published versions, when the owner asks (`git switch main && git merge --ff-only dev && git push
origin main`). Nothing is deployed yet.

## Licence

© 2026 AdamRodWebDev. All rights reserved: see [LICENSE](LICENSE).
