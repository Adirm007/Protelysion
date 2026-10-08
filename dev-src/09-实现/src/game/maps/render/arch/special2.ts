// Signature and special building forms (hd2d-architecture-2), part 2: dome house, nautilus shell house,
// shipwreck house, colonnade, book house, origami pavilion, book stack, obelisk, crystal shard house,
// ring temple, kiosk booth, control tower, A-frame, inverted house, pencil tower, shaving pavilion,
// eraser hut, salt block, driftwood shack, umbrella house, cork house, bottle dome, lighthouse, shrine,
// circus tent, prism chapel, CRT tower, scrap stilt house, hex hive, rib house, pod tower, subway car,
// fly tower, tesseract, rotunda.
import type { MeshBuilder, V3 } from "../mesh";
import type { Ctx } from "../ground";
import { dome, lathe, obox, onion, quadOut, ring, triOut, tube, wallP, wbox, wq } from "./geo";
import { roof } from "./roofs";
import { facade, type Op } from "./facade";
import { barrel, crate, lantern, light, paperLantern, pot, sack, drum } from "./parts";
import { pad, fence, type SB } from "./special";
import { rigging } from "./special3";
import type { Plan } from "./plan";
import type { Mats } from "./house";

const L = (ctx: Ctx, id: string) => ctx.layer(id);
const lit = (p: Plan, i: number) => p.r(600 + i) < 0.5;
const mob = (ctx: Ctx) => ctx.quality === "mobile";

/** Box body with facades on four sides (door on the front). */
function body(ctx: Ctx, p: Plan, M: Mats, w: number, d: number, y0: number, h: number, wall: number, opts: { cx?: number; cz?: number; door?: Op["door"]; win?: Partial<Op>; doorHead?: Op["head"]; noDoor?: boolean; tint?: V3 } = {}) {
  const mb = ctx.mb, cx = opts.cx ?? 0, cz = opts.cz ?? 0;
  for (const side of ["s", "e", "n", "w"] as const) {
    const len = side === "s" || side === "n" ? w : d;
    const P = wallP(side, w / 2, d / 2, cx, cz);
    const n = Math.max(1, Math.floor((len - 0.4) / 1.6));
    const ops: Op[] = [];
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (len / n) * (i + 0.5);
      if (side === "s" && i === Math.floor(n / 2) && !opts.noDoor) ops.push({ u, w: Math.min(1.0, len / n - 0.3), v0: 0, v1: Math.min(h - 0.25, 2.15), kind: "door", head: opts.doorHead ?? "flat", door: opts.door ?? "plank", lit: true });
      else if (h > 1.6) ops.push({ u, w: Math.min(0.7, len / n - 0.5), v0: Math.min(0.9, h * 0.35), v1: Math.min(h - 0.3, 2.0), kind: "win", head: "flat", lit: lit(p, i + ["s", "e", "n", "w"].indexOf(side) * 7), mull: p.st.mull, ...opts.win });
    }
    facade(mb, { P, u0: -len / 2, u1: len / 2, y0, y1: y0 + h, ops, wall: { layer: wall, tint: opts.tint ?? (p.tint as V3) }, mats: M.fm, st: p.st, seed: p.b.seed + ["s", "e", "n", "w"].indexOf(side), mobile: mob(ctx) });
  }
}

export const domehouse: SB = (ctx, p, M) => {
  const mb = ctx.mb, r = Math.min(p.W, p.D) / 2 - 0.4;
  pad(mb, p, M.fm.stone, 0.25);
  const coral = p.b.theme === "T14" || p.b.theme === "T35";
  const wall = coral ? L(ctx, "wall") : L(ctx, "a_plaster");
  const seg = 12, h = 2.5;
  mb.cyl(0, 0.25, 0, r, r, h, seg, { layer: wall, tint: p.tint as V3 }, false);
  mb.cyl(0, 0.25, 0, r + 0.08, r + 0.08, 0.3, seg, { layer: M.fm.stone }, false);
  mb.cyl(0, 0.25 + h - 0.1, 0, r + 0.15, r + 0.15, 0.22, seg, { layer: M.fm.stone });
  dome(mb, 0, 0.25 + h + 0.12, 0, r + 0.05, r * 0.95, seg, 5, { layer: coral ? L(ctx, "roof") : M.R, tint: coral ? [1, 1, 1] : [0.85, 0.95, 1.2] });
  mb.cyl(0, 0.25 + h + r * 0.95, 0, 0.35, 0.35, 0.5, 8, { layer: wall });
  dome(mb, 0, 0.25 + h + r * 0.95 + 0.5, 0, 0.4, 0.35, 8, 3, { layer: M.R });
  mb.cyl(0, 0.25 + h + r * 0.95 + 0.85, 0, 0.05, 0.02, 0.5, 6, { layer: M.fm.brass });
  // Door + windows around.
  mb.quad([-0.5, 0.25, r + 0.02], [0.5, 0.25, r + 0.02], [0.5, 2.3, r + 0.02], [-0.5, 2.3, r + 0.02], { layer: M.fm.door });
  mb.cyl(0, 2.3, r + 0.02, 0.5, 0.5, 0.04, 10, { layer: M.fm.stone }, false);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 2 + (i + 1) * (Math.PI * 2 / 5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r, yaw = 90 - a * 180 / Math.PI;
    mb.push(yaw, x, 0, z);
    const rr = 0.32;
    for (let k = 0; k < 10; k++) { const a0 = (k / 10) * Math.PI * 2, a1 = ((k + 1) / 10) * Math.PI * 2; mb.tri([0, 1.5, 0.03], [Math.cos(a0) * rr, 1.5 + Math.sin(a0) * rr, 0.03], [Math.cos(a1) * rr, 1.5 + Math.sin(a1) * rr, 0.03], { layer: lit(p, i) ? M.fm.lit : M.fm.glass, emissive: lit(p, i) ? 1 : 0 }); }
    for (let k = 0; k < 10; k++) { const a0 = (k / 10) * Math.PI * 2, a1 = ((k + 1) / 10) * Math.PI * 2; mb.quad([Math.cos(a0) * rr, 1.5 + Math.sin(a0) * rr, 0.06], [Math.cos(a0) * (rr + 0.1), 1.5 + Math.sin(a0) * (rr + 0.1), 0.06], [Math.cos(a1) * (rr + 0.1), 1.5 + Math.sin(a1) * (rr + 0.1), 0.06], [Math.cos(a1) * rr, 1.5 + Math.sin(a1) * rr, 0.06], { layer: M.fm.stone }); }
    mb.pop();
  }
  if (coral && !mob(ctx)) for (let i = 0; i < 6; i++) { const a = i * 1.1; mb.blob(Math.cos(a) * (r + 0.1), 0.6 + (i % 3) * 0.6, Math.sin(a) * (r + 0.1), 0.18, 0.14, 0.18, { layer: M.fm.cloth, tint: [1.2, 0.8, 0.8] }, 1, 0.4, i); }
  lantern(ctx, (u, v, t = 0) => [u, v, r + t], 0.85, 2.2, { metal: M.fm.metal, lit: M.fm.lit });
  pot(mb, -0.9, 0.25, r + 0.3, M.cm, true);
};

export const shellhouse: SB = (ctx, p, M) => {
  const mb = ctx.mb, Rl = Math.min(p.W, p.D) / 2;
  pad(mb, p, M.fm.stone, 0.2);
  const shell = L(ctx, "wall"), inner = L(ctx, "wall2");
  // Nautilus shell standing upright, whorl turned 40° to the street; the aperture (door) opens forward.
  const R0 = Rl * 0.5, rr0 = R0 * 0.74, k = 0.13, h0 = R0 + rr0 + 0.22;
  const N = mob(ctx) ? 18 : 30, turns = 3.0 * Math.PI;
  mb.push(38, 0, 0, 0.2);
  const P = (t: number): V3 => { const R = R0 * Math.exp(-k * t); return [0, h0 - R * Math.cos(t), -R * Math.sin(t)]; };
  const rad = (t: number) => rr0 * Math.exp(-k * t);
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * turns, t1 = ((i + 1) / N) * turns;
    const shade = 1 - (i / N) * 0.25;
    tube(mb, P(t0), P(t1), rad(t0), 12, { layer: shell, tint: [1.08 * shade, 0.98 * shade, 0.9 * shade] }, false, rad(t1));
    if (i % 3 === 0 && !mob(ctx)) tube(mb, P(t0), P(t0 + 0.02), rad(t0) * 1.04, 12, { layer: inner, tint: [1.1, 1.0, 0.95] }, false, rad(t0) * 1.04);
  }
  // Tip cap + aperture rim + door.
  mb.blob(...P(turns), rad(turns), rad(turns), rad(turns), { layer: shell }, 1);
  const a = P(0);
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
    mb.beam([a[0] + Math.cos(a0) * rr0, a[1] + Math.sin(a0) * rr0, a[2] + 0.05], [a[0] + Math.cos(a1) * rr0, a[1] + Math.sin(a1) * rr0, a[2] + 0.05], 0.16, { layer: inner });
  }
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
    mb.tri([a[0], a[1], a[2] + 0.02], [a[0] + Math.cos(a0) * rr0 * 0.95, a[1] + Math.sin(a0) * rr0 * 0.95, a[2] + 0.02], [a[0] + Math.cos(a1) * rr0 * 0.95, a[1] + Math.sin(a1) * rr0 * 0.95, a[2] + 0.02], { layer: inner, tint: [0.8, 0.62, 0.6] });
  }
  mb.quad([a[0] - 0.42, 0.2, a[2] + 0.06], [a[0] + 0.42, 0.2, a[2] + 0.06], [a[0] + 0.42, 1.9, a[2] + 0.06], [a[0] - 0.42, 1.9, a[2] + 0.06], { layer: M.fm.door });
  mb.cyl(a[0], 1.9, a[2] + 0.06, 0.42, 0.42, 0.04, 10, { layer: inner }, false);
  for (let i = 0; i < 3; i++) { const q = P(1.2 + i * 1.3), r2 = rad(1.2 + i * 1.3); mb.cyl(q[0] + r2 * 0.98, q[1], q[2], 0.16, 0.16, 0.05, 8, { layer: M.fm.lit, emissive: 1 }); }
  mb.pop();
  light(ctx, [0, 1.4, Rl * 0.6], ctx.lampColor, 5, 1, "wall");
  if (!mob(ctx)) for (let i = 0; i < 5; i++) { const ang = 0.5 + i * 1.1; mb.blob(Math.cos(ang) * (Rl - 0.5), 0.3, Math.sin(ang) * (Rl - 0.5), 0.22, 0.2, 0.22, { layer: M.fm.cloth, tint: [1.2, 0.75, 0.7] }, 1, 0.4, i); }
};

export const wreckhouse: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "ground2"), 0.1);
  const hw = W / 2 - 0.3, hd = D / 2 - 0.35;
  body(ctx, p, M, hw * 2 - 0.4, hd * 2 - 0.4, 0.1, 1.5, M.fm.stone, { door: "plank" });
  // Overturned hull as the roof: ribs + planking along x.
  const wood = M.fm.wood, len = hw * 2 + 0.4, bw = hd * 2 + 0.3;
  const prof = (t: number) => { const s = -1 + 2 * t; return [s * bw / 2, 1.6 + (1 - s * s) * 1.5] as [number, number]; };
  const taper = (x: number) => 1 - Math.pow(Math.abs(x) / (len / 2), 3) * 0.45;
  const nx = 6, ns = 6;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ns; j++) {
    const x0 = -len / 2 + (len * i) / nx, x1 = -len / 2 + (len * (i + 1)) / nx;
    const [s0, h0] = prof(j / ns), [s1, h1] = prof((j + 1) / ns);
    const A: V3 = [x0, h0, s0 * taper(x0)], B: V3 = [x1, h0, s0 * taper(x1)], C: V3 = [x1, h1, s1 * taper(x1)], D2: V3 = [x0, h1, s1 * taper(x0)];
    quadOut(mb, A, B, C, D2, [0, 1, (s0 + s1) * 0.5], { layer: wood, tint: i % 2 ? [0.85, 0.8, 0.75] : [0.95, 0.9, 0.82], uvs: [[x0 * 0.5, j * 0.3], [x1 * 0.5, j * 0.3], [x1 * 0.5, (j + 1) * 0.3], [x0 * 0.5, (j + 1) * 0.3]] });
  }
  mb.beam([-len / 2 - 0.3, 3.1, 0], [len / 2 + 0.3, 3.1, 0], 0.2, { layer: M.fm.dark });
  for (let i = 0; i <= 4; i++) { const x = -len / 2 + (len * i) / 4; for (let j = 0; j < ns; j++) { const [s0, h0] = prof(j / ns), [s1, h1] = prof((j + 1) / ns); mb.beam([x, h0 + 0.04, s0 * taper(x)], [x, h1 + 0.04, s1 * taper(x)], 0.08, { layer: M.fm.dark }); } }
  // Mast stub + rope + portholes.
  mb.beam([len / 2 - 0.8, 3.1, 0], [len / 2 + 0.4, 5.0, 0.3], 0.14, { layer: M.fm.dark });
  tube(mb, [len / 2 + 0.3, 4.8, 0.3], [hw, 0.2, hd], 0.02, 4, { layer: M.cm.cloth2 });
  barrel(mb, -hw + 0.4, 0.1, hd + 0.2, M.cm, 0.9);
  lantern(ctx, (u, v, t = 0) => [u, v, hd - 0.2 + t], 0.9, 1.4, { metal: M.fm.metal, lit: M.fm.lit }, 4.5);
};

