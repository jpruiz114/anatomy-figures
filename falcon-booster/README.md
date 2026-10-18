# Falcon 9 first stage

An interactive isometric figure built with the `anatomy` skill: a Falcon 9 Block 5
booster on its landing pad with three cutaway panels, nine Merlin engines with a
WebGL plume, grid fins and landing legs that unfold, and two propellant tanks that
drain. One flight model (`model.mjs`) drives every moving part, the readout and the
caption numbers.

## Build

Needs Node 20.10 or later and Google Chrome (for the checks).

```sh
NODE=~/.nvm/versions/node/v22.13.0/bin/node
$NODE build.mjs            # falcon-booster.html (dark)
$NODE build.mjs --light    # falcon-booster-light.html
$NODE build.mjs --audit    # geometry audit, must end "audit passed"
```

## Check

```sh
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
$NODE ../scripts/lines.mjs falcon-booster.html --reduced        # line ends: 0
$NODE ../scripts/capture.mjs falcon-booster.html --out shots/desk.png --height 1300
$NODE ../scripts/capture.mjs falcon-booster.html --out shots/phone.png --width 390
```

## Files

- `model.mjs` - the flight model: phases, throttle, propellant, altitude, speed, deployments.
- `parts.mjs` - geometry of the parts that move (legs, fins, liquids), shared by build and page.
- `build.mjs` - static geometry, cutaway windows, card and page.
- `live.js` - page runtime: scrubbing, tour, plume shader, readout.
- `booster.css` - figure styles, light and dark tokens.
- `../kit`, `../scripts` - a copy of the anatomy skill's kit and tools.

## Controls

Drag or hover across the figure to scrub the mission clock. Space or the Play button
runs it at 8x. Arrow keys step 5 s (Shift: 30 s), Home and End jump to liftoff and
touchdown. The phase buttons under the card jump to each event.

## Scope

This is the Hero cut of an Epic subject. Not modelled: the flip itself (the booster
stays upright), stage separation hardware, the droneship, grid-fin aerodynamics,
leg hydraulics and the second stage. The altitude and speed track is a representative
return-to-launch-site profile, not telemetry from one flight.
