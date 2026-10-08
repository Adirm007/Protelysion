// Attachments and street clutter for buildings: steps, chimneys, dormers, awnings, hanging signs,
// lanterns (real lights), paper lanterns, banners, noren, neon boxes, barrels, crates, sacks, pots …
import type { FaceOpts, MeshBuilder, V3 } from "../mesh";
import { hash3 } from "../mesh";
import type { Ctx } from "../ground";
import { lathe, tube, wbox, wq, type WallP } from "./geo";

export type Lights = Ctx["lights"];

/** Light in local coordinates → world (kernel bakes it into vertex colours). */
export function light(ctx: Ctx, p: V3, color: [number, number, number], radius: number, intensity: number, kind = "wall") {
  const w = ctx.mb.apply(p[0], p[1], p[2]);
  ctx.lights.push({ x: w[0], y: w[1], z: w[2], color, radius, intensity, kind });
}

/** Stone / timber steps descending from height h to 0 in front of a wall at z = zf, direction +z. */
export function steps(mb: MeshBuilder, x: number, zf: number, w: number, h: number, layer: number, maxDepth = 0.6) {
  if (h < 0.08) return;
  const n = Math.max(1, Math.min(3, Math.round(h / 0.17)));
  const tread = Math.min(0.3, maxDepth / n);
  for (let i = 0; i < n; i++) {
    const top = h * (1 - i / n);
    mb.bevelBox(x, -0.3, zf + tread * (i + 0.5), w + 0.1 * (i + 1), top + 0.3, tread, 0.025, { layer });
  }
}

export function chimney(mb: MeshBuilder, x: number, z: number, y0: number, y1: number, body: number, cap: number, tint?: V3, pots = 2) {
  mb.bevelBox(x, y0, z, 0.62, y1 - y0, 0.62, 0.03, { layer: body, tint });
  mb.bevelBox(x, y1, z, 0.78, 0.14, 0.78, 0.03, { layer: cap });
  for (let i = 0; i < pots; i++) mb.cyl(x - 0.14 + i * 0.28, y1 + 0.14, z, 0.09, 0.08, 0.26, 6, { layer: cap, tint: [1.05, 0.72, 0.55] });
}

/** Gable dormer sitting on a slope: front wall with window, cheeks, little gable roof. */
export function dormer(mb: MeshBuilder, x: number, zWall: number, ySill: number, w: number, depth: number, mats: { wall: number; roof: number; trim: number; glass: number; lit: number }, lit: boolean, tint?: V3, shed = false) {
  const h = 0.95, z0 = zWall - depth;
  mb.box(x, ySill - 0.4, zWall - depth / 2, w, h + 0.4, depth, { layer: mats.wall, tint }, "sew");
  mb.quad([x - w * 0.3, ySill + 0.12, zWall + 0.01], [x + w * 0.3, ySill + 0.12, zWall + 0.01], [x + w * 0.3, ySill + h - 0.12, zWall + 0.01], [x - w * 0.3, ySill + h - 0.12, zWall + 0.01], { layer: lit ? mats.lit : mats.glass, emissive: lit ? 1 : 0, noAO: true });
  mb.box(x, ySill + 0.06, zWall + 0.03, w * 0.7, 0.06, 0.08, { layer: mats.trim });
  mb.box(x, ySill + h - 0.12, zWall + 0.03, w * 0.7, 0.06, 0.06, { layer: mats.trim });
  mb.box(x, ySill + 0.12, zWall + 0.03, 0.05, h - 0.24, 0.05, { layer: mats.trim });
  const top = ySill + h, rw = w / 2 + 0.14, rise = shed ? 0.2 : w * 0.45;
  if (shed) {
    mb.quad([x - rw, top, zWall + 0.2], [x + rw, top, zWall + 0.2], [x + rw, top + rise, z0], [x - rw, top + rise, z0], { layer: mats.roof, tint });
  } else {
    mb.quad([x - rw, top - 0.05, zWall + 0.22], [x, top + rise, zWall + 0.22], [x, top + rise, z0], [x - rw, top - 0.05, z0], { layer: mats.roof, tint, uvs: [[0, 0.5], [0, 0], [depth * 0.5, 0], [depth * 0.5, 0.5]] });
    mb.quad([x, top + rise, zWall + 0.22], [x + rw, top - 0.05, zWall + 0.22], [x + rw, top - 0.05, z0], [x, top + rise, z0], { layer: mats.roof, tint, uvs: [[0, 0], [0, 0.5], [depth * 0.5, 0.5], [depth * 0.5, 0]] });
    mb.tri([x - w / 2, top, zWall], [x + w / 2, top, zWall], [x, top + rise - 0.08, zWall], { layer: mats.wall, tint });
    mb.beam([x - rw, top - 0.08, zWall + 0.22], [x, top + rise - 0.02, zWall + 0.22], 0.08, { layer: mats.trim });
    mb.beam([x + rw, top - 0.08, zWall + 0.22], [x, top + rise - 0.02, zWall + 0.22], 0.08, { layer: mats.trim });
  }
}