export const colonnade: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  mb.bevelBox(0, -0.3, 0, W, 0.75, D, 0.05, { layer: M.fm.stone });
  for (let i = 0; i < 3; i++) mb.bevelBox(0, -0.3, D / 2 + 0.12 + i * 0.001, W - 0.6 - i * 0.3, 0.3 + 0.45 * (1 - i / 3), 0.3, 0.02, { layer: M.fm.stone });
  const hw = W / 2 - 0.5, hd = D / 2 - 0.5, h = 3.2, y0 = 0.45;
  const marble = p.lang === "classical" || p.lang === "arcane" ? L(ctx, "a_plaster") : M.fm.stone;
  const nx = Math.max(3, Math.round(hw * 2 / 1.1));
  const cols: [number, number][] = [];
  for (let i = 0; i <= nx; i++) { cols.push([-hw + (2 * hw * i) / nx, hd]); cols.push([-hw + (2 * hw * i) / nx, -hd]); }
  for (const [x, z] of cols) {
    mb.bevelBox(x, y0, z, 0.5, 0.2, 0.5, 0.03, { layer: M.fm.stone });
    lathe(mb, x, y0 + 0.2, z, [[0.2, 0], [0.19, h * 0.5], [0.16, h - 0.5]], 10, { layer: marble }, false);
    mb.cyl(x, y0 + h - 0.3, z, 0.18, 0.26, 0.12, 10, { layer: marble });
    mb.bevelBox(x, y0 + h - 0.18, z, 0.55, 0.18, 0.55, 0.03, { layer: M.fm.stone });
  }
  // Entablature + pediments on both ends.
  mb.bevelBox(0, y0 + h, hd, hw * 2 + 0.7, 0.45, 0.6, 0.04, { layer: marble });
  mb.bevelBox(0, y0 + h, -hd, hw * 2 + 0.7, 0.45, 0.6, 0.04, { layer: marble });
  for (const sx of [-1, 1]) mb.bevelBox(sx * hw, y0 + h, 0, 0.6, 0.45, hd * 2, 0.04, { layer: marble });
  roof(mb, { x0: -hw - 0.3, x1: hw + 0.3, z0: -hd - 0.3, z1: hd + 0.3, y: y0 + h + 0.45, kind: "gable", pitch: 0.35, eave: [0.1, 0.1, 0.1, 0.1], alongX: false, mat: M.R, trim: marble, gable: marble, soffit: marble, seed: p.b.seed, snow: M.snow, mobile: mob(ctx) });
  // Back wall (niches) + urns.
  wq(mb, wallP("n", hw, hd - 0.6), -hw, hw, y0, y0 + h, 0, { layer: marble, tint: [0.85, 0.85, 0.88] });
  for (const sx of [-1, 1]) { pot(mb, sx * (hw - 0.2), y0, hd + 0.1, M.cm, true); }
  if (p.kit.deco.includes("candles")) for (let i = 0; i < 5; i++) { mb.cyl(-1 + i * 0.5, y0, -hd + 0.9, 0.05, 0.05, 0.25, 6, { layer: L(ctx, "paper") }); mb.box(-1 + i * 0.5, y0 + 0.25, -hd + 0.9, 0.04, 0.08, 0.04, { layer: M.fm.lit, emissive: 1 }); }
  light(ctx, [0, y0 + 2.2, 0], ctx.lampColor, 5, 0.8, "wall");
};

export const bookhouse: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "a_plaster"), 0.15);
  const hw = W / 2 - 0.35, hd = D / 2 - 0.4;
  const covers: V3[] = [[1.3, 0.45, 0.4], [0.42, 0.58, 1.2], [0.45, 0.95, 0.5], [1.25, 0.95, 0.45], [0.85, 0.45, 1.05], [0.35, 0.35, 0.4]];
  const cloth = L(ctx, "a_plaster"), paper = L(ctx, "paper"), gold = M.fm.brass;
  // Walls = giant books lying flat, hand-stacked (slight turns), spines and page edges alternating outward.
  let y = 0.15, i = 0;
  const h = 2.7 + (p.b.floors > 1 ? 2.3 : 0);
  while (y < h) {
    const t = 0.5 + p.r(80 + i) * 0.3, yaw = (p.r(85 + i) - 0.5) * 9, dx = (p.r(90 + i) - 0.5) * 0.25;
    const tint = covers[Math.floor(p.r(100 + i) * covers.length)]!;
    const bw = hw * 2 + 0.2 - p.r(110 + i) * 0.3, bd = hd * 2 + 0.15 - p.r(115 + i) * 0.25;
    mb.push(yaw, dx, y, 0);
    const spineFront = i % 2 === 0;
    mb.box(0, 0, 0, bw, t, bd, { layer: cloth, tint }, "t");
    mb.box(0, 0, 0, bw, t, bd, spineFront ? { layer: cloth, tint: [tint[0] * 0.8, tint[1] * 0.8, tint[2] * 0.8] } : { layer: paper }, "s");
    mb.box(0, 0, 0, bw, t, bd, spineFront ? { layer: paper } : { layer: cloth, tint: [tint[0] * 0.8, tint[1] * 0.8, tint[2] * 0.8] }, "n");
    mb.box(0, 0, 0, bw, t, bd, { layer: paper, tint: [0.95, 0.93, 0.88] }, "ew");
    // Cover boards overhang the page block a little.
    mb.box(0, 0, 0, bw + 0.08, 0.06, bd + 0.08, { layer: cloth, tint }, "tnsew");
    if (spineFront && !mob(ctx)) {
      for (const f of [0.18, 0.82]) mb.box(-bw / 2 + bw * f, t * 0.12, bd / 2 + 0.01, 0.08, t * 0.76, 0.03, { layer: gold }, "s");
      mb.box(0, t * 0.3, bd / 2 + 0.012, Math.min(1.4, bw * 0.3), t * 0.4, 0.02, { layer: paper, tint: [1.0, 0.95, 0.82] }, "s");
    }
    mb.pop();
    y += t; i++;
  }
  // Door + windows cut through the stack, framed like bookmarks.
  mb.quad([-0.5, 0.15, hd + 0.12], [0.5, 0.15, hd + 0.12], [0.5, 2.15, hd + 0.12], [-0.5, 2.15, hd + 0.12], { layer: M.fm.door });
  mb.box(0, 2.15, hd + 0.14, 1.2, 0.14, 0.12, { layer: M.fm.wood });
  for (const [x, yy] of [[-hw + 0.9, 1.25], [hw - 0.9, 1.25], [-hw + 0.9, 3.45], [hw - 0.9, 3.45]] as const) {
    if (yy > h - 0.6) continue;
    const lt = lit(p, Math.round(x * 3 + yy));
    mb.quad([x - 0.35, yy, hd + 0.13], [x + 0.35, yy, hd + 0.13], [x + 0.35, yy + 0.7, hd + 0.13], [x - 0.35, yy + 0.7, hd + 0.13], { layer: lt ? M.fm.lit : M.fm.glass, emissive: lt ? 1 : 0 });
    mb.box(x, yy - 0.06, hd + 0.16, 0.85, 0.06, 0.12, { layer: M.fm.wood });
    mb.box(x, yy + 0.7, hd + 0.15, 0.85, 0.06, 0.08, { layer: M.fm.wood });
  }
  // Roof: an open book resting spine-up, pages fanned beneath the covers.
  const top = y;
  const cover = covers[Math.floor(p.r(120) * covers.length)]!;
  for (const sg of [-1, 1]) {
    const A: V3 = [-hw - 0.5, top + 0.05, sg * (hd + 0.55)], B: V3 = [hw + 0.5, top + 0.05, sg * (hd + 0.55)], C: V3 = [hw + 0.5, top + 1.6, 0], D2: V3 = [-hw - 0.5, top + 1.6, 0];
    quadOut(mb, A, B, C, D2, [0, 1, sg], { layer: cloth, tint: cover });
    quadOut(mb, [A[0], A[1] - 0.07, A[2]], [B[0], B[1] - 0.07, B[2]], [C[0], C[1] - 0.07, C[2]], [D2[0], D2[1] - 0.07, D2[2]], [0, -1, -sg], { layer: cloth, tint: [cover[0] * 0.6, cover[1] * 0.6, cover[2] * 0.6] });
    for (let k2 = 1; k2 <= 4; k2++) {
      const f = 1 - k2 * 0.06;
      quadOut(mb, [-hw - 0.42, top + 0.02 + k2 * 0.02, sg * (hd + 0.48) * f], [hw + 0.42, top + 0.02 + k2 * 0.02, sg * (hd + 0.48) * f], [hw + 0.42, top + 1.5 - k2 * 0.05, 0], [-hw - 0.42, top + 1.5 - k2 * 0.05, 0], [0, 1, sg], { layer: paper, tint: [1 - k2 * 0.02, 1 - k2 * 0.02, 0.98 - k2 * 0.03] });
    }
    for (const x of [-hw - 0.5, hw + 0.5]) triOut(mb, [x, top + 0.05, sg * (hd + 0.48)], [x, top + 1.5, 0], [x, top + 0.05, 0], [x < 0 ? -1 : 1, 0, 0], { layer: paper, tint: [0.92, 0.9, 0.85] });
  }
  mb.beam([-hw - 0.5, top + 1.62, 0], [hw + 0.5, top + 1.62, 0], 0.18, { layer: cloth, tint: [cover[0] * 0.7, cover[1] * 0.7, cover[2] * 0.7] });
  for (const f of [-0.35, 0.35]) mb.beam([f * hw * 2, top + 1.62, 0], [f * hw * 2, top + 1.62, 0.001], 0.2, { layer: gold });
  // Bookmark ribbon hanging from the roof spine.
  mb.quad([hw * 0.4, top + 1.55, 0.02], [hw * 0.4 + 0.2, top + 1.55, 0.02], [hw * 0.4 + 0.2, top - 1.4, hd + 0.66], [hw * 0.4, top - 1.4, hd + 0.66], { layer: M.fm.cloth, doubleSided: true, wind: true, tint: [1.3, 0.35, 0.35] });
  lantern(ctx, (u, v, t = 0) => [u, v, hd + 0.14 + t], -0.95, 2.25, { metal: M.fm.metal, lit: M.fm.lit });
};

export const origami: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "paper"), 0.2);
  const paper = L(ctx, "paper");
  const hw = W / 2 - 0.4, hd = D / 2 - 0.4, h = 2.6;
  const pts: V3[] = [[-hw, 0.2, hd], [0, 0.2, hd + 0.35], [hw, 0.2, hd], [hw + 0.3, 0.2, 0], [hw, 0.2, -hd], [0, 0.2, -hd - 0.3], [-hw, 0.2, -hd], [-hw - 0.3, 0.2, 0]];
  const top: V3[] = pts.map(([x, , z], i) => [x * 0.75, h + (i % 2 ? 0.5 : 0), z * 0.75]);
  const apex: V3 = [0, h + 2.2, 0];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const out: V3 = [(pts[i]![0] + pts[j]![0]) / 2, 0.2, (pts[i]![2] + pts[j]![2]) / 2];
    if (i !== 0) quadOut(mb, pts[i]!, pts[j]!, top[j]!, top[i]!, out, { layer: paper, tint: i % 2 ? [1, 0.97, 0.93] : [0.9, 0.88, 0.86] });
    triOut(mb, top[i]!, top[j]!, apex, [out[0], 1.5, out[2]], { layer: paper, tint: i % 2 ? [1.02, 0.96, 0.9] : [0.86, 0.84, 0.82] });
    mb.beam(top[i]!, apex, 0.03, { layer: M.fm.dark, tint: [0.6, 0.55, 0.5] });
  }
  mb.quad([pts[0]![0], 0.2, pts[0]![2]], [pts[1]![0], 0.2, pts[1]![2]], [pts[1]![0], 1.2, pts[1]![2] - 0.05], [pts[0]![0], 1.8, pts[0]![2]], { layer: paper, doubleSided: true, tint: [0.95, 0.92, 0.88] });
  mb.quad([pts[0]![0] * 0.5, 0.2, hd + 0.1], [0.4, 0.2, hd + 0.25], [0.4, 2.0, hd + 0.15], [pts[0]![0] * 0.5, 2.0, hd], { layer: M.fm.dark, tint: [0.3, 0.26, 0.24] });
  paperLantern(ctx, [hw + 0.2, 2.2, hd + 0.2], L(ctx, "paper"), M.fm.dark, 0.2);
  light(ctx, [0, 1.4, 0], ctx.lampColor, 4.5, 1.0, "interior");
};

