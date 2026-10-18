import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import * as A from "../kit/audit.mjs";
import { kitScript, glScript } from "../scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { GEO, RAD, partsOf } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const W = 920;
const H = 600;
const TOP = GEO.top;
const AZ = GEO.azimuth;
const UP = [0, 0, 1];
const BED = { x: -165, y: -70, w: 330, d: 140, r: 8 };
const dir = (deg) => [Math.cos(deg * RAD), Math.sin(deg * RAD), 0];
const tang = (deg) => [-Math.sin(deg * RAD), Math.cos(deg * RAD), 0];
const vertical = (x, y) => G.frameOf([x, y, 0], UP, [1, 0, 0], [0, 1, 0]);
const S_ = GEO.small;
const B_ = GEO.big;
const REST = M.stateAt(GEO.rest.push, GEO.rest.weights);

const P = k.fitProjection([...k.boxCorners(BED, -6, TOP), [S_.x, S_.y, S_.pistonTop0 + S_.rodLen + S_.capH + 2], [B_.x - 45, B_.y - 45, 200], [B_.x + 45, B_.y + 45, 158 + GEO.weight.h * 4 + 2]], W, H, { pad: 26, azimuth: AZ, elevation: GEO.elevation });
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const parts = partsOf(k, G, M);

const R = A.recorder(P);
const { items, nameFor } = R;
const record = R.solid;
function put(ref, svg, { bias = 0, shapes = [], name, dyn } = {}) {
  R.put({ at: ref, bias, svg, shapes, name: name ?? nameFor("item"), dyn });
}
function shapeOf(desc) {
  const meta = { name: desc.name, owner: desc.owner };
  if (desc.kind === "cyl") return A.cylinder(desc.cx, desc.cy, desc.r, desc.z, desc.h, meta);
  if (desc.kind === "slab") return A.slab(desc.plan, desc.z, desc.h, meta, 4);
  return null;
}
function putDescs(descs, ref, { bias = 0, name, dyn }) {
  put(ref, descs.map((d) => parts.drawDesc(d, P)).join(""), { bias, name, dyn, shapes: descs.map(shapeOf).filter(Boolean).map(record) });
}
function boxAt(plan, z0, z1, { tone = "mid", name, owner, bias = 0, extra = "", bevel = 0.4, steps = 2, inner = "" } = {}) {
  const id = nameFor(name ?? "box");
  put([plan.x + plan.w / 2, plan.y + plan.d / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone, inner }) + extra, { bias, name: id, shapes: [record(A.slab(plan, z0, z1 - z0, { name: id, owner }, steps))] });
}
function ringAt(cx, cy, z0, z1, rIn, rOut, { tone = "mid", name, owner, bias = 0, extra = "", bevel = 0 } = {}) {
  const id = nameFor(name ?? "ring");
  const F = vertical(cx, cy);
  put([cx, cy, (z0 + z1) / 2], S(G.ringBand(z0, z1, rIn, rOut, F, P, bevel ? { bevel } : {}), { tone }) + extra, { bias, name: id, shapes: [record(A.ring(F, z0, z1, rIn, rOut, { name: id, owner }))] });
}