/** Striped / cloth awning on a wall: sloped canopy, scalloped valance, iron arms. */
export function awning(mb: MeshBuilder, P: WallP, u0: number, u1: number, v: number, out: number, drop: number, cloth: number, metal: number, scallop = true) {
  const n = Math.max(3, Math.round((u1 - u0) / 0.3));
  const o: FaceOpts = { layer: cloth, doubleSided: true };
  // Slight belly: two rows.
  const mid = 0.55;
  const rowP = (u: number, f: number): V3 => P(u, v - drop * (f * f * 0.6 + f * 0.4), 0.02 + out * f);
  for (const [f0, f1] of [[0, mid], [mid, 1]] as const)
    mb.quad(rowP(u0, f1), rowP(u1, f1), rowP(u1, f0), rowP(u0, f0), { ...o, uvs: [[0, f1 * 0.5], [(u1 - u0) * 0.5, f1 * 0.5], [(u1 - u0) * 0.5, f0 * 0.5], [0, f0 * 0.5]] });
  const eb = rowP(u0, 1)[1];
  void eb;
  // Valance.
  for (let i = 0; i < n; i++) {
    const a = u0 + ((u1 - u0) * i) / n, c = u0 + ((u1 - u0) * (i + 1)) / n;
    const A = rowP(a, 1), C = rowP(c, 1);
    const vb = A[1] - 0.2;
    mb.quad(A, C, [C[0], vb, C[2]], [A[0], vb, A[2]], { layer: cloth, doubleSided: true, uvs: [[0, 0.5], [(c - a) * 0.5, 0.5], [(c - a) * 0.5, 0.6], [0, 0.6]] });
    if (scallop) mb.tri([A[0], vb, A[2]], [C[0], vb, C[2]], [(A[0] + C[0]) / 2, vb - 0.1, (A[2] + C[2]) / 2], { layer: cloth, doubleSided: true });
  }
  for (const u of [u0 + 0.05, u1 - 0.05]) mb.beam(P(u, v - drop - 0.35, 0.02), rowP(u, 0.98), 0.03, { layer: metal });
  wbox(mb, P, u0 - 0.03, u1 + 0.03, v - 0.03, v + 0.06, 0, 0.07, { layer: metal }, "ftb");
}