export const bookstack: SB = (ctx, p, M) => {
  const mb = ctx.mb, s = Math.min(p.W, p.D) - 0.8;
  pad(mb, p, L(ctx, "a_plaster"), 0.2);
  const covers: V3[] = [[1.3, 0.5, 0.45], [0.45, 0.6, 1.2], [0.5, 1.0, 0.55], [1.2, 1.0, 0.5], [0.9, 0.5, 1.1]];
  let y = 0.2;
  for (let i = 0; i < 14; i++) {
    const t = 0.45 + p.r(130 + i) * 0.25, w = s * (1 - i * 0.03), d = w * (0.72 + p.r(140 + i) * 0.2);
    mb.push((p.r(150 + i) - 0.5) * 40, (p.r(160 + i) - 0.5) * 0.3, y, (p.r(170 + i) - 0.5) * 0.3);
    mb.box(0, 0, 0, w, t, d, { layer: M.fm.cloth, tint: covers[i % covers.length]! }, "tnsew");
    mb.box(0.04, 0.05, 0, w - 0.02, t - 0.1, d + 0.02, { layer: L(ctx, "paper") }, "ns");
    mb.box(0.06, 0.05, 0, w + 0.02, t - 0.1, d - 0.1, { layer: L(ctx, "paper") }, "e");
    mb.pop();
    y += t;
  }
  mb.quad([-0.45, 0.2, s * 0.37 + 0.03], [0.45, 0.2, s * 0.37 + 0.03], [0.45, 2.1, s * 0.37 + 0.03], [-0.45, 2.1, s * 0.37 + 0.03], { layer: M.fm.door });
  // Reading lamp on top.
  mb.cyl(0, y, 0, 0.25, 0.25, 0.08, 8, { layer: M.fm.brass });
  mb.beam([0, y, 0], [0.3, y + 1.0, 0], 0.05, { layer: M.fm.brass });
  mb.cyl(0.35, y + 0.75, 0, 0.35, 0.12, 0.35, 8, { layer: M.fm.cloth, tint: [0.4, 0.8, 0.5] });
  mb.cyl(0.35, y + 0.74, 0, 0.3, 0.3, 0.01, 8, { layer: M.fm.lit, emissive: 1 });
  light(ctx, [0.35, y + 0.6, 0], ctx.lampColor, 6, 1.1, "lamp");
};

export const obelisk: SB = (ctx, p, M) => {
  const mb = ctx.mb, s = Math.min(p.W, p.D) - 1.2;
  mb.bevelBox(0, -0.3, 0, p.W, 0.6, p.D, 0.05, { layer: M.fm.stone });
  mb.bevelBox(0, 0.3, 0, s + 0.3, 0.8, s + 0.3, 0.05, { layer: M.fm.stone });
  const h = 5.2 + p.r(10) * 1.5;
  const b = s * 0.42, t = s * 0.28;
  const stone = p.lang === "classical" ? L(ctx, "a_plaster") : L(ctx, "wall");
  mb.cyl(0, 1.1, 0, b * 1.41, t * 1.41, h, 4, { layer: stone, tint: p.tint as V3 }, false);
  mb.cyl(0, 1.1 + h, 0, t * 1.41, 0.02, t * 1.6, 4, { layer: L(ctx, "a_crystal"), emissive: 0.8 });
  // Glowing runes.
  for (let i = 0; i < 4; i++) {
    const y = 2 + i * 0.9;
    const k = 1 - (y - 1.1) / h * (1 - t / b);
    mb.quad([-b * k * 0.4, y, b * k + 0.02], [b * k * 0.4, y, b * k + 0.02], [b * k * 0.4, y + 0.45, b * k + 0.02], [-b * k * 0.4, y + 0.45, b * k + 0.02], { layer: L(ctx, "a_neon"), emissive: 1, uvs: [[0.1, 0.4], [0.3, 0.4], [0.3, 0.1], [0.1, 0.1]] });
  }
  light(ctx, [0, 1.1 + h + 0.5, 0], ctx.glowColor, 6, 1.0, "glow");
};

export const shardhouse: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, M.fm.stone, 0.2);
  const cr = L(ctx, "a_crystal");
  const shards = mob(ctx) ? 5 : 8;
  for (let i = 0; i < shards; i++) {
    const a = (i / shards) * Math.PI * 2 + 0.3, rr = Math.min(W, D) * 0.28;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr, h = 2.2 + p.r(200 + i) * 2.2, w = 0.5 + p.r(210 + i) * 0.4;
    const tip: V3 = [x * 0.4, h + 0.2, z * 0.4];
    const base = [0, 1, 2, 3, 4, 5].map((k) => { const aa = (k / 6) * Math.PI * 2; return [x + Math.cos(aa) * w, 0.2, z + Math.sin(aa) * w] as V3; });
    const mid = base.map((q) => [q[0] * 0.7 + tip[0] * 0.3, h * 0.75, q[2] * 0.7 + tip[2] * 0.3] as V3);
    for (let k = 0; k < 6; k++) {
      const j = (k + 1) % 6, out: V3 = [(base[k]![0] + base[j]![0]) / 2 - x, 0.2, (base[k]![2] + base[j]![2]) / 2 - z];
      quadOut(mb, base[k]!, base[j]!, mid[j]!, mid[k]!, out, { layer: cr, emissive: 0.35, tint: [0.95, 0.95 + (k % 2) * 0.1, 1.1] });
      triOut(mb, mid[k]!, mid[j]!, tip, [out[0], 0.6, out[2]], { layer: cr, emissive: 0.45, tint: [1.05, 1.05, 1.15] });
    }
  }
  body(ctx, p, M, Math.min(W, D) * 0.45, Math.min(W, D) * 0.45, 0.2, 2.3, M.fm.stone, { doorHead: "pointed", door: "double" });
  roof(mb, { x0: -Math.min(W, D) * 0.225, x1: Math.min(W, D) * 0.225, z0: -Math.min(W, D) * 0.225, z1: Math.min(W, D) * 0.225, y: 2.5, kind: "pyramid", pitch: 1.6, eave: [0.2, 0.2, 0.2, 0.2], alongX: true, mat: cr, trim: M.fm.stone, gable: M.fm.stone, soffit: M.fm.stone, seed: p.b.seed, mobile: mob(ctx) });
  light(ctx, [0, 2.5, 0], ctx.glowColor, 6, 1.1, "glow");
};

export const ringtemple: SB = (ctx, p, M) => {
  const mb = ctx.mb, R = Math.min(p.W, p.D) / 2 - 0.3;
  mb.cyl(0, -0.3, 0, R, R, 0.8, 16, { layer: M.fm.stone });
  mb.cyl(0, 0.5, 0, R - 0.3, R - 0.3, 0.2, 16, { layer: M.fm.stone });
  const n = 8, cr = L(ctx, "a_crystal");
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * (R - 0.6), z = Math.sin(a) * (R - 0.6);
    lathe(mb, x, 0.7, z, [[0.18, 0], [0.16, 2.6], [0.24, 2.8]], 8, { layer: M.fm.stone }, true);
  }
  // Floating ring + central crystal.
  const y = 4.2, rr = R - 0.5;
  for (let i = 0; i < 20; i++) {
    const a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2;
    tube(mb, [Math.cos(a0) * rr, y + Math.sin(a0 * 2) * 0.1, Math.sin(a0) * rr], [Math.cos(a1) * rr, y + Math.sin(a1 * 2) * 0.1, Math.sin(a1) * rr], 0.12, 5, { layer: M.fm.brass, emissive: 0.2 });
  }
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; mb.beam([Math.cos(a) * (R - 0.6), 3.5, Math.sin(a) * (R - 0.6)], [Math.cos(a) * rr, y, Math.sin(a) * rr], 0.05, { layer: cr, emissive: 0.6 }); }
  const base = [0, 1, 2, 3, 4, 5].map((k) => [Math.cos(k * Math.PI / 3) * 0.45, 1.6, Math.sin(k * Math.PI / 3) * 0.45] as V3);
  for (let k = 0; k < 6; k++) { const j = (k + 1) % 6; triOut(mb, base[k]!, base[j]!, [0, 3.4, 0], [base[k]![0] + base[j]![0], 0.4, base[k]![2] + base[j]![2]], { layer: cr, emissive: 0.8 }); triOut(mb, base[k]!, base[j]!, [0, 0.8, 0], [base[k]![0] + base[j]![0], -0.4, base[k]![2] + base[j]![2]], { layer: cr, emissive: 0.6 }); }
  light(ctx, [0, 2.4, 0], ctx.glowColor, 7, 1.3, "glow");
};

/** Kiosk / booth: ticket booth (carnival), guard booth (industrial), post box kiosk (victorian), shop kiosk. */
export const booth: SB = (ctx, p, M) => {
  const mb = ctx.mb, s = Math.min(p.W, p.D) - 1.0;
  pad(mb, p, M.fm.stone, 0.15);
  const carnival = p.lang === "whimsy";
  const vict = p.lang === "victorian";
  const wall = carnival ? L(ctx, "a_awning") : vict ? L(ctx, "a_brick") : p.lang === "industrial" || p.lang === "urban" ? L(ctx, "a_corr") : L(ctx, "a_siding");
  const oct = carnival || vict;
  const h = 2.3;
  if (oct) {
    const r = s / 2;
    mb.cyl(0, 0.15, 0, r, r, 0.9, 8, { layer: M.fm.wood }, false);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; mb.box(Math.cos(a) * r * 0.95, 1.05, Math.sin(a) * r * 0.95, 0.1, h - 0.9, 0.1, { layer: M.fm.frame }); }
    mb.cyl(0, 1.05, 0, r * 0.94, r * 0.94, h - 0.9, 8, { layer: M.fm.lit, emissive: 0.6 }, false);
    mb.cyl(0, 0.15 + h, 0, r + 0.2, r + 0.2, 0.2, 8, { layer: M.fm.frame });
    if (carnival) { onion(mb, 0, 0.35 + h, 0, r + 0.1, 1.8, 8, { layer: wall }); mb.cyl(0, 2.15 + h, 0, 0.03, 0.03, 0.7, 4, { layer: M.fm.metal }); mb.quad([0, 2.55 + h, 0], [0.5, 2.62 + h, 0], [0.5, 2.85 + h, 0], [0, 2.85 + h, 0], { layer: M.fm.cloth, doubleSided: true, wind: true }); }
    else { mb.cyl(0, 0.35 + h, 0, r + 0.1, 0.08, 1.1, 8, { layer: M.R }); }
    mb.quad([-0.35, 1.0, r + 0.02], [0.35, 1.0, r + 0.02], [0.35, 1.3, r + 0.02], [-0.35, 1.3, r + 0.02], { layer: M.fm.dark });
  } else {
    body(ctx, p, M, s, s, 0.15, h, wall, { door: p.lang === "industrial" ? "glass" : "plank", win: { v0: 1.0, v1: 1.9, w: 0.8, mull: "none" } });
    roof(mb, { x0: -s / 2, x1: s / 2, z0: -s / 2, z1: s / 2, y: 0.15 + h, kind: p.lang === "urban" || p.lang === "industrial" ? "flat" : "hip", pitch: 0.4, eave: [0.35, 0.35, 0.35, 0.35], alongX: true, mat: p.lang === "urban" || p.lang === "industrial" ? wall : M.R, trim: M.fm.frame, gable: L(ctx, "a_concrete"), soffit: M.fm.wood, seed: p.b.seed, snow: M.snow, mobile: mob(ctx) });
    if (p.kit.deco.includes("hazard")) mb.box(0, 0.15, s / 2 + 0.03, s, 0.25, 0.04, { layer: L(ctx, "a_awning"), tint: [1.3, 1.1, 0.3] });
  }
  if (vict || p.kit.deco.includes("mail")) {
    // Pillar box.
    lathe(mb, s / 2 + 0.2, 0.15, s / 2 + 0.15, [[0.22, 0], [0.22, 1.1], [0.25, 1.15], [0.16, 1.3], [0.02, 1.35]], 10, { layer: M.fm.metal, tint: [1.4, 0.35, 0.3] });
  }
  if (carnival) for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.3; mb.cyl(Math.cos(a) * (s / 2 + 0.3), 0.15, Math.sin(a) * (s / 2 + 0.3), 0.04, 0.04, 1.1, 4, { layer: M.fm.metal }); }
  light(ctx, [0, 1.6, 0], ctx.lampColor, 4, 0.9, "interior");
};

export const controltower: SB = (ctx, p, M) => {
  const mb = ctx.mb;
  pad(mb, p, L(ctx, "a_concrete"), 0.15);
  const conc = L(ctx, "a_concrete");
  mb.cyl(0, 0.15, 0, 1.0, 0.8, 7.0, 10, { layer: conc, tint: p.tint as V3 }, false);
  for (let y = 1.2; y < 7; y += 1.4) mb.box(0, y, 0.82, 0.3, 0.6, 0.06, { layer: M.fm.glass });
  mb.cyl(0, 7.1, 0, 1.3, 1.6, 0.4, 10, { layer: conc });
  mb.cyl(0, 7.5, 0, 1.6, 1.8, 1.3, 10, { layer: M.fm.lit, emissive: 0.8 }, false);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; mb.beam([Math.cos(a) * 1.6, 7.5, Math.sin(a) * 1.6], [Math.cos(a) * 1.8, 8.8, Math.sin(a) * 1.8], 0.06, { layer: M.fm.metal }); }
  mb.cyl(0, 8.8, 0, 1.95, 1.95, 0.25, 10, { layer: M.fm.metal });
  mb.cyl(0, 9.05, 0, 0.3, 0.3, 0.6, 8, { layer: M.fm.metal });
  mb.cyl(0, 9.65, 0, 0.04, 0.02, 1.8, 4, { layer: M.fm.metal });
  mb.box(0, 11.3, 0, 0.14, 0.14, 0.14, { layer: M.fm.lit, emissive: 1, tint: [1.5, 0.4, 0.4] });
  mb.push(0, 0, 0, 0);
  obox(mb, [0, 9.4, 0.5], [1, 0, 0], [0, 0.94, -0.34], [0, 0.34, 0.94], 0.5, 0.25, 0.02, { layer: M.fm.metal });
  mb.pop();
  mb.box(0, 0.15, 1.3, 1.6, 2.4, 1.0, { layer: conc });
  mb.quad([-0.45, 0.15, 1.81], [0.45, 0.15, 1.81], [0.45, 2.2, 1.81], [-0.45, 2.2, 1.81], { layer: M.fm.glass });
  light(ctx, [0, 8, 1.8], ctx.lampColor, 6, 0.8, "interior");
};

