// A bench hydraulic lift: a hand plunger and a ram joined by a pipe full of oil.
// Pascal's principle: the pressure set by the load is the same everywhere in the
// oil, so the hand pushes with F1 = p * A1 while the ram carries F2 = p * A2, and
// the plunger travels A2 / A1 times as far as the ram. Units: mm, kg, N, Pa.

export const LIFT = {
  plungerBore: 30, // mm
  ramBore: 60,
  plungerStroke: 80, // mm, full hand travel
  platformKg: 2.0, // the platform and ram rod
  weightKg: 10, // each slotted weight
  maxWeights: 4,
  oilDensity: 870, // kg/m3
  g: 9.80665,
};

export const A1 = Math.PI * (LIFT.plungerBore / 2) ** 2; // mm2
export const A2 = Math.PI * (LIFT.ramBore / 2) ** 2;
export const RATIO = A2 / A1;

export function stateAt(push, weights) {
  const d1 = Math.min(LIFT.plungerStroke, Math.max(0, push));
  const d2 = d1 / RATIO;
  const massKg = LIFT.platformKg + weights * LIFT.weightKg;
  const load = massKg * LIFT.g; // N on the ram
  const pressure = load / (A2 * 1e-6); // Pa gauge
  const hand = pressure * (A1 * 1e-6); // N on the plunger
  return { d1, d2, weights, massKg, load, pressure, bar: pressure / 1e5, hand, ratio: RATIO };
}

export const GAUGE_MAX_BAR = 2.5;
