// Falcon 9 Block 5 first stage: a pure flight model for a representative
// return-to-launch-site mission. Every number the figure shows comes from here.
// Units: seconds, metres, kilograms, newtons, unless named otherwise.

export const BOOSTER = {
  diameter: 3.66,
  engines: 9,
  thrustSeaLevel: 845e3, // N per engine, Merlin 1D
  thrustVacuum: 914e3,
  ispSeaLevel: 282, // s
  ispVacuum: 311,
  mixture: 2.34, // LOX : RP-1 by mass
  lox: 287400, // kg at liftoff
  rp1: 123500,
  dry: 25600,
  loxDensity: 1255, // kg/m3, subcooled to about -207 C
  rp1Density: 830, // chilled
  scaleHeight: 7200, // m, for ambient pressure
  g0: 9.80665,
};

// Phases of the mission clock. `engines` lists the engines that burn, by
// position index: 0 is the centre engine, 1..8 run round the octaweb.
export const PHASES = [
  { id: "liftoff", name: "Liftoff", from: 0, to: 140, engines: [0, 1, 2, 3, 4, 5, 6, 7, 8], say: "nine Merlins, full thrust" },
  { id: "meco", name: "MECO", from: 140, to: 143, engines: [], say: "main engine cut-off" },
  { id: "separation", name: "Stage separation", from: 143, to: 146, engines: [], say: "pneumatic pushers release the second stage" },
  { id: "flip", name: "Flip", from: 146, to: 160, engines: [], say: "nitrogen cold-gas thrusters turn the booster engines-first" },
  { id: "boostback", name: "Boostback burn", from: 160, to: 196, engines: [0, 3, 7], say: "three engines reverse the ground track" },
  { id: "coast", name: "Coast", from: 196, to: 400, engines: [], say: "grid fins unfold above the atmosphere" },
  { id: "entry", name: "Entry burn", from: 400, to: 420, engines: [0, 3, 7], say: "three engines shield the base from re-entry heating" },
  { id: "descent", name: "Aerodynamic descent", from: 420, to: 460, engines: [], say: "grid fins steer; drag slows the booster" },
  { id: "landing", name: "Landing burn", from: 460, to: 488, engines: [0], say: "the centre engine throttles down to touchdown" },
  { id: "landed", name: "Touchdown", from: 488, to: 488, engines: [], say: "landed on four legs" },
];
export const T_END = 488;
export const EVENTS = {
  maxQ: 72,
  finsDeploy: [210, 216],
  legsDeploy: [478, 484],
};

// Throttle along the ascent, as [t, share]. Max-Q throttle-down at 62-82 s,
// then back up, then down toward MECO to hold acceleration.
const ASCENT_THROTTLE = [
  [0, 1],
  [50, 1],
  [62, 0.72],
  [82, 0.72],
  [92, 1],
  [118, 1],
  [140, 0.78],
];
const LANDING_THROTTLE = [
  [460, 1],
  [470, 0.85],
  [484, 0.6],
  [488, 0.5],
];

// Altitude (km) and speed (m/s) keyframes of a typical RTLS profile. Smooth
// monotone cubic between them.
const TRACK = [
  [0, 0, 0],
  [30, 1.6, 130],
  [60, 7.5, 290],
  [72, 11.5, 420],
  [90, 22, 650],
  [110, 38, 1050],
  [125, 52, 1450],
  [140, 67, 1900],
  [146, 76, 1870],
  [160, 93, 1750],
  [180, 110, 1350],
  [196, 121, 1000],
  [250, 133, 900],
  [300, 125, 1050],
  [350, 100, 1300],
  [400, 66, 1650],
  [410, 53, 1250],
  [420, 42, 900],
  [440, 22, 520],
  [455, 8, 330],
  [460, 5.5, 290],
  [470, 2.4, 170],
  [480, 0.5, 60],
  [488, 0, 0],
];

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const lerpTable = (table, t) => {
  if (t <= table[0][0]) return table[0][1];
  for (let index = 1; index < table.length; index++) {
    if (t <= table[index][0]) {
      const [t0, v0] = table[index - 1];
      const [t1, v1] = table[index];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return table[table.length - 1][1];
};

// Fritsch-Carlson monotone cubic through (x, y) keys, column `column` of TRACK.
function hermite(column) {
  const xs = TRACK.map((row) => row[0]);
  const ys = TRACK.map((row) => row[column]);
  const n = xs.length;
  const d = new Array(n).fill(0);
  const h = [];
  const s = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i]);
    s.push((ys[i + 1] - ys[i]) / h[i]);
  }
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] <= 0) d[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      d[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]);
    }
  }
  d[0] = s[0];
  d[n - 1] = s[n - 2];
  return (x) => {
    const t = clamp(x, xs[0], xs[n - 1]);
    let i = 0;
    while (i < n - 2 && t > xs[i + 1]) i++;
    const u = (t - xs[i]) / h[i];
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
    const h10 = u ** 3 - 2 * u ** 2 + u;
    const h01 = -2 * u ** 3 + 3 * u ** 2;
    const h11 = u ** 3 - u ** 2;
    return Math.max(0, h00 * ys[i] + h10 * h[i] * d[i] + h01 * ys[i + 1] + h11 * h[i] * d[i + 1]);
  };
}
export const altitudeKm = hermite(1);
export const speedMs = hermite(2);

