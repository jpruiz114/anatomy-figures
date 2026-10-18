# anatomy-figures

Interactive isometric figures that explain how machines work, built with Claude Code and the
[`anatomy`](https://github.com/wheresryan22/anatomy) agent skill by Ryan (MIT). Each figure is a
single self-contained HTML page: SVG drawn back to front from a pure model of the machine, with a
WebGL layer for plumes, steam and light, and a live readout driven by the same numbers that move
the parts.

**Gallery (GitHub Pages):** https://jpruiz114.github.io/anatomy-figures/

| Fig | Figure | Page | What moves |
|---|---|---|---|
| 1 | Falcon 9 first stage | [dark](falcon-booster/booster.html) · [light](falcon-booster/booster-light.html) | A return-to-launch-site flight: throttle table, propellant, grid fins and legs, engine plumes |
| 2 | Horizontal mill steam engine | [dark](steam-engine/engine.html) · [light](steam-engine/engine-light.html) | Slide valve, piston, crosshead, flywheel; indicator diagram per end |
| 3 | Pascal's principle | [dark](pascal-lift/lift.html) · [light](pascal-lift/lift-light.html) | A bench hydraulic lift: push the small piston, lift the weights, read both gauges |
| 4 | 0-4-0 steam locomotive | [dark](locomotive/locomotive.html) · [light](locomotive/locomotive-light.html) | Cut boiler, firebox and cylinder; valve gear and motion; exhaust puffs on the beat |
| 5 | Lockheed Martin F-22A Raptor | [dark](f22/f22.html) · [light](f22/f22-light.html) | Opened F119 bay with turning spools; stick drives every surface and the vectoring nozzles; afterburner |

## The skill

The skill was installed with the `skills` CLI:

```sh
npx skills add https://github.com/wheresryan22/anatomy --skill anatomy
```

It lands in `.agents/skills/anatomy`; Claude Code reads `.claude/skills/`, so a symlink
(`.claude/skills/anatomy -> ../../.agents/skills/anatomy`) and `/reload-skills` made `/anatomy`
available. `kit/` and `scripts/` here are a copy of the skill's own kit (camera, solids, lathe,
tubes, audit, WebGL layer, headless-Chrome capture, drive and line-end checks), kept with the
figures so the pages rebuild without the skill installed. See `kit/LICENSE`.

## The prompts

Each figure came from one prompt, in this order:

1. `/anatomy explain me how the spacex first-stage booster works, interactive.`
2. `/anatomy explain me how a steam engine works, interactive.`
3. `/anatomy explain me how the Pascal principle works, interactive.`
4. `/anatomy explain me how a steam locomotive works, interactive.`
5. `/anatomy explain me how a Lockheed Martin F-22 Raptor works, interactive.`

The skill sizes the subject first (Figure, Hero or Epic). The booster, both steam engines and the
F-22 are Epic subjects built as their Hero cut; each figure's README lists what the full version
would add. Nothing else was specified: object, camera, parts list, model and shaders are the
skill's workflow applied by the agent.

## How a figure is checked

Every figure ends with the skill's verification pass:

- `node build.mjs --audit` records the true shape of every part and proves nothing passes through
  anything, every part rests on another, and every overlap is painted in depth order.
- `node scripts/lines.mjs page.html` proves every seam, tick and rib ends on a stroke, a dot or an
  outline, in both themes and in every resting pose.
- Headless Chrome captures at desktop and phone width, 4x close-ups of every junction, and slowed
  contact sheets across each shader transition (no pops, ink monotonic in the light theme).

## Build

```sh
NODE=~/.nvm/versions/node/v22.13.0/bin/node          # any Node 22
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cd f22
$NODE build.mjs            # f22.html (dark)
$NODE build.mjs --light    # f22-light.html
$NODE build.mjs --audit    # must end "audit passed"
$NODE ../scripts/lines.mjs f22.html --reduced   # line ends: 0
```

Each figure folder has the same layout: `model.mjs` (the pure model), `parts.mjs` (moving parts
shared by build and page), `build.mjs` (geometry, card, page), `live.js` (interaction and shaders),
a stylesheet, a README and a `shots/` folder with the desktop capture.

## Licence

Figures: MIT, Jean Paul Ruiz. `kit/` and `scripts/`: MIT, Ryan (wheresryan22/anatomy), see
`kit/LICENSE`.