/** Hanging sign on a wrought-iron arm, perpendicular to the wall. q = sign icon quadrant 0..3. */
export function hangSign(mb: MeshBuilder, P: WallP, u: number, v: number, sign: number, metal: number, q: number, shield = true) {
  const arm = 0.78;
  const A = P(u, v, 0), B = P(u, v, arm);
  mb.beam(A, B, 0.04, { layer: metal });
  mb.beam(P(u, v - 0.35, 0), P(u, v, arm * 0.6), 0.03, { layer: metal });
  // Scroll at the tip.
  mb.box(B[0], B[1] - 0.02, B[2], 0.05, 0.08, 0.05, { layer: metal });
  const qu = (q % 2) * 0.5, qv = Math.floor(q / 2) * 0.5;
  const s0 = 0.14, s1 = arm - 0.06, top = v - 0.1, bot = v - 0.68;
  for (const k of [0.25, 0.75]) { const c = P(u, top, s0 + (s1 - s0) * k); mb.beam([c[0], c[1] + 0.1, c[2]], [c[0], c[1], c[2]], 0.02, { layer: metal }); }
  const pts: [number, number][] = shield
    ? [[0, 0], [1, 0], [1, 0.62], [0.82, 0.86], [0.5, 1], [0.18, 0.86], [0, 0.62]]
    : [[0, 0], [1, 0], [1, 1], [0, 1]];
  // Board in the plane containing the wall normal (u fixed) → two faces.
  const toW = (s: number, t: number): V3 => P(u, top - (top - bot) * t, s0 + (s1 - s0) * s);
  const ctr = toW(0.5, 0.45);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    const uv = (p: [number, number]): [number, number] => [qu + p[0] * 0.5, qv + p[1] * 0.5];
    const o: FaceOpts = { layer: sign, doubleSided: true, uvs: [uv([0.5, 0.45]), uv(a), uv(b), uv(b)] };
    mb.quad(ctr, toW(a[0], a[1]), toW(b[0], b[1]), toW(b[0], b[1]), o);
  }
}

/** Wall lantern: bracket + glass box with cap + point light. */
export function lantern(ctx: Ctx, P: WallP, u: number, v: number, mats: { metal: number; lit: number }, radius = 5.5) {
  const mb = ctx.mb;
  const A = P(u, v, 0), B = P(u, v, 0.3);
  mb.beam(A, B, 0.035, { layer: mats.metal });
  const c = P(u, v - 0.06, 0.3);
  mb.box(c[0], c[1] - 0.42, c[2], 0.2, 0.34, 0.2, { layer: mats.lit, emissive: 1 });
  mb.cyl(c[0], c[1] - 0.1, c[2], 0.16, 0.03, 0.14, 4, { layer: mats.metal });
  mb.box(c[0], c[1] - 0.46, c[2], 0.24, 0.05, 0.24, { layer: mats.metal });
  for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]] as const) mb.box(c[0] + dx, c[1] - 0.44, c[2] + dz, 0.025, 0.36, 0.025, { layer: mats.metal });
  light(ctx, [c[0], c[1] - 0.25, c[2]], ctx.lampColor, radius, 1.0);
}

/** Paper lantern (eastern): glowing lathe body with dark caps, hanging from a cord. */
export function paperLantern(ctx: Ctx, p: V3, cloth: number, dark: number, r = 0.2, withLight = true) {
  const mb = ctx.mb;
  mb.box(p[0], p[1], p[2], 0.015, 0.25, 0.015, { layer: dark });
  const y = p[1] - r * 2.1;
  lathe(mb, p[0], y, p[2], [[r * 0.45, 0], [r * 0.9, r * 0.35], [r, r * 1.0], [r * 0.9, r * 1.65], [r * 0.45, r * 2.0]], 8, { layer: cloth, emissive: 1 });
  mb.cyl(p[0], y - 0.04, p[2], r * 0.5, r * 0.5, 0.06, 8, { layer: dark });
  mb.cyl(p[0], y + r * 2.0 - 0.02, p[2], r * 0.5, r * 0.5, 0.06, 8, { layer: dark });
  if (withLight) light(ctx, [p[0], y + r, p[2]], [1.0, 0.55, 0.32], 3.8, 0.8, "paper");
}

