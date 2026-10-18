const D = __DATA__;
const root = document.querySelector(".pl");
const stage = root.querySelector(".pl-stage");
const svg = stage.querySelector("svg");
const readout = root.querySelector("[data-readout]");
const liveRegion = root.querySelector("[data-live]");
const weightButtons = [...root.querySelectorAll(".pl-weight")];
const still = matchMedia("(prefers-reduced-motion: reduce)");

const P = D.P;
const G = { unit3, add3, sub3, mul3, len3, cross3, dot3, lerp3, viewOf, frameOf, frameAlong, pointOf };
const K = { cylinder, slabOf, solidSvg, lineSvg, dotsSvg, segment, pathOf, iso, sideArc, knurl, ring, corners };
const parts = partsOf(K, G, null);
const dyn = Object.fromEntries([...svg.querySelectorAll("[data-dyn]")].map((el) => [el.dataset.dyn, el]));
const clampTo = (value, low, high) => Math.min(high, Math.max(low, value));
const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

let push = D.rest.push;
let target = D.rest.push;
let weights = D.rest.weights;
const bar = { x: stateAt(push, weights).bar, v: 0 };
let touring = !still.matches;
let tourClock = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let shown = { push: NaN, weights: -1, bar: NaN };
let said = "";

const draw = (descs) => descs.map((desc) => parts.drawDesc(desc, P)).join("");
function place(state, shownBar) {
  if (Math.abs(state.d1 - shown.push) > 0.02 || Math.abs(shownBar - shown.bar) > 0.002) {
    dyn.small.innerHTML = draw(parts.smallInside(state.d1, shownBar));
    dyn.big.innerHTML = draw(parts.bigInside(state.d2, shownBar));
    dyn.needle0.innerHTML = parts.needle(0, shownBar, P);
    dyn.needle1.innerHTML = parts.needle(1, shownBar, P);
  }
  if (Math.abs(state.d1 - shown.push) > 0.02) dyn.plunger.innerHTML = draw(parts.plungerOutside(state.d1));
  if (Math.abs(state.d1 - shown.push) > 0.02 || state.weights !== shown.weights) dyn.ram.innerHTML = draw(parts.ramOutside(state.d2, state.weights));
  shown = { push: state.d1, weights: state.weights, bar: shownBar };
}
function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function describe(state) {
  const text = `${state.massKg.toFixed(0)} kg on the ram, ${state.bar.toFixed(2)} bar everywhere in the oil, ${state.hand.toFixed(0)} newtons on the hand`;
  if (said === text) return;
  said = text;
  if (liveRegion) liveRegion.textContent = text;
  stage.setAttribute("aria-valuetext", `Plunger pushed ${state.d1.toFixed(0)} millimetres, ram up ${state.d2.toFixed(1)}: ${text}`);
  weightButtons.forEach((button) => (Number(button.dataset.weights) === state.weights ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
}
const readoutOf = (state, shownBar) => `push ${fmt(state.d1)} mm → lift ${fmt(state.d2, 1)} mm · ${shownBar.toFixed(2)} bar · hand ${fmt(state.hand)} N · load ${fmt(state.load)} N`;

// Idle tour: pump down and up, then add a weight.
function tourAt(t) {
  const cycle = 7;
  const n = Math.floor(t / cycle);
  const u = (t % cycle) / cycle;
  const w = ((D.rest.weights + n) % (LIFT.maxWeights + 1));
  const stroke = u < 0.45 ? u / 0.45 : u < 0.6 ? 1 : u < 0.95 ? 1 - (u - 0.6) / 0.35 : 0;
  const ease = stroke * stroke * (3 - 2 * stroke);
  return { push: ease * LIFT.plungerStroke, weights: w };
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    tourClock += dt;
    const step = tourAt(tourClock);
    target = step.push;
    if (step.weights !== weights) setWeights(step.weights, false);
  }
  push = calm ? target : push + (target - push) * (1 - Math.exp(-dt / 0.2));
  if (Math.abs(target - push) < 0.02) push = target;
  const state = stateAt(push, weights);
  const moving = settle(bar, state.bar, dt, 0.35, calm);
  place(state, bar.x);
  say(readoutOf(state, bar.x));
  describe(state);
  stage.setAttribute("aria-valuenow", String(Math.round(push)));
  frame = visible && (Math.abs(target - push) > 0.02 || moving || touring) ? requestAnimationFrame(tick) : 0;
}
function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

let held = false;
function takeOver() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (held) return takeOver();
    touring = !still.matches;
    tourClock = 0;
    run();
  }, 6000);
  run();
}
function setWeights(n, user = true) {
  weights = clampTo(Math.round(n), 0, LIFT.maxWeights);
  if (user) takeOver();
  run();
}
function steer(next) {
  target = clampTo(next, 0, LIFT.plungerStroke);
  takeOver();
}
// Drag down to push the plunger: the stage height maps to the full stroke.
let drag = null;
const yOf = (event) => {
  const box = stage.getBoundingClientRect();
  return (event.clientY - box.top) / box.height;
};
stage.addEventListener("pointerdown", (event) => {
  held = true;
  stage.setPointerCapture(event.pointerId);
  drag = { y: yOf(event), push: touring ? push : target };
  takeOver();
});
stage.addEventListener("pointermove", (event) => {
  if (!held || !drag) return;
  steer(drag.push + (yOf(event) - drag.y) * LIFT.plungerStroke * 1.6);
});
const release = () => {
  held = false;
  drag = null;
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
weightButtons.forEach((button) => button.addEventListener("click", () => setWeights(Number(button.dataset.weights))));
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 20 : 5;
  const from = touring ? push : target;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") steer(from + step);
  else if (event.key === "ArrowUp" || event.key === "ArrowLeft") steer(from - step);
  else if (event.key === "Home") steer(0);
  else if (event.key === "End") steer(LIFT.plungerStroke);
  else if (event.key === "+" || event.key === "=") setWeights(weights + 1);
  else if (event.key === "-" || event.key === "_") setWeights(weights - 1);
  else if (event.key === "Escape") takeOver();
  else return;
  event.preventDefault();
});
if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".pl-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Drag down to push the plunger" : "Drag down to push the plunger; buttons add weights");
wording();
narrow.addEventListener("change", wording);
place(stateAt(push, weights), bar.x);
say(readoutOf(stateAt(push, weights), bar.x));
describe(stateAt(push, weights));
