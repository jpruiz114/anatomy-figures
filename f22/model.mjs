// Lockheed Martin F-22A Raptor: public figures and a simplified control blend.
// The fly-by-wire system mixes stick, rudder and throttle into surface deflections;
// the gains here are illustrative, the limits are the published ones.
// Units: metres, kN, degrees.

export const F22 = {
  length: 18.9,
  span: 13.56,
  height: 5.08,
  wingArea: 78.0,
  emptyKg: 19700,
  maxKg: 38000,
  engines: 2, // Pratt & Whitney F119-PW-100
  thrustIdleKn: 12,
  thrustMilKn: 116,
  thrustAbKn: 156,
  nozzleVectorDeg: 20, // pitch, each way
  stabilatorDeg: 30,
  rudderDeg: 30,
  flaperonDeg: 20,
  aileronDeg: 25,
  finCantDeg: 28,
  supercruiseMach: 1.8,
  maxMach: 2.25,
  fanIdleShare: 0.35,
};

export const THROTTLE = ["idle", "military", "afterburner"];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// stick.pitch: -1 nose down .. +1 nose up; stick.roll: -1 left .. +1 right; rudder: -1 left .. +1 right.
// Deflections in degrees, trailing edge down positive for surfaces, exhaust up positive for nozzles.
export function surfacesAt(stick, rudder, throttle) {
  const p = clamp(stick.pitch, -1, 1);
  const r = clamp(stick.roll, -1, 1);
  const y = clamp(rudder, -1, 1);
  const stabPitch = -F22.stabilatorDeg * 0.8 * p; // nose up: trailing edge up
  const stabRoll = F22.stabilatorDeg * 0.5 * r; // right roll: right stab trailing edge up
  const stab = { left: clamp(stabPitch - stabRoll, -F22.stabilatorDeg, F22.stabilatorDeg), right: clamp(stabPitch + stabRoll, -F22.stabilatorDeg, F22.stabilatorDeg) };
  const nozzle = F22.nozzleVectorDeg * p;
  const flapPitch = 6 * p;
  const flap = { left: clamp(flapPitch - F22.flaperonDeg * 0.7 * r, -F22.flaperonDeg, F22.flaperonDeg), right: clamp(flapPitch + F22.flaperonDeg * 0.7 * r, -F22.flaperonDeg, F22.flaperonDeg) };
  const aileron = { left: clamp(-F22.aileronDeg * r, -F22.aileronDeg, F22.aileronDeg), right: clamp(F22.aileronDeg * r, -F22.aileronDeg, F22.aileronDeg) };
  const rud = F22.rudderDeg * y;
  const level = THROTTLE.indexOf(throttle);
  const perEngine = level === 2 ? F22.thrustAbKn : level === 1 ? F22.thrustMilKn : F22.thrustIdleKn;
  const fanShare = level === 0 ? F22.fanIdleShare : 1;
  return { pitch: p, roll: r, yaw: y, stab, nozzle, flap, aileron, rudder: rud, throttle, perEngine, totalKn: perEngine * F22.engines, fanShare, afterburner: level === 2 ? 1 : 0, core: level === 0 ? 0.25 : 1 };
}