/** Vertical banner hanging from a pole bracket. */
export function banner(mb: MeshBuilder, P: WallP, u: number, v: number, h: number, cloth: number, metal: number) {
  const A = P(u, v, 0), B = P(u, v, 0.6);
  mb.beam(A, B, 0.04, { layer: metal });
  const w = 0.42, s0 = 0.12, s1 = 0.12 + w;
  const q = (s: number, t: number): V3 => P(u, v - t, s);
  mb.quad(q(s0, h), q(s1, h), q(s1, 0), q(s0, 0), { layer: cloth, doubleSided: true, wind: true, uvs: [[0, 1], [0.5, 1], [0.5, 0], [0, 0]] });
  mb.tri(q(s0, h), q((s0 + s1) / 2, h + 0.18), q(s1, h), { layer: cloth, doubleSided: true, wind: true });
}

/** Noren: split curtain hanging across the top of a doorway. */
export function noren(mb: MeshBuilder, P: WallP, u0: number, u1: number, v: number, cloth: number, rod: number) {
  wbox(mb, P, u0 - 0.1, u1 + 0.1, v - 0.03, v + 0.03, 0.02, 0.07, { layer: rod }, "ftb");
  const n = 3, gap = 0.03, w = (u1 - u0 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const a = u0 + i * (w + gap);
    mb.quad(P(a, v - 0.62, 0.06), P(a + w, v - 0.62, 0.06), P(a + w, v, 0.05), P(a, v, 0.05), { layer: cloth, doubleSided: true, wind: true, uvs: [[0, 0.5], [0.5, 0.5], [0.5, 0], [0, 0]] });
  }
}

/** Projecting neon box sign (glows at night). */
export function neonBox(ctx: Ctx, P: WallP, u: number, v0: number, h: number, neon: number, metal: number) {
  const mb = ctx.mb;
  const s0 = 0.1, s1 = 0.55;
  const q = (s: number, v: number, du: number): V3 => P(u + du, v, s);
  for (const du of [-0.06, 0.06]) mb.quad(q(du < 0 ? s1 : s0, v0, du), q(du < 0 ? s0 : s1, v0, du), q(du < 0 ? s0 : s1, v0 + h, du), q(du < 0 ? s1 : s0, v0 + h, du), { layer: neon, emissive: 1, uvs: [[0, 1], [0.5, 1], [0.5, 0], [0, 0]] });
  const c = P(u, v0 + h / 2, (s0 + s1) / 2);
  mb.box(c[0], v0 - 0.04, c[2], 0.13, 0.04, 0.47, { layer: metal });
  mb.box(c[0], v0 + h, c[2], 0.13, 0.04, 0.47, { layer: metal });
  mb.beam(P(u, v0 + h * 0.2, 0), P(u, v0 + h * 0.2, s0), 0.04, { layer: metal });
  mb.beam(P(u, v0 + h * 0.8, 0), P(u, v0 + h * 0.8, s0), 0.04, { layer: metal });
  light(ctx, [c[0], c[1], c[2]], [1, 0.5, 0.8], 4.2, 0.6, "neon");
}

