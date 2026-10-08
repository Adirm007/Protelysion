/**
 * Loading veil (0.37.4 remake): an animated transition card shown while the next floor is generated / uploaded
 * to the renderer (first entry into the labyrinth and every floor change), so the player never faces a frozen frame.
 *
 * Three themed variants — library, fairy-tale pop-up book, marionette theatre — are layered AI illustrations
 * (VEIL_ART) plus HTML/CSS light, particles and parallax. Every animation only touches `transform` / `opacity`,
 * so the compositor keeps them moving while the main thread is blocked by WebAssembly (Godot builds the floor on
 * the main thread in the web export). The marionette is cut into ten jointed parts (head, torso, upper/lower arms
 * and legs) that dance on a 4.8 s loop; the hand/knee/head strings counter-rotate so they stay vertical.
 * The veil stays at least MIN_MS on screen, then fades out over FADE_MS. prefers-reduced-motion is honoured.
 */
import {VEIL_ART, type VeilArtKey} from './veil-art';
import {OCTO_SERIF} from './octo-kit';

export type VeilVariant = 'library' | 'fairytale' | 'marionette';
export const VEIL_VARIANTS: readonly VeilVariant[] = ['library', 'fairytale', 'marionette'];
export type VeilInfo = {key: string; subtitle?: string; variant?: VeilVariant; boot?: boolean};
export const VEIL_MIN_MS = 1200, VEIL_FADE_MS = 450;

const TITLES: Record<VeilVariant, string> = {library: '正在翻开下一页', fairytale: '故事正在展开', marionette: '幕间换景中'};
const HINTS: Record<VeilVariant, string[]> = {
  library: ['书架深处传来纸页摩挲的声音', '墨迹正在凝成道路与屋檐', '有一本书，正替你挑选下一段旅程'],
  fairytale: ['城堡正从书页里立起来', '怀表停在了“从前从前”', '兔子说：还来得及'],
  marionette: ['布景师正在更换背景画板', '提线已经绷紧，请稍候', '帷幕之后，下一幕即将开演'],
};

/** Stable variant for a floor key (FNV-1a). */
export function veilVariantFor(key: string): VeilVariant {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return VEIL_VARIANTS[(h >>> 0) % VEIL_VARIANTS.length]!;
}

/** Themes whose world already speaks one of the three veil languages; every other floor uses the stable hash. */
export const VEIL_THEME_AFFINITY: Readonly<Record<string, VeilVariant>> = {
  T15: 'library', T22: 'library', T25: 'library', T27: 'library', T39: 'library', T41: 'library',
  T02: 'fairytale', T04: 'fairytale', T12: 'fairytale', T20: 'fairytale', T21: 'fairytale', T32: 'fairytale', T35: 'fairytale', T38: 'fairytale',
  T06: 'marionette', T11: 'marionette', T24: 'marionette', T33: 'marionette', T34: 'marionette', T45: 'marionette', T48: 'marionette',
};
export function veilVariantForTheme(theme: string | undefined, key: string): VeilVariant {
  return (theme ? VEIL_THEME_AFFINITY[theme] : undefined) ?? veilVariantFor(key);
}

type ArtKey = VeilArtKey;
const A: Record<ArtKey, string> = VEIL_ART;
const rep = (n: number, fn: (i: number) => string) => Array.from({length: n}, (_, i) => fn(i)).join('');
const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const f = (v: number, d = 2) => v.toFixed(d);
const motes = (n: number, seed: number, box: [number, number, number, number], o: number) => `<div class="bsv-layer bsv-motes bsv-scr">${rep(n, (i) => {const s = f(0.25 + rnd(i, seed) * 0.55) + 'cqw'; return `<i style="--x:${f(box[0] + rnd(i, seed + 1) * box[2], 1)}%;--y:${f(box[1] + rnd(i, seed + 2) * box[3], 1)}%;--s:${s};--dx:${f((rnd(i, seed + 3) - .35) * 8)}cqw;--dy:${f(-8 - rnd(i, seed + 4) * 22)}cqh;--t:${f(7 + rnd(i, seed + 5) * 8)}s;--d:${f(-rnd(i, seed + 6) * 14)}s;--o:${f(o * (.45 + rnd(i, seed + 7) * .55))}"></i>`;})}</div>`;

