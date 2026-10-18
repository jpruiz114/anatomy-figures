// A single-cylinder, double-acting horizontal mill engine with a D slide valve.
// Pure model: crank angle in, positions, pressures, torque and power out.
// Units: cm for geometry in the drawing, SI for thermodynamics.

export const ENGINE = {
  bore: 20, // cm
  stroke: 40, // cm
  crank: 20, // cm, half the stroke
  conrod: 100, // cm, crosshead pin to crankpin
  clearance: 0.08, // share of swept volume at each end
  boilerBar: 7.0, // bar absolute (6 bar gauge)
  backBar: 1.15, // bar absolute, exhaust back pressure
  valveTravel: 5.0, // cm, so the eccentric throw is 2.5
  steamLap: 1.2, // cm
  exhaustLap: 0.2, // cm
  advanceDeg: 55.3, // angle of advance: gives about 6 degrees of lead
  ratedRpm: 120,
  shownRpm: 24, // the figure runs slowed so the valve events can be followed
};

export const DEG = Math.PI / 180;
const wrap = (deg) => ((deg % 360) + 360) % 360;

// Piston displacement from the head-end dead centre, cm, exact slider-crank.
export function pistonAt(theta) {
  const { crank: r, conrod: L } = ENGINE;
  const a = theta * DEG;
  return r * (1 - Math.cos(a)) + L - Math.sqrt(L * L - r * r * Math.sin(a) ** 2);
}
// dx/dtheta in cm per radian.
export function pistonRate(theta) {
  const { crank: r, conrod: L } = ENGINE;
  const a = theta * DEG;
  return r * Math.sin(a) + (r * r * Math.sin(a) * Math.cos(a)) / Math.sqrt(L * L - r * r * Math.sin(a) ** 2);
}
// Valve displacement toward the crank end, cm. Positive uncovers the head-end steam port.
export const valveAt = (theta) => (ENGINE.valveTravel / 2) * Math.cos((theta - ENGINE.advanceDeg) * DEG);

// Port openings in cm (0 when shut).
export function portsAt(theta) {
  const v = valveAt(theta);
  return {
    headSteam: Math.max(0, v - ENGINE.steamLap),
    crankSteam: Math.max(0, -v - ENGINE.steamLap),
    headExhaust: Math.max(0, -v - ENGINE.exhaustLap),
    crankExhaust: Math.max(0, v - ENGINE.exhaustLap),
  };
}

// Event angles for the head end, found by scanning.
function eventsOf(side) {
  const open = (theta) => {
    const p = portsAt(theta);
    return side === "head" ? { steam: p.headSteam > 0, exhaust: p.headExhaust > 0 } : { steam: p.crankSteam > 0, exhaust: p.crankExhaust > 0 };
  };
  const found = { admission: null, cutoff: null, release: null, compression: null };
  for (let t = 0; t < 360; t += 0.05) {
    const a = open(t);
    const b = open(t + 0.05);
    if (!a.steam && b.steam) found.admission = wrap(t + 0.05);
    if (a.steam && !b.steam) found.cutoff = wrap(t + 0.05);
    if (!a.exhaust && b.exhaust) found.release = wrap(t + 0.05);
    if (a.exhaust && !b.exhaust) found.compression = wrap(t + 0.05);
  }
  return found;
}
export const EVENTS = { head: eventsOf("head"), crank: eventsOf("crank") };

const AREA = Math.PI * (ENGINE.bore / 2) ** 2; // cm2
const SWEPT = AREA * ENGINE.stroke; // cm3
const CLEAR = ENGINE.clearance * SWEPT;
const volumeHead = (theta) => CLEAR + AREA * pistonAt(theta);
const volumeCrank = (theta) => CLEAR + AREA * (ENGINE.stroke - pistonAt(theta));

// Which part of the cycle one end is in, and its pressure in bar absolute.
// Angles measured from that end's own dead centre, so the crank end reuses the head-end logic.
function sideState(local, events, volume) {
  const inArc = (from, to, t) => (from <= to ? t >= from && t < to : t >= from || t < to);
  const t = wrap(local);
  if (inArc(events.admission, events.cutoff, t)) return { phase: "admission", bar: ENGINE.boilerBar };
  if (inArc(events.cutoff, events.release, t)) {
    const v0 = volume(events.cutoff);
    return { phase: "expansion", bar: Math.max(ENGINE.backBar, (ENGINE.boilerBar * v0) / volume(t)) };
  }
  if (inArc(events.release, events.compression, t)) return { phase: "exhaust", bar: ENGINE.backBar };
  const v0 = volume(events.compression);
  return { phase: "compression", bar: Math.min(ENGINE.boilerBar, (ENGINE.backBar * v0) / volume(t)) };
}
export function headState(theta) {
  return sideState(theta, EVENTS.head, volumeHead);
}
export function crankState(theta) {
  // the crank end's events are 180 degrees on, in the same cycle order
  const local = wrap(theta - 180);
  const ev = Object.fromEntries(Object.entries(EVENTS.crank).map(([k, v]) => [k, wrap(v - 180)]));
  return sideState(local, ev, (t) => volumeCrank(wrap(t + 180)));
}

// Torque on the crank, N m, from the pressure difference across the piston.
export function torqueAt(theta) {
  const head = headState(theta).bar;
  const crank = crankState(theta).bar;
  const force = (head - crank) * 1e5 * (AREA * 1e-4); // N, toward the crank end
  return force * (pistonRate(theta) / 100); // N m per radian
}
let MEAN_TORQUE = 0;
for (let t = 0; t < 360; t += 1) MEAN_TORQUE += torqueAt(t) / 360;
export const meanTorque = MEAN_TORQUE;
export const powerKw = (rpm) => (MEAN_TORQUE * ((rpm * 2 * Math.PI) / 60)) / 1000;

export function stateAt(theta) {
  const t = wrap(theta);
  const head = headState(t);
  const crank = crankState(t);
  const ports = portsAt(t);
  return { theta: t, piston: pistonAt(t), valve: valveAt(t), ports, head, crank, torque: torqueAt(t) };
}

export const PHASE_WORDS = {
  admission: "steam admitted",
  expansion: "expanding",
  exhaust: "exhausting",
  compression: "compressing",
};