export const aframe: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, M.fm.stone, 0.35);
  const hw = W / 2 - 0.2, hd = D / 2 - 0.5, H = hw * 2.1;
  const P0: V3 = [-hw, 0.35, 0], P1: V3 = [hw, 0.35, 0], T: V3 = [0, 0.35 + H, 0];
  // Roof planes (to the ground).
  for (const sg of [-1, 1]) {
    const e = sg < 0 ? P0 : P1;
    quadOut(mb, [e[0] + sg * 0.25, e[1] - 0.2, -hd - 0.4], [e[0] + sg * 0.25, e[1] - 0.2, hd + 0.4], [T[0], T[1] + 0.12, hd + 0.4], [T[0], T[1] + 0.12, -hd - 0.4], [sg, 0.7, 0], { layer: M.R, uvs: [[0, H * 0.6], [D * 0.5, H * 0.6], [D * 0.5, 0], [0, 0]] });
    if (M.snow >= 0) quadOut(mb, [e[0] * 0.7 + sg * 0.25, e[1] + H * 0.3 + 0.05, -hd - 0.35], [e[0] * 0.7 + sg * 0.25, e[1] + H * 0.3 + 0.05, hd + 0.35], [T[0], T[1] + 0.2, hd + 0.35], [T[0], T[1] + 0.2, -hd - 0.35], [sg, 0.7, 0], { layer: M.snow });
    mb.beam([e[0] + sg * 0.25, e[1] - 0.2, hd + 0.42], [T[0], T[1] + 0.12, hd + 0.42], 0.14, { layer: M.T });
    mb.beam([e[0] + sg * 0.25, e[1] - 0.2, -hd - 0.42], [T[0], T[1] + 0.12, -hd - 0.42], 0.14, { layer: M.T });
  }
  // Glazed front gable with mullions + balcony.
  const zf = hd;
  triOut(mb, [-hw + 0.2, 0.35, zf], [hw - 0.2, 0.35, zf], [0, 0.35 + H - 0.4, zf], [0, 0, 1], { layer: M.fm.lit, emissive: 0.75 });
  for (let i = -2; i <= 2; i++) { const x = i * hw * 0.35; mb.beam([x, 0.35, zf + 0.04], [x, 0.35 + (H - 0.4) * (1 - Math.abs(x) / (hw - 0.2)), zf + 0.04], 0.07, { layer: M.fm.dark }); }
  for (const y of [2.5, 4.4]) { const k = 1 - (y - 0.35) / (H - 0.4); if (k > 0.1) mb.beam([-(hw - 0.2) * k, y, zf + 0.04], [(hw - 0.2) * k, y, zf + 0.04], 0.08, { layer: M.fm.dark }); }
  mb.quad([-0.45, 0.35, zf + 0.06], [0.45, 0.35, zf + 0.06], [0.45, 2.3, zf + 0.06], [-0.45, 2.3, zf + 0.06], { layer: M.fm.door });
  mb.box(0, 2.75, zf + 0.45, hw * 1.2, 0.12, 0.9, { layer: M.fm.wood });
  for (let i = 0; i <= 8; i++) mb.box(-hw * 0.6 + (hw * 1.2 * i) / 8, 2.87, zf + 0.86, 0.05, 0.8, 0.05, { layer: M.fm.wood });
  mb.box(0, 3.62, zf + 0.86, hw * 1.2, 0.07, 0.07, { layer: M.fm.wood });
  triOut(mb, [-hw + 0.2, 0.35, -zf], [hw - 0.2, 0.35, -zf], [0, 0.35 + H - 0.4, -zf], [0, 0, -1], { layer: L(ctx, "a_log") });
  chimneyPipe(mb, hw * 0.4, -hd * 0.3, 0.35 + H * 0.55, 0.35 + H + 0.6, M);
  light(ctx, [0, 2.0, zf + 0.6], ctx.lampColor, 6, 1.1, "interior");
  const pile = L(ctx, "wood");
  for (let i = 0; i < 6; i++) tube(mb, [-hw + 0.3 + i * 0.12, 0.45 + (i % 2) * 0.12, -hd - 0.2], [-hw + 0.3 + i * 0.12, 0.45 + (i % 2) * 0.12, -hd + 0.6], 0.07, 5, { layer: pile }, true);
};
function chimneyPipe(mb: MeshBuilder, x: number, z: number, y0: number, y1: number, M: Mats) {
  mb.cyl(x, y0, z, 0.14, 0.14, y1 - y0, 8, { layer: M.fm.metal, tint: [0.5, 0.5, 0.52] });
  mb.cyl(x, y1, z, 0.25, 0.05, 0.2, 8, { layer: M.fm.metal, tint: [0.5, 0.5, 0.52] });
}

/** Inverted house: roof buried in the ground (V trough), storeys above, foundation + chimney on top. */
export const inverted: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "ground2"), 0.08);
  const hw = W / 2 - 0.3, hd = D / 2 - 0.4, rise = 1.6;
  // Inverted gable roof: ridge at ground, eaves up.
  for (const sg of [-1, 1]) quadOut(mb, [-hw - 0.3, 0.1, 0], [hw + 0.3, 0.1, 0], [hw + 0.3, rise, sg * (hd + 0.35)], [-hw - 0.3, rise, sg * (hd + 0.35)], [0, -0.3, sg], { layer: M.R, uvs: [[0, 0], [W * 0.5, 0], [W * 0.5, 1], [0, 1]] });
  for (const sx of [-1, 1]) triOut(mb, [sx * hw, rise, -hd], [sx * hw, rise, hd], [sx * hw, 0.2, 0], [sx, 0, 0], { layer: L(ctx, "a_plaster") });
  const h = 2.6;
  for (let fl = 0; fl < 2; fl++) {
    const y0 = rise + fl * h;
    for (const side of ["s", "e", "n", "w"] as const) {
      const len = side === "s" || side === "n" ? hw * 2 : hd * 2;
      const P = wallP(side, hw, hd);
      const n = Math.max(1, Math.floor(len / 1.6));
      // Windows upside down: sill on top (flower boxes hang upward), door on the upper storey.
      const ops: Op[] = Array.from({ length: n }, (_, i) => ({ u: -len / 2 + (len / n) * (i + 0.5), w: 0.7, v0: h - 2.0, v1: h - 0.9, kind: "win" as const, head: "flat" as const, lit: lit(p, fl * 10 + i), shutters: p.r(700 + i) < 0.5, mull: "cross" as const }));
      if (side === "s" && fl === 1) ops[Math.floor(n / 2)] = { u: ops[Math.floor(n / 2)]!.u, w: 1.0, v0: 0.3, v1: h - 0.05, kind: "door", head: "flat", door: "plank" };
      facade(mb, { P, u0: -len / 2, u1: len / 2, y0, y1: y0 + h, ops, wall: { layer: L(ctx, "a_plaster"), tint: p.tint as V3 }, mats: M.fm, st: p.st, seed: p.b.seed + fl, mobile: mob(ctx) });
    }
  }
  const top = rise + 2 * h;
  mb.bevelBox(0, top, 0, hw * 2 + 0.2, 0.45, hd * 2 + 0.2, 0.04, { layer: M.fm.stone });
  mb.bevelBox(hw * 0.4, top + 0.45, -hd * 0.3, 0.6, 0.9, 0.6, 0.03, { layer: M.fm.stone });
  // Front steps hanging upside down from the door.
  for (let i = 0; i < 3; i++) mb.box(0, top - 0.3 - i * 0.2, hd + 0.2 + i * 0.25, 1.2, 0.18, 0.25, { layer: M.fm.stone });
  // A proper ladder up to the door from the street.
  for (let i = 0; i < 12; i++) mb.box(0.9, 0.2 + i * 0.35, hd + 0.35, 0.5, 0.04, 0.05, { layer: M.fm.wood });
  for (const dx of [0.65, 1.15]) mb.box(dx, 0.1, hd + 0.35, 0.05, 4.4, 0.05, { layer: M.fm.wood });
  lantern(ctx, wallP("s", hw, hd), -0.9, rise + h + 2.2, { metal: M.fm.metal, lit: M.fm.lit });
};

export const penciltower: SB = (ctx, p, M) => {
  const mb = ctx.mb;
  pad(mb, p, L(ctx, "ground2"), 0.1);
  const colors: V3[] = [[1.3, 1.05, 0.35], [1.25, 0.45, 0.4], [0.45, 0.7, 1.2], [0.55, 1.0, 0.5], [1.2, 0.6, 1.0]];
  const tint = colors[Math.floor(p.r(90) * colors.length)]!;
  const r = Math.min(p.W, p.D) / 2 - 0.4, h = 3.8 + p.b.floors * 2.0;
  const paint = L(ctx, "a_plaster");
  // Eraser + ferrule base.
  mb.cyl(0, 0.1, 0, r * 0.98, r * 0.98, 0.7, 6, { layer: paint, tint: [1.3, 0.75, 0.8] }, false);
  mb.cyl(0, 0.8, 0, r * 1.02, r * 1.02, 0.55, 6, { layer: M.fm.metal, tint: [1.1, 1.05, 0.9] }, false);
  for (const y of [0.9, 1.1, 1.25]) mb.cyl(0, y, 0, r * 1.05, r * 1.05, 0.04, 6, { layer: M.fm.metal }, false);
  mb.cyl(0, 1.35, 0, r, r, h - 1.35, 6, { layer: paint, tint }, false);
  // Sharpened wood cone + graphite tip.
  mb.cyl(0, h, 0, r, r * 0.26, r * 2.8, 6, { layer: L(ctx, "a_wood"), tint: [1.2, 1.02, 0.78] }, false);
  // Paint scallops where the lacquer meets the shaved wood.
  for (let k2 = 0; k2 < 6; k2++) { const a = (k2 / 6) * Math.PI * 2 + Math.PI / 6, fz2 = r * Math.cos(Math.PI / 6); triOut(mb, [Math.cos(a - 0.52) * r, h, Math.sin(a - 0.52) * r], [Math.cos(a + 0.52) * r, h, Math.sin(a + 0.52) * r], [Math.cos(a) * fz2 * 0.86, h + r * 0.55, Math.sin(a) * fz2 * 0.86], [Math.cos(a), 0.4, Math.sin(a)], { layer: paint, tint }); }
  mb.cyl(0, h + r * 2.8, 0, r * 0.26, 0.02, r * 0.9, 6, { layer: M.fm.metal, tint: [0.28, 0.28, 0.32] });
  // Door + round windows on facets.
  mb.push(0, 0, 0, 0);
  const fz = r * Math.cos(Math.PI / 6);
  mb.quad([-0.4, 0.1, fz + 0.02], [0.4, 0.1, fz + 0.02], [0.4, 1.95, fz + 0.02], [-0.4, 1.95, fz + 0.02], { layer: M.fm.door });
  mb.box(0, 1.95, fz + 0.05, 1.0, 0.12, 0.1, { layer: M.fm.frame });
  for (let k = 0; k < 3; k++) {
    const y = 2.6 + k * 1.4;
    if (y > h - 0.5) break;
    const a = (k % 2 ? 1 : -1) * Math.PI / 3 + Math.PI / 2;
    mb.push(90 - a * 180 / Math.PI, Math.cos(a) * fz, 0, Math.sin(a) * fz);
    const rr = 0.28;
    for (let i = 0; i < 10; i++) { const a0 = (i / 10) * Math.PI * 2, a1 = ((i + 1) / 10) * Math.PI * 2; mb.tri([0, y, 0.03], [Math.cos(a0) * rr, y + Math.sin(a0) * rr, 0.03], [Math.cos(a1) * rr, y + Math.sin(a1) * rr, 0.03], { layer: lit(p, k) ? M.fm.lit : M.fm.glass, emissive: lit(p, k) ? 1 : 0 }); }
    mb.pop();
  }
  mb.pop();
  // Text band.
  mb.cyl(0, h - 1.0, 0, r * 1.01, r * 1.01, 0.3, 6, { layer: L(ctx, "a_neon"), tint: [0.3, 0.3, 0.3] }, false);
  lantern(ctx, (u, v, t = 0) => [u, v, fz + t], 0.7, 2.1, { metal: M.fm.metal, lit: M.fm.lit });
};

export const shavingpavilion: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "ground2"), 0.12);
  const r = Math.min(W, D) / 2 - 0.4, h = 2.4;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; mb.cyl(Math.cos(a) * r * 0.75, 0.12, Math.sin(a) * r * 0.75, 0.12, 0.12, h, 6, { layer: L(ctx, "wall"), tint: [1.3, 1.05, 0.4] }); }
  // Shaving petals: ruffled ring with a pink / painted edge.
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const y = h + 0.1, wob = (i % 2 ? 0.25 : -0.05);
    const A: V3 = [Math.cos(a0) * 0.3, y + 1.3, Math.sin(a0) * 0.3], B: V3 = [Math.cos(a1) * 0.3, y + 1.3, Math.sin(a1) * 0.3];
    const C: V3 = [Math.cos(a1) * (r + 0.6), y + wob, Math.sin(a1) * (r + 0.6)], D2: V3 = [Math.cos(a0) * (r + 0.6), y - wob * 0.6, Math.sin(a0) * (r + 0.6)];
    quadOut(mb, D2, C, B, A, [Math.cos(am), 1, Math.sin(am)], { layer: L(ctx, "wood"), tint: [1.2, 1.0, 0.78], doubleSided: true });
    mb.beam([D2[0], D2[1], D2[2]], [C[0], C[1], C[2]], 0.08, { layer: L(ctx, "a_plaster"), tint: i % 3 ? [1.25, 0.5, 0.45] : [0.45, 0.65, 1.2] });
  }
  mb.cyl(0, h + 1.3, 0, 0.3, 0.05, 0.6, 6, { layer: M.fm.metal, tint: [0.3, 0.3, 0.34] });
  mb.cyl(0, 0.12, 0, 0.5, 0.5, 0.75, 8, { layer: L(ctx, "wood") });
  light(ctx, [0, h, 0], ctx.lampColor, 4.5, 0.8, "wall");
};

