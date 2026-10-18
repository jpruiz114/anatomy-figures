const D = __DATA__;
const root = document.querySelector(".se");
const stage = root.querySelector(".se-stage");
const svg = stage.querySelector("svg");
const readout = root.querySelector("[data-readout]");
const liveRegion = root.querySelector("[data-live]");
const playButton = root.querySelector("[data-play]");
const playLabel = root.querySelector("[data-play-label]");
const eventButtons = [...root.querySelectorAll(".se-event")];
const still = matchMedia("(prefers-reduced-motion: reduce)");

const P = D.P;
const G = { unit3, add3, sub3, mul3, len3, cross3, dot3, lerp3, viewOf, toneOf, frameOf, frameAlong, pointOf, disc, ringBand, prismOf, arcOf, circleOf, sphereOf, solidOf, stadium };
const K = { cylinder, solidSvg, lineSvg, segment, pathOf, iso };
const Model = { stateAt, ENGINE };
const parts = partsOf(K, G, Model);
const dyn = Object.fromEntries([...svg.querySelectorAll("[data-dyn]")].map((el) => [el.dataset.dyn, el]));
const alongY = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const clampTo = (value, low, high) => Math.min(high, Math.max(low, value));
const wrapDeg = (deg) => ((deg % 360) + 360) % 360;
const fmt = (value) => Math.round(value).toLocaleString("en-US");

let theta = D.rest; // crank angle shown, degrees, unwrapped
let target = D.rest;
let running = false;
let touring = !still.matches;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let shownTheta = NaN;
let phaseShown = "";

const draw = (descs) => descs.map((desc) => parts.drawDesc(desc, P)).join("");
function place(deg) {
  if (Math.abs(deg - shownTheta) < 0.02) return;
  shownTheta = deg;
  const t = wrapDeg(deg);
  dyn.cylinder.innerHTML = draw(parts.cylinderInside(t).descs);
  dyn.valve.innerHTML = draw(parts.valve(t));
  const ch = parts.crosshead(t);
  dyn.crosshead.innerHTML = draw(ch.descs);
  dyn["pin-nose"].innerHTML = draw([{ kind: "disc", F: alongY(ch.xc, 0, GEO.axisZ), s0: GEO.conrodY[1], s1: GEO.pinY[1], r: 2.5, tone: "mid", bevel: 0.3 }]);
  dyn.conrod.innerHTML = draw(parts.conrod(t));
  dyn.crank.innerHTML = draw(parts.crank(t));
  const [xk, zk] = parts.crankpin(t);
  dyn["crank-nose"].innerHTML = draw([{ kind: "disc", F: alongY(xk, 0, zk), s0: GEO.crank.noseY[0], s1: GEO.crank.noseY[1], r: GEO.crank.pinR, tone: "hi", bevel: 0.3 }]);
  const gear = parts.valveGear(t);
  dyn.eccentric.innerHTML = draw(gear.eccentric);
  dyn["valve-rod"].innerHTML = draw(gear.rod);
  const sp = parts.spokes(t, P);
  dyn["spokes-far"].innerHTML = draw(sp.far);
  dyn["spokes-near"].innerHTML = draw(sp.near);
}

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function describe(state) {
  const key = `${state.head.phase}/${state.crank.phase}`;
  if (phaseShown === key) return;
  phaseShown = key;
  const text = `head end ${PHASE_WORDS[state.head.phase]}, crank end ${PHASE_WORDS[state.crank.phase]}`;
  if (liveRegion) liveRegion.textContent = text;
  stage.setAttribute("aria-valuetext", `Crank at ${Math.round(state.theta)} degrees, ${text}`);
  eventButtons.forEach((button) => (button.dataset.event === eventOf(state) ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
}
const eventOf = (state) => ({ admission: "admission", expansion: "cutoff", exhaust: "release", compression: "compression" })[state.head.phase];
function readoutOf(state) {
  const side = state.head.phase === "admission" || state.head.phase === "expansion" ? ["head end", state.head] : ["crank end", state.crank];
  const rpm = running || touring ? ` · ${D.shownRpm} rpm · ${powerKw(D.shownRpm).toFixed(1)} kW` : "";
  return `crank ${String(Math.round(wrapDeg(state.theta))).padStart(3, " ")}° · ${side[0]} ${PHASE_WORDS[side[1].phase]} · ${side[1].bar.toFixed(1)} bar${rpm}`;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (running || touring) target += dt * D.shownRpm * 6;
  theta = calm ? target : theta + (target - theta) * (1 - Math.exp(-dt / 0.18));
  if (Math.abs(target - theta) < 0.02) theta = target;
  const state = stateAt(wrapDeg(theta));
  place(theta);
  say(readoutOf(state));
  describe(state);
  stage.setAttribute("aria-valuenow", String(Math.round(wrapDeg(theta))));
  const moving = Math.abs(target - theta) > 0.02 || running || touring;
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
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

function setRunning(on) {
  running = on;
  playLabel.textContent = on ? "Stop" : "Run";
  if (on) playButton.setAttribute("data-state", "on");
  else playButton.removeAttribute("data-state");
}
let held = false;
function takeOver() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (running || held) return takeOver();
    touring = !still.matches;
    run();
  }, 9000);
  run();
}
function steer(next) {
  target = next;
  takeOver();
}
// Drag turns the crank: one width of the stage is one turn and a half.
let dragStart = null;
const fractionOf = (event) => {
  const box = stage.getBoundingClientRect();
  return (event.clientX - box.left) / box.width;
};
stage.addEventListener("pointerdown", (event) => {
  held = true;
  stage.setPointerCapture(event.pointerId);
  if (running) setRunning(false);
  dragStart = { x: fractionOf(event), theta: touring ? theta : target };
  takeOver();
});
stage.addEventListener("pointermove", (event) => {
  if (!held || !dragStart) return;
  steer(dragStart.theta + (fractionOf(event) - dragStart.x) * 540);
});
const release = () => {
  held = false;
  dragStart = null;
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
playButton.addEventListener("click", () => {
  setRunning(!running);
  takeOver();
});
eventButtons.forEach((button) =>
  button.addEventListener("click", () => {
    if (running) setRunning(false);
    const here = wrapDeg(target);
    const want = Number(button.dataset.at);
    let delta = want - here;
    if (delta < -180) delta += 360;
    if (delta > 180) delta -= 360;
    steer(target + delta);
  }),
);
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 45 : 10;
  const from = touring ? theta : target;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") steer(from + step);
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") steer(from - step);
  else if (event.key === "Home") steer(from - wrapDeg(from));
  else if (event.key === "End") steer(from - wrapDeg(from) + 180);
  else if (event.key === " " || event.key === "Enter") {
    setRunning(!running);
    takeOver();
  } else if (event.key === "Escape") {
    setRunning(false);
    takeOver();
  } else return;
  event.preventDefault();
});

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".se-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Drag to turn the crank" : "Drag across the engine to turn the crank by hand");
wording();
narrow.addEventListener("change", wording);
place(theta);
say(readoutOf(stateAt(wrapDeg(theta))));
describe(stateAt(wrapDeg(theta)));
