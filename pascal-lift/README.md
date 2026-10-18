# Hydraulic lift (Pascal's principle)

An interactive isometric figure built with the `anatomy` skill: a bench hydraulic lift
with a 30 mm hand plunger and a 60 mm ram joined by an oil pipe, both cut open, with a
Bourdon gauge on each tee of the pipe. The two gauges always read the same pressure;
the ram rises a quarter as far as the plunger is pushed and carries four times the force.

## Build

```sh
NODE=~/.nvm/versions/node/v22.13.0/bin/node
$NODE build.mjs            # pascal-lift.html (dark)
$NODE build.mjs --light    # pascal-lift-light.html
$NODE build.mjs --audit    # geometry audit, must end "audit passed"
```

## Check

```sh
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
$NODE ../scripts/lines.mjs pascal-lift.html --reduced        # line ends: 0
$NODE ../scripts/capture.mjs pascal-lift.html --out shots/desk.png --height 900
```

## Controls

Drag down on the figure to push the plunger; the ram follows at a quarter of the travel.
Arrow keys step 5 mm (Shift: 20), Home and End are the ends of the stroke, plus and minus
add and remove 10 kg weights, as do the buttons under the card. The idle tour pumps the
plunger and adds a weight each cycle.

## Model

`model.mjs`: areas from the two bores, pressure = load / ram area, hand force = pressure x
plunger area, ram travel = plunger travel / 4. Platform 2 kg, weights 10 kg each, up to four.
The oil's own head (about 0.01 bar) is left out and said so in the caption.