export const eraserhut: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "ground2"), 0.1);
  const hw = W / 2 - 0.4, hd = D / 2 - 0.4;
  const pink = L(ctx, "a_plaster");
  mb.bevelBox(0, 0.1, 0, hw * 2, 2.5, hd * 2, 0.35, { layer: pink, tint: [1.35, 0.78, 0.82] });
  // Slanted worn top.
  quadOut(mb, [-hw + 0.3, 2.6, hd - 0.3], [hw - 0.3, 2.6, hd - 0.3], [hw - 0.3, 3.3, -hd + 0.3], [-hw + 0.3, 3.3, -hd + 0.3], [0, 1, 0.3], { layer: pink, tint: [1.25, 0.72, 0.76] });
  quadOut(mb, [hw - 0.3, 2.6, hd - 0.3], [hw - 0.3, 3.3, -hd + 0.3], [hw - 0.3, 2.6, -hd + 0.3], [hw - 0.3, 2.6, -hd + 0.3], [1, 0, 0], { layer: pink, tint: [1.2, 0.7, 0.74] });
  quadOut(mb, [-hw + 0.3, 2.6, hd - 0.3], [-hw + 0.3, 2.6, -hd + 0.3], [-hw + 0.3, 3.3, -hd + 0.3], [-hw + 0.3, 3.3, -hd + 0.3], [-1, 0, 0], { layer: pink, tint: [1.2, 0.7, 0.74] });
  quadOut(mb, [-hw + 0.3, 2.6, -hd + 0.3], [hw - 0.3, 2.6, -hd + 0.3], [hw - 0.3, 3.3, -hd + 0.3], [-hw + 0.3, 3.3, -hd + 0.3], [0, 0, -1], { layer: pink, tint: [1.2, 0.7, 0.74] });
  // Paper sleeve band.
  mb.box(0, 0.9, 0, hw * 2 + 0.06, 1.0, hd * 2 + 0.06, { layer: L(ctx, "paper") }, "nsew");
  mb.box(0, 1.3, hd + 0.04, hw * 1.4, 0.2, 0.02, { layer: M.fm.cloth, tint: [0.4, 0.5, 1.2] }, "s");
  mb.quad([-0.45, 0.1, hd + 0.05], [0.45, 0.1, hd + 0.05], [0.45, 2.0, hd + 0.05], [-0.45, 2.0, hd + 0.05], { layer: M.fm.door });
  for (const sx of [-1, 1]) { mb.quad([sx * hw * 0.6 - 0.3, 1.9, hd + 0.05], [sx * hw * 0.6 + 0.3, 1.9, hd + 0.05], [sx * hw * 0.6 + 0.3, 2.3, hd + 0.05], [sx * hw * 0.6 - 0.3, 2.3, hd + 0.05], { layer: lit(p, sx + 1) ? M.fm.lit : M.fm.glass, emissive: lit(p, sx + 1) ? 1 : 0 }); }
  for (let i = 0; i < 5; i++) mb.blob(-hw + 0.3 + i * 0.4, 0.15, hd + 0.35 + (i % 2) * 0.1, 0.12, 0.05, 0.08, { layer: pink, tint: [1.2, 0.75, 0.78] }, 0);
  lantern(ctx, (u, v, t = 0) => [u, v, hd + t], 0.8, 2.1, { metal: M.fm.metal, lit: M.fm.lit });
};

export const saltblock: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "ground"), 0.15);
  const salt = L(ctx, "a_salt");
  const hw = W / 2 - 0.35, hd = D / 2 - 0.4, h = 2.4 + (p.b.floors > 1 ? 2.2 : 0);
  // Stacked salt blocks with glowing seams.
  const rows = Math.round(h / 0.6);
  for (let r = 0; r < rows; r++) {
    const y = 0.15 + r * 0.6, inset = r % 2 ? 0.04 : 0;
    mb.bevelBox(0, y, 0, hw * 2 - inset, 0.56, hd * 2 - inset, 0.06, { layer: salt, tint: [1, 1.02 + (r % 3) * 0.02, 1.0] });
    mb.box(0, y + 0.56, 0, hw * 2 - 0.1, 0.04, hd * 2 - 0.1, { layer: L(ctx, "a_neon"), emissive: 0.8, tint: [0.4, 1.2, 1.0] }, "nsew");
  }
  mb.quad([-0.45, 0.15, hd + 0.02], [0.45, 0.15, hd + 0.02], [0.45, 2.0, hd + 0.02], [-0.45, 2.0, hd + 0.02], { layer: M.fm.door });
  for (const x of [-hw + 0.8, hw - 0.8]) mb.quad([x - 0.35, 1.0, hd + 0.02], [x + 0.35, 1.0, hd + 0.02], [x + 0.35, 1.7, hd + 0.02], [x - 0.35, 1.7, hd + 0.02], { layer: M.fm.lit, emissive: lit(p, Math.round(x)) ? 1 : 0.3 });
  // Crystal growths on the roof.
  const top = 0.15 + rows * 0.6;
  for (let i = 0; i < 7; i++) {
    const x = (p.r(300 + i) - 0.5) * (hw * 2 - 0.6), z = (p.r(310 + i) - 0.5) * (hd * 2 - 0.6), hh = 0.4 + p.r(320 + i) * 0.9;
    mb.cyl(x, top, z, 0.16, 0.02, hh, 5, { layer: salt, emissive: 0.4, tint: [0.9, 1.1, 1.05] });
  }
  light(ctx, [0, 1.5, hd + 0.4], [0.6, 1, 0.9], 5, 0.9, "glow");
};

export const driftshack: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "ground2"), 0.05);
  const deckY = 0.9, hw = W / 2 - 0.25, hd = D / 2 - 0.25;
  const drift = L(ctx, "wood");
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as const) mb.cyl(x, 0, z, 0.1, 0.09, deckY + 0.1, 6, { layer: drift, tint: [0.8, 0.78, 0.74] });
  mb.box(0, deckY - 0.1, 0, W - 0.3, 0.1, D - 0.3, { layer: drift, tint: [0.9, 0.86, 0.8] }, "tnsew");
  const bw = W - 1.3, bd = D - 1.2;
  for (const side of ["s", "e", "n", "w"] as const) {
    const len = side === "s" || side === "n" ? bw : bd;
    const P = wallP(side, bw / 2, bd / 2, -0.2, -0.2);
    const ops: Op[] = side === "s" ? [{ u: -len / 4, w: 0.8, v0: 0, v1: 1.85, kind: "door", head: "flat", door: "plank" }, { u: len / 4, w: 0.55, v0: 0.9, v1: 1.5, kind: "win", head: "flat", lit: lit(p, 1), mull: "cross", boarded: p.r(5) < 0.3 }] : [{ u: 0, w: 0.5, v0: 0.9, v1: 1.4, kind: "win", head: "flat", mull: "cross" }];
    facade(mb, { P, u0: -len / 2, u1: len / 2, y0: deckY, y1: deckY + 2.1, ops, wall: { layer: L(ctx, "a_batten"), tint: [0.75, 0.78, 0.8] }, mats: M.fm, st: p.st, seed: p.b.seed, mobile: mob(ctx) });
  }
  roof(mb, { x0: -bw / 2 - 0.2, x1: bw / 2 - 0.2, z0: -bd / 2 - 0.2, z1: bd / 2 - 0.2, y: deckY + 2.1, kind: "shed", pitch: 0.3, eave: [0.4, 0.2, 0.2, 0.2], alongX: true, mat: L(ctx, "a_corr"), trim: drift, gable: L(ctx, "a_batten"), soffit: drift, seed: p.b.seed, snow: M.snow, mobile: mob(ctx) });
  // Nets, buoys, rope railing, crab pots.
  if (!mob(ctx)) {
    mb.quad([bw / 2 - 0.1, deckY + 0.3, bd / 2 - 0.1], [bw / 2 - 0.1, deckY + 0.3, -bd / 2 + 0.3], [bw / 2 - 0.1, deckY + 1.9, -bd / 2 + 0.3], [bw / 2 - 0.1, deckY + 1.9, bd / 2 - 0.1], { layer: L(ctx, "grass"), tint: [0.6, 0.55, 0.5], doubleSided: true });
    for (let i = 0; i < 3; i++) mb.blob(bw / 2 + 0.05, deckY + 0.6 + i * 0.45, -0.4 + i * 0.4, 0.13, 0.13, 0.13, { layer: M.fm.cloth, tint: i % 2 ? [1.4, 0.5, 0.4] : [1.3, 1.2, 1.1] });
  }
  tube(mb, [-hw, deckY + 0.7, hd], [hw, deckY + 0.7, hd], 0.025, 4, { layer: M.cm.cloth2 });
  for (let i = 0; i < 4; i++) mb.box(hw - 0.4, deckY - 0.25 * (i + 1), hd + 0.15 + i * 0.12, 0.7, 0.05, 0.14, { layer: drift });
  crate(mb, -hw + 0.35, deckY, hd - 0.3, M.cm, 0.8);
  lantern(ctx, wallP("s", bw / 2, bd / 2, -0.2, -0.2), bw / 2 - 0.3, deckY + 1.9, { metal: M.fm.metal, lit: M.fm.lit }, 4.5);
};

export const umbrellahouse: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "ground2"), 0.1);
  const r = Math.min(W, D) / 2 - 0.6;
  const adobe = L(ctx, "wall");
  mb.cyl(0, 0.1, 0, r, r, 2.3, 12, { layer: adobe, tint: p.tint as V3 }, false);
  mb.cyl(0, 2.35, 0, r, r, 0.02, 12, { layer: adobe });
  mb.quad([-0.45, 0.1, r + 0.02], [0.45, 0.1, r + 0.02], [0.45, 2.0, r + 0.02], [-0.45, 2.0, r + 0.02], { layer: M.fm.door });
  for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + (i + 1) * 1.4; mb.push(90 - a * 180 / Math.PI, Math.cos(a) * r, 0, Math.sin(a) * r); mb.quad([-0.3, 1.1, 0.03], [0.3, 1.1, 0.03], [0.3, 1.6, 0.03], [-0.3, 1.6, 0.03], { layer: lit(p, i) ? M.fm.lit : M.fm.glass, emissive: lit(p, i) ? 1 : 0 }); mb.pop(); }
  // Giant umbrella canopy: 8 scalloped panels on ribs.
  const R = Math.min(W, D) / 2 + 0.2, hub = 4.4, rim = 2.9, n = 8;
  const canvas = L(ctx, "a_awning");
  mb.cyl(0, 2.35, 0, 0.09, 0.09, hub - 2.3 + 0.6, 6, { layer: M.fm.metal });
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const A: V3 = [Math.cos(a0) * R, rim, Math.sin(a0) * R], B: V3 = [Math.cos(a1) * R, rim, Math.sin(a1) * R], T: V3 = [0, hub, 0];
    const Mm: V3 = [Math.cos(am) * R * 0.9, rim + 0.25, Math.sin(am) * R * 0.9];
    triOut(mb, A, Mm, T, [Math.cos(am), 1, Math.sin(am)], { layer: canvas, tint: i % 2 ? [1, 1, 1] : [1.05, 1.05, 1.05], uvs: undefined });
    triOut(mb, Mm, B, T, [Math.cos(am), 1, Math.sin(am)], { layer: canvas });
    mb.beam(A, T, 0.05, { layer: M.fm.metal, tint: [1.1, 0.95, 0.6] });
    mb.beam([A[0] * 0.55, rim + 0.7, A[2] * 0.55], [0, 2.5, 0], 0.03, { layer: M.fm.metal });
  }
  // Handle (crook) above.
  mb.cyl(0, hub, 0, 0.07, 0.07, 0.9, 6, { layer: M.fm.dark });
  for (let k = 0; k < 6; k++) { const a0 = (k / 6) * Math.PI, a1 = ((k + 1) / 6) * Math.PI; mb.beam([0.3 - Math.cos(a0) * 0.3, hub + 0.9 + Math.sin(a0) * 0.3, 0], [0.3 - Math.cos(a1) * 0.3, hub + 0.9 + Math.sin(a1) * 0.3, 0], 0.08, { layer: M.fm.dark }); }
  light(ctx, [0, 2.2, r + 0.5], ctx.lampColor, 5, 0.9, "wall");
  pot(mb, r * 0.8, 0.1, r * 0.9, M.cm);
};

