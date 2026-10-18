// A small 0-4-0 industrial steam locomotive with two outside cylinders.
// Pure model: wheel angle in, positions, valve events, pressures, speed, effort out.
// Geometry in cm, thermodynamics in SI.

export const LOCO = {
  bore: 30, // cm
  stroke: 40,
  crank: 20,
  conrod: 240, // crosshead pin to crankpin
  wheelDia: 90, // cm
  wheelbase: 160,
  boilerBar: 10, // bar gauge, working pressure
  backBar: 1.3, // exhaust back pressure, absolute, with the blast pipe
  clearance: 0.08,
  valveTravel: 10, // cm
  steamLap: 2.2,
  exhaustLap: 0.3,
  advanceDeg: 60, // angle of advance of the return crank
  shownRpm: 24,
  massT: 24, // tonnes in working order
  cylinders: 2,
};
export const DEG = Math.PI / 180;
const wrap = (deg) => ((deg % 360) + 360) % 360;

export function pistonAt(theta) {
  const { crank: r, conrod: L } = LOCO;
  const a = theta * DEG;
  return r * (1 - Math.cos(a)) + L - Math.sqrt(L * L - r * r * Math.sin(a) ** 2);
}
export function pistonRate(theta) {
  const { crank: r, conrod: L } = LOCO;
  const a = theta * DEG;
  return r * Math.sin(a) + (r * r * Math.sin(a) * Math.cos(a)) / Math.sqrt(L * L - r * r * Math.sin(a) ** 2);
}
export const valveAt = (theta) => (LOCO.valveTravel / 2) * Math.cos((theta - LOCO.advanceDeg) * DEG);
export function portsAt(theta) {
  const v = valveAt(theta);
  return { headSteam: Math.max(0, v - LOCO.steamLap), crankSteam: Math.max(0, -v - LOCO.steamLap), headExhaust: Math.max(0, -v - LOCO.exhaustLap), crankExhaust: Math.max(0, v - LOCO.exhaustLap) };
}
function eventsOf(side) {
  const open = (t) => {
    const p = portsAt(t);
    return side === "head" ? { steam: p.headSteam > 0, exhaust: p.headExhaust > 0 } : { steam: p.crankSteam > 0, exhaust: p.crankExhaust > 0 };
  };
  const found = {};
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

const AREA = Math.PI * (LOCO.bore / 2) ** 2;
const SWEPT = AREA * LOCO.stroke;
const CLEAR = LOCO.clearance * SWEPT;
const volumeHead = (t) => CLEAR + AREA * pistonAt(t);
const volumeCrank = (t) => CLEAR + AREA * (LOCO.stroke - pistonAt(t));
const P1 = LOCO.boilerBar + 1.013; // absolute in the chest, regulator wide open
function sideState(local, events, volume) {
  const inArc = (from, to, t) => (from <= to ? t >= from && t < to : t >= from || t < to);
  const t = wrap(local);
  if (inArc(events.admission, events.cutoff, t)) return { phase: "admission", bar: P1 };
  if (inArc(events.cutoff, events.release, t)) return { phase: "expansion", bar: Math.max(LOCO.backBar, (P1 * volume(events.cutoff)) / volume(t)) };
  if (inArc(events.release, events.compression, t)) return { phase: "exhaust", bar: LOCO.backBar };
  return { phase: "compression", bar: Math.min(P1, (LOCO.backBar * volume(events.compression)) / volume(t)) };
}
export const headState = (theta) => sideState(theta, EVENTS.head, volumeHead);
export function crankState(theta) {
  const ev = Object.fromEntries(Object.entries(EVENTS.crank).map(([k, v]) => [k, wrap(v - 180)]));
  return sideState(wrap(theta - 180), ev, (t) => volumeCrank(wrap(t + 180)));
}
// Torque from one cylinder at crank angle theta, N m at the wheel.
export function torqueAt(theta) {
  const force = (headState(theta).bar - crankState(theta).bar) * 1e5 * (AREA * 1e-4);
  return force * (pistonRate(theta) / 100);
}
// Two cylinders set 90 degrees apart (the far side leads by a quarter turn).
export const totalTorque = (theta) => torqueAt(theta) + torqueAt(theta + 90);
let MEAN = 0;
for (let t = 0; t < 360; t++) MEAN += totalTorque(t) / 360;
export const meanTorque = MEAN;
export const meanEffortKn = MEAN / (LOCO.wheelDia / 200) / 1000; // force at the rail
// The traditional rated tractive effort at 85% of boiler pressure.
export const ratedEffortKn = (0.85 * LOCO.boilerBar * 1e5 * (LOCO.bore / 100) ** 2 * (LOCO.stroke / 100)) / (LOCO.wheelDia / 100) / 1000;
export const speedKmh = (rpm) => ((Math.PI * LOCO.wheelDia) / 100) * rpm * 0.06;
export const powerKw = (rpm) => (MEAN * ((rpm * 2 * Math.PI) / 60)) / 1000;

// Exhaust beats: each cylinder releases twice per turn. Returns the wheel angles.
export const BEATS = [EVENTS.head.release, EVENTS.crank.release, wrap(EVENTS.head.release - 90), wrap(EVENTS.crank.release - 90)].sort((a, b) => a - b);

export function stateAt(theta) {
  const t = wrap(theta);
  return { theta: t, piston: pistonAt(t), valve: valveAt(t), head: headState(t), crank: crankState(t), torque: totalTorque(t) };
}
export const PHASE_WORDS = { admission: "steam admitted", expansion: "expanding", exhaust: "exhausting", compression: "compressing" };