function library():string{
  const lamps=[[6.5,44,9],[21,53,6],[28,57,5],[67.5,6,5],[63,15,5],[71.5,25,6],[76,51,6],[72,56,5],[91.5,40,10],[66.5,60,4],[36,61,4],[41,27,3],[58,27,3],[45,44,3],[55,44,3],[50,66,4]];
  const glows=lamps.map((l,i)=>`<i class="lb-glow" style="--x:${l[0]}%;--y:${l[1]}%;--r:${(l[2] ?? 4)*1.6}cqw;--t:${f(1.6+rnd(i,3)*1.8)}s;--d:${f(-rnd(i,4)*3)}s"></i>`).join('');
  const rays=[[-2,5.5,7,0],[4,3,9,-2],[9,6.5,8,-4],[15,2.5,11,-1]].map(r=>`<i class="lb-ray" style="--o:${r[0]}cqh;--h:${r[1]}cqh;--t:${r[2]}s;--d:${r[3]}s"></i>`).join('');
  const raymotes=rep(18,i=>`<i style="--x:${f(rnd(i,11)*90)}%;--y:${f(rnd(i,12)*100)}%;--s:${f(2+rnd(i,13)*3,1)}px;--t:${f(5+rnd(i,14)*5)}s;--d:${f(-rnd(i,15)*9)}s"></i>`);
  const glyphChars='書頁墨夢言文字卷詩星月海門燈';
  const glyphs=rep(10,i=>`<span style="--x:${f((rnd(i,21)-.5)*12)}cqw;--dx:${f((rnd(i,22)-.5)*18)}cqw;--f:${f(.8+rnd(i,23)*1)}cqw;--t:${f(4.6+rnd(i,24)*2.6)}s;--d:${f(.2+i*.62-rnd(i,25)*.3)}s;--r:${f((rnd(i,26)-.5)*50)}deg">${glyphChars[i%glyphChars.length]}</span>`);
  const leaves=rep(6,i=>`<i style="--dx:${f((i%2?1:-1)*(12+rnd(i,31)*26))}cqw;--dy:${f(-18-rnd(i,32)*30)}cqh;--r:${f(360+rnd(i,33)*540)}deg;--t:${f(5+rnd(i,34)*3)}s;--d:${f(.6+i*1.3)}s"></i>`);
  const fly=(img:ArtKey,w:number,path:string,t:number,d:number,fx:number,fl:string,ft:number)=>`<div class="lb-fly" style="--w:${w}cqw;--path:${path};--t:${t}s;--d:${d}s;--fx:${fx};--fl:${fl};--ft:${ft}s"><div class="flip"><img src="${A[img]}" alt=""></div></div>`;
  const far=fly('lib-fly-violet',6.5,'lb-pathC',17,-6,1,'brightness(.55) blur(1.2px)',.38)+fly('lib-fly-teal',7,'lb-pathB',15,-11,-1,'brightness(.6) blur(1px)',.36);
  const near=fly('lib-fly-red',11,'lb-pathA',12,-2.5,1,'brightness(.92)',.44)+fly('lib-fly-ochre',9.5,'lb-pathB',13.5,-8,-1,'brightness(.85)',.4);
  const circle=`<svg viewBox="-100 -100 200 200"><g fill="none" stroke="#ffd98a" stroke-width=".7"><circle r="96" stroke-opacity=".7"/><circle r="90" stroke-dasharray="1 3" /><circle r="70" stroke-opacity=".6"/><circle r="44" stroke-opacity=".5"/>${rep(12,i=>`<g transform="rotate(${i*30})"><path d="M0-90L5-80 0-70-5-80Z" fill="#ffd98a" fill-opacity=".6"/><circle cy="-57" r="5" stroke-opacity=".7"/></g>`)}<path d="${rep(6,i=>{const a=i*Math.PI/3,b=(i+2)*Math.PI/3;return `M${f(Math.sin(a)*70)} ${f(-Math.cos(a)*70)}L${f(Math.sin(b)*70)} ${f(-Math.cos(b)*70)}`})}" stroke-opacity=".45"/></g></svg>`;
  const circle2=`<svg class="rev" viewBox="-100 -100 200 200" style="position:absolute;inset:14%;width:72%;height:72%"><g fill="none" stroke="#ffe9b8" stroke-width=".9" stroke-opacity=".55"><circle r="96" stroke-dasharray="14 6 2 6"/>${rep(24,i=>`<path transform="rotate(${i*15})" d="M0-84V-74"/>`)}</g></svg>`;
  const bokeh=`<div class="bsv-layer lb-bokeh">${rep(6,i=>`<i style="--x:${f(rnd(i,41)*95)}%;--y:${f(10+rnd(i,42)*70)}%;--s:${f(9+rnd(i,43)*14)}cqw;--dx:${f((rnd(i,44)-.5)*8)}cqw;--dy:${f((rnd(i,45)-.5)*6)}cqh;--t:${f(7+rnd(i,46)*6)}s;--d:${f(-rnd(i,47)*8)}s"></i>`)}</div>`;
  return `<div class="bsv-layer lb-cam"><img class="bsv-fill" src="${A['lib-bg']}" alt="">${glows}<div class="lb-arch"></div><div class="lb-rays">${rays}<div class="lb-raymotes">${raymotes}</div></div></div>
<div class="bsv-layer lb-mid">${far}<div class="lb-circle">${circle}${circle2}</div><div class="lb-shadow"></div>
<div class="lb-book"><div class="lb-bob"><div class="lb-under"></div><img src="${A['lib-grimoire']}" alt=""></div></div>
<div class="lb-glyphs">${glyphs}</div><div class="lb-leaves">${leaves}</div></div>
<div class="bsv-layer">${near}</div>${motes(26,50,[5,20,90,75],.85)}${bokeh}`;
}

function fairytale():string{
  const stars=rep(26,i=>`<i style="--x:${f(rnd(i,61)*100,1)}%;--y:${f(rnd(i,62)*40,1)}%;--s:${f(.5+rnd(i,63)*1.1)}cqw;--t:${f(2+rnd(i,64)*3)}s;--d:${f(-rnd(i,65)*4)}s"></i>`);
  const wisps=[[4,26,34,9,24],[48,20,30,7,30],[70,40,40,10,27]].map(w=>`<i class="ft-wisp" style="--x:${w[0]}%;--y:${w[1]}%;--w:${w[2]}cqw;--h:${w[3]}cqh;--t:${w[4]}s"></i>`).join('');
  const flies=rep(22,i=>`<i style="--x:${f(3+rnd(i,71)*94,1)}%;--y:${f(50+rnd(i,72)*42,1)}%;--dx:${f((rnd(i,73)-.5)*9)}cqw;--dy:${f((rnd(i,74)-.5)*9)}cqh;--t:${f(5+rnd(i,75)*6)}s;--b:${f(1.2+rnd(i,76)*1.8)}s;--d:${f(-rnd(i,77)*6)}s"></i>`);
  const wins=[[46,64,3],[53,63,3],[58,55,2.4],[41,47,2.2],[62,42,2],[69,56,2],[33,68,2.2],[57,78,2.5]].map((w,i)=>`<i class="ft-win" style="--x:${w[0]}%;--y:${w[1]}%;--s:${w[2]}cqw;--t:${f(1.4+rnd(i,81)*1.6)}s"></i>`).join('');
  const burst=rep(18,i=>{const a=-Math.PI*(0.1+0.8*rnd(i,91)),r=10+rnd(i,92)*18;return `<i style="--s:${f(.8+rnd(i,93)*1.2)}cqw;--dx:${f(Math.cos(a)*r*1.4)}cqw;--dy:${f(Math.sin(a)*r)}cqh;--d:${f(.55+rnd(i,94)*.35)}s"></i>`});
  const rise=rep(12,i=>`<i style="--x:${f((rnd(i,101)-.5)*24)}cqw;--s:${f(.6+rnd(i,102)*.9)}cqw;--dx:${f((rnd(i,103)-.5)*10)}cqw;--t:${f(3.4+rnd(i,104)*2.4)}s;--d:${f(1.6+i*.45)}s"></i>`);
  return `<div class="bsv-layer ft-cam"><img class="bsv-fill" src="${A['fairy-bg']}" alt=""><div class="ft-moon"></div><div class="bsv-layer ft-stars">${stars}</div>${wisps}<div class="bsv-layer ft-flies bsv-scr">${flies}</div>
<div class="ft-bshadow"></div><div class="ft-bookwrap"><div class="ft-book"><img src="${A['fairy-book']}" alt=""><div class="ft-pageglow"></div><div class="ft-cshadow"></div>
<div class="ft-castle"><img src="${A['fairy-castle']}" alt="">${wins}</div><div class="ft-burst">${burst}</div><div class="ft-rise">${rise}</div></div></div>
<img class="bsv-fill ft-grass" src="${A['fairy-bg']}" alt="">
<div class="ft-rabbit"><div class="ft-hop"><img src="${A['fairy-rabbit']}" alt=""></div><div class="ft-rshadow"></div></div></div>`;
}