export const corkhouse: SB = (ctx, p, M) => {
  const mb = ctx.mb, r = Math.min(p.W, p.D) / 2 - 0.35;
  pad(mb, p, M.fm.stone, 0.2);
  const cork = L(ctx, "a_cork");
  const h = 2.8 + (p.b.floors > 1 ? 1.8 : 0);
  mb.cyl(0, 0.2, 0, r * 0.94, r, h, 14, { layer: cork }, false);
  mb.cyl(0, 0.2 + h, 0, r, r, 0.02, 14, { layer: cork });
  // Wire cage (muselet) + metal cap.
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; mb.beam([Math.cos(a) * r * 1.01, 0.8, Math.sin(a) * r * 1.01], [Math.cos(a) * r * 1.01, 0.2 + h, Math.sin(a) * r * 1.01], 0.04, { layer: M.fm.metal }); mb.beam([Math.cos(a) * r, 0.2 + h + 0.02, Math.sin(a) * r], [0, 0.2 + h + 0.35, 0], 0.04, { layer: M.fm.metal }); }
  ring(mb, 0, 0.8, 0, r * 1.0, r * 1.04, 14, { layer: M.fm.metal });
  mb.cyl(0, 0.2 + h + 0.3, 0, r * 0.5, r * 0.5, 0.12, 10, { layer: M.fm.metal, tint: [1.2, 1.05, 0.6] });
  mb.cyl(0, 0.2 + h + 0.42, 0, r * 0.5, r * 0.45, 0.06, 10, { layer: M.fm.metal, tint: [1.2, 1.05, 0.6] });
  mb.quad([-0.45, 0.2, r + 0.02], [0.45, 0.2, r + 0.02], [0.45, 2.1, r + 0.02], [-0.45, 2.1, r + 0.02], { layer: M.fm.door });
  mb.box(0, 2.1, r + 0.05, 1.1, 0.12, 0.12, { layer: M.fm.wood });
  for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + (i + 1) * 1.5, y = 1.2 + (i % 2) * 1.3; mb.push(90 - a * 180 / Math.PI, Math.cos(a) * r, 0, Math.sin(a) * r); const rr = 0.26; for (let k = 0; k < 10; k++) { const a0 = (k / 10) * Math.PI * 2, a1 = ((k + 1) / 10) * Math.PI * 2; mb.tri([0, y, 0.03], [Math.cos(a0) * rr, y + Math.sin(a0) * rr, 0.03], [Math.cos(a1) * rr, y + Math.sin(a1) * rr, 0.03], { layer: lit(p, i) ? M.fm.lit : M.fm.glass, emissive: lit(p, i) ? 1 : 0 }); } mb.pop(); }
  tube(mb, [r * 0.9, 0.2 + h - 0.3, r * 0.3], [p.W / 2 - 0.1, 0.3, p.D / 2 - 0.1], 0.03, 4, { layer: M.cm.cloth2 });
  lantern(ctx, (u, v, t = 0) => [u, v, r + t], 0.8, 2.1, { metal: M.fm.metal, lit: M.fm.lit });
};

export const bottledome: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D, r = Math.min(W, D) / 2 - 0.25;
  pad(mb, p, M.fm.stone, 0.2);
  // Little house inside a glass bottle lying on its side? (upright dome + neck + cork).
  body(ctx, p, M, r * 1.0, r * 0.9, 0.2, 1.9, L(ctx, "a_plaster"), { door: "plank" });
  roof(mb, { x0: -r / 2, x1: r / 2, z0: -r * 0.45, z1: r * 0.45, y: 2.1, kind: "gable", pitch: 0.9, eave: [0.2, 0.2, 0.2, 0.2], alongX: true, mat: L(ctx, "a_roof2"), trim: M.fm.wood, gable: L(ctx, "a_plaster"), soffit: M.fm.wood, seed: p.b.seed, mobile: mob(ctx) });
  mb.cyl(0, 0.2, 0, r, r, 0.3, 16, { layer: M.fm.stone });
  const glass = M.fm.glass;
  lathe(mb, 0, 0.5, 0, [[r, 0], [r, 1.6], [r * 0.92, 2.6], [r * 0.6, 3.2], [0.45, 3.5], [0.45, 4.3]], 16, { layer: glass, tint: [0.9, 1.05, 1.0], emissive: 0.1 }, false);
  mb.cyl(0, 4.8, 0, 0.5, 0.46, 0.6, 10, { layer: L(ctx, "a_cork") });
  light(ctx, [0, 1.6, 0], ctx.lampColor, 5, 1, "interior");
  tube(mb, [0.45, 4.6, 0], [W / 2 - 0.2, 0.3, D / 2 - 0.2], 0.025, 4, { layer: M.cm.cloth2 });
};

export const lighthouse: SB = (ctx, p, M) => {
  const mb = ctx.mb;
  mb.bevelBox(0, -0.3, 0, p.W, 0.7, p.D, 0.06, { layer: M.fm.stone });
  const r0 = Math.min(p.W, p.D) / 2 - 0.5, r1 = r0 * 0.7, h = 8.0;
  const bands = 4, white = L(ctx, "a_plaster");
  for (let i = 0; i < bands; i++) {
    const y0 = 0.4 + (h * i) / bands, y1 = 0.4 + (h * (i + 1)) / bands;
    const ra = r0 + (r1 - r0) * (i / bands), rb = r0 + (r1 - r0) * ((i + 1) / bands);
    mb.cyl(0, y0, 0, ra, rb, y1 - y0, 12, { layer: white, tint: i % 2 ? [1.3, 0.45, 0.4] : [1.05, 1.05, 1.05] }, false);
  }
  mb.quad([-0.4, 0.4, r0 + 0.02], [0.4, 0.4, r0 + 0.02], [0.4, 2.3, r0 - 0.05], [-0.4, 2.3, r0 - 0.05], { layer: M.fm.door });
  for (let k = 0; k < 3; k++) { const y = 3 + k * 1.8, rr = r0 + (r1 - r0) * ((y - 0.4) / h); mb.quad([-0.2, y, rr + 0.01], [0.2, y, rr + 0.01], [0.2, y + 0.6, rr], [-0.2, y + 0.6, rr], { layer: lit(p, k) ? M.fm.lit : M.fm.glass, emissive: lit(p, k) ? 1 : 0 }); }
  const gy = 0.4 + h;
  mb.cyl(0, gy, 0, r1 + 0.5, r1 + 0.5, 0.18, 12, { layer: M.fm.metal });
  const gp = { layer: M.fm.metal };
  for (let i = 0; i < 16; i++) { const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2; mb.box(Math.cos(a0) * (r1 + 0.45), gy + 0.18, Math.sin(a0) * (r1 + 0.45), 0.04, 0.7, 0.04, gp); mb.beam([Math.cos(a0) * (r1 + 0.45), gy + 0.88, Math.sin(a0) * (r1 + 0.45)], [Math.cos(a1) * (r1 + 0.45), gy + 0.88, Math.sin(a1) * (r1 + 0.45)], 0.04, gp); }
  mb.cyl(0, gy + 0.18, 0, r1 * 0.75, r1 * 0.75, 1.4, 10, { layer: M.fm.lit, emissive: 1 }, false);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; mb.box(Math.cos(a) * r1 * 0.75, gy + 0.18, Math.sin(a) * r1 * 0.75, 0.06, 1.4, 0.06, gp); }
  mb.cyl(0, gy + 1.58, 0, r1 * 0.9, 0.1, 0.9, 10, { layer: M.fm.metal, tint: [1.2, 0.45, 0.4] });
  mb.cyl(0, gy + 2.45, 0, 0.1, 0.02, 0.5, 6, { layer: M.fm.metal });
  light(ctx, [0, gy + 0.9, 0], [1, 0.95, 0.7], 12, 1.6, "beacon");
  // Keeper's lean-to.
  const kx = p.W / 2 - 1.1;
  mb.box(kx, 0.4, -0.6, 1.4, 1.9, 2.2, { layer: white });
  roof(mb, { x0: kx - 0.7, x1: kx + 0.7, z0: -1.7, z1: 0.5, y: 2.3, kind: "gable", pitch: 0.7, eave: [0.2, 0.2, 0.2, 0.2], alongX: false, mat: M.R, trim: M.fm.wood, gable: white, soffit: M.fm.wood, seed: p.b.seed, mobile: mob(ctx) });
};

/** Shrine (honden): raised hall, gable roof with chigi, shimenawa rope, gate in front, cyber accents. */
export const shrine: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  mb.bevelBox(0, -0.3, 0, W, 0.8, D, 0.05, { layer: M.fm.stone });
  const hw = W / 2 - 0.9, hd = D / 2 - 1.3, cz = -0.5, y0 = 0.9;
  mb.box(0, 0.5, cz, hw * 2 + 0.8, 0.4, hd * 2 + 0.8, { layer: M.fm.wood }, "tnsew");
  for (const [x, z] of [[-hw - 0.3, cz - hd - 0.3], [hw + 0.3, cz - hd - 0.3], [hw + 0.3, cz + hd + 0.3], [-hw - 0.3, cz + hd + 0.3]] as const) mb.cyl(x, 0.5, z, 0.08, 0.08, 1.2, 6, { layer: M.F });
  for (const side of ["s", "e", "n", "w"] as const) {
    const len = side === "s" || side === "n" ? hw * 2 : hd * 2;
    const P = wallP(side, hw, hd, 0, cz);
    const ops: Op[] = side === "s" ? [{ u: 0, w: Math.min(1.8, len - 0.6), v0: 0, v1: 2.1, kind: "door", head: "flat", door: "sliding", lit: true }] : [];
    facade(mb, { P, u0: -len / 2, u1: len / 2, y0, y1: y0 + 2.4, ops, wall: { layer: M.F }, mats: M.fm, st: p.st, seed: p.b.seed, mobile: mob(ctx) });
    for (const u of [-len / 2 + 0.08, len / 2 - 0.08]) wbox(mb, P, u - 0.09, u + 0.09, y0, y0 + 2.4, 0, 0.09, { layer: M.fm.dark }, "flr");
  }
  const info = roof(mb, { x0: -hw, x1: hw, z0: cz - hd, z1: cz + hd, y: y0 + 2.4, kind: "gable", pitch: 0.95, eave: [0.9, 0.6, 0.5, 0.5], alongX: true, mat: M.R, trim: M.fm.dark, gable: M.F, soffit: M.F, rafters: true, seed: p.b.seed, snow: M.snow, mobile: mob(ctx) });
  // Chigi (crossed finials) + katsuogi logs on the ridge.
  for (const sx of [-1, 1]) { mb.beam([sx * (hw + 0.5), info.ridgeY - 0.1, cz], [sx * (hw + 0.8), info.ridgeY + 0.9, cz + 0.35], 0.1, { layer: M.fm.dark }); mb.beam([sx * (hw + 0.5), info.ridgeY - 0.1, cz], [sx * (hw + 0.8), info.ridgeY + 0.9, cz - 0.35], 0.1, { layer: M.fm.dark }); }
  for (let i = 0; i < 4; i++) tube(mb, [-hw * 0.6 + i * hw * 0.4, info.ridgeY + 0.12, cz - 0.3], [-hw * 0.6 + i * hw * 0.4, info.ridgeY + 0.12, cz + 0.3], 0.1, 6, { layer: M.fm.brass }, true);
  // Shimenawa rope + paper streamers.
  const zr = cz + hd + 0.35;
  for (let k = 0; k < 8; k++) { const t0 = k / 8, t1 = (k + 1) / 8; tube(mb, [-hw + 2 * hw * t0, y0 + 2.2 - Math.sin(t0 * Math.PI) * 0.25, zr], [-hw + 2 * hw * t1, y0 + 2.2 - Math.sin(t1 * Math.PI) * 0.25, zr], 0.09, 5, { layer: M.cm.cloth2, tint: [1.1, 1.0, 0.75] }); }
  for (let k = 1; k < 4; k++) { const x = -hw + (2 * hw * k) / 4; mb.quad([x - 0.06, y0 + 1.5, zr + 0.05], [x + 0.06, y0 + 1.5, zr + 0.05], [x + 0.06, y0 + 2.0, zr + 0.05], [x - 0.06, y0 + 2.0, zr + 0.05], { layer: L(ctx, "paper"), doubleSided: true, wind: true }); }
  // Torii gate at the front of the lot.
  const tz = D / 2 - 0.35, tw = Math.min(W - 0.6, 3.0);
  for (const sx of [-1, 1]) mb.cyl(sx * tw / 2, 0.5, tz, 0.14, 0.12, 3.0, 8, { layer: M.F });
  mb.box(0, 3.3, tz, tw + 1.0, 0.22, 0.3, { layer: M.fm.dark });
  mb.box(0, 3.1, tz, tw + 0.7, 0.22, 0.26, { layer: M.F });
  mb.box(0, 2.6, tz, tw + 0.2, 0.16, 0.18, { layer: M.F });
  // Offering box + cyber accents.
  mb.box(0, y0, cz + hd + 0.6, 1.0, 0.6, 0.5, { layer: M.fm.dark });
  if (p.kit.deco.includes("neon") || p.kit.deco.includes("cables")) {
    for (const sx of [-1, 1]) mb.box(sx * (tw / 2), 0.9, tz + 0.15, 0.05, 2.0, 0.03, { layer: L(ctx, "a_neon"), emissive: 1, tint: [0.4, 1.2, 1.3] });
    tube(mb, [-hw, y0 + 2.3, cz - hd], [-W / 2 + 0.3, 0.6, -D / 2 + 0.3], 0.05, 4, { layer: M.fm.dark });
    tube(mb, [hw, y0 + 2.3, cz - hd], [W / 2 - 0.3, 0.6, -D / 2 + 0.4], 0.05, 4, { layer: M.fm.dark });
    mb.box(W / 2 - 0.5, 0.5, -D / 2 + 0.5, 0.6, 1.0, 0.5, { layer: M.fm.metal, tint: [0.7, 0.75, 0.8] });
  }
  paperLantern(ctx, [-hw - 0.3, y0 + 2.1, cz + hd + 0.7], M.fm.cloth, M.fm.dark, 0.2);
  paperLantern(ctx, [hw + 0.3, y0 + 2.1, cz + hd + 0.7], M.fm.cloth, M.fm.dark, 0.2, false);
};

