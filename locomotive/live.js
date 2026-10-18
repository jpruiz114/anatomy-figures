const D = __DATA__;
const root = document.querySelector(".lc");
const stage = root.querySelector(".lc-stage");
const svg = stage.querySelector("svg");
const canvas = stage.querySelector(".lc-puffs");
const readout = root.querySelector("[data-readout]");
const liveRegion = root.querySelector("[data-live]");
const playButton = root.querySelector("[data-play]");
const playLabel = root.querySelector("[data-play-label]");
const eventButtons = [...root.querySelectorAll(".lc-event")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIGHT = root.closest("[data-theme]")?.getAttribute("data-theme") === "light" ? 1 : 0;

const P = D.P;
const G = { unit3, add3, sub3, mul3, len3, cross3, dot3, lerp3, viewOf, toneOf, frameOf, frameAlong, pointOf, disc, ringBand, prismOf, arcOf, circleOf, sphereOf, solidOf, stadium };
const K = { cylinder, solidSvg, lineSvg, segment, pathOf, iso };
const Model = { stateAt, LOCO };
const parts = partsOf(K, G, Model);
const dyn = Object.fromEntries([...svg.querySelectorAll("[data-dyn]")].map((el) => [el.dataset.dyn, el]));
const clampTo = (value, low, high) => Math.min(high, Math.max(low, value));
const wrapDeg = (deg) => ((deg % 360) + 360) % 360;

let theta = D.rest;
let target = D.rest;
let running = false;
let touring = !still.matches;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let clock = 0;
let shownTheta = NaN;
let phaseShown = "";

const draw = (descs) => descs.map((desc) => parts.drawDesc(desc, P)).join("");
function place(deg) {
  if (Math.abs(deg - shownTheta) < 0.02) return;
  shownTheta = deg;
  const t = wrapDeg(deg);
  dyn.cylinder.innerHTML = draw(parts.cylinderInside(t));
  dyn.valve.innerHTML = draw(parts.valve(t));
  const ch = parts.crosshead(t);
  dyn.crosshead.innerHTML = draw(ch.descs);
  dyn["pin-nose"].innerHTML = draw(ch.nose);
  dyn.conrod.innerHTML = draw(parts.conrod(t));
  dyn.coupling.innerHTML = draw(parts.couplingRod(t));
  const pins = parts.pins(t);
  dyn["front-nose"].innerHTML = draw(pins.front);
  dyn["rear-pin"].innerHTML = draw(pins.rear);
  const gear = parts.valveGear(t);
  dyn["return-crank"].innerHTML = draw(gear.crank);
  dyn["gear-rod"].innerHTML = draw(gear.rod);
  GEO.axles.forEach((xa, index) => {
    const sp = parts.spokes(xa, t, P);
    dyn[`wheel${index}-spokes-far`].innerHTML = draw(sp.far);
    dyn[`wheel${index}-spokes-near`].innerHTML = draw(sp.near);
  });
}
function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
const eventOf = (state) => ({ admission: "admission", expansion: "cutoff", exhaust: "release", compression: "compression" })[state.head.phase];
function describe(state) {
  const key = `${state.head.phase}/${state.crank.phase}`;
  if (phaseShown === key) return;
  phaseShown = key;
  const text = `head end ${PHASE_WORDS[state.head.phase]}, crank end ${PHASE_WORDS[state.crank.phase]}`;
  if (liveRegion) liveRegion.textContent = text;
  stage.setAttribute("aria-valuetext", `Wheels at ${Math.round(state.theta)} degrees, ${text}`);
  eventButtons.forEach((button) => (button.dataset.event === eventOf(state) ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
}
function readoutOf(state) {
  const side = state.head.phase === "admission" || state.head.phase === "expansion" ? ["head end", state.head] : ["crank end", state.crank];
  const run = running || touring ? ` · ${speedKmh(D.shownRpm).toFixed(1)} km/h · ${meanEffortKn.toFixed(0)} kN` : "";
  return `wheel ${String(Math.round(wrapDeg(state.theta))).padStart(3, " ")}° · ${side[0]} ${PHASE_WORDS[side[1].phase]} · ${side[1].bar.toFixed(1)} bar${run}`;
}

// ---------------------------------------------------------------- exhaust puffs
const PUFFS = 8;
const puffs = Array.from({ length: PUFFS }, () => ({ age: 99, strength: 0 }));
let nextPuff = 0;
const LIFE = 2.6;
const FRAGMENT = `
uniform vec4 uPuff[${PUFFS}];
uniform float uLight;
const vec3 TOP=vec3(${D.chimney.map((v) => v.toFixed(1)).join(",")});
const vec2 VIEW=vec2(${D.W.toFixed(1)},${D.H.toFixed(1)});
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 V=towardViewer();
  vec3 g0=rayOf(vb);
  float edge=smoothstep(10.,40.,vb.x)*(1.-smoothstep(VIEW.x-40.,VIEW.x-10.,vb.x))*smoothstep(10.,40.,vb.y)*(1.-smoothstep(VIEW.y-40.,VIEW.y-10.,vb.y));
  float dens=0.;
  for(int i=0;i<${PUFFS};i++){
    vec4 q=uPuff[i];
    float age=q.z;
    if(age<0.||age>${LIFE.toFixed(1)}||q.w<.001)continue;
    float u=age/${LIFE.toFixed(1)};
    float rise=110.*age-18.*age*age;
    vec3 c=TOP+vec3(42.*age+6.*age*age,0.,2.+rise);
    float R=6.+26.*age;
    float tc=dot(c-g0,V);
    float d=length(g0+tc*V-c);
    float wob=.8+.4*fbm3(vec3(c.x*.05,c.z*.05,age*.7)+vec3(vb*.01,0.));
    float life=(1.-u)*(1.-u)*smoothstep(0.,.12,age);
    dens+=q.w*life*wob*exp(-d*d/(R*R*.45))*1.772*R*.045;
  }
  dens*=edge;
  float a=1.-exp(-dens*1.6);
  // dark: pale steam added over the drawing; light: light grey ink on paper
  vec3 dark=vec3(.78,.8,.84)*a;
  float ink=a*.8;
  vec3 light=mix(vec3(.80,.83,.87),vec3(.62,.66,.72),smoothstep(.2,.9,a))*ink;
  float nz=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  vec4 darkOut=vec4(dark,a)+vec4(nz)*smoothstep(0.,1.5/255.,a);
  vec4 lightOut=vec4(light,ink)+vec4(nz)*smoothstep(0.,1.5/255.,ink);
  lightOut.rgb=min(lightOut.rgb,vec3(lightOut.a));
  gl_FragColor=mix(max(darkOut,0.),max(lightOut,0.),uLight);
}`;
const layer = glLayer({ canvas, fragment: FRAGMENT, view: [D.W, D.H], camera: D.camera, uniforms: ["uPuff"], fixed: { uLight: LIGHT } });
if (layer) stage.setAttribute("data-gl", "");
const puffBuffer = new Float32Array(PUFFS * 4);
function spawnPuff(strength) {
  const p = puffs[nextPuff];
  nextPuff = (nextPuff + 1) % PUFFS;
  p.age = 0;
  p.strength = strength;
}
function paintPuffs(dt, calm) {
  let active = false;
  for (let i = 0; i < PUFFS; i++) {
    const p = puffs[i];
    if (p.age <= LIFE) {
      p.age += dt;
      active = true;
    }
    puffBuffer[i * 4] = 0;
    puffBuffer[i * 4 + 1] = 0;
    puffBuffer[i * 4 + 2] = p.age;
    puffBuffer[i * 4 + 3] = p.strength;
  }
  if (!layer) return active;
  if (!active || calm) {
    layer.clear();
    return false;
  }
  layer.draw({ uPuff: puffBuffer }, clock);
  return true;
}
// A puff for every exhaust beat the wheel passes through this frame.
function beatsBetween(a, b) {
  const count = Math.floor(b / 360) - Math.floor(a / 360);
  let hits = 0;
  for (const beat of D.beats) {
    const base = Math.floor(a / 360) * 360;
    for (let k = 0; k <= count + 1; k++) {
      const at = base + k * 360 + beat;
      if (at > a && at <= b) hits++;
    }
  }
  return hits;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (running || touring) target += dt * D.shownRpm * 6;
  const before = theta;
  theta = calm ? target : theta + (target - theta) * (1 - Math.exp(-dt / 0.18));
  if (Math.abs(target - theta) < 0.02) theta = target;
  if (!calm && theta > before) {
    const hits = beatsBetween(before, theta);
    for (let i = 0; i < hits; i++) spawnPuff(0.9);
  }
  const state = stateAt(wrapDeg(theta));
  place(theta);
  const puffing = paintPuffs(dt, calm);
  say(readoutOf(state));
  describe(state);
  stage.setAttribute("aria-valuenow", String(Math.round(wrapDeg(theta))));
  const moving = Math.abs(target - theta) > 0.02 || running || touring || puffing;
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
    let delta = Number(button.dataset.at) - here;
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
const hint = root.querySelector(".lc-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Drag to roll the engine" : "Drag across the engine to roll it by hand");
wording();
narrow.addEventListener("change", wording);
window.addEventListener("resize", run);
place(theta);
say(readoutOf(stateAt(wrapDeg(theta))));
describe(stateAt(wrapDeg(theta)));
