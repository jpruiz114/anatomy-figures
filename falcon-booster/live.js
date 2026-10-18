const D = __DATA__;
const root = document.querySelector(".fb");
const stage = root.querySelector(".fb-stage");
const front = stage.querySelector(".fb-front");
const ground = stage.querySelector(".fb-ground");
const scorch = stage.querySelector(".fb-scorch");
const canvas = stage.querySelector(".fb-plume");
const readout = root.querySelector("[data-readout]");
const liveRegion = root.querySelector("[data-live]");
const playButton = root.querySelector("[data-play]");
const playLabel = root.querySelector("[data-play-label]");
const phaseButtons = [...root.querySelectorAll(".fb-phase")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIGHT = root.closest("[data-theme]")?.getAttribute("data-theme") === "light" ? 1 : 0;

const P = D.P;
setProjection(P);
const G = { unit3, add3, sub3, mul3, len3, cross3, dot3, lerp3, viewOf, frameOf, frameAlong, pointOf, disc, prismOf, arcOf, circleOf, sphereOf, solidOf };
installPointOf2(G);
const K = { cylinder, solidSvg, lineSvg, segment, pathOf, iso };
const parts = partsOf(K, G);

const dyn = Object.fromEntries([...front.querySelectorAll("[data-dyn]")].map((el) => [el.dataset.dyn, el]));
const bells = [...front.querySelectorAll(".it[data-engine]")];
const rims = [...stage.querySelectorAll(".fb-rim")];
const clampTo = (value, low, high) => Math.min(high, Math.max(low, value));
const fmt = (value) => Math.round(value).toLocaleString("en-US");

const SPEED = 8; // mission seconds per real second while playing
let t = T_END; // mission clock shown
let target = T_END;
let playing = false;
let touring = !still.matches;
let tourHold = 0;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;
let clock = 0;
let shown = { legs: -1, fins: -1, lox: -1, rp1: -1, lit: "" };
let phaseShown = "";

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function announce(phase) {
  if (phaseShown === phase.id) return;
  phaseShown = phase.id;
  if (liveRegion) liveRegion.textContent = `${phase.name}: ${phase.say}`;
  stage.setAttribute("aria-valuetext", `${clockText(t)}, ${phase.name}: ${phase.say}`);
  phaseButtons.forEach((button) => (button.dataset.phase === phase.id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
}

// Rebuild only the parts whose share changed.
function placeParts(state) {
  if (Math.abs(state.legs - shown.legs) > 1e-4) {
    shown.legs = state.legs;
    GEO.legAngles.forEach((deg, index) => {
      const { strut, body, near } = parts.leg(index, state.legs);
      const order = near ? [...strut, ...body] : [...body, ...strut];
      dyn[`leg${index}`].innerHTML = order.map((desc) => parts.drawDesc(desc, P)).join("");
    });
  }
  if (Math.abs(state.fins - shown.fins) > 1e-4) {
    shown.fins = state.fins;
    GEO.finAngles.forEach((deg, index) => {
      dyn[`fin${index}`].innerHTML = parts.fin(index, state.fins).map((desc) => parts.drawDesc(desc, P)).join("");
    });
  }
  const lox = loxLevel(state.lox);
  if (Math.abs(lox - shown.lox) > 0.02) {
    shown.lox = lox;
    dyn.lox.innerHTML = parts.drawDesc(parts.liquid("tank.lox", lox, D.windows.lox, "fb-lox"), P);
  }
  const rp1 = rp1Level(state.rp1);
  if (Math.abs(rp1 - shown.rp1) > 0.02) {
    shown.rp1 = rp1;
    dyn.rp1.innerHTML = parts.drawDesc(parts.liquid("tank.rp1", rp1, D.windows.rp1, "fb-rp1"), P);
    dyn["rp1-tube"].innerHTML = parts.drawDesc(parts.tubeAbove(rp1), P);
  }
  const lit = state.engines.map((share) => (share > 0 ? "1" : "0")).join("");
  if (lit !== shown.lit) {
    shown.lit = lit;
    bells.forEach((el) => (state.engines[Number(el.dataset.engine)] > 0 ? el.setAttribute("data-on", "") : el.removeAttribute("data-on")));
  }
}

// ---------------------------------------------------------------- plume shader
const FRAGMENT = `
uniform vec3 uEng[9];
uniform float uPress;
uniform float uGround;
uniform float uLight;
const float ZE=${D.exit.toFixed(1)};
const float R0=${D.bellR.toFixed(2)};
const vec2 PAD=vec2(${D.pad[0].toFixed(1)},${D.pad[1].toFixed(1)});
const float PADZ=${D.padZ.toFixed(1)};
const vec2 VIEW=vec2(${D.W.toFixed(1)},${D.H.toFixed(1)});
float sdRect(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
vec4 inkFor(vec3 seen,float cover){vec3 absorbed=1.-seen;float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);return vec4(vec3(a)-absorbed,a);}
vec3 paperOf(float e,float pf){
  vec3 vac=vec3(.80,.84,.98);
  vec3 pale=vec3(1.,.93,.74);
  vec3 body=vec3(1.,.62,.16);
  vec3 deep=vec3(.9,.40,.08);
  vec3 core=vec3(1.,.9,.7);
  vec3 slc=mix(vec3(1.),pale,smoothstep(0.,.15,e));
  slc=mix(slc,body,smoothstep(.12,.45,e));
  slc=mix(slc,deep,smoothstep(.45,.8,e));
  slc=mix(slc,core,smoothstep(.88,1.,e));
  vec3 vcl=mix(vec3(1.),vac,smoothstep(0.,.6,e));
  return mix(vcl,slc,pf);
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 V=towardViewer();
  vec3 g0=rayOf(vb);
  float sE=uCam.z;
  float pf=pow(clamp(uPress,0.,1.),.35);
  float spread=mix(1.3,.085,pf);
  float len=mix(260.,110.,pf);
  float dith=hash12(gl_FragCoord.xy);
  float T=uTime;
  float edge=(1.-smoothstep(VIEW.y-70.,VIEW.y-14.,vb.y))*smoothstep(14.,60.,vb.x)*(1.-smoothstep(VIEW.x-60.,VIEW.x-14.,vb.x));
  // where the ray meets the pad plane
  float tPad=(PADZ-g0.z)/sE;
  vec3 hp=g0+tPad*V;
  float onPad=(1.-smoothstep(-1.5,0.,sdRect(hp.xy,vec2(PAD.x),PAD.y)))*uGround;
  float tTop=(ZE+.5-g0.z)/sE;
  float tLow=(ZE-len-g0.z)/sE;
  float tStart=mix(tLow,max(tLow,tPad),onPad);
  vec3 sum=vec3(0.);
  float energy=0.;
  float dt=max(tTop-tStart,0.)/30.;
  if(dt>0.){
    for(int i=0;i<30;i++){
      float t=tStart+(float(i)+dith)*dt;
      vec3 p=g0+t*V;
      float s=ZE-p.z;
      float along=smoothstep(-.6,1.5,s)*(1.-smoothstep(len*.45,len,s));
      float lift=mix(1.,smoothstep(PADZ-.5,PADZ+1.5,p.z),uGround);
      for(int e=0;e<9;e++){
        float th=uEng[e].z;
        if(th<.001)continue;
        float r=length(p.xy-uEng[e].xy);
        float Rv=R0*(1.+spread*s/R0*.55)*(.9+.1*th);
        float rn=r/Rv;
        if(rn>1.6)continue;
        float n=fbm2(vec2(r*.25+float(e)*3.1,s*.09-T*7.));
        float ragged=1.+(n-.5)*mix(.9,.35,pf)*smoothstep(2.,30.,s);
        float body=exp(-rn*rn*2.6*ragged)*th;
        float core=exp(-rn*rn*9.)*smoothstep(0.,.3,th)*exp(-s/(28.+40.*pf));
        float dim=1./(1.+s*spread*.03);
        float cells=1.+.35*pf*cos(s*(.62/(1.+.1*spread))-.3)*smoothstep(0.,6.,s)*(1.-smoothstep(40.,90.,s));
        float w=dt*sE/(Rv*1.772);
        float eSample=(body*1.1*cells+core*1.6)*dim*along*lift*w*mix(2.2,1.,pf);
        vec3 sl=mix(vec3(1.,.42,.12),vec3(1.,.85,.55),core*.8+.2*pf);
        vec3 vc=vec3(.55,.62,1.);
        sum+=mix(vc*.7,sl,pf)*eSample;
        energy+=eSample;
      }
    }
  }
  // splash sheet on the pad
  float splashE=0.;
  if(onPad>.001){
    vec2 dirH=normalize(hp.xy+vec2(1e-4));
    float flow=fbm3(vec3(dirH*2.6,length(hp.xy)*.05-T*4.));
    for(int e=0;e<9;e++){
      float th=uEng[e].z;
      if(th<.001)continue;
      float d=length(hp.xy-uEng[e].xy);
      float reach=16.+22.*th*pf;
      splashE+=th*exp(-pow(d/reach,1.6))*(.45+.55*flow)*pf;
    }
    splashE*=onPad*(1.-smoothstep(60.,95.,length(hp.xy)));
    vec3 hot=mix(vec3(1.,.4,.12),vec3(1.,.82,.55),exp(-length(hp.xy)/30.));
    sum+=hot*splashE*.4;
    energy+=splashE*.4;
  }
  sum*=edge;
  // dark: light added over the drawing
  vec3 col=tonemap(sum,1.1);
  float m=max(col.r,max(col.g,col.b));
  float nz=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  col=max(col+nz*smoothstep(0.,1.5/255.,m),0.);
  m=max(col.r,max(col.g,col.b));
  vec4 dark=vec4(col,m);
  // light: ink on paper from one ramp
  float e=1.-exp(-1.4*energy);
  vec3 seen=paperOf(e,pf);
  float cover=.22*smoothstep(.7,1.,e)*pf;
  vec4 light=inkFor(seen,cover)*edge;
  light=max(light+vec4(nz)*smoothstep(0.,1.5/255.,light.a),0.);
  light.rgb=min(light.rgb,vec3(light.a));
  gl_FragColor=mix(dark,light,uLight);
}`;

const layer = glLayer({ canvas, fragment: FRAGMENT, view: [D.W, D.H], camera: D.camera, uniforms: ["uEng", "uPress", "uGround"], fixed: { uLight: LIGHT } });
if (layer) stage.setAttribute("data-gl", "");
const engineBuffer = new Float32Array(27);
let lastKey = "";
// each engine's plume follows its throttle on its own envelope, so a cut-off fades instead of popping
const plumes = D.engines.map(() => ({ x: 0, v: 0 }));
let burning = 0;
const groundShare = { x: 1, v: 0 };

function paint(state, calm) {
  if (!layer) return;
  if (burning < 1e-3) {
    layer.clear();
    lastKey = "";
    return;
  }
  for (let i = 0; i < 9; i++) {
    engineBuffer[i * 3] = D.engines[i][0];
    engineBuffer[i * 3 + 1] = D.engines[i][1];
    engineBuffer[i * 3 + 2] = plumes[i].x;
  }
  const values = { uEng: engineBuffer, uPress: state.pressure, uGround: groundShare.x };
  const time = calm ? 0.8 : clock;
  const key = calm ? JSON.stringify([...engineBuffer, state.pressure, groundShare.x]) : "";
  if (key && key === lastKey) return;
  lastKey = key;
  layer.draw(values, time);
}

function readoutOf(state) {
  const alt = state.altitudeKm < 10 ? state.altitudeKm.toFixed(1) : fmt(state.altitudeKm);
  return `${clockText(state.t)} · ${state.phase.name} · ${alt} km · ${fmt(state.speedMs * 3.6)} km/h`;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring || playing) {
    if (tourHold > 0) tourHold -= dt;
    else {
      target = Math.min(T_END, target + dt * SPEED);
      if (target >= T_END) {
        if (playing) setPlaying(false);
        else {
          tourHold = 3;
          target = 0;
          t = 0;
        }
      }
    }
  }
  t = calm ? target : t + (target - t) * (1 - Math.exp(-dt / 0.22));
  if (Math.abs(target - t) < 0.02) t = target;
  const state = stateAt(t);
  const onGround = 1 - smooth(0.3, 2.5, state.altitudeKm);
  settle(groundShare, onGround, dt, 0.22, calm);
  burning = 0;
  state.engines.forEach((share, index) => {
    settle(plumes[index], share, dt, share > plumes[index].x ? 0.12 : 0.28, calm);
    burning = Math.max(burning, plumes[index].x);
  });
  placeParts(state);
  ground.style.opacity = groundShare.x.toFixed(3);
  scorch.style.opacity = (groundShare.x * burning * 0.7).toFixed(3);
  rims.forEach((rim, index) => rim.style.setProperty("opacity", (clampTo(plumes[index].x, 0, 1) * 0.9).toFixed(3)));
  paint(state, calm);
  say(readoutOf(state));
  announce(state.phase);
  stage.setAttribute("aria-valuenow", String(Math.round(t)));
  const moving = Math.abs(target - t) > 0.02 || touring || playing || burning > 1e-3 || Math.abs(groundShare.x - onGround) > 1e-3;
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

function setPlaying(on) {
  playing = on;
  playLabel.textContent = on ? "Pause" : "Play";
  if (on) playButton.setAttribute("data-state", "on");
  else playButton.removeAttribute("data-state");
}
function takeOver() {
  touring = false;
  tourHold = 0;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (playing || held) return takeOver();
    touring = !still.matches;
    tourHold = 0;
    run();
  }, 9000);
  run();
}
function steer(next) {
  target = clampTo(next, 0, T_END);
  takeOver();
}

let held = false;
const fractionOf = (event) => {
  const box = stage.getBoundingClientRect();
  return clampTo((event.clientX - box.left) / box.width, 0, 1);
};
stage.addEventListener("pointerdown", (event) => {
  held = true;
  stage.setPointerCapture(event.pointerId);
  if (playing) setPlaying(false);
  steer(fractionOf(event) * T_END);
});
stage.addEventListener("pointermove", (event) => {
  if (!held && event.pointerType === "touch") return;
  if (!held && playing) return;
  steer(fractionOf(event) * T_END);
});
const release = () => {
  held = false;
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("pointerleave", () => {
  if (!held) takeOver();
});

playButton.addEventListener("click", () => {
  if (!playing && target >= T_END - 0.5) {
    target = 0;
    t = 0;
  }
  setPlaying(!playing);
  takeOver();
});
phaseButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (playing) setPlaying(false);
    steer(Number(button.dataset.at) + 0.5);
  });
});
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 30 : 5;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") steer((touring ? t : target) + step);
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") steer((touring ? t : target) - step);
  else if (event.key === "Home") steer(0);
  else if (event.key === "End") steer(T_END);
  else if (event.key === " " || event.key === "Enter") {
    if (!playing && target >= T_END - 0.5) {
      target = 0;
      t = 0;
    }
    setPlaying(!playing);
    takeOver();
  } else if (event.key === "Escape") {
    setPlaying(false);
    takeOver();
  } else return;
  event.preventDefault();
});

if (still.matches) touring = false;
else {
  target = 0;
  t = 0;
  tourHold = 0.8;
}
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".fb-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Drag to scrub the mission clock" : "Drag across the figure to scrub the mission clock");
wording();
narrow.addEventListener("change", wording);
window.addEventListener("resize", () => {
  lastKey = "";
  run();
});
placeParts(stateAt(t));
say(readoutOf(stateAt(t)));