function marionette():string{
  const foots=[[25.5,83.4],[31,84.8],[37,85.5],[43,85.8],[50,86],[56.5,85.8],[63,85.5],[68.5,84.8],[74,83.4]].map((p,i)=>`<i class="th-foot" style="--x:${p[0]}%;--y:${p[1]}%;--t:${f(1.4+rnd(i,111)*1.6)}s;--d:${f(-rnd(i,112)*2)}s"></i>`).join('');
  return `<div class="bsv-layer th-cam" ><img class="bsv-fill" src="${A['thea-bg']}" alt="">
<i class="th-tint a"></i><i class="th-tint b"></i>
<div class="th-beamwrap"><div class="th-beam"></div></div><div class="th-pool"></div>${motes(20,120,[40,24,20,52],.75)}
<div class="th-dshadow"></div>
<div class="th-rig"><div class="th-drop"><div class="th-doll"><div class="dj thL"><img src="${A['doll-legL-thigh']}" alt=""><div class="dj shL"><img src="${A['doll-legL-shin']}" alt=""></div><div class="th-sa pKL kL"><i></i></div></div><div class="dj thR"><img src="${A['doll-legR-thigh']}" alt=""><div class="dj shR"><img src="${A['doll-legR-shin']}" alt=""></div><div class="th-sa pKR kR"><i></i></div></div><div class="dj iL"><div class="dj auL"><img src="${A['doll-armL-up']}" alt=""><div class="dj afL"><img src="${A['doll-armL-fore']}" alt=""><div class="th-sa pHL siL"><div class="th-sa hL"><i></i></div></div></div></div></div><div class="dj iR"><div class="dj auR"><img src="${A['doll-armR-up']}" alt=""><div class="dj afR"><img src="${A['doll-armR-fore']}" alt=""><div class="th-sa pHR siR"><div class="th-sa hR"><i></i></div></div></div></div></div><img src="${A['doll-torso']}" alt=""><div class="dj hd"><img src="${A['doll-head']}" alt=""><div class="th-sa pHd hd"><i></i></div></div></div></div></div>
<div class="th-curtains"><i class="th-cur l"></i><i class="th-cur r"></i></div>
<img class="th-frame" src="${A['thea-frame']}" alt="">${foots}<div class="th-spill"></div></div>`;
}

const MARKERS: Record<VeilVariant, string> = {library: 'bsv-lib', fairytale: 'bsv-fairy', marionette: 'bsv-thea'};
const SCENES: Record<VeilVariant, () => string> = {library, fairytale, marionette};
/** Full scene markup for a variant; re-rendered on every fresh show so the opening moves replay. */
export function veilScene(v: VeilVariant): string {
  return `<div class="bsv-stage ${MARKERS[v]}"><div class="bsv-layer bsv-intro">${SCENES[v]()}</div></div><div class="bsv-black"></div>`;
}