export const circustent: SB = (ctx, p, M) => {
  const mb = ctx.mb, R = Math.min(p.W, p.D) / 2 - 0.35;
  pad(mb, p, L(ctx, "ground2"), 0.08);
  const canvas = L(ctx, "a_awning"), n = 12;
  const wallH = 2.2, eaveR = R, midR = R * 0.55, top = 7.5;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const P = (a: number, r: number, y: number): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];
    const door = Math.abs(((am - Math.PI / 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.3;
    if (!door) quadOut(mb, P(a0, eaveR * 0.95, 0.08), P(a1, eaveR * 0.95, 0.08), P(a1, eaveR * 0.95, wallH), P(a0, eaveR * 0.95, wallH), [Math.cos(am), 0, Math.sin(am)], { layer: canvas, uvs: [[0, 1], [1, 1], [1, 0], [0, 0]] });
    // Scalloped valance + two-stage roof.
    quadOut(mb, P(a0, eaveR, wallH + 0.1), P(a1, eaveR, wallH + 0.1), P(a1, midR, top * 0.62), P(a0, midR, top * 0.62), [Math.cos(am), 0.8, Math.sin(am)], { layer: canvas, uvs: [[0, 1], [1, 1], [1, 0], [0, 0]] });
    triOut(mb, P(a0, midR, top * 0.62), P(a1, midR, top * 0.62), [0, top, 0], [Math.cos(am), 0.6, Math.sin(am)], { layer: canvas, uvs: [[0, 1], [1, 1], [0.5, 0]] });
    triOut(mb, P(a0, eaveR, wallH + 0.1), P(a1, eaveR, wallH + 0.1), P(am, eaveR * 1.02, wallH - 0.35), [Math.cos(am), -0.2, Math.sin(am)], { layer: M.fm.cloth, tint: [1.3, 1.1, 0.4] });
    mb.beam(P(a0, eaveR, wallH + 0.1), P(a0, midR, top * 0.62), 0.05, { layer: M.fm.brass });
    if (i % 2 === 0) { mb.beam(P(a0, eaveR * 0.95, 0), P(a0, eaveR * 0.95, wallH + 0.1), 0.08, { layer: M.fm.wood }); tube(mb, P(a0, eaveR, wallH), P(a0, eaveR + 0.9, 0.05), 0.015, 3, { layer: M.cm.cloth2 }); }
  }
  // Entrance canopy.
  const ez = R * 0.95;
  mb.quad([-0.8, 0.08, ez - 0.1], [0.8, 0.08, ez - 0.1], [0.8, 2.1, ez - 0.1], [-0.8, 2.1, ez - 0.1], { layer: M.fm.dark, tint: [0.25, 0.15, 0.15] });
  for (const sx of [-1, 1]) mb.cyl(sx * 0.9, 0.08, ez + 0.9, 0.05, 0.05, 2.6, 6, { layer: M.fm.brass });
  quadOut(mb, [-1.0, 2.7, ez + 1.0], [1.0, 2.7, ez + 1.0], [1.0, 3.1, ez - 0.2], [-1.0, 3.1, ez - 0.2], [0, 1, 0.3], { layer: canvas, doubleSided: true });
  // Pole + flags + bunting to lot corners.
  mb.cyl(0, top - 0.3, 0, 0.06, 0.04, 1.6, 6, { layer: M.fm.brass });
  mb.quad([0, top + 0.9, 0], [0.8, top + 1.0, 0], [0.8, top + 1.3, 0], [0, top + 1.3, 0], { layer: M.fm.cloth, doubleSided: true, wind: true, tint: [1.3, 0.4, 0.4] });
  for (const [x, z] of [[-p.W / 2 + 0.2, p.D / 2 - 0.2], [p.W / 2 - 0.2, p.D / 2 - 0.2]] as const) {
    mb.cyl(x, 0.08, z, 0.04, 0.04, 2.6, 4, { layer: M.fm.wood });
    for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6; const A: V3 = [x + (0 - x) * t0, 2.6 + (top * 0.62 - 2.6) * t0 - Math.sin(t0 * Math.PI) * 0.5, z + (0 - z) * t0], B: V3 = [x + (0 - x) * t1, 2.6 + (top * 0.62 - 2.6) * t1 - Math.sin(t1 * Math.PI) * 0.5, z + (0 - z) * t1]; mb.beam(A, B, 0.015, { layer: M.fm.dark }); mb.tri(A, B, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 0.25, (A[2] + B[2]) / 2], { layer: M.fm.cloth, doubleSided: true, tint: k % 2 ? [1.3, 1.1, 0.4] : [0.5, 0.7, 1.3] }); }
  }
  light(ctx, [0, 2.4, ez + 0.6], ctx.lampColor, 6, 1.1, "wall");
  for (let i = 0; i < 6; i++) { const a = Math.PI / 2 + (i - 2.5) * 0.35; mb.box(Math.cos(a) * (R + 0.02), wallH - 0.15, Math.sin(a) * (R + 0.02), 0.1, 0.1, 0.1, { layer: M.fm.lit, emissive: 1 }); }
};

export const prismchapel: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  mb.bevelBox(0, -0.3, 0, W, 0.7, D, 0.05, { layer: M.fm.stone });
  const hw = W / 2 - 0.5, hd = D / 2 - 0.5, H = 4.6;
  const glass = L(ctx, "a_crystal");
  for (const sg of [-1, 1]) {
    quadOut(mb, [sg * hw, 0.4, -hd], [sg * hw, 0.4, hd], [0, 0.4 + H, hd], [0, 0.4 + H, -hd], [sg, 0.5, 0], { layer: glass, emissive: 0.45, tint: [1.0, 1.05, 1.15] });
    for (let i = 0; i <= 4; i++) { const z = -hd + (2 * hd * i) / 4; mb.beam([sg * hw, 0.4, z], [0, 0.4 + H, z], 0.1, { layer: M.fm.stone }); }
  }
  for (const sz of [-1, 1]) {
    triOut(mb, [-hw, 0.4, sz * hd], [hw, 0.4, sz * hd], [0, 0.4 + H, sz * hd], [0, 0, sz], { layer: glass, emissive: 0.55, tint: [1.1, 1.0, 1.15] });
    mb.beam([-hw, 0.4, sz * hd], [0, 0.4 + H, sz * hd], 0.14, { layer: M.fm.stone });
    mb.beam([hw, 0.4, sz * hd], [0, 0.4 + H, sz * hd], 0.14, { layer: M.fm.stone });
  }
  mb.beam([0, 0.4 + H, -hd], [0, 0.4 + H, hd], 0.16, { layer: M.fm.stone });
  // Rose window + door + spire.
  const rz = hd + 0.02;
  for (let k = 0; k < 12; k++) { const a0 = (k / 12) * Math.PI * 2, a1 = ((k + 1) / 12) * Math.PI * 2; mb.tri([0, 2.9, rz + 0.02], [Math.cos(a0) * 0.6, 2.9 + Math.sin(a0) * 0.6, rz + 0.02], [Math.cos(a1) * 0.6, 2.9 + Math.sin(a1) * 0.6, rz + 0.02], { layer: M.fm.lit, emissive: 1, tint: k % 2 ? [1.2, 0.7, 1.1] : [0.7, 1.0, 1.3] }); mb.beam([0, 2.9, rz + 0.04], [Math.cos(a0) * 0.6, 2.9 + Math.sin(a0) * 0.6, rz + 0.04], 0.04, { layer: M.fm.stone }); }
  mb.quad([-0.5, 0.4, rz + 0.03], [0.5, 0.4, rz + 0.03], [0.5, 2.1, rz + 0.03], [-0.5, 2.1, rz + 0.03], { layer: M.fm.door });
  mb.cyl(0, 0.4 + H, hd - 0.4, 0.3, 0.02, 2.2, 4, { layer: glass, emissive: 0.6 });
  light(ctx, [0, 2, 0], ctx.glowColor, 7, 1.2, "glow");
  if (p.kit.deco.includes("candles")) for (let i = 0; i < 6; i++) { const x = -hw + 0.3 + i * 0.35; mb.cyl(x, 0.4, hd + 0.4, 0.05, 0.05, 0.3, 6, { layer: L(ctx, "paper") }); mb.box(x, 0.7, hd + 0.4, 0.04, 0.08, 0.04, { layer: M.fm.lit, emissive: 1 }); }
};

export const crttower: SB = (ctx, p, M) => {
  const mb = ctx.mb;
  pad(mb, p, M.fm.stone, 0.2);
  let y = 0.2;
  const s0 = Math.min(p.W, p.D) - 1.0;
  for (let i = 0; i < 7; i++) {
    const s = s0 * (1 - i * 0.07), h = s * 0.62;
    mb.push((p.r(400 + i) - 0.5) * 26, (p.r(410 + i) - 0.5) * 0.2, y, (p.r(420 + i) - 0.5) * 0.2);
    mb.bevelBox(0, 0, 0, s, h, s * 0.8, 0.06, { layer: M.fm.metal, tint: i % 2 ? [0.8, 0.78, 0.74] : [0.55, 0.52, 0.5] });
    for (const [yaw, dz] of [[0, s * 0.4], [180, s * 0.4]] as const) { mb.push(yaw, 0, 0, 0); mb.quad([-s * 0.38, h * 0.14, dz + 0.01], [s * 0.38, h * 0.14, dz + 0.01], [s * 0.38, h * 0.86, dz + 0.01], [-s * 0.38, h * 0.86, dz + 0.01], { layer: L(ctx, "a_neon"), emissive: 1, uvs: [[p.r(430 + i) * 0.5, 1], [p.r(430 + i) * 0.5 + 0.5, 1], [p.r(430 + i) * 0.5 + 0.5, 0], [p.r(430 + i) * 0.5, 0]] }); mb.pop(); }
    mb.pop();
    y += h;
  }
  tube(mb, [0, y, 0], [0.4, y + 1.2, 0], 0.03, 4, { layer: M.fm.metal });
  tube(mb, [0, y, 0], [-0.4, y + 1.1, 0.1], 0.03, 4, { layer: M.fm.metal });
  mb.box(0, y, 0, 0.5, 0.3, 0.5, { layer: M.fm.lit, emissive: 1 });
  light(ctx, [0, y + 0.3, 0], ctx.glowColor, 10, 1.4, "beacon");
  mb.quad([-0.4, 0.2, s0 * 0.4 + 0.02], [0.4, 0.2, s0 * 0.4 + 0.02], [0.4, 1.8, s0 * 0.4 + 0.02], [-0.4, 1.8, s0 * 0.4 + 0.02], { layer: M.fm.door });
};

export const scrapstilt: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "ground2"), 0.08);
  const y0 = 1.6, hw = W / 2 - 0.4, hd = D / 2 - 0.5;
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as const) mb.beam([x * 1.1, 0.05, z * 1.1], [x, y0, z], 0.12, { layer: M.fm.metal, tint: [0.8, 0.6, 0.45] });
  mb.box(0, y0 - 0.12, 0, hw * 2 + 0.4, 0.12, hd * 2 + 0.4, { layer: M.fm.metal }, "tnsew");
  // Patched panels in varied tints.
  const corr = L(ctx, "a_corr"), tints: V3[] = [[1.2, 0.65, 0.45], [0.7, 0.85, 1.05], [1.05, 1.0, 0.8], [0.8, 0.8, 0.8]];
  body(ctx, p, M, hw * 2 - 0.3, hd * 2 - 0.3, y0, 2.3, corr, { door: "plank", tint: tints[Math.floor(p.r(1) * 4)] });
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, x = (p.r(500 + i) - 0.5) * (hw * 2 - 1), y = y0 + 0.3 + p.r(510 + i) * 1.5;
    mb.box(x, y, side * (hd - 0.12), 0.7 + p.r(520 + i) * 0.5, 0.5 + p.r(530 + i) * 0.4, 0.04, { layer: corr, tint: tints[i % 4]! });
  }
  roof(mb, { x0: -hw + 0.15, x1: hw - 0.15, z0: -hd + 0.15, z1: hd - 0.15, y: y0 + 2.3, kind: "shed", pitch: 0.35, eave: [0.35, 0.2, 0.25, 0.25], alongX: true, mat: corr, trim: M.fm.metal, gable: corr, soffit: M.fm.metal, seed: p.b.seed, mobile: mob(ctx) });
  // Antenna, solar panel, ladder.
  tube(mb, [hw - 0.4, y0 + 3.0, -hd + 0.4], [hw - 0.4, y0 + 5.0, -hd + 0.4], 0.03, 4, { layer: M.fm.metal });
  for (const yy of [4.2, 4.6]) mb.box(hw - 0.4, y0 + yy, -hd + 0.4, 0.8, 0.03, 0.03, { layer: M.fm.metal });
  obox(mb, [-hw * 0.3, y0 + 3.2, 0], [1, 0, 0], [0, 0.87, 0.5], [0, -0.5, 0.87], 0.7, 0.03, 0.5, { layer: M.fm.glass, tint: [0.4, 0.5, 0.9] });
  for (let i = 0; i < 5; i++) mb.box(hw + 0.1, 0.25 + i * 0.3, hd + 0.2, 0.5, 0.04, 0.05, { layer: M.fm.metal });
  drum(mb, -hw, 0.08, hd + 0.3, M.cm, [1.2, 0.5, 0.35]);
  lantern(ctx, wallP("s", hw - 0.15, hd - 0.15), -hw * 0.5, y0 + 2.0, { metal: M.fm.metal, lit: M.fm.lit }, 4.5);
};

