# Mill engine

An interactive isometric figure built with the `anatomy` skill: a single-cylinder,
double-acting horizontal mill engine with a D slide valve. The cylinder barrel and the
steam chest are cut open; the piston, the steam on both sides of it, and the valve over
its three ports all move with the crank. One model (`model.mjs`) gives the piston and
valve positions, the pressure in each end, torque and power.

## Build

```sh
NODE=~/.nvm/versions/node/v22.13.0/bin/node
$NODE build.mjs            # steam-engine.html (dark)
$NODE build.mjs --light    # steam-engine-light.html
$NODE build.mjs --audit    # geometry audit, must end "audit passed"
```

## Check

```sh
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
$NODE ../scripts/lines.mjs steam-engine.html --reduced        # line ends: 0
$NODE ../scripts/capture.mjs steam-engine.html --out shots/desk.png --height 1000
```

## Controls

Drag across the engine to turn the crank by hand (one stage width is a turn and a half).
Run starts it at 24 rpm, slowed from its rated 120 so the valve events can be followed.
Arrow keys step 10 degrees (Shift: 45), Home is head-end dead centre, End the crank-end
one. The four event buttons jump the crank to admission, cut-off, release and compression
for the head end.

## Model

200 mm bore, 400 mm stroke, 1,000 mm connecting rod, 7 bar absolute steam, 1.15 bar back
pressure, 50 mm valve travel, 12 mm steam lap, 2 mm exhaust lap, 55.3 degrees angle of
advance. Pressures follow a simple indicator diagram: admission at boiler pressure,
hyperbolic expansion after cut-off, exhaust at back pressure, hyperbolic compression after
the exhaust port shuts.

## Files

- `model.mjs` - kinematics, valve events, pressures, torque, power.
- `parts.mjs` - the moving parts as descriptors; `facesSvg` draws the flywheel spokes face by face.
- `build.mjs` - static geometry, two cutaway windows, pipes, flywheel, card and page.
- `live.js` - drag, run, keyboard, event buttons, readout.
- `engine.css` - figure styles for both themes.