export const phaseAt = (t) => PHASES.find((phase) => t >= phase.from && t < phase.to) ?? PHASES[PHASES.length - 1];

// Ambient pressure as a share of sea level, from altitude.
export const pressureShare = (t) => Math.exp((-altitudeKm(t) * 1000) / BOOSTER.scaleHeight);

// Per-engine throttle share at time t: 0 when off.
export function throttleAt(t) {
  const phase = phaseAt(t);
  if (!phase.engines.length) return 0;
  if (phase.id === "liftoff") return lerpTable(ASCENT_THROTTLE, t);
  if (phase.id === "landing") return lerpTable(LANDING_THROTTLE, t);
  return 1;
}

export function enginesAt(t) {
  const phase = phaseAt(t);
  const share = throttleAt(t);
  return Array.from({ length: BOOSTER.engines }, (_, index) => (phase.engines.includes(index) ? share : 0));
}

// Thrust and specific impulse at the ambient pressure of time t, one engine at full throttle.
export function engineAt(t) {
  const p = pressureShare(t);
  const thrust = BOOSTER.thrustVacuum - (BOOSTER.thrustVacuum - BOOSTER.thrustSeaLevel) * p;
  const isp = BOOSTER.ispVacuum - (BOOSTER.ispVacuum - BOOSTER.ispSeaLevel) * p;
  return { thrust, isp, flow: thrust / (isp * BOOSTER.g0) };
}

// Total thrust (N) and mass flow (kg/s) at time t.
export function burnAt(t) {
  const engine = engineAt(t);
  const shares = enginesAt(t);
  const total = shares.reduce((sum, share) => sum + share, 0);
  return { thrust: total * engine.thrust, flow: total * engine.flow, lit: shares.filter((share) => share > 0).length, engines: shares };
}

// Propellant left at time t, integrated at 0.5 s steps and cached.
const STEP = 0.5;
const USED = [0];
for (let t = 0; t < T_END; t += STEP) USED.push(USED[USED.length - 1] + burnAt(t + STEP / 2).flow * STEP);
export function propellantAt(t) {
  const index = clamp(t / STEP, 0, USED.length - 1);
  const i = Math.floor(index);
  const used = USED[i] + (USED[Math.min(i + 1, USED.length - 1)] - USED[i]) * (index - i);
  const total = BOOSTER.lox + BOOSTER.rp1;
  const left = Math.max(0, total - used);
  const share = left / total;
  return { lox: BOOSTER.lox * share, rp1: BOOSTER.rp1 * share, used, share };
}

// Deployment shares, 0 stowed to 1 out, with a smooth ease.
const ease = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};
export const finsAt = (t) => ease((t - EVENTS.finsDeploy[0]) / (EVENTS.finsDeploy[1] - EVENTS.finsDeploy[0]));
export const legsAt = (t) => ease((t - EVENTS.legsDeploy[0]) / (EVENTS.legsDeploy[1] - EVENTS.legsDeploy[0]));

// Cold-gas thrusters fire through the flip and in short pulses while steering.
export function coldGasAt(t) {
  if (t >= 146 && t < 160) return 1;
  return 0;
}

export function clockText(t) {
  const whole = Math.max(0, Math.floor(t));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `T+${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function stateAt(t) {
  const time = clamp(t, 0, T_END);
  const burn = burnAt(time);
  const fuel = propellantAt(time);
  return {
    t: time,
    phase: phaseAt(time),
    altitudeKm: altitudeKm(time),
    speedMs: speedMs(time),
    pressure: pressureShare(time),
    thrust: burn.thrust,
    lit: burn.lit,
    engines: burn.engines,
    lox: fuel.lox,
    rp1: fuel.rp1,
    fins: finsAt(time),
    legs: legsAt(time),
    coldGas: coldGasAt(time),
  };
}

// Tank geometry shared with the drawing, in world units of 0.1 m.
export const TANKS = {
  radius: 18.3,
  inner: 17.8,
  domeHeight: 13,
  rp1: { bottom: 38, top: 150 }, // cylinder section
  lox: { bottom: 176, top: 376 },
};
const AREA = Math.PI * (BOOSTER.diameter / 2) ** 2; // m2
const DOME_VOLUME = (2 / 3) * Math.PI * (BOOSTER.diameter / 2) ** 2 * (TANKS.domeHeight / 10); // m3
// Liquid level (world z) for a mass of propellant in a tank.
export function levelOf(tank, mass, density) {
  const volume = mass / density;
  const cylinder = (tank.top - tank.bottom) / 10;
  if (volume <= DOME_VOLUME) return tank.bottom - TANKS.domeHeight + (TANKS.domeHeight * volume) / DOME_VOLUME;
  const inCylinder = Math.min(cylinder, (volume - DOME_VOLUME) / AREA);
  const above = Math.max(0, volume - DOME_VOLUME - cylinder * AREA);
  return tank.bottom + inCylinder * 10 + Math.min(TANKS.domeHeight * 0.8, (TANKS.domeHeight * above) / DOME_VOLUME);
}
export const loxLevel = (mass) => levelOf(TANKS.lox, mass, BOOSTER.loxDensity);
export const rp1Level = (mass) => levelOf(TANKS.rp1, mass, BOOSTER.rp1Density);