// ---- clutter ----
export type ClutterMats = { wood: number; dark: number; metal: number; stone: number; cloth: number; cloth2: number; flowers: number; leaves: number; paper: number };
export function barrel(mb: MeshBuilder, x: number, y: number, z: number, m: ClutterMats, s = 1) {
  lathe(mb, x, y, z, [[0.24 * s, 0], [0.29 * s, 0.2 * s], [0.3 * s, 0.37 * s], [0.29 * s, 0.54 * s], [0.24 * s, 0.74 * s]], 8, { layer: m.wood }, true);
  for (const hy of [0.1, 0.62]) mb.cyl(x, y + hy * s, z, 0.285 * s, 0.285 * s, 0.05 * s, 8, { layer: m.metal }, false);
}
export function crate(mb: MeshBuilder, x: number, y: number, z: number, m: ClutterMats, s = 1, yaw = 0) {
  mb.push(yaw, x, y, z);
  mb.bevelBox(0, 0, 0, 0.55 * s, 0.5 * s, 0.55 * s, 0.03, { layer: m.wood });
  mb.box(0, 0.04 * s, 0.28 * s, 0.58 * s, 0.07 * s, 0.02, { layer: m.dark });
  mb.box(0, 0.4 * s, 0.28 * s, 0.58 * s, 0.07 * s, 0.02, { layer: m.dark });
  mb.pop();
}
export function sack(mb: MeshBuilder, x: number, y: number, z: number, m: ClutterMats, seed: number) {
  mb.blob(x, y + 0.2, z, 0.22, 0.24, 0.2, { layer: m.cloth2, tint: [0.95, 0.88, 0.72] }, 1, 0.15, seed);
  mb.cyl(x, y + 0.4, z, 0.07, 0.05, 0.1, 5, { layer: m.cloth2, tint: [0.85, 0.78, 0.62] });
}
export function pot(mb: MeshBuilder, x: number, y: number, z: number, m: ClutterMats, big = false) {
  const s = big ? 1.3 : 1;
  lathe(mb, x, y, z, [[0.12 * s, 0], [0.2 * s, 0.14 * s], [0.18 * s, 0.3 * s], [0.21 * s, 0.34 * s]], 8, { layer: m.stone, tint: [1.12, 0.78, 0.6] }, false);
  mb.card(x, y + 0.25 * s, z, 0.55 * s, 0.5 * s, 20, { layer: m.flowers, wind: true });
  mb.card(x, y + 0.25 * s, z, 0.55 * s, 0.5 * s, 110, { layer: m.flowers, wind: true });
}
export function bench(mb: MeshBuilder, x: number, y: number, z: number, m: ClutterMats, yaw = 0) {
  mb.push(yaw, x, y, z);
  mb.box(0, 0.4, 0, 1.2, 0.06, 0.34, { layer: m.wood });
  for (const sx of [-0.5, 0.5]) mb.box(sx, 0, 0, 0.08, 0.4, 0.3, { layer: m.dark });
  mb.box(0, 0.62, -0.15, 1.2, 0.18, 0.04, { layer: m.wood });
  mb.pop();
}
export function trough(mb: MeshBuilder, x: number, y: number, z: number, m: ClutterMats, water: number, yaw = 0) {
  mb.push(yaw, x, y, z);
  mb.box(0, 0.15, 0, 1.1, 0.35, 0.45, { layer: m.wood });
  mb.quad([-0.5, 0.46, 0.18], [0.5, 0.46, 0.18], [0.5, 0.46, -0.18], [-0.5, 0.46, -0.18], { layer: water });
  for (const sx of [-0.45, 0.45]) mb.box(sx, 0, 0, 0.1, 0.16, 0.4, { layer: m.dark });
  mb.pop();
}
export function hitchRail(mb: MeshBuilder, x: number, y: number, z: number, w: number, m: ClutterMats, yaw = 0) {
  mb.push(yaw, x, y, z);
  for (const sx of [-w / 2, w / 2]) mb.box(sx, 0, 0, 0.12, 1.0, 0.12, { layer: m.wood });
  mb.box(0, 0.86, 0, w + 0.2, 0.1, 0.1, { layer: m.wood });
  mb.pop();
}
export function woodpile(mb: MeshBuilder, x: number, y: number, z: number, m: ClutterMats, w = 1.2, yaw = 0) {
  mb.push(yaw, x, y, z);
  for (let r = 0; r < 3; r++) for (let i = 0; i < Math.round(w / 0.18) - r; i++) {
    const px = -w / 2 + 0.1 + i * 0.18 + r * 0.09;
    tube(mb, [px, 0.09 + r * 0.16, -0.25], [px, 0.09 + r * 0.16, 0.25], 0.085, 5, { layer: m.wood, tint: [1.05, 0.95, 0.8] }, true);
  }
  mb.pop();
}
export function drum(mb: MeshBuilder, x: number, y: number, z: number, m: ClutterMats, tint: V3 = [1, 1, 1]) {
  mb.cyl(x, y, z, 0.26, 0.26, 0.85, 10, { layer: m.metal, tint });
  for (const hy of [0.28, 0.56]) mb.cyl(x, y + hy, z, 0.27, 0.27, 0.04, 10, { layer: m.metal, tint: [tint[0] * 0.8, tint[1] * 0.8, tint[2] * 0.8] }, false);
}
export function pallet(mb: MeshBuilder, x: number, y: number, z: number, m: ClutterMats, yaw = 0) {
  mb.push(yaw, x, y, z);
  for (const sz of [-0.4, 0, 0.4]) mb.box(0, 0, sz, 1.1, 0.1, 0.1, { layer: m.wood, tint: [1.05, 0.95, 0.8] });
  for (let i = 0; i < 5; i++) mb.box(-0.44 + i * 0.22, 0.1, 0, 0.16, 0.03, 0.95, { layer: m.wood, tint: [1.1, 1, 0.85] });
  crate(mb, 0.1, 0.13, 0, m, 0.95, 8);
  mb.pop();
}
export function acUnit(mb: MeshBuilder, P: WallP, u: number, v: number, m: ClutterMats) {
  wbox(mb, P, u - 0.38, u + 0.38, v, v + 0.52, 0, 0.3, { layer: m.metal, tint: [1.12, 1.12, 1.1] }, "ftblr");
  const c = P(u + 0.12, v + 0.26, 0.31), c2 = P(u + 0.12, v + 0.26, 0.4);
  void c2;
  wq(mb, P, u - 0.3, u + 0.05, v + 0.06, v + 0.46, 0.305, { layer: m.dark, tint: [0.4, 0.4, 0.42] });
  void c;
  mb.beam(P(u - 0.3, v, 0.05), P(u - 0.3, v - 0.2, 0.28), 0.03, { layer: m.metal });
  mb.beam(P(u + 0.3, v, 0.05), P(u + 0.3, v - 0.2, 0.28), 0.03, { layer: m.metal });
}
export function bin(mb: MeshBuilder, x: number, y: number, z: number, m: ClutterMats, tint: V3 = [0.6, 0.8, 0.6]) {
  mb.bevelBox(x, y, z, 0.6, 0.8, 0.5, 0.04, { layer: m.metal, tint }, { layer: m.metal, tint: [tint[0] * 0.8, tint[1] * 0.8, tint[2] * 0.8] });
}
export function clutter(mb: MeshBuilder, kind: string, x: number, y: number, z: number, m: ClutterMats, seed: number, water: number) {
  const r = hash3(seed);
  switch (kind) {
    case "barrel": barrel(mb, x, y, z, m, 0.9 + r * 0.2); if (r < 0.4) barrel(mb, x + 0.5, y, z + 0.1, m, 0.85); break;
    case "crate": crate(mb, x, y, z, m, 0.9 + r * 0.25, r * 30 - 15); if (r < 0.5) crate(mb, x + 0.05, y + 0.5, z, m, 0.7, r * 40); break;
    case "sack": sack(mb, x, y, z, m, seed); sack(mb, x + 0.35, y, z + 0.05, m, seed + 1); break;
    case "pot": pot(mb, x, y, z, m, r < 0.4); break;
    case "bench": bench(mb, x, y, z, m); break;
    case "trough": trough(mb, x, y, z, m, water); break;
    case "rail": hitchRail(mb, x, y, z, 1.4, m); break;
    case "woodpile": woodpile(mb, x, y, z, m); break;
    case "drum": drum(mb, x, y, z, m, r < 0.33 ? [1.2, 0.5, 0.35] : r < 0.66 ? [0.5, 0.7, 1.1] : [1.1, 1.0, 0.5]); break;
    case "pallet": pallet(mb, x, y, z, m); break;
    case "bin": bin(mb, x, y, z, m); break;
    default: break;
  }
}