export const VEIL_CSS = `
.bsv{position:absolute;inset:0;z-index:60;overflow:hidden;container-type:size;contain:strict;background:#0b0910;color:#efe4cf;font-family:${OCTO_SERIF};opacity:1;transition:opacity ${VEIL_FADE_MS}ms ease}
.bsv.is-leaving{opacity:0;pointer-events:none}
.bsv *{box-sizing:border-box}
.bsv-scene{position:absolute;inset:0;overflow:hidden}
.bsv-stage{position:absolute;left:50%;top:50%;width:max(100cqw,177.78cqh);height:max(100cqh,56.25cqw);transform:translate(-50%,-50%);container-type:size;perspective:1400px}
.bsv-layer{position:absolute;inset:0}
.bsv-fill{position:absolute;inset:0;width:100%;height:100%;display:block}
.bsv img{user-select:none;-webkit-user-drag:none;pointer-events:none}
.bsv-scr{mix-blend-mode:screen}
.bsv-abs{position:absolute}
.bsv-intro{animation:bsv-intro 2.2s cubic-bezier(.16,.75,.25,1) both}
.bsv-black{position:absolute;inset:0;background:#050407;animation:bsv-lift .9s .05s ease-out both;pointer-events:none;z-index:9}
.bsv-grain{position:absolute;inset:-10%;background-image:url(${VEIL_ART.grain});background-size:160px;opacity:.07;mix-blend-mode:overlay;animation:bsv-grain .9s steps(4) infinite;pointer-events:none;z-index:6}
.bsv-vign{position:absolute;inset:0;background:radial-gradient(ellipse 75% 70% at 50% 46%,transparent 52%,#000000b0 100%);pointer-events:none;z-index:5}
.bsv-bars::before,.bsv-bars::after{content:"";position:absolute;left:0;right:0;height:9cqh;z-index:5;pointer-events:none}
.bsv-bars::before{top:0;background:linear-gradient(#000000d0,#0000)}
.bsv-bars::after{bottom:0;height:24cqh;background:linear-gradient(#0000,#000000c8 70%,#000000e0)}
.bsv-motes i{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);border-radius:50%;background:radial-gradient(circle,#fff6dd 0,#ffd98a 35%,#ffcf7000 70%);opacity:0;animation:bsv-mote var(--t) linear var(--d) infinite;will-change:transform,opacity}
.bsv-caption{position:absolute;left:0;right:0;bottom:3.2cqh;z-index:7;text-align:center;pointer-events:none}
.bsv-band{position:relative;display:inline-block;min-width:min(62cqw,640px);padding:1.1cqh 8cqw 1.3cqh;background:linear-gradient(90deg,#0000,#0a0810d9 22%,#0a0810d9 78%,#0000)}
.bsv-band::before,.bsv-band::after{content:"";position:absolute;left:12%;right:12%;height:1px;background:linear-gradient(90deg,#0000,#c9a6628c 20%,#e9cf93 50%,#c9a6628c 80%,#0000)}
.bsv-band::before{top:0}.bsv-band::after{bottom:0}
.bsv-title{position:relative;margin:0;font-size:clamp(16px,4cqmin,32px);font-weight:600;letter-spacing:.34em;padding-left:.34em;color:#f6e6c0;text-shadow:0 0 18px #e9b8604d,0 2px 4px #000}
.bsv-title::before,.bsv-title::after{content:"";display:inline-block;vertical-align:middle;width:clamp(26px,7cqmin,64px);height:9px;margin:0 1.1em;opacity:.9}
.bsv-title::before{background:linear-gradient(90deg,#0000,#c9a662) 0 50%/100% 1px no-repeat,linear-gradient(45deg,#0000 35%,#f0d49a 35% 65%,#0000 65%) 100% 50%/7px 7px no-repeat}
.bsv-title::after{background:linear-gradient(270deg,#0000,#c9a662) 0 50%/100% 1px no-repeat,linear-gradient(45deg,#0000 35%,#f0d49a 35% 65%,#0000 65%) 0 50%/7px 7px no-repeat}
.bsv-sub{margin:.55em 0 0;font-size:clamp(11px,2.2cqmin,16px);letter-spacing:.3em;color:#d4bd8f}
.bsv-sub:empty{display:none}
.bsv-hint{margin:.45em 0 0;font-size:clamp(10px,1.95cqmin,14px);letter-spacing:.14em;color:#a8987c}
.bsv-prog{position:relative;width:min(34cqw,300px);height:1px;margin:1.1em auto 0;background:linear-gradient(90deg,#0000,#8a734b 20%,#8a734b 80%,#0000)}
.bsv-prog i{position:absolute;left:0;top:-3px;width:7px;height:7px;background:#fff0c8;transform:rotate(45deg);box-shadow:0 0 8px 2px #f5cf7caa,0 0 22px 6px #f0b95a44;animation:bsv-prog 2.6s cubic-bezier(.55,0,.45,1) infinite alternate}
.bsv-prog b{position:absolute;left:0;top:-1px;width:30%;height:3px;background:linear-gradient(90deg,#0000,#f3d596,#0000);filter:blur(1px);animation:bsv-prog2 2.6s cubic-bezier(.55,0,.45,1) infinite alternate}
@keyframes bsv-intro{from{transform:scale(1.07)}to{transform:scale(1)}}
@keyframes bsv-lift{from{opacity:1}to{opacity:0}}
@keyframes bsv-grain{0%{transform:translate(0,0)}25%{transform:translate(-3%,2%)}50%{transform:translate(2%,-3%)}75%{transform:translate(-2%,-2%)}100%{transform:translate(3%,1%)}}
@keyframes bsv-mote{0%{transform:translate(0,0) scale(.6);opacity:0}12%{opacity:var(--o,.8)}85%{opacity:var(--o,.8)}100%{transform:translate(var(--dx),var(--dy)) scale(1.1);opacity:0}}
@keyframes bsv-prog{from{transform:translateX(0) rotate(45deg)}to{transform:translateX(calc(min(34cqw,300px) - 7px)) rotate(45deg)}}
@keyframes bsv-prog2{from{transform:translateX(-30%)}to{transform:translateX(calc(min(34cqw,300px)*.72))}}
@keyframes bsv-flick{0%{opacity:.78}13%{opacity:.95}21%{opacity:.7}37%{opacity:1}52%{opacity:.82}66%{opacity:.94}81%{opacity:.72}100%{opacity:.88}}
@keyframes bsv-breathe{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.07)}}
@keyframes bsv-spin{to{transform:rotate(360deg)}}
.lb-cam{animation:lb-cam 18s ease-in-out infinite alternate}
.lb-mid{animation:lb-mid 18s ease-in-out infinite alternate}
.lb-glow{position:absolute;left:var(--x);top:var(--y);width:var(--r);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#ffe2a6 0,#ffb65a88 18%,#ff9a3a2a 42%,#0000 70%);mix-blend-mode:screen;animation:bsv-flick var(--t,2.3s) ease-in-out var(--d,0s) infinite alternate}
.lb-arch{position:absolute;left:50%;top:68%;width:34cqw;height:44cqh;transform:translate(-50%,-50%);background:radial-gradient(ellipse at 50% 55%,#ffd99466 0,#ffb86a22 35%,#0000 70%);mix-blend-mode:screen;animation:bsv-breathe 6s ease-in-out infinite}
.lb-rays{position:absolute;left:11%;top:5%;width:0;height:0;transform:rotate(41deg);transform-origin:0 0}
.lb-ray{position:absolute;left:0;top:var(--o);width:78cqw;height:var(--h);transform-origin:0 50%;background:linear-gradient(90deg,#fff3d000,#ffe7b85c 8%,#ffd9993a 40%,#ffc9780f 75%,#0000);filter:blur(9px);mix-blend-mode:screen;animation:lb-ray var(--t) ease-in-out var(--d) infinite alternate}
.lb-raymotes{position:absolute;left:0;top:-5cqh;width:62cqw;height:10cqh}
.lb-raymotes i{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);border-radius:50%;background:#fff1cf;box-shadow:0 0 6px 1px #ffd98a;opacity:0;animation:lb-raymote var(--t) linear var(--d) infinite}
.lb-book{position:absolute;left:50%;top:50%;width:25cqw;transform:translate(-50%,-50%)}
.lb-bob{position:relative;animation:lb-bob 5.2s ease-in-out infinite}
.lb-book img{display:block;width:100%;filter:drop-shadow(0 0 1.2cqw #ffcf7a55)}
.lb-under{position:absolute;left:50%;top:55%;width:150%;aspect-ratio:1.9;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse,#ffe0a080 0,#ffbf6a33 30%,#0000 66%);mix-blend-mode:screen;animation:bsv-breathe 3.6s ease-in-out infinite}
.lb-shadow{position:absolute;left:50%;top:72%;width:26cqw;height:4.5cqh;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse,#000000b0,#0000 70%);animation:lb-shadow 5.2s ease-in-out infinite}
.lb-circle{position:absolute;left:50%;top:69%;width:40cqw;aspect-ratio:1;transform:translate(-50%,-50%) rotateX(74deg);mix-blend-mode:screen;opacity:.75}
.lb-circle svg{width:100%;height:100%;display:block;animation:bsv-spin 40s linear infinite}
.lb-circle .rev{animation-direction:reverse;animation-duration:26s}
.lb-glyphs{position:absolute;left:50%;top:41%;width:0;height:0}
.lb-glyphs span{position:absolute;left:var(--x);top:0;font-size:var(--f);color:#ffe7ae;text-shadow:0 0 6px #ffc760,0 0 16px #ff9f3099;opacity:0;animation:lb-glyph var(--t) cubic-bezier(.3,.1,.5,1) var(--d) infinite;will-change:transform,opacity}
.lb-leaves{position:absolute;left:50%;top:45%;width:0;height:0}
.lb-leaves i{position:absolute;left:0;top:0;width:2.6cqw;height:3.4cqw;background:linear-gradient(135deg,#f6ead0,#e4d1a8 60%,#cdb78b);box-shadow:0 0 .6cqw #ffcf7a66;opacity:0;animation:lb-leaf var(--t) cubic-bezier(.25,.1,.4,1) var(--d) infinite;will-change:transform,opacity}
.lb-leaves i::after{content:"";position:absolute;inset:18% 16%;background:repeating-linear-gradient(#0000 0 3px,#6b56384d 3px 4px)}
.lb-fly{position:absolute;left:0;top:0;width:var(--w);animation:var(--path) var(--t) linear var(--d) infinite;will-change:transform}
.lb-fly .flip{transform:scaleX(var(--fx,1))}
.lb-fly img{display:block;width:100%;transform-origin:50% 60%;animation:lb-flap var(--ft,.42s) ease-in-out infinite alternate;filter:var(--fl,none)}
.lb-bokeh i{position:absolute;left:var(--x);top:var(--y);width:var(--s);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#ffd89a38,#ffc07014 55%,#0000 70%);mix-blend-mode:screen;animation:lb-bokeh var(--t) ease-in-out var(--d) infinite alternate}
@keyframes lb-cam{from{transform:scale(1.03) translate(0,0)}to{transform:scale(1.09) translate(-.8%,-.6%)}}
@keyframes lb-mid{from{transform:translate(0,0)}to{transform:translate(-1.8%,-1.1%) scale(1.02)}}
@keyframes lb-ray{from{opacity:.55;transform:translateY(-1cqh) scaleY(.9)}to{opacity:1;transform:translateY(1.2cqh) scaleY(1.12)}}
@keyframes lb-raymote{0%{transform:translate(0,0);opacity:0}15%{opacity:.9}85%{opacity:.7}100%{transform:translate(9cqw,3cqh);opacity:0}}
@keyframes lb-bob{0%,100%{transform:translateY(0) rotate(-1.4deg)}50%{transform:translateY(-2.4cqh) rotate(1.2deg)}}
@keyframes lb-shadow{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.85}50%{transform:translate(-50%,-50%) scale(.86);opacity:.55}}
@keyframes lb-glyph{0%{transform:translate(0,2cqh) scale(.5);opacity:0}14%{opacity:1}70%{opacity:.85}100%{transform:translate(var(--dx),-34cqh) scale(1.15) rotate(var(--r));opacity:0}}
@keyframes lb-leaf{0%{transform:translate(0,0) rotate3d(1,.6,.2,0deg) scale(.4);opacity:0}8%{opacity:1}80%{opacity:.9}100%{transform:translate(var(--dx),var(--dy)) rotate3d(1,.6,.2,var(--r)) scale(1);opacity:0}}
@keyframes lb-flap{from{transform:scaleX(1) skewY(0)}to{transform:scaleX(.72) skewY(-5deg)}}
@keyframes lb-pathA{0%{transform:translate(-22cqw,46cqh) rotate(-6deg) scale(.9)}25%{transform:translate(18cqw,30cqh) rotate(4deg)}50%{transform:translate(52cqw,34cqh) rotate(-5deg) scale(1)}75%{transform:translate(84cqw,18cqh) rotate(5deg)}100%{transform:translate(124cqw,8cqh) rotate(-4deg) scale(1.05)}}
@keyframes lb-pathB{0%{transform:translate(122cqw,24cqh) rotate(5deg)}30%{transform:translate(80cqw,12cqh) rotate(-4deg)}60%{transform:translate(38cqw,20cqh) rotate(5deg)}100%{transform:translate(-24cqw,6cqh) rotate(-3deg)}}
@keyframes lb-pathC{0%{transform:translate(-20cqw,14cqh) rotate(3deg) scale(.8)}35%{transform:translate(26cqw,6cqh) rotate(-4deg) scale(.85)}70%{transform:translate(70cqw,12cqh) rotate(4deg) scale(.9)}100%{transform:translate(122cqw,2cqh) rotate(-3deg) scale(.95)}}
@keyframes lb-bokeh{from{transform:translate(0,0) scale(1);opacity:.6}to{transform:translate(var(--dx),var(--dy)) scale(1.2);opacity:1}}
.ft-cam{animation:ft-cam 20s ease-in-out infinite alternate}
.ft-moon{position:absolute;left:72.5%;top:24%;width:52cqw;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#dff4ff55 0,#b6e0ff33 22%,#8fb8ff14 42%,#0000 66%);mix-blend-mode:screen;animation:bsv-breathe 7s ease-in-out infinite}
.ft-stars i{position:absolute;left:var(--x);top:var(--y);width:var(--s);aspect-ratio:1;background:radial-gradient(circle,#fff 0,#fff8 18%,#0000 60%);animation:ft-tw var(--t) ease-in-out var(--d) infinite}
.ft-stars i::before,.ft-stars i::after{content:"";position:absolute;left:50%;top:50%;width:300%;height:1px;transform:translate(-50%,-50%);background:linear-gradient(90deg,#0000,#fffbe8,#0000)}
.ft-stars i::after{transform:translate(-50%,-50%) rotate(90deg)}
.ft-wisp{position:absolute;left:var(--x);top:var(--y);width:var(--w);height:var(--h);border-radius:50%;background:radial-gradient(ellipse,#d9c8ff2e,#bfb0ff10 50%,#0000 70%);animation:ft-wisp var(--t) ease-in-out infinite alternate}
.ft-flies i{position:absolute;left:var(--x);top:var(--y);width:.55cqw;aspect-ratio:1;animation:ft-wander var(--t) ease-in-out var(--d) infinite alternate}
.ft-flies i::before{content:"";position:absolute;inset:-160%;border-radius:50%;background:radial-gradient(circle,#fffbd0 0,#f5ec8a 20%,#d8e25a40 40%,#0000 66%);animation:ft-blink var(--b) ease-in-out var(--d) infinite alternate}
.ft-grass{-webkit-mask-image:linear-gradient(#0000 83.5%,#000 89%);mask-image:linear-gradient(#0000 83.5%,#000 89%)}
.ft-bshadow{position:absolute;left:50%;top:85%;width:50cqw;height:7cqh;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse,#050a1ab0,#0000 70%)}
.ft-bookwrap{position:absolute;left:50%;bottom:14cqh;width:46cqw;transform:translateX(-50%);animation:ft-bookin .8s cubic-bezier(.2,.8,.25,1) both}
.ft-book{position:relative;perspective:900px}
.ft-book>img{display:block;width:100%;filter:drop-shadow(0 1.6cqh 1.6cqh #0009)}
.ft-pageglow{position:absolute;left:50%;top:38%;width:90%;aspect-ratio:2.2;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse,#fff2c47a,#ffd98a26 45%,#0000 70%);mix-blend-mode:screen;animation:bsv-breathe 4s 1s ease-in-out infinite both}
.ft-castle{position:absolute;left:50%;bottom:52%;width:55%;transform:translateX(-50%);transform-style:preserve-3d}
.ft-castle img{display:block;width:100%;transform-origin:50% 97%;animation:ft-pop 1.25s .45s cubic-bezier(.34,1.32,.5,1) both,ft-idle 6s 1.8s ease-in-out infinite;filter:drop-shadow(0 .6cqh .8cqh #0007)}
.ft-cshadow{position:absolute;left:50%;bottom:44%;width:52%;height:14%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse,#2b1a0e66,#0000 70%);animation:ft-cshadow 1.25s .45s ease-out both}
.ft-win{position:absolute;left:var(--x);top:var(--y);width:var(--s);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#ffe39a,#ffb84a55 40%,#0000 70%);mix-blend-mode:screen;opacity:0;animation:bsv-flick var(--t) 1.6s ease-in-out infinite alternate}
.ft-burst{position:absolute;left:50%;top:40%;width:0;height:0}
.ft-burst i,.ft-rise i{position:absolute;left:0;top:0;width:var(--s);aspect-ratio:1;background:#fff5d0;clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);filter:drop-shadow(0 0 4px #ffd166);opacity:0}
.ft-burst i{animation:ft-burst 1.5s var(--d) cubic-bezier(.15,.7,.3,1) both}
.ft-rise{position:absolute;left:50%;top:44%;width:0;height:0}
.ft-rise i{left:var(--x);animation:ft-rise var(--t) var(--d) ease-out infinite}
.ft-rabbit{position:absolute;left:0;bottom:13cqh;width:14.5cqw;z-index:2;animation:ft-run 10s linear 1.3s infinite backwards}
.ft-hop{animation:ft-hop .5s cubic-bezier(.3,0,.7,1) infinite}
.ft-hop img{display:block;width:100%;filter:drop-shadow(0 0 1cqw #fff4)}
.ft-rshadow{position:absolute;left:18%;right:18%;bottom:-1.2cqh;height:2.4cqh;border-radius:50%;background:radial-gradient(ellipse,#000a,#0000 70%);animation:ft-rsh .5s cubic-bezier(.3,0,.7,1) infinite}
@keyframes ft-cam{from{transform:scale(1.03)}to{transform:scale(1.08) translate(-1%,-.4%)}}
@keyframes ft-tw{0%,100%{opacity:.2;transform:scale(.6) rotate(0)}50%{opacity:1;transform:scale(1.15) rotate(20deg)}}
@keyframes ft-wisp{from{transform:translateX(0)}to{transform:translateX(7cqw)}}
@keyframes ft-wander{0%{transform:translate(0,0)}33%{transform:translate(var(--dx),calc(var(--dy)*-.6))}66%{transform:translate(calc(var(--dx)*-.4),var(--dy))}100%{transform:translate(calc(var(--dx)*.6),calc(var(--dy)*.3))}}
@keyframes ft-blink{0%,40%{opacity:.05}100%{opacity:1}}
@keyframes ft-bookin{from{opacity:0;transform:translate(-50%,7cqh) scale(.96)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
@keyframes ft-pop{0%{transform:rotateX(86deg) scaleY(.5);opacity:0}12%{opacity:1}100%{transform:rotateX(0) scaleY(1);opacity:1}}
@keyframes ft-idle{0%,100%{transform:rotateX(0)}50%{transform:rotateX(4deg)}}
@keyframes ft-cshadow{from{opacity:0;transform:translateX(-50%) scaleY(.2)}to{opacity:1;transform:translateX(-50%) scaleY(1)}}
@keyframes ft-burst{0%{opacity:0;transform:translate(0,0) scale(.3)}10%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1) rotate(180deg)}}
@keyframes ft-rise{0%{opacity:0;transform:translate(0,0) scale(.4)}20%{opacity:1}100%{opacity:0;transform:translate(var(--dx),-30cqh) scale(1) rotate(200deg)}}
@keyframes ft-run{0%{transform:translateX(-18cqw)}62%{transform:translateX(112cqw)}100%{transform:translateX(112cqw)}}
@keyframes ft-hop{0%,100%{transform:translateY(0) rotate(3deg)}50%{transform:translateY(-4.6cqh) rotate(-5deg)}}
@keyframes ft-rsh{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(.65);opacity:.45}}
.th-rig{position:absolute;left:50%;top:0;width:14.6cqw;height:100cqh;margin-left:-7.3cqw;transform-origin:50% -30cqh;animation:th-sway 6.4s ease-in-out infinite}
.th-drop{position:absolute;left:0;right:0;top:36.5cqh;animation:th-drop 1.9s .7s cubic-bezier(.22,1.18,.36,1) both}
.th-doll{position:relative;aspect-ratio:702/1173;animation:th-bob2 4.8s cubic-bezier(.45,0,.55,1) infinite}
.th-doll img{position:absolute;inset:0;width:100%;height:100%;display:block;filter:brightness(.9) saturate(.95)}
.dj{position:absolute;inset:0}
.dj.thL{transform-origin:42.735% 61.552%;animation:th-thL 4.8s cubic-bezier(.45,0,.55,1) infinite}.dj.shL{transform-origin:42.735% 68.798%;animation:th-shL 4.8s cubic-bezier(.45,0,.55,1) infinite}
.dj.thR{transform-origin:56.980% 61.552%;animation:th-thR 4.8s cubic-bezier(.45,0,.55,1) infinite}.dj.shR{transform-origin:56.980% 68.798%;animation:th-shR 4.8s cubic-bezier(.45,0,.55,1) infinite}
.dj.iL{transform-origin:33.048% 27.451%;animation:th-iL 1.9s .7s both}.dj.iR{transform-origin:66.952% 27.451%;animation:th-iR 1.9s .7s both}
.dj.auL{transform-origin:33.048% 27.451%;animation:th-auL 4.8s cubic-bezier(.45,0,.55,1) infinite}.dj.afL{transform-origin:26.353% 32.992%;animation:th-afL 4.8s cubic-bezier(.45,0,.55,1) infinite}
.dj.auR{transform-origin:66.952% 27.451%;animation:th-auR 4.8s cubic-bezier(.45,0,.55,1) infinite}.dj.afR{transform-origin:73.647% 32.992%;animation:th-afR 4.8s cubic-bezier(.45,0,.55,1) infinite}
.dj.hd{transform-origin:48.433% 18.329%;animation:th-hd 4.8s cubic-bezier(.45,0,.55,1) infinite}
.th-sa{position:absolute;width:0;height:0}
.th-sa i{position:absolute;left:0;bottom:0;width:1px;height:140cqh;background:linear-gradient(#e8dcc000,#e8dcc080 55%,#fff4dcd8);box-shadow:0 0 2px #fff4dc55}
.th-sa{left:0;top:0}.th-sa.pHL{left:9.972%;top:43.905%}.th-sa.pHR{left:90.028%;top:43.905%}.th-sa.pKL{left:42.735%;top:67.519%}.th-sa.pKR{left:56.980%;top:67.519%}.th-sa.pHd{left:49.858%;top:2.387%}
.th-sa.hL{animation:th-sHL 4.8s cubic-bezier(.45,0,.55,1) infinite}.th-sa.hR{animation:th-sHR 4.8s cubic-bezier(.45,0,.55,1) infinite}.th-sa.kL{animation:th-sKL 4.8s cubic-bezier(.45,0,.55,1) infinite}.th-sa.kR{animation:th-sKR 4.8s cubic-bezier(.45,0,.55,1) infinite}.th-sa.hd{animation:th-sHd 4.8s cubic-bezier(.45,0,.55,1) infinite}
.th-sa.siL{animation:th-siL 1.9s .7s both}.th-sa.siR{animation:th-siR 1.9s .7s both}
@keyframes th-auL{0%{transform:rotate(0deg)}12.5%{transform:rotate(10deg)}25%{transform:rotate(4deg)}37.5%{transform:rotate(55deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(70deg)}75%{transform:rotate(24deg)}87.5%{transform:rotate(20deg)}100%{transform:rotate(0deg)}}
@keyframes th-afL{0%{transform:rotate(0deg)}12.5%{transform:rotate(6deg)}25%{transform:rotate(0deg)}37.5%{transform:rotate(40deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(50deg)}75%{transform:rotate(14deg)}87.5%{transform:rotate(-16deg)}100%{transform:rotate(0deg)}}
@keyframes th-auR{0%{transform:rotate(0deg)}12.5%{transform:rotate(-70deg)}25%{transform:rotate(-24deg)}37.5%{transform:rotate(-55deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(-10deg)}75%{transform:rotate(-4deg)}87.5%{transform:rotate(-20deg)}100%{transform:rotate(0deg)}}
@keyframes th-afR{0%{transform:rotate(0deg)}12.5%{transform:rotate(-50deg)}25%{transform:rotate(-14deg)}37.5%{transform:rotate(-40deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(-6deg)}75%{transform:rotate(0deg)}87.5%{transform:rotate(16deg)}100%{transform:rotate(0deg)}}
@keyframes th-hd{0%{transform:rotate(0deg)}12.5%{transform:rotate(6deg)}25%{transform:rotate(1deg)}37.5%{transform:rotate(-2deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(-6deg)}75%{transform:rotate(-1deg)}87.5%{transform:rotate(5deg)}100%{transform:rotate(0deg)}}
@keyframes th-thL{0%{transform:rotate(0deg)}12.5%{transform:rotate(16deg)}25%{transform:rotate(0deg)}37.5%{transform:rotate(0deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(0deg)}75%{transform:rotate(0deg)}87.5%{transform:rotate(4deg)}100%{transform:rotate(0deg)}}
@keyframes th-shL{0%{transform:rotate(0deg)}12.5%{transform:rotate(-28deg)}25%{transform:rotate(0deg)}37.5%{transform:rotate(0deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(0deg)}75%{transform:rotate(0deg)}87.5%{transform:rotate(-8deg)}100%{transform:rotate(0deg)}}
@keyframes th-thR{0%{transform:rotate(0deg)}12.5%{transform:rotate(0deg)}25%{transform:rotate(0deg)}37.5%{transform:rotate(0deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(-16deg)}75%{transform:rotate(0deg)}87.5%{transform:rotate(-4deg)}100%{transform:rotate(0deg)}}
@keyframes th-shR{0%{transform:rotate(0deg)}12.5%{transform:rotate(0deg)}25%{transform:rotate(0deg)}37.5%{transform:rotate(0deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(28deg)}75%{transform:rotate(0deg)}87.5%{transform:rotate(8deg)}100%{transform:rotate(0deg)}}
@keyframes th-sHL{0%{transform:rotate(0deg)}12.5%{transform:rotate(-16deg)}25%{transform:rotate(-4deg)}37.5%{transform:rotate(-95deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(-120deg)}75%{transform:rotate(-38deg)}87.5%{transform:rotate(-4deg)}100%{transform:rotate(0deg)}}
@keyframes th-sHR{0%{transform:rotate(0deg)}12.5%{transform:rotate(120deg)}25%{transform:rotate(38deg)}37.5%{transform:rotate(95deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(16deg)}75%{transform:rotate(4deg)}87.5%{transform:rotate(4deg)}100%{transform:rotate(0deg)}}
@keyframes th-sKL{0%{transform:rotate(0deg)}12.5%{transform:rotate(-16deg)}25%{transform:rotate(0deg)}37.5%{transform:rotate(0deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(0deg)}75%{transform:rotate(0deg)}87.5%{transform:rotate(-4deg)}100%{transform:rotate(0deg)}}
@keyframes th-sKR{0%{transform:rotate(0deg)}12.5%{transform:rotate(0deg)}25%{transform:rotate(0deg)}37.5%{transform:rotate(0deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(16deg)}75%{transform:rotate(0deg)}87.5%{transform:rotate(4deg)}100%{transform:rotate(0deg)}}
@keyframes th-sHd{0%{transform:rotate(0deg)}12.5%{transform:rotate(-6deg)}25%{transform:rotate(-1deg)}37.5%{transform:rotate(2deg)}50%{transform:rotate(0deg)}62.5%{transform:rotate(6deg)}75%{transform:rotate(1deg)}87.5%{transform:rotate(-5deg)}100%{transform:rotate(0deg)}}
@keyframes th-bob2{0%{transform:translateY(0cqh)}12.5%{transform:translateY(-2.4cqh)}25%{transform:translateY(0cqh)}37.5%{transform:translateY(-1.8cqh)}50%{transform:translateY(0cqh)}62.5%{transform:translateY(-2.4cqh)}75%{transform:translateY(0cqh)}87.5%{transform:translateY(0.8cqh)}100%{transform:translateY(0cqh)}}
@keyframes th-iL{0%{transform:rotate(70deg)}55%{transform:rotate(-12deg)}78%{transform:rotate(5deg)}100%{transform:rotate(0deg)}}
@keyframes th-siL{0%{transform:rotate(-70deg)}55%{transform:rotate(12deg)}78%{transform:rotate(-5deg)}100%{transform:rotate(0deg)}}
@keyframes th-iR{0%{transform:rotate(-70deg)}55%{transform:rotate(12deg)}78%{transform:rotate(-5deg)}100%{transform:rotate(0deg)}}
@keyframes th-siR{0%{transform:rotate(70deg)}55%{transform:rotate(-12deg)}78%{transform:rotate(5deg)}100%{transform:rotate(0deg)}}
.th-cam{animation:th-cam 22s ease-in-out infinite alternate}
.th-tint{position:absolute;left:25%;top:15%;width:50%;height:67%;opacity:0;mix-blend-mode:soft-light}
.th-tint.a{background:radial-gradient(ellipse at 50% 40%,#ff9a5a,#8a2b6a 70%);animation:th-tintA 36s linear infinite}
.th-tint.b{background:radial-gradient(ellipse at 50% 40%,#ffe6a8,#3c7a8a 70%);animation:th-tintB 36s linear infinite}
.th-beamwrap{position:absolute;left:50%;top:13%;width:34cqw;height:70cqh;transform:translateX(-50%);filter:blur(10px);mix-blend-mode:screen}
.th-beam{position:absolute;inset:0;clip-path:polygon(43% 0,57% 0,88% 100%,12% 100%);background:linear-gradient(180deg,#fff0c866,#ffe2a833 45%,#ffd9900f 85%,#0000);animation:bsv-flick 3.4s ease-in-out infinite alternate}
.th-pool{position:absolute;left:50%;top:78.5%;width:30cqw;height:9cqh;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse,#ffe8b870,#ffc86a22 45%,#0000 70%);mix-blend-mode:screen;animation:bsv-breathe 4s ease-in-out infinite}
.th-dshadow{position:absolute;left:50%;top:79.5%;width:9cqw;height:2.2cqh;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse,#000c,#0000 70%);animation:th-dshadow 1.6s ease-in-out infinite}
.th-curtains{position:absolute;inset:0}
.th-cur{position:absolute;top:10%;height:71%;width:26%;background-image:url(${VEIL_ART['thea-curtain']});background-size:auto 100%;background-repeat:repeat-x;filter:drop-shadow(0 0 1.5cqw #000c);animation:th-curL 12s cubic-bezier(.58,0,.3,1) infinite}
.th-cur.l{left:24.5%;transform-origin:0 50%;background-position:right top}
.th-cur.r{right:24.5%;transform-origin:100% 50%;animation-name:th-curR;background-position:left top}
.th-cur::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#0006,#0000 30%,#0000 70%,#0006)}
.th-frame{position:absolute;inset:0;width:100%;height:100%}
.th-foot{position:absolute;left:var(--x);top:var(--y);width:7cqw;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff0c0 0,#ffc76a88 14%,#ff9d3a26 38%,#0000 66%);mix-blend-mode:screen;animation:bsv-flick var(--t) ease-in-out var(--d) infinite alternate}
.th-spill{position:absolute;left:50%;top:80%;width:60cqw;height:16cqh;transform:translate(-50%,-50%);background:radial-gradient(ellipse at 50% 80%,#ffb86a30,#0000 70%);mix-blend-mode:screen;animation:bsv-flick 2.6s ease-in-out infinite alternate}
@keyframes th-cam{from{transform:scale(1.02)}to{transform:scale(1.06) translate(0,-.8%)}}
@keyframes th-curL{0%,4%{transform:scaleX(1)}15%{transform:scaleX(.17)}80%{transform:scaleX(.17)}89%,100%{transform:scaleX(1)}}
@keyframes th-curR{0%,4%{transform:scaleX(1)}15%{transform:scaleX(.17)}80%{transform:scaleX(.17)}89%,100%{transform:scaleX(1)}}
@keyframes th-tintA{0%,30%{opacity:0}31.5%,63%{opacity:.55}64.5%,100%{opacity:0}}
@keyframes th-tintB{0%,63%{opacity:0}64.5%,97%{opacity:.5}98.5%,100%{opacity:0}}
@keyframes th-sway{0%,100%{transform:rotate(-1.6deg)}50%{transform:rotate(1.6deg)}}
@keyframes th-drop{from{transform:translateY(-52cqh)}to{transform:translateY(0)}}
@keyframes th-dshadow{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.9}30%{transform:translate(-50%,-50%) scale(.8);opacity:.55}}
@media (prefers-reduced-motion:reduce){.bsv *,.bsv *::before,.bsv *::after{animation-duration:.01s!important;animation-iteration-count:1!important;animation-delay:0s!important}.th-cur{transform:scaleX(.17)!important}.bsv-prog i{animation:none!important;left:50%}}
`;