// ---------------------------------------------------------------- bed
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(BED, -6, 6, P)}"/>`);
for (const [x, y] of k.corners(BED, 18).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))) {
  back.push(S(k.cylinder(x, y, 7, -6, 2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 5.4, -4, 4, P, 28), { tone: "mid" }));
  record(A.cylinder(x, y, 7, -6, 6, { name: "stand.foot" }));
}
back.push(S(k.slabOf(BED, 0, TOP, P, 8, 1.4), { tone: "mid" }));
record(A.slab(BED, 0, TOP, { name: "stand.bed" }, 8));
back.push(Ln(k.planOutline(k.insetPlan(BED, 5), TOP, P), { tone: "lo" }));
const SCREWS = k.corners(BED, 9);
back.push(Ln(SCREWS.map(([x, y]) => k.ring(x, y, 2.4, TOP, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(SCREWS.map(([x, y]) => at([x, y, TOP])), { size: 0.55 }));
const STRIP = { x: -150, y: BED.y + BED.d - 12, w: 300, d: 6, r: 0.8 };
back.push(S(k.slabOf(STRIP, TOP, 0.6, P, 3), { tone: "lo" }));
const TICKS = k.topTicks(STRIP.x, STRIP.x + STRIP.w, 10, 5, STRIP.y + 0.15, TOP + 0.6, [2.6, STRIP.d - 0.3], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
const LABEL = { x: 100, y: BED.y + 10, w: 48, d: 12, r: 1.2 };
back.push(S(k.slabOf(LABEL, TOP, 1, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.6), TOP + 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 4, LABEL.y + 7.8], TOP + 1, P, "x"), "PASCAL · 1 : 4", { size: 3.6, tone: "lo" }));
back.push(Dots([at([LABEL.x + 2.4, LABEL.y + LABEL.d / 2, TOP + 1]), at([LABEL.x + LABEL.w - 2.4, LABEL.y + LABEL.d / 2, TOP + 1])], { size: 0.45 }));

// ---------------------------------------------------------------- a cylinder with a window
let clipCount = 0;
function windowPoints(cx, cy, r, z0, z1, half) {
  const corner = 3;
  const arc = r * half * RAD;
  const pts = [];
  const cornerPts = (ca, cz, start) => {
    for (let i = 0; i <= 6; i++) {
      const a = start + (i / 6) * (Math.PI / 2);
      pts.push([ca + corner * Math.cos(a), cz + corner * Math.sin(a)]);
    }
  };
  cornerPts(arc - corner, z1 - corner, 0);
  cornerPts(-arc + corner, z1 - corner, Math.PI / 2);
  cornerPts(-arc + corner, z0 + corner, Math.PI);
  cornerPts(arc - corner, z0 + corner, 1.5 * Math.PI);
  return pts.map(([s, z]) => [cx + r * Math.cos(AZ * RAD + s / r), cy + r * Math.sin(AZ * RAD + s / r), z]);
}
function cylinderWithWindow(C, zw, insideDescs, { name, owner, frames }) {
  const outer = windowPoints(C.x, C.y, C.outer, zw[0], zw[1], GEO.windows.halfDeg);
  const path = k.pathOf(outer.map(at), true);
  const id = `pl-win${clipCount++}`;
  const F = vertical(C.x, C.y);
  const body = [
    `<path class="pl-cavity" d="${path}"/>`,
    Ln(frames.map((z) => G.arcOf(F, z, C.bore, P, { inward: true, least: -1 })).join(""), { tone: "lo" }),
    Ln([-0.5, -0.85].map((f) => k.segment([C.x - f * C.bore * Math.cos(AZ * RAD) + (f === -0.5 ? 0 : 0), C.y - C.bore * 0.9 * Math.sin(AZ * RAD) * (f === -0.5 ? 0.6 : 1), zw[0] - 2], [C.x - C.bore * 0.9 * Math.cos(AZ * RAD) * (f === -0.5 ? 0.6 : 1), C.y - C.bore * 0.9 * Math.sin(AZ * RAD) * (f === -0.5 ? 0.6 : 1), zw[1] + 2], P)).join(""), { tone: "faint" }),
    `<g data-dyn="${name}">${insideDescs.map((d) => parts.drawDesc(d, P)).join("")}</g>`,
  ].join("");
  const window = `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><g clip-path="url(#${id})">${body}</g><path class="iso-line pl-cut" data-tone="lo" d="${path}"/>`;
  const paths = k.cylinder(C.x, C.y, C.outer, 20, C.z1 - 20, P, 64);
  const a0 = (AZ - GEO.windows.halfDeg) * RAD;
  const a1 = (AZ + GEO.windows.halfDeg) * RAD;
  const outerArc = Array.from({ length: 49 }, (_, j) => a1 + ((Math.PI * 2 - (a1 - a0)) * j) / 48).map((a) => [C.outer * Math.cos(a), C.outer * Math.sin(a)]);
  const innerArc = Array.from({ length: 49 }, (_, j) => a1 + ((Math.PI * 2 - (a1 - a0)) * (48 - j)) / 48).map((a) => [C.bore * Math.cos(a), C.bore * Math.sin(a)]);
  const shapes = [
    record(A.ring(F, 20, zw[0], C.bore, C.outer, { name: `${owner}.body`, owner })),
    record(A.prism(F, [...outerArc, ...innerArc], zw[0], zw[1], { name: `${owner}.body`, owner })),
    record(A.ring(F, zw[1], C.z1, C.bore, C.outer, { name: `${owner}.body`, owner })),
    ...insideDescs.filter((d) => d.kind !== "oil").map(shapeOf).map(record),
  ];
  put([C.x, C.y, (20 + C.z1) / 2], S(paths, { tone: "hi", inner: Ln(k.sideArc(C.x, C.y, C.outer, zw[1] + 4, P, 40) + k.sideArc(C.x, C.y, C.outer, zw[0] - 4, P, 40), { tone: "faint" }) }) + window, { name: `${owner}.body`, shapes });
}

// plunger cylinder
ringAt(S_.x, S_.y, TOP, 20, 0, 26, { name: "small.flange", owner: "small", bevel: 0.6, extra: Dots(G.dotsOf(vertical(S_.x, S_.y), 20, 23.5, 8, P, { all: true }), { size: 0.45, tone: "mid" }) });
cylinderWithWindow(S_, GEO.windows.small, parts.smallInside(REST.d1, REST.bar), { name: "small", owner: "small", frames: [50, 80, 110] });
ringAt(S_.x, S_.y, S_.z1, S_.z1 + 6, S_.rod + 0.1, 24, { name: "small.gland", owner: "small", bevel: 0.5, extra: Dots(G.dotsOf(vertical(S_.x, S_.y), S_.z1 + 6, 21, 6, P, { all: true }), { size: 0.42, tone: "mid" }) });
ringAt(S_.x, S_.y, S_.z1 + 6, S_.glandOut, S_.rod + 0.1, 9, { name: "small.gland-nut", owner: "small", extra: Ln(k.knurl(S_.x, S_.y, 9, S_.z1 + 6, S_.glandOut, 24, P), { tone: "lo" }) });
putDescs(parts.plungerOutside(REST.d1), [S_.x, S_.y, 190], { name: "plunger.outside", dyn: "plunger" });
// travel scale beside the plunger
{
  const plan = { x: S_.x + 26, y: -30, w: 4, d: 16, r: 0.6 };
  const face = plan.x + plan.w + 0.01;
  const top = S_.pistonTop0 + S_.rodLen + 6;
  const ticks = [Ln(k.segment([face, -15, TOP], [face, -15, top], P), { tone: "lo" })];
  for (let d = 0; d <= S_.rodLen - 22; d += 10) {
    const z = S_.pistonTop0 + S_.rodLen - d;
    const len = d % 50 === 0 ? 15 : 4;
    ticks.push(Ln(k.segment([face, -15, z], [face, -15 - len, z], P), { tone: d % 50 === 0 ? "mid" : "lo" }));
  }
  boxAt(plan, TOP, top, { name: "small.scale", owner: "small", tone: "mid", bevel: 0.3, extra: ticks.join("") });
}

// ram cylinder
ringAt(B_.x, B_.y, TOP, 20, 0, 42, { name: "big.flange", owner: "big", bevel: 0.6, extra: Dots(G.dotsOf(vertical(B_.x, B_.y), 20, 39.5, 12, P, { all: true }), { size: 0.45, tone: "mid" }) });
cylinderWithWindow(B_, GEO.windows.big, parts.bigInside(REST.d2, REST.bar), { name: "big", owner: "big", frames: [45, 70] });
ringAt(B_.x, B_.y, B_.z1, B_.z1 + 6, B_.rod + 0.1, 40, { name: "big.gland", owner: "big", bevel: 0.5, extra: Dots(G.dotsOf(vertical(B_.x, B_.y), B_.z1 + 6, 37, 8, P, { all: true }), { size: 0.42, tone: "mid" }) });
ringAt(B_.x, B_.y, B_.z1 + 6, B_.glandOut, B_.rod + 0.1, 18, { name: "big.gland-nut", owner: "big", extra: Ln(k.knurl(B_.x, B_.y, 18, B_.z1 + 6, B_.glandOut, 36, P), { tone: "lo" }) });
putDescs(parts.ramOutside(REST.d2, REST.weights), [B_.x, B_.y, 160], { name: "ram.outside", dyn: "ram" });
{
  const plan = { x: B_.x + 48, y: -30, w: 4, d: 16, r: 0.6 };
  const face = plan.x + plan.w + 0.01;
  const top = B_.pistonTop0 + B_.rodLen + 26;
  const ticks = [Ln(k.segment([face, -15, TOP], [face, -15, top], P), { tone: "lo" })];
  for (let d = 0; d <= 20; d += 2.5) {
    const z = B_.pistonTop0 + B_.rodLen + d;
    const major = d % 5 === 0;
    ticks.push(Ln(k.segment([face, -15, z], [face, -15 - (major ? 15 : 4), z], P), { tone: major ? "mid" : "lo" }));
  }
  boxAt(plan, TOP, top, { name: "big.scale", owner: "big", tone: "mid", bevel: 0.3, extra: ticks.join("") });
}

// ---------------------------------------------------------------- pipe with two gauge tees
const PIPE_Z = 30;
const PIPE_R = 5;
const padOf = (C, toward, name) => {
  const F = G.frameAlong([C.x, C.y, PIPE_Z], toward);
  const a = 8.5;
  const face = C.outer + 4;
  const low = Math.min(...Array.from({ length: 48 }, (_, i) => G.saddleStart(C.outer, a, (i / 48) * Math.PI * 2)));
  const host = R.solids.filter((s) => s.name === `${name}.body`);
  put(G.add3(F.o, G.mul3(F.a, C.outer + 2)), S(G.saddleOf(F, a, C.outer, face, P), { tone: "hi" }), { bias: 0.2, name: `${name}.pad`, shapes: [record(A.disc(F, low - 0.05, face, a, { name: `${name}.pad`, owner: name, seated: true, cut: host }))] });
  return G.add3(F.o, G.mul3(F.a, face));
};
const padA = padOf(S_, [1, 0, 0], "small");
const padB = padOf(B_, [-1, 0, 0], "big");
{
  const line = [padA, padB];
  const total = padB[0] - padA[0];
  const thick = 2.4;
  const TEE = 8;
  const teeGap = Math.sqrt(TEE ** 2 - PIPE_R ** 2);
  const tees = GEO.gauge.x.map((x) => x - padA[0]);
  const gaps = [[0, thick], [total - thick, total], ...tees.map((t) => [t - teeGap, t + teeGap])];
  const id = "pipe.main";
  R.route(id, line, PIPE_R, { owner: id, gaps, rims: [8, 8] });
  for (const part of tubePieces(line, PIPE_R, P, { maxLength: 20, spacing: 1.2, gaps })) put(part.mid, tubeSvg(part, { tone: "mid" }), { bias: 0.3, name: `${id}:${part.from}`, shapes: [A.tube(part.points, part.radii)] });
  [[padA, 1], [padB, -1]].forEach(([end, sign]) => {
    const F = G.frameAlong(end, [sign, 0, 0]);
    put(G.add3(end, G.mul3(F.a, thick / 2)), S(G.disc(0, thick, 8, F, P), { tone: "mid" }) + (G.dot3(F.a, V) > 0.12 ? Dots(G.dotsOf(F, thick, 6, 6, P, { all: true }), { size: 0.4, tone: "mid" }) : ""), { bias: 0.3, name: `${id}.flange`, shapes: [record(A.disc(F, 0, thick, 8, { name: `${id}.flange`, owner: id }))] });
  });
  // gauges on ball tees
  GEO.gauge.x.forEach((gx, index) => {
    const owner = `gauge${index}`;
    const centre = [gx, 0, PIPE_Z];
    put(centre, S(G.sphereOf(centre, TEE, P, { steps: 36 }), { tone: "mid" }), { bias: 0.4, name: `${owner}.tee`, shapes: [record(A.ball(centre, TEE, { name: `${owner}.tee`, owner: id }))] });
    const Gg = GEO.gauge;
    const caseCentre = [gx, 0, Gg.riserTop + Gg.r];
    const riserTop = caseCentre[2] - Math.sqrt(Gg.r ** 2 - 3 ** 2);
    const RF = vertical(gx, 0);
    const z0 = PIPE_Z + Math.sqrt(TEE ** 2 - 3 ** 2);
    put([gx, 0, (z0 + riserTop) / 2], S(G.disc(z0, riserTop, 3, RF, P), { tone: "mid", crease: "none" }), { bias: 0.4, name: `${owner}.riser`, shapes: [record(A.disc(RF, z0, riserTop, 3, { name: `${owner}.riser`, owner: id }))] });
    const CF = G.frameOf(caseCentre, dir(AZ), tang(AZ), UP);
    const half = Gg.thick / 2;
    const ticks = [];
    for (let i = 0; i <= 10; i++) {
      const a = (225 - Gg.sweep * (i / 10)) * RAD;
      const r0 = i % 5 === 0 ? 8.6 : 9.8;
      const pt = (r) => G.add3(G.add3(caseCentre, G.mul3(CF.a, half + 1.52)), G.add3(G.mul3(CF.u, r * Math.cos(a)), G.mul3(CF.v, r * Math.sin(a))));
      ticks.push(Ln(k.segment(pt(r0), pt(12.2), P), { tone: i % 5 === 0 ? "mid" : "lo" }));
    }
    const svg =
      S(G.disc(-half, half, Gg.r, CF, P, { bevel: 0.5 }), { tone: "mid", inner: Ln(G.arcOf(CF, 0, Gg.r, P), { tone: "faint" }) }) +
      S(G.ringBand(half, half + 1.5, 12.4, Gg.r, CF, P), { tone: "hi" }) +
      `<path class="pl-dial-face" d="${G.circleOf(CF, half + 1.5, 12.4, P)}"/>` +
      Ln(G.circleOf(CF, half + 1.51, 12.4, P), { tone: "lo" }) +
      ticks.join("") +
      Ln(G.circleOf(CF, half + 1.52, 1.6, P, 16), { tone: "mid" }) +
      `<g data-dyn="needle${index}">${parts.needle(index, REST.bar, P)}</g>`;
    put(caseCentre, svg, { bias: 0.5, name: `${owner}.case`, shapes: [record(A.disc(CF, -half, half + 1.5, Gg.r, { name: `${owner}.case`, owner }))] });
  });
}

// ---------------------------------------------------------------- emit
A.settle(R, P);
items.sort((a, b) => a.key - b.key);
const groups = items.map((item, index) => `<g class="it"${item.dyn ? ` data-dyn="${item.dyn}"` : ""} data-i="${index}">${item.svg}</g>`);
const LABEL_TEXT =
  "A bench hydraulic lift: a narrow plunger cylinder with a knob on its rod and a wide ram cylinder carrying a platform with slotted weights, both cut open to show the oil and the pistons, joined by a pipe along the bedplate. Two pressure gauges on tees in the pipe read the same value. Pushing the plunger down lifts the ram a quarter as far.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, `<g class="pl-lift">${groups.join("")}</g>`] });
const DATA = { W, H, P, rest: GEO.rest };
const WEIGHTS = [0, 1, 2, 3, 4].map((n) => `<button type="button" class="pl-weight" data-weights="${n}"><span class="pl-num">${String(n).padStart(2, "0")}</span>${n === 0 ? "platform only" : `${n * M.LIFT.weightKg} kg`}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 3</span><span class="iso-plate-corner" data-corner="title">Hydraulic lift · Pascal's principle</span><span class="iso-plate-corner" data-corner="readout" data-readout>push 30 mm → lift 7.5 mm · ${REST.bar.toFixed(2)} bar</span></div>`;
const controls = `<div class="pl-controls"><span class="pl-hint">Drag down to push the plunger; buttons add weights</span><span class="pl-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="pl-stage" tabindex="0" role="slider" aria-label="Hydraulic lift. Drag down or use the arrow keys to push the plunger; plus and minus add and remove weights." aria-valuemin="0" aria-valuemax="${M.LIFT.plungerStroke}" aria-valuenow="${GEO.rest.push}" aria-valuetext="Plunger pushed 30 millimetres">${svg}</div>`;
const caption = `Pascal's principle: a pressure applied to an enclosed fluid is passed on undiminished to every part of it and to the walls. The two gauges always agree. The plunger is 30 mm across and the ram 60 mm, so the ram has ${M.RATIO.toFixed(0)} times the area and carries ${M.RATIO.toFixed(0)} times the force the hand applies, while it rises only a quarter as far: the oil is incompressible, so the volume the plunger sweeps is the volume the ram gains, and the work is the same at both ends. With ${(M.LIFT.platformKg + 2 * M.LIFT.weightKg).toFixed(0)} kg on the platform the oil is at ${REST.bar.toFixed(2)} bar and the hand pushes with ${REST.hand.toFixed(0)} N. The oil's own weight, about 0.01 bar over this height, is left out.`;
const body = `<figure class="iso-figure pl"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="pl-weights">${WEIGHTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;
const latheScript = () => readFileSync(join(HERE, "..", "kit", "lathe.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "").replace(/\b(oriented|signedArea|runsOf)\b/g, "lathe_$1");
const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^export /gm, "");
const CSS = readFileSync(join(HERE, "lift.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Hydraulic lift", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + "\n" + latheScript() + "\n" + glScript() + "\n" + strip("model.mjs") + "\n" + strip("parts.mjs") + "\n" + LIVE, width: 980 });
const name = THEME === "light" ? "pascal-lift-light.html" : "pascal-lift.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, `${R.solids.length} solids`);
A.auditOrExit(R, P, { cover: ["small.body", "big.body"] });
