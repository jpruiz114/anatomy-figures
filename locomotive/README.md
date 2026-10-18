# 0-4-0 steam locomotive

An interactive isometric figure built with the `anatomy` skill: a small industrial
0-4-0 with two outside cylinders on a length of track. The boiler is cut open to show
the fire tubes under the water and the dry pipe above it, the firebox to show the fire
on its grate, the near cylinder and steam chest to show the piston and slide valve. The
near-side motion works: piston rod, crosshead, connecting rod, coupling rod, return
crank and eccentric rod. Exhaust puffs leave the chimney at each release, four per turn.

This is the Hero cut of an Epic subject. Not modelled: the far-side motion, true
Walschaerts gear with a reverser, the cab interior, injectors, blower, brakes, a tender.

## Prompt

Built from one Claude Code prompt with the `anatomy` skill:

```
/anatomy explain me how a steam locomotive works, interactive.
```

## Build

```sh
NODE=~/.nvm/versions/node/v22.13.0/bin/node
$NODE build.mjs            # locomotive.html (dark)
$NODE build.mjs --light    # locomotive-light.html
$NODE build.mjs --audit    # geometry audit, must end "audit passed"
```

## Check

```sh
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
$NODE ../scripts/lines.mjs locomotive.html --reduced        # line ends: 0
$NODE ../scripts/capture.mjs locomotive.html --out shots/desk.png --height 900
```

## Controls

Drag across the engine to roll it by hand. Run turns the wheels at 24 rpm (4.1 km/h).
Arrow keys step 10 degrees (Shift: 45), Home and End are the dead centres. The four
event buttons jump to admission, cut-off, release and compression for the head end.

## Model

`model.mjs`: 30 x 40 cm cylinders, 240 cm connecting rod, 90 cm wheels, 10 bar gauge,
10 cm valve travel, 2.2 cm steam lap, 60 degrees of advance. Pressures follow an indicator
diagram per end; the two cylinders are a quarter turn apart. Mean effort at the rail is
summed from both and compared with the traditional 85 percent rating.

## Files

- `model.mjs` - kinematics, valve events, pressures, effort, exhaust beats.
- `parts.mjs` - moving parts as descriptors, spokes drawn face by face.
- `build.mjs` - track, frames, wheels, cylinder, boiler, firebox, cab, card and page.
- `live.js` - drag, run, keyboard, event buttons, readout, the puff shader.
- `loco.css` - figure styles for both themes.