export type LoadingVeil = {update(info: VeilInfo | null): void; readonly visible: boolean; readonly variant: VeilVariant | null; dispose(): void};

export function mountLoadingVeil(stage: HTMLElement, win: Window = stage.ownerDocument.defaultView ?? window): LoadingVeil {
  const doc = stage.ownerDocument;
  if (!doc.getElementById('booksea-veil-style')) {const css = doc.createElement('style'); css.id = 'booksea-veil-style'; css.textContent = VEIL_CSS; doc.head.append(css);}
  const root = doc.createElement('div');
  root.className = 'bsv'; root.hidden = true; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite');
  root.innerHTML = '<div class="bsv-scene"></div><div class="bsv-vign"></div><div class="bsv-bars"></div><div class="bsv-grain"></div><div class="bsv-caption"><div class="bsv-band"><p class="bsv-title"></p><p class="bsv-sub"></p><p class="bsv-hint"></p><div class="bsv-prog"><b></b><i></i></div></div></div>';
  stage.append(root);
  const scene = root.querySelector<HTMLElement>('.bsv-scene')!, title = root.querySelector<HTMLElement>('.bsv-title')!, sub = root.querySelector<HTMLElement>('.bsv-sub')!, hint = root.querySelector<HTMLElement>('.bsv-hint')!;
  const now = () => win.performance?.now?.() ?? Date.now();
  let variant: VeilVariant | null = null, key = '', shownAt = 0, showing = false, hideTimer = 0, fadeTimer = 0, slowTimer = 0;
  const clear = () => {win.clearTimeout(hideTimer); win.clearTimeout(fadeTimer); hideTimer = fadeTimer = 0;};
  function show(info: VeilInfo) {
    clear();
    const v = info.variant ?? veilVariantFor(info.key);
    const lines = HINTS[v], prevKey = key, fresh = !showing || info.key !== prevKey;
    if (v !== variant || fresh) {variant = v; scene.innerHTML = veilScene(v); root.dataset.variant = v;}
    if (fresh) hint.textContent = lines[Math.floor(Math.random() * lines.length)]!;
    title.textContent = TITLES[v];
    sub.textContent = info.subtitle ?? '';
    key = info.key;
    root.classList.remove('is-leaving');
    if (!showing) {showing = true; shownAt = now(); root.hidden = false;}
    if (fresh) {
      win.clearTimeout(slowTimer);
      slowTimer = win.setTimeout(() => {if (showing) hint.textContent = '书页比平时更厚一些，请再稍候片刻……';}, 20000);
    }
  }
  function hide() {
    if (!showing || hideTimer || fadeTimer) return;
    const wait = Math.max(0, VEIL_MIN_MS - (now() - shownAt));
    hideTimer = win.setTimeout(() => {
      hideTimer = 0; root.classList.add('is-leaving');
      fadeTimer = win.setTimeout(() => {fadeTimer = 0; showing = false; root.hidden = true; root.classList.remove('is-leaving'); win.clearTimeout(slowTimer); scene.innerHTML = '';}, VEIL_FADE_MS);
    }, wait);
  }
  return {
    update(info) {if (info) show(info); else hide();},
    get visible() {return showing;},
    get variant() {return variant;},
    dispose() {clear(); win.clearTimeout(slowTimer); root.remove();},
  };
}
