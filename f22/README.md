# Lockheed Martin F-22A Raptor

An interactive isometric figure built with the `anatomy` skill: an F-22A on its landing
gear on a hangar floor, seen from the right rear quarter. The right engine bay has its
upper side panels off, showing the F119: the fan and compressor cases are cut with windows
so the spools can be seen turning, then the flange, the combustor with its fuel manifold,
the turbine and the afterburner duct, hanging from the deck on a mount. Behind it sits the
two-dimensional thrust-vectoring nozzle. One stick drives the stabilators, the rudders on
the canted fins, the flaperons and ailerons, and the nozzle flaps, all on hinge knuckles.
A throttle lights the afterburner plumes in WebGL.

This is the Hero cut of an Epic subject. Not modelled: the weapons bays and their doors,
the serpentine intake ducts, leading-edge flaps, the cockpit interior, the far engine bay,
the gear retraction, the radar and sensor apertures, a spotting tour of the airframe.

## Prompt

Built from one Claude Code prompt with the `anatomy` skill:

```
/anatomy explain me how a Lockheed Martin F-22 Raptor works, interactive.
```

## Build

```sh
NODE=~/.nvm/versions/node/v22.13.0/bin/node
$NODE build.mjs            # f22.html (dark)
$NODE build.mjs --light    # f22-light.html
$NODE build.mjs --audit    # geometry audit, must end "audit passed"
```

## Check

```sh
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
$NODE ../scripts/lines.mjs f22.html --reduced          # line ends: 0
$NODE ../scripts/capture.mjs f22.html --out shots/desk.png
```

## Controls

Drag across the aircraft: left and right is roll, up and down is pitch. A and D move the
rudder, the arrow keys step the stick (Shift: bigger steps), Home centres everything.
Idle, Mil and A/B (or 1, 2, 3) set the throttle. An idle tour sweeps the stick and cycles
the throttle when nobody touches the figure.

## Model

`model.mjs`: public F-22A figures (18.9 m, 13.56 m span, two F119 at 116 kN dry and 156 kN
in afterburner, 20 degree nozzle vectoring, 30 degree stabilators and rudders, 28 degree
fin cant). `surfacesAt(stick, rudder, throttle)` blends the stick into surface deflections
with illustrative gains and the published limits, and gives the thrust per engine.

## Files

- `model.mjs` - aircraft figures and the control blend.
- `parts.mjs` - geometry constants, hinged plates with knuckles, fin and rudder frames,
  windows on cylinders, rotor blade tips clipped to a window.
- `build.mjs` - floor, airframe, opened bay, engine, nozzles, booms, tails, gear, card and page.
- `live.js` - drag, keys, throttle, idle tour, readout, the plume shader.
- `f22.css` - figure styles for both themes.