export const hexhive: SB = (ctx, p, M) => {
  const mb = ctx.mb, r = Math.min(p.W, p.D) / 2 - 0.4;
  pad(mb, p, L(ctx, "wall"), 0.15);
  const wax = L(ctx, "wall"), n = Math.max(2, p.b.floors);
  for (let i = 0; i < n; i++) {
    const rr = r * (1 - i * 0.12), y = 0.15 + i * 2.3;
    mb.cyl(0, y, 0, rr, rr, 2.2, 6, { layer: wax, tint: [1.1, 1.0, 0.8] }, true, { layer: wax, tint: [0.95, 0.85, 0.6] });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6, fz = rr * Math.cos(Math.PI / 6);
      mb.push(90 - a * 180 / Math.PI, Math.cos(a) * fz, 0, Math.sin(a) * fz);
      const hr = 0.36;
      for (let j = 0; j < 6; j++) { const a0 = (j / 6) * Math.PI * 2, a1 = ((j + 1) / 6) * Math.PI * 2; mb.tri([0, y + 1.2, 0.02], [Math.cos(a0) * hr, y + 1.2 + Math.sin(a0) * hr, 0.02], [Math.cos(a1) * hr, y + 1.2 + Math.sin(a1) * hr, 0.02], { layer: M.fm.lit, emissive: p.r(800 + i * 6 + k) < 0.6 ? 1 : 0.2, tint: [1.2, 0.9, 0.5] }); }
      mb.pop();
    }
  }
  mb.quad([-0.4, 0.15, r * 0.866 + 0.03], [0.4, 0.15, r * 0.866 + 0.03], [0.4, 1.9, r * 0.866 + 0.03], [-0.4, 1.9, r * 0.866 + 0.03], { layer: M.fm.door });
  mb.blob(0, 0.15 + n * 2.3 + 0.1, 0, r * 0.5, 0.4, r * 0.5, { layer: wax, tint: [1.2, 1.0, 0.7] }, 1, 0.2);
  light(ctx, [0, 1.3, r], ctx.lampColor, 5, 1, "wall");
};

export const ribhouse: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "wall2"), 0.15);
  const hw = W / 2 - 0.4, hd = D / 2 - 0.4;
  const skin = L(ctx, "wall"), bone = L(ctx, "wall2");
  // Membrane vault along x with rib arches.
  const segs = 7, n = Math.max(3, Math.round(hw * 2 / 0.9));
  for (let i = 0; i < n; i++) {
    const x0 = -hw + (2 * hw * i) / n, x1 = -hw + (2 * hw * (i + 1)) / n;
    for (let j = 0; j < segs; j++) {
      const a0 = Math.PI * (j / segs), a1 = Math.PI * ((j + 1) / segs);
      const P = (x: number, a: number): V3 => [x, 0.15 + Math.sin(a) * 2.8, Math.cos(a) * hd];
      quadOut(mb, P(x0, a0), P(x1, a0), P(x1, a1), P(x0, a1), [0, Math.sin((a0 + a1) / 2), Math.cos((a0 + a1) / 2)], { layer: skin, emissive: 0.08 });
    }
    for (let j = 0; j < segs; j++) { const a0 = Math.PI * (j / segs), a1 = Math.PI * ((j + 1) / segs); mb.beam([x0, 0.15 + Math.sin(a0) * 2.85, Math.cos(a0) * (hd + 0.05)], [x0, 0.15 + Math.sin(a1) * 2.85, Math.cos(a1) * (hd + 0.05)], 0.16, { layer: bone }); }
  }
  for (const sx of [-1, 1]) { for (let j = 0; j < segs; j++) { const a0 = Math.PI * (j / segs), a1 = Math.PI * ((j + 1) / segs); triOut(mb, [sx * hw, 0.15, 0], [sx * hw, 0.15 + Math.sin(a0) * 2.8, Math.cos(a0) * hd], [sx * hw, 0.15 + Math.sin(a1) * 2.8, Math.cos(a1) * hd], [sx, 0, 0], { layer: skin }); } }
  mb.quad([-0.45, 0.15, hd * 0.98], [0.45, 0.15, hd * 0.98], [0.45, 1.8, hd * 0.6], [-0.45, 1.8, hd * 0.6], { layer: M.fm.dark, tint: [0.35, 0.15, 0.15] });
  for (let i = 0; i < 4; i++) mb.blob(-hw + 0.5 + i * (hw * 0.6), 2.9, 0, 0.2, 0.2, 0.2, { layer: M.fm.lit, emissive: 1, tint: [0.8, 1.3, 0.6] });
  light(ctx, [0, 1.5, hd], ctx.glowColor, 5, 0.9, "glow");
};

export const podtower: SB = (ctx, p, M) => {
  const mb = ctx.mb;
  pad(mb, p, L(ctx, "wall2"), 0.15);
  const wall = L(ctx, "wall");
  mb.cyl(0, 0.15, 0, 0.35, 0.3, 4.5, 8, { layer: L(ctx, "wall2") });
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7, y = 1.2 + i * 1.0, rr = 0.7 + (i % 2) * 0.2;
    mb.blob(Math.cos(a) * 0.6, y, Math.sin(a) * 0.6, rr, rr * 0.8, rr, { layer: wall, tint: [1.05, 1.0, 0.95] }, 1, 0.1, i);
    mb.cyl(Math.cos(a) * (0.6 + rr * 0.9), y, Math.sin(a) * (0.6 + rr * 0.9), 0.18, 0.18, 0.04, 8, { layer: M.fm.lit, emissive: 1 });
  }
  mb.blob(0, 5.0, 0, 0.8, 0.6, 0.8, { layer: wall }, 1, 0.1);
  light(ctx, [0, 3, 0.8], ctx.glowColor, 5, 0.9, "glow");
};

export const subwaycar: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "a_concrete"), 0.1);
  const levels = Math.max(1, Math.min(2, p.b.floors));
  const len = W - 0.4, w = 2.2, h = 2.5;
  for (let lv = 0; lv < levels; lv++) {
    const y = 0.4 + lv * (h + 0.1), off = lv ? (p.r(3) - 0.5) * 0.8 : 0;
    mb.push(0, off, y, 0);
    mb.bevelBox(0, 0, 0, len, h, w, 0.25, { layer: M.fm.metal, tint: [1.05, 1.05, 1.08] });
    mb.box(0, h * 0.3, w / 2 + 0.01, len - 0.3, 0.12, 0.02, { layer: L(ctx, "a_awning"), tint: [0.4, 1.0, 0.95] }, "s");
    const n = Math.floor(len / 1.3);
    for (let i = 0; i < n; i++) { const x = -len / 2 + 0.65 + i * 1.3; mb.quad([x - 0.4, h * 0.45, w / 2 + 0.02], [x + 0.4, h * 0.45, w / 2 + 0.02], [x + 0.4, h * 0.85, w / 2 + 0.02], [x - 0.4, h * 0.85, w / 2 + 0.02], { layer: p.r(900 + i + lv * 10) < 0.5 ? M.fm.lit : M.fm.glass, emissive: p.r(900 + i + lv * 10) < 0.5 ? 1 : 0 }); }
    mb.quad([-0.5, 0, w / 2 + 0.02], [0.5, 0, w / 2 + 0.02], [0.5, h * 0.9, w / 2 + 0.02], [-0.5, h * 0.9, w / 2 + 0.02], { layer: M.fm.dark, tint: [0.5, 0.5, 0.55] });
    mb.pop();
    if (lv === 0) for (const sx of [-len / 3, len / 3]) { mb.box(sx, 0.1, 0, 1.4, 0.3, w - 0.4, { layer: M.fm.metal, tint: [0.4, 0.4, 0.42] }); }
  }
  for (const sz of [-0.7, 0.7]) mb.box(0, 0.1, sz, W - 0.2, 0.06, 0.08, { layer: M.fm.metal });
  light(ctx, [0, 1.8, w / 2 + 0.4], ctx.lampColor, 5, 0.8, "wall");
};

export const flytower: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, M.fm.stone, 0.25);
  body(ctx, p, M, W - 0.6, D - 0.6, 0.25, 3.2, L(ctx, "a_brick"), { door: "double" });
  const s = Math.min(W, D) - 1.6;
  mb.box(0, 3.45, -0.3, s, 5.5, s * 0.8, { layer: L(ctx, "a_brick"), tint: [0.85, 0.8, 0.78] });
  roof(mb, { x0: -s / 2, x1: s / 2, z0: -0.3 - s * 0.4, z1: -0.3 + s * 0.4, y: 8.95, kind: "gable", pitch: 0.5, eave: [0.2, 0.2, 0.2, 0.2], alongX: true, mat: M.R, trim: M.fm.stone, gable: L(ctx, "a_brick"), soffit: M.fm.wood, seed: p.b.seed, mobile: mob(ctx) });
  roof(mb, { x0: -(W - 0.6) / 2, x1: (W - 0.6) / 2, z0: -(D - 0.6) / 2, z1: (D - 0.6) / 2, y: 3.45, kind: "flat", pitch: 0, eave: [0, 0, 0, 0], alongX: true, mat: L(ctx, "a_brick"), trim: M.fm.stone, gable: L(ctx, "a_concrete"), soffit: M.fm.wood, seed: p.b.seed + 1, mobile: true });
  // Marquee with bulbs.
  const PS = wallP("s", (W - 0.6) / 2, (D - 0.6) / 2);
  wbox(mb, PS, -1.4, 1.4, 2.5, 3.0, 0, 0.9, { layer: M.fm.brass }, "ftblr");
  for (let i = 0; i < 10; i++) { const u = -1.3 + i * 0.29, c = PS(u, 2.5, 0.92); mb.box(c[0], c[1] - 0.06, c[2], 0.08, 0.08, 0.08, { layer: M.fm.lit, emissive: 1 }); }
  light(ctx, [0, 2.4, D / 2], ctx.lampColor, 6, 1.1, "wall");
  // Exposed rigging on the fly tower's flank: gridiron outriggers, pulley wheels, ropes and sandbags.
  rigging(ctx, M, s / 2, -0.3 - s * 0.4, -0.3 + s * 0.4, 8.7, 1);
  for (let i = 0; i < 3; i++) { const z = -0.3 - s * 0.3 + i * s * 0.3; mb.box(-s / 2 - 0.03, 4.2 + i * 1.3, z, 0.06, 0.8, 0.5, { layer: L(ctx, "a_poster") }); }
};

export const tesseract: SB = (ctx, p, M) => {
  const mb = ctx.mb, s = Math.min(p.W, p.D) - 1.0;
  pad(mb, p, M.fm.stone, 0.2);
  const frame = M.fm.metal, glow = L(ctx, "a_crystal");
  const cube = (c: V3, h: number, rot: number) => {
    const pts: V3[] = [];
    for (const y of [-h, h]) for (const [x, z] of [[-h, -h], [h, -h], [h, h], [-h, h]] as const) { const cr = Math.cos(rot), sr = Math.sin(rot); pts.push([c[0] + x * cr - z * sr, c[1] + y, c[2] + x * sr + z * cr]); }
    for (let i = 0; i < 4; i++) { mb.beam(pts[i]!, pts[(i + 1) % 4]!, 0.1, { layer: frame }); mb.beam(pts[4 + i]!, pts[4 + (i + 1) % 4]!, 0.1, { layer: frame }); mb.beam(pts[i]!, pts[4 + i]!, 0.1, { layer: frame }); }
    return pts;
  };
  const A = cube([0, 0.2 + s / 2, 0], s / 2, 0), B = cube([0, 0.2 + s / 2, 0], s / 4, 0.6);
  for (let i = 0; i < 8; i++) mb.beam(A[i]!, B[i]!, 0.05, { layer: glow, emissive: 0.8 });
  mb.box(0, 0.2 + s / 2 - s / 8, 0, s / 4, s / 4, s / 4, { layer: glow, emissive: 0.9 });
  light(ctx, [0, 0.2 + s / 2, 0], ctx.glowColor, 7, 1.2, "glow");
};

export const rotunda: SB = (ctx, p, M) => {
  const mb = ctx.mb, R = Math.min(p.W, p.D) / 2 - 0.3;
  mb.cyl(0, -0.3, 0, R, R, 0.8, 16, { layer: M.fm.stone });
  const marble = L(ctx, "a_plaster"), n = 10, h = 3.2, rr = R - 0.45;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; lathe(mb, Math.cos(a) * rr, 0.5, Math.sin(a) * rr, [[0.2, 0], [0.18, 0.2], [0.16, h - 0.3], [0.24, h]], 8, { layer: marble }, true); }
  mb.cyl(0, 0.5 + h, 0, rr + 0.35, rr + 0.35, 0.45, 16, { layer: marble });
  dome(mb, 0, 0.95 + h, 0, rr + 0.25, rr * 0.8, 16, 5, { layer: M.R, tint: [1.1, 1.05, 1.0] });
  mb.cyl(0, 0.95 + h + rr * 0.8, 0, 0.3, 0.3, 0.4, 8, { layer: marble });
  mb.cyl(0, 1.35 + h + rr * 0.8, 0, 0.35, 0.05, 0.6, 8, { layer: M.fm.brass });
  mb.cyl(0, 0.5, 0, 0.5, 0.5, 0.9, 10, { layer: marble });
  if (p.kit.deco.includes("flowers") || p.kit.deco.includes("lace")) { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2; for (let k = 0; k < 4; k++) { const t0 = k / 4, t1 = (k + 1) / 4; const P = (t: number): V3 => { const aa = a + (b - a) * t; return [Math.cos(aa) * (rr + 0.05), 0.5 + h - 0.35 - Math.sin(t * Math.PI) * 0.4, Math.sin(aa) * (rr + 0.05)]; }; tube(mb, P(t0), P(t1), 0.07, 4, { layer: M.cm.cloth2, tint: [1.2, 1.1, 1.15] }); } } }
  light(ctx, [0, 2.4, 0], ctx.lampColor, 6, 1, "wall");
  void fence; void barrel; void crate; void sack;
};
