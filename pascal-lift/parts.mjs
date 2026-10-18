// Moving parts of the hydraulic lift, shared by the build and the page.
export const RAD = Math.PI / 180;
export const GEO = {
  azimuth: 42,
  elevation: 30,
  top: 14, // bed top
  small: { x: -95, y: 0, outer: 20, bore: 15, z1: 134, piston: 20, pistonTop0: 128, rod: 6, rodLen: 102, cap: 18, capH: 12, glandOut: 146 },
  big: { x: 60, y: 0, outer: 36, bore: 30, z1: 94, piston: 24, pistonTop0: 64, rod: 14, rodLen: 86, glandOut: 106 },
  platform: { half: 45, h: 8, r: 6 },
  weight: { r: 32, h: 14 },
  windows: { small: [24, 126], big: [24, 86], halfDeg: 32 },
  gauge: { x: [-60, -14], riserTop: 62, r: 16, thick: 10, sweep: 270, maxBar: 2.5 },
  rest: { push: 30, weights: 2 },
};

export function partsOf(K, G, M) {
  const UP = [0, 0, 1];
  const vertical = (x, y) => G.frameOf([x, y, 0], UP, [1, 0, 0], [0, 1, 0]);
  const dir = (deg) => [Math.cos(deg * RAD), Math.sin(deg * RAD), 0];
  const tang = (deg) => [-Math.sin(deg * RAD), Math.cos(deg * RAD), 0];

  // What the small cylinder's window shows: oil, plunger, rod up to the gland.
  function smallInside(push, bar) {
    const S = GEO.small;
    const top = S.pistonTop0 - push;
    const bottom = top - S.piston;
    return [
      { kind: "oil", cx: S.x, cy: S.y, r: S.bore - 0.3, z: GEO.top + 0.3, h: bottom - GEO.top - 0.3, bar, name: "oil.small" },
      { kind: "cyl", cx: S.x, cy: S.y, r: S.bore - 0.5, z: bottom, h: S.piston, tone: "hi", name: "plunger.piston", owner: "plunger", steps: 40, groove: [bottom + 4, top - 4] },
      { kind: "cyl", cx: S.x, cy: S.y, r: S.rod, z: top, h: S.z1 - top, tone: "hi", name: "plunger.rod-inside", owner: "plunger", steps: 20, crease: "none" },
    ];
  }
  // Plunger rod above the gland and its knob.
  function plungerOutside(push) {
    const S = GEO.small;
    const top = S.pistonTop0 - push;
    const capZ = top + S.rodLen;
    return [
      { kind: "cyl", cx: S.x, cy: S.y, r: S.rod, z: S.glandOut, h: capZ - S.glandOut, tone: "hi", name: "plunger.rod", owner: "plunger", steps: 20, crease: "none" },
      { kind: "cyl", cx: S.x, cy: S.y, r: S.cap, z: capZ, h: S.capH, tone: "mid", name: "plunger.cap", owner: "plunger", steps: 40, bevel: 0.8, knurl: true },
    ];
  }
  function bigInside(lift, bar) {
    const B = GEO.big;
    const top = B.pistonTop0 + lift;
    const bottom = top - B.piston;
    return [
      { kind: "oil", cx: B.x, cy: B.y, r: B.bore - 0.3, z: GEO.top + 0.3, h: bottom - GEO.top - 0.3, bar, name: "oil.big" },
      { kind: "cyl", cx: B.x, cy: B.y, r: B.bore - 0.5, z: bottom, h: B.piston, tone: "hi", name: "ram.piston", owner: "ram", steps: 56, groove: [bottom + 5, top - 5] },
      { kind: "cyl", cx: B.x, cy: B.y, r: B.rod, z: top, h: B.z1 - top, tone: "hi", name: "ram.rod-inside", owner: "ram", steps: 32, crease: "none" },
    ];
  }
  function ramOutside(lift, weights) {
    const B = GEO.big;
    const top = B.pistonTop0 + lift;
    const platZ = top + B.rodLen;
    const PL = GEO.platform;
    const out = [
      { kind: "cyl", cx: B.x, cy: B.y, r: B.rod, z: B.glandOut, h: platZ - B.glandOut, tone: "hi", name: "ram.rod", owner: "ram", steps: 32, crease: "none" },
      { kind: "slab", plan: { x: B.x - PL.half, y: B.y - PL.half, w: PL.half * 2, d: PL.half * 2, r: PL.r }, z: platZ, h: PL.h, tone: "mid", name: "ram.platform", owner: "ram", bevel: 0.8, screws: true },
    ];
    for (let i = 0; i < weights; i++) {
      const z = platZ + PL.h + i * GEO.weight.h;
      out.push({ kind: "cyl", cx: B.x, cy: B.y, r: GEO.weight.r, z, h: GEO.weight.h, tone: "hi", name: `ram.weight${i}`, owner: "ram", steps: 56, bevel: 0.6, ring: GEO.weight.r - 6 });
    }
    return out;
  }
  // Needle on one gauge, as a 3D segment on the dial face.
  function needle(index, bar, P) {
    const Gg = GEO.gauge;
    const a = dir(GEO.azimuth);
    const centre = [Gg.x[index], 0, Gg.riserTop + Gg.r];
    const face = G.add3(centre, G.mul3(a, Gg.thick / 2 + 0.2));
    const u = tang(GEO.azimuth);
    const share = Math.min(1, Math.max(0, bar / Gg.maxBar));
    const ang = (225 - Gg.sweep * share) * RAD;
    const at = (r) => G.add3(face, G.add3(G.mul3(u, r * Math.cos(ang)), G.mul3(UP, r * Math.sin(ang))));
    return K.lineSvg(K.segment(at(-2.4), at(11.5), P), { tone: "lit", free: "start", className: "pl-needle" });
  }

  function drawDesc(desc, P) {
    if (!desc) return "";
    if (desc.kind === "oil") {
      if (desc.h < 0.3) return "";
      const paths = K.cylinder(desc.cx, desc.cy, desc.r, desc.z, desc.h, P, 48);
      const share = Math.min(1, Math.max(0, desc.bar / GEO.gauge.maxBar));
      return `<g class="pl-oil" style="--oil:${(0.35 + 0.55 * share).toFixed(3)}">${K.solidSvg(paths, { tone: "mid", crease: "none", className: "pl-oil-solid" })}</g>`;
    }
    if (desc.kind === "cyl") {
      const paths = K.cylinder(desc.cx, desc.cy, desc.r, desc.z, desc.h, P, desc.steps ?? 32, desc.bevel ?? 0);
      let extra = "";
      if (desc.groove) extra += K.lineSvg(desc.groove.map((z) => K.sideArc(desc.cx, desc.cy, desc.r, z, P, 24)).join(""), { tone: "faint" });
      if (desc.knurl) extra += K.lineSvg(K.knurl(desc.cx, desc.cy, desc.r, desc.z, desc.z + desc.h, 48, P), { tone: "lo" });
      if (desc.ring) extra += K.lineSvg(K.ring(desc.cx, desc.cy, desc.ring, desc.z + desc.h, P, 48), { tone: "faint" });
      return K.solidSvg(paths, { tone: desc.tone, crease: desc.crease ?? "faint", inner: desc.groove ? "" : "", className: desc.className }) + extra;
    }
    if (desc.kind === "slab") {
      const paths = K.slabOf(desc.plan, desc.z, desc.h, P, 4, desc.bevel ?? 0);
      let extra = "";
      if (desc.screws) extra += K.dotsSvg(K.corners(desc.plan, 6).map(([x, y]) => K.iso([x, y, desc.z + desc.h], P)), { size: 0.5 });
      return K.solidSvg(paths, { tone: desc.tone }) + extra;
    }
    return "";
  }
  return { smallInside, plungerOutside, bigInside, ramOutside, needle, drawDesc, dir, tang };
}
