const D = __DATA__;
const root = document.querySelector(".ff");
const stage = root.querySelector(".ff-stage");
const svg = stage.querySelector("svg");
const canvas = stage.querySelector(".ff-plume");
const readout = root.querySelector("[data-readout]");
const liveRegion = root.querySelector("[data-live]");
const throttleButtons = [...root.querySelectorAll(".ff-throttle")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIGHT = root.closest("[data-theme]")?.getAttribute("data-theme") === "light" ? 1 : 0;

const P = D.P;
const G = { unit3, add3, sub3, mul3, len3, cross3, dot3, lerp3, viewOf, frameOf, frameAlong, pointOf, prismOf, disc };
const K = { solidSvg, lineSvg, segment, pathOf, iso, depthOf };
const Model = { F22, surfacesAt };
const parts = partsOf(K, G, Model);
const dyn = Object.fromEntries([...svg.querySelectorAll("[data-dyn]")].map((el) => [el.dataset.dyn, el]));
const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const stick = { pitch: D.rest.pitch, roll: D.rest.roll };
const target = { pitch: D.rest.pitch, roll: D.rest.roll, rudder: D.rest.rudder };
let rudder = D.rest.rudder;
let throttle = D.rest.throttle;
const ab = { x: throttle === "afterburner" ? 1 : 0, v: 0 };
const core = { x: throttle === "idle" ? 0.25 : 1, v: 0 };
let fanPhase = 0;
let touring = !still.matches;
let tourClock = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let clock = 0;
let shown = { pitch: NaN, roll: NaN, rudder: NaN, throttle: "" };
let said = "";

const draw = (descs) => descs.map((d) => parts.drawDesc(d, P)).join("");
const WIN = Object.fromEntries(Object.entries(GEO.windows).map(([id, w]) => [id, parts.windowPoints(GEO.nacelleY, GEO.cz, w.r, w.x0, w.x1, w.deg0, w.deg1, P)]));
const [FAN_ROW, ...COMP_ROWS] = GEO.rotors;
function spin(phase) {
  dyn.fan.innerHTML = parts.rotorBlades([FAN_ROW], phase, WIN.fan, P);
  dyn.comp.innerHTML = parts.rotorBlades(COMP_ROWS, phase, WIN.comp, P);
}
function fill(kind, descs) {
  for (const side of ["right", "left"]) dyn[`${kind}-${side}`].innerHTML = draw(descs.filter((d) => d.name.endsWith(side)));
}
function place(s) {
  if (Math.abs(s.pitch - shown.pitch) > 1e-3 || Math.abs(s.roll - shown.roll) > 1e-3) {
    fill("stabs", parts.stabilators(s));
    fill("flaps", parts.wingFlaps(s));
    fill("nozzles", parts.nozzleFlaps(s));
  }
  if (Math.abs(s.yaw - shown.rudder) > 1e-3) fill("rudders", parts.rudders(s));
  shown = { pitch: s.pitch, roll: s.roll, rudder: s.yaw, throttle: s.throttle };
}
function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
const fmtDeg = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}°`;
function readoutOf(s) {
  return `stabs ${fmtDeg(s.stab.left)} / ${fmtDeg(s.stab.right)} · nozzles ${fmtDeg(s.nozzle)} · rudders ${fmtDeg(s.rudder)} · ${s.throttle === "afterburner" ? "A/B" : s.throttle === "military" ? "mil" : "idle"} ${s.totalKn.toFixed(0)} kN`;
}
function describe(s) {
  const text = `${s.throttle} power, ${s.totalKn.toFixed(0)} kilonewtons; stabilators ${s.stab.left.toFixed(0)} and ${s.stab.right.toFixed(0)} degrees, nozzles ${s.nozzle.toFixed(0)}, rudders ${s.rudder.toFixed(0)}`;
  if (said === text) return;
  said = text;
  if (liveRegion) liveRegion.textContent = text;
  stage.setAttribute("aria-valuetext", text);
  throttleButtons.forEach((b) => (b.dataset.throttle === s.throttle ? b.setAttribute("data-on", "") : b.removeAttribute("data-on")));
}

// ---------------------------------------------------------------- afterburner plumes
const FRAGMENT = `
uniform vec3 uExit[2];
uniform vec3 uDir;
uniform float uAb;
uniform float uCore;
uniform float uLight;
const vec2 VIEW=vec2(${D.W.toFixed(1)},${D.H.toFixed(1)});
vec4 inkFor(vec3 seen,float cover){vec3 absorbed=1.-seen;float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);return vec4(vec3(a)-absorbed,a);}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 V=towardViewer();
  vec3 g0=rayOf(vb);
  float edge=smoothstep(10.,40.,vb.x)*(1.-smoothstep(VIEW.x-40.,VIEW.x-10.,vb.x))*smoothstep(10.,40.,vb.y)*(1.-smoothstep(VIEW.y-40.,VIEW.y-10.,vb.y));
  float T=uTime;
  vec3 col=vec3(0.);
  float energy=0.;
  float len=mix(20.,60.,uAb)*uCore;
  for(int e=0;e<2;e++){
    vec3 o=uExit[e];
    vec3 d=uDir;
    // distance of this ray from the plume axis, and position along it
    vec3 w=g0-o;
    float dd=dot(d,V);
    float den=1.-dd*dd;
    float sA=(dot(w,d)-dd*dot(w,V))/den;      // along the axis at closest approach
    float tV=(dd*dot(w,d)-dot(w,V))/den;
    vec3 pA=o+d*sA;
    vec3 pV=g0+V*tV;
    float r=length(pA-pV);
    if(sA<-2.||sA>len*1.3)continue;
    float along=smoothstep(-1.5,1.,sA)*(1.-smoothstep(len*.5,len,sA));
    float R=3.4+sA*mix(.03,.085,uAb);
    float rn=r/R;
    if(rn>1.8)continue;
    float n=fbm2(vec2(sA*.12-T*9.,r*.3+float(e)*2.));
    float ragged=1.+(n-.5)*.5*smoothstep(4.,40.,sA);
    float body=exp(-rn*rn*3.*ragged);
    float cells=1.+.12*uAb*cos(sA*.9)*smoothstep(0.,4.,sA)*(1.-smoothstep(20.,50.,sA));
    float core=exp(-rn*rn*9.)*exp(-sA/40.);
    float eSample=(body*(.3+.9*uAb)*cells+core*(.5+.9*uAb))*along*(.35+.65*uCore);
    vec3 hot=mix(vec3(.55,.62,1.),vec3(1.,.55,.18),uAb*smoothstep(0.,.3,uAb));
    vec3 pale=vec3(1.,.9,.72);
    col+=mix(hot,pale,core*.6)*eSample*mix(.35,1.,uAb);
    energy+=eSample*mix(.35,1.,uAb);
  }
  col*=edge;energy*=edge;
  vec3 dark=tonemap(col,1.2);
  float m=max(dark.r,max(dark.g,dark.b));
  float nz=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  dark=max(dark+nz*smoothstep(0.,1.5/255.,m),0.);
  m=max(dark.r,max(dark.g,dark.b));
  float en=1.-exp(-1.4*energy);
  vec3 vac=vec3(.80,.85,.98);
  vec3 bodyInk=mix(vec3(1.),mix(vac,vec3(1.,.6,.15),uAb),smoothstep(0.,.45,en));
  bodyInk=mix(bodyInk,mix(vac,vec3(.9,.42,.08),uAb),smoothstep(.45,.85,en));
  bodyInk=mix(bodyInk,vec3(1.,.9,.72),smoothstep(.88,1.,en)*uAb);
  float cover=.2*smoothstep(.7,1.,en)*uAb;
  vec4 light=inkFor(bodyInk,cover)*edge;
  light=max(light+vec4(nz)*smoothstep(0.,1.5/255.,light.a),0.);
  light.rgb=min(light.rgb,vec3(light.a));
  gl_FragColor=mix(vec4(dark,m),light,uLight);
}`;
const layer = glLayer({ canvas, fragment: FRAGMENT, view: [D.W, D.H], camera: D.camera, uniforms: ["uExit", "uDir", "uAb", "uCore"], fixed: { uLight: LIGHT } });
if (layer) stage.setAttribute("data-gl", "");
const exits = new Float32Array(6);
function paint(s, calm) {
  if (!layer) return;
  if (core.x < 0.02) {
    layer.clear();
    return;
  }
  for (const [i, side] of [[0, 1], [1, -1]]) {
    const { exit } = parts.plumeOf(s, side);
    exits[i * 3] = exit[0];
    exits[i * 3 + 1] = exit[1];
    exits[i * 3 + 2] = exit[2];
  }
  const { dir } = parts.plumeOf(s, 1);
  layer.draw({ uExit: exits, uDir: dir, uAb: ab.x, uCore: core.x }, calm ? 0.8 : clock);
}

function tourAt(t) {
  const c = t % 16;
  const pitch = Math.sin((c / 16) * Math.PI * 2) * 0.8;
  const roll = Math.sin((c / 8) * Math.PI * 2 + 1) * 0.6;
  const rud = c > 10 && c < 13 ? Math.sin(((c - 10) / 3) * Math.PI) * 0.8 : 0;
  const thr = c < 5 ? "military" : c < 11 ? "afterburner" : "idle";
  return { pitch, roll, rudder: rud, throttle: thr };
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring) {
    tourClock += dt;
    const step = tourAt(tourClock);
    target.pitch = step.pitch;
    target.roll = step.roll;
    target.rudder = step.rudder;
    if (step.throttle !== throttle) setThrottle(step.throttle, false);
  }
  const ease = calm ? 1 : 1 - Math.exp(-dt / 0.22);
  stick.pitch += (target.pitch - stick.pitch) * ease;
  stick.roll += (target.roll - stick.roll) * ease;
  rudder += (target.rudder - rudder) * ease;
  const s = surfacesAt(stick, rudder, throttle);
  let moving = settle(ab, s.afterburner, dt, 0.35, calm);
  moving = settle(core, s.core, dt, 0.6, calm) || moving;
  fanPhase = (fanPhase + dt * 360 * (0.5 + 1.5 * core.x)) % 360;
  if (!calm) spin(fanPhase);
  place(s);
  paint(s, calm);
  say(readoutOf(s));
  describe(s);
  const settled = Math.abs(target.pitch - stick.pitch) < 1e-3 && Math.abs(target.roll - stick.roll) < 1e-3 && Math.abs(target.rudder - rudder) < 1e-3;
  frame = visible && (!settled || moving || touring || (!calm && core.x > 0.02)) ? requestAnimationFrame(tick) : 0;
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
  }, 8000);
  run();
}
function setThrottle(next, user = true) {
  throttle = next;
  if (user) takeOver();
  run();
}
let drag = null;
const fractionsOf = (event) => {
  const box = stage.getBoundingClientRect();
  return [(event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height];
};
stage.addEventListener("pointerdown", (event) => {
  held = true;
  stage.setPointerCapture(event.pointerId);
  const [fx, fy] = fractionsOf(event);
  drag = { fx, fy, pitch: touring ? stick.pitch : target.pitch, roll: touring ? stick.roll : target.roll };
  takeOver();
});
stage.addEventListener("pointermove", (event) => {
  if (!held || !drag) return;
  const [fx, fy] = fractionsOf(event);
  target.roll = clampTo(drag.roll + (fx - drag.fx) * 3, -1, 1);
  target.pitch = clampTo(drag.pitch + (fy - drag.fy) * 3, -1, 1);
  takeOver();
});
const release = () => {
  held = false;
  drag = null;
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
throttleButtons.forEach((b) => b.addEventListener("click", () => setThrottle(b.dataset.throttle)));
const keysDown = new Set();
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 0.5 : 0.2;
  if (event.key === "ArrowUp") target.pitch = clampTo((touring ? stick.pitch : target.pitch) - step, -1, 1);
  else if (event.key === "ArrowDown") target.pitch = clampTo((touring ? stick.pitch : target.pitch) + step, -1, 1);
  else if (event.key === "ArrowLeft") target.roll = clampTo((touring ? stick.roll : target.roll) - step, -1, 1);
  else if (event.key === "ArrowRight") target.roll = clampTo((touring ? stick.roll : target.roll) + step, -1, 1);
  else if (event.key === "a" || event.key === "A") target.rudder = clampTo(target.rudder - step, -1, 1);
  else if (event.key === "d" || event.key === "D") target.rudder = clampTo(target.rudder + step, -1, 1);
  else if (event.key === "Home") Object.assign(target, { pitch: 0, roll: 0, rudder: 0 });
  else if (event.key === "1") setThrottle("idle");
  else if (event.key === "2") setThrottle("military");
  else if (event.key === "3") setThrottle("afterburner");
  else if (event.key === "Escape") Object.assign(target, { pitch: 0, roll: 0, rudder: 0 });
  else return;
  event.preventDefault();
  takeOver();
});
void keysDown;
if (still.matches) touring = false;
place(surfacesAt(stick, rudder, throttle));
say(readoutOf(surfacesAt(stick, rudder, throttle)));
describe(surfacesAt(stick, rudder, throttle));
