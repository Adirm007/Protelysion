// Signature and special building forms (hd2d-architecture-2), part 1: water tower, windmill / windpump,
// silo, barn, containers, gas station, pagoda, pavilion, stage, round hut, hide tent, stilt hut,
// watchtower, clock tower, observatory, minehead, station hall, stave church, watermill, gantry crane.
import type { FaceOpts, MeshBuilder, V3 } from "../mesh";
import type { Ctx } from "../ground";
import { dome, lathe, obox, onion, quadOut, ring, rotZ, tube, wallP, wbox, wq } from "./geo";
import { roof } from "./roofs";
import { facade, type Op } from "./facade";
import { barrel, crate, drum, lantern, light, paperLantern, pallet, sack, woodpile } from "./parts";
import type { Plan } from "./plan";
import type { Mats } from "./house";

export type SB = (ctx: Ctx, p: Plan, M: Mats) => void;
const L = (ctx: Ctx, id: string) => ctx.layer(id);

/** Lot pad covering the whole footprint so blocked cells read as occupied. */
export function pad(mb: MeshBuilder, p: Plan, layer: number, h = 0.2, edge?: number) {
  mb.bevelBox(0, -0.3, 0, p.W, h + 0.3, p.D, 0.04, { layer: edge ?? layer }, { layer });
}
/** Low fence / wall around the lot, open at the front middle. */
export function fence(mb: MeshBuilder, p: Plan, layer: number, kind: "picket" | "rail" | "stone" | "rope" = "rail", gap = 1.4) {
  const hw = p.W / 2 - 0.08, hd = p.D / 2 - 0.08;
  const runs: [number, number, number, number][] = [[-hw, -hd, hw, -hd], [hw, -hd, hw, hd], [-hw, hd, -hw, -hd], [-hw, hd, -gap / 2, hd], [gap / 2, hd, hw, hd]];
  for (const [x0, z0, x1, z1] of runs) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.2) continue;
    if (kind === "stone") { mb.bevelBox((x0 + x1) / 2, 0, (z0 + z1) / 2, Math.abs(x1 - x0) + 0.25, 0.55, Math.abs(z1 - z0) + 0.25, 0.05, { layer }); continue; }
    const n = Math.max(1, Math.round(len / (kind === "picket" ? 0.18 : 1.2)));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      if (kind === "picket") mb.box(x, 0, z, 0.06, 0.7, 0.06, { layer });
      else mb.box(x, 0, z, 0.1, kind === "rope" ? 0.8 : 0.9, 0.1, { layer });
    }
    if (kind === "rope") tube(mb, [x0, 0.72, z0], [x1, 0.72, z1], 0.025, 4, { layer });
    else { mb.beam([x0, 0.62, z0], [x1, 0.62, z1], 0.06, { layer }); if (kind === "rail") mb.beam([x0, 0.3, z0], [x1, 0.3, z1], 0.06, { layer }); }
  }
}
/** Four-post trestle with X-bracing (timber or steel). */
function trestle(mb: MeshBuilder, r0: number, r1: number, y0: number, y1: number, layer: number, th = 0.14, levels = 2) {
  const c = (r: number): [number, number][] => [[-r, -r], [r, -r], [r, r], [-r, r]];
  const A = c(r0), B = c(r1);
  for (let i = 0; i < 4; i++) mb.beam([A[i]![0], y0, A[i]![1]], [B[i]![0], y1, B[i]![1]], th, { layer });
  for (let lv = 0; lv < levels; lv++) {
    const t0 = lv / levels, t1 = (lv + 1) / levels;
    const at = (i: number, t: number): V3 => [A[i]![0] + (B[i]![0] - A[i]![0]) * t, y0 + (y1 - y0) * t, A[i]![1] + (B[i]![1] - A[i]![1]) * t];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      mb.beam(at(i, t0), at(j, t1), th * 0.55, { layer });
      mb.beam(at(j, t0), at(i, t1), th * 0.55, { layer });
      mb.beam(at(i, t1), at(j, t1), th * 0.7, { layer });
    }
  }
}
function ladder(mb: MeshBuilder, x: number, z: number, y0: number, y1: number, layer: number, alongX = true) {
  const s = 0.2;
  for (const d of [-s, s]) mb.box(x + (alongX ? d : 0), y0, z + (alongX ? 0 : d), 0.05, y1 - y0, 0.05, { layer });
  for (let y = y0 + 0.25; y < y1; y += 0.3) mb.box(x, y, z, alongX ? s * 2 : 0.04, 0.04, alongX ? 0.04 : s * 2, { layer });
}
/** Railing ring (posts + top rail) around a circle. */
function railRing(mb: MeshBuilder, cx: number, y: number, cz: number, r: number, layer: number, n = 12, h = 0.8) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const p0: V3 = [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], p1: V3 = [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r];
    mb.box(p0[0], y, p0[2], 0.04, h, 0.04, { layer });
    mb.beam([p0[0], y + h, p0[2]], [p1[0], y + h, p1[2]], 0.04, { layer });
    mb.beam([p0[0], y + h * 0.5, p0[2]], [p1[0], y + h * 0.5, p1[2]], 0.025, { layer });
  }
}
/** Small front door (wall at z = zf). */
function doorAt(mb: MeshBuilder, x: number, zf: number, y: number, w: number, h: number, leaf: number, frame: number, arch = false) {
  mb.quad([x - w / 2, y, zf + 0.02], [x + w / 2, y, zf + 0.02], [x + w / 2, y + h, zf + 0.02], [x - w / 2, y + h, zf + 0.02], { layer: leaf });
  mb.box(x - w / 2 - 0.05, y, zf + 0.04, 0.1, h + 0.05, 0.08, { layer: frame });
  mb.box(x + w / 2 + 0.05, y, zf + 0.04, 0.1, h + 0.05, 0.08, { layer: frame });
  mb.box(x, y + h, zf + 0.04, w + 0.2, 0.12, 0.1, { layer: frame });
  if (arch) mb.cyl(x, y + h + 0.06, zf + 0.04, w / 2 + 0.08, w / 2 + 0.08, 0.06, 10, { layer: frame }, false);
}
/** Window glass square at a point on a wall (normal +z). */
function winAt(mb: MeshBuilder, x: number, y: number, z: number, w: number, h: number, lit: boolean, M: Mats, yaw = 0) {
  mb.push(yaw, x, 0, z);
  mb.quad([-w / 2, y, 0.03], [w / 2, y, 0.03], [w / 2, y + h, 0.03], [-w / 2, y + h, 0.03], { layer: lit ? M.fm.lit : M.fm.glass, emissive: lit ? 1 : 0, noAO: true });
  mb.box(0, y - 0.06, 0.06, w + 0.14, 0.06, 0.1, { layer: M.fm.frame });
  mb.box(0, y + h, 0.05, w + 0.1, 0.06, 0.08, { layer: M.fm.frame });
  mb.box(-w / 2 - 0.03, y, 0.05, 0.06, h, 0.06, { layer: M.fm.frame });
  mb.box(w / 2 + 0.03, y, 0.05, 0.06, h, 0.06, { layer: M.fm.frame });
  mb.box(0, y, 0.05, 0.04, h, 0.04, { layer: M.fm.frame });
  mb.pop();
}
const lit = (p: Plan, i: number) => p.r(500 + i) < 0.5;

// ------------------------------------------------------------------------------------------------
export const watertower: SB = (ctx, p, M) => {
  const mb = ctx.mb, steel = p.lang === "industrial" || p.lang === "urban";
  pad(mb, p, M.fm.stone, 0.15);
  const legL = steel ? M.fm.metal : M.fm.wood;
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) mb.bevelBox(x * 1.05, 0, z * 1.05, 0.45, 0.4, 0.45, 0.04, { layer: M.fm.stone });
  trestle(mb, 1.05, 0.8, 0.35, 4.3, legL, steel ? 0.12 : 0.18, 2);
  // Deck + railing.
  mb.cyl(0, 4.25, 0, 1.35, 1.35, 0.12, 12, { layer: M.fm.wood });
  railRing(mb, 0, 4.37, 0, 1.3, legL, 14, 0.7);
  // Tank.
  const tankL = steel ? M.fm.metal : M.fm.wood;
  mb.cyl(0, 4.37, 0, 1.05, 1.05, 2.2, 14, { layer: tankL, tint: steel ? [1.05, 1.02, 0.95] : [1.0, 0.92, 0.82], uvs: undefined });
  if (!steel) for (const hy of [0.35, 1.0, 1.65]) mb.cyl(0, 4.37 + hy, 0, 1.07, 1.07, 0.06, 14, { layer: M.fm.metal }, false);
  mb.cyl(0, 6.57, 0, 1.2, 0.06, 1.0, 14, { layer: steel ? M.fm.metal : M.R });
  mb.cyl(0, 7.5, 0, 0.08, 0.03, 0.5, 6, { layer: M.fm.metal });
  ladder(mb, 0, 1.12, 0.3, 4.3, M.fm.metal);
  tube(mb, [0.3, 4.4, 0.3], [0.3, 0.4, 0.3], 0.1, 6, { layer: M.fm.metal });
  if (p.kit.deco.includes("rust") || p.lang === "industrial") mb.box(0, 5.2, 1.06, 1.1, 0.5, 0.04, { layer: M.X, tint: [1.2, 0.8, 0.5] });
};

export const windmill: SB = (ctx, p, M) => {
  const mb = ctx.mb;
  if (p.lang === "frontier") {
    // American windpump: steel lattice tower, multi-blade rotor, tail vane, stock tank.
    pad(mb, p, M.fm.stone, 0.12);
    trestle(mb, 0.9, 0.18, 0.1, 7.2, M.fm.metal, 0.08, 4);
    mb.box(0, 7.2, 0, 0.3, 0.3, 0.5, { layer: M.fm.metal });
    const hub: V3 = [0, 7.35, 0.4];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const tip: V3 = [hub[0] + Math.cos(a) * 1.3, hub[1] + Math.sin(a) * 1.3, hub[2] + 0.12];
      obox(mb, [(hub[0] + tip[0]) / 2, (hub[1] + tip[1]) / 2, (hub[2] + tip[2]) / 2], [Math.cos(a), Math.sin(a), 0], [-Math.sin(a) * 0.85, Math.cos(a) * 0.85, 0.5], [0, -0.5, 0.85], 0.65, 0.09, 0.01, { layer: M.fm.metal, tint: [1.1, 1.1, 1.1] });
    }
    ring(mb, hub[0], hub[1], hub[2] + 0.1, 1.28, 1.34, 16, { layer: M.fm.metal });
    tube(mb, [0, 7.35, 0], [0, 7.35, -1.4], 0.04, 4, { layer: M.fm.metal });
    wq(mb, (u, v, t = 0) => [t, v, -1.4 + u], -0.6, 0.6, 7.0, 7.7, 0, { layer: M.fm.metal, tint: [1.2, 0.5, 0.4], doubleSided: true });
    tube(mb, [0.15, 0.2, 0.15], [0.15, 7.2, 0.15], 0.03, 4, { layer: M.fm.metal });
    mb.cyl(1.3, 0.1, 1.1, 0.8, 0.8, 0.55, 12, { layer: M.fm.metal, tint: [0.9, 0.9, 0.92] }, false);
    mb.cyl(1.3, 0.6, 1.1, 0.74, 0.74, 0.01, 12, { layer: M.water });
    return;
  }
  // European tower mill: tapered octagonal body, cap, four lattice sails.
  pad(mb, p, M.fm.stone, 0.25);
  const body = p.st.mat.G === "a_log" ? M.G : L(ctx, "a_plaster");
  mb.cyl(0, 0.25, 0, 1.55, 1.15, 5.6, 8, { layer: body, tint: p.tint as V3 });
  mb.cyl(0, 0.25, 0, 1.62, 1.6, 0.5, 8, { layer: M.fm.stone }, false);
  mb.cyl(0, 3.2, 0, 1.45, 1.45, 0.14, 8, { layer: M.fm.wood });
  railRing(mb, 0, 3.34, 0, 1.75, M.fm.wood, 12, 0.7);
  mb.cyl(0, 3.2, 0, 1.8, 1.8, 0.1, 12, { layer: M.fm.wood });
  const capY = 5.85;
  mb.cyl(0, capY, 0, 1.3, 1.3, 0.2, 10, { layer: M.fm.dark });
  dome(mb, 0, capY + 0.2, 0, 1.3, 1.25, 10, 4, { layer: M.R });
  mb.cyl(0, capY + 1.4, 0, 0.06, 0.02, 0.5, 6, { layer: M.fm.metal });
  doorAt(mb, 0, 1.45, 0.25, 0.9, 1.9, M.fm.door, M.fm.frame);
  winAt(mb, 0, 4.0, 1.3, 0.55, 0.7, lit(p, 1), M);
  winAt(mb, 0, 2.3, -1.4, 0.5, 0.6, lit(p, 2), M, 180);
  // Sails.
  const hub: V3 = [0, capY + 0.55, 1.45];
  tube(mb, [0, hub[1], 0.6], hub, 0.14, 8, { layer: M.fm.dark }, true);
  const rot = (p.b.seed % 90) * Math.PI / 180;
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
    const P = (s: number, w: number, dz = 0): V3 => [hub[0] + ca * s - sa * w, hub[1] + sa * s + ca * w, hub[2] + 0.08 + dz];
    mb.beam(P(0, 0), P(4.4, 0), 0.12, { layer: M.fm.wood });
    // Lattice frame + cloth.
    mb.quad(P(0.9, 0.05, -0.01), P(4.3, 0.05, -0.01), P(4.3, 0.75, -0.01), P(0.9, 0.75, -0.01), { layer: M.fm.cloth, doubleSided: true, tint: [1.2, 1.15, 1.05] });
    mb.beam(P(0.9, 0.8), P(4.3, 0.8), 0.04, { layer: M.fm.wood });
    for (let k = 0; k <= 6; k++) { const s = 0.9 + (3.4 * k) / 6; mb.beam(P(s, 0), P(s, 0.8), 0.03, { layer: M.fm.wood }); }
  }
  sack(mb, 1.4, 0.25, 1.6, M.cm, p.b.seed);
  sack(mb, 1.75, 0.25, 1.45, M.cm, p.b.seed + 1);
};

export const silo: SB = (ctx, p, M) => {
  const mb = ctx.mb;
  pad(mb, p, M.fm.stone, 0.15);
  const corr = L(ctx, "a_corr");
  mb.cyl(0, 0.15, 0, 1.2, 1.2, 7.2, 14, { layer: corr, tint: [1.05, 1.05, 1.02] });
  for (const hy of [1.5, 3.0, 4.5, 6.0]) mb.cyl(0, hy, 0, 1.22, 1.22, 0.06, 14, { layer: M.fm.metal }, false);
  dome(mb, 0, 7.35, 0, 1.22, 0.9, 14, 4, { layer: M.fm.metal, tint: [1.1, 1.1, 1.12] });
  mb.cyl(0, 8.2, 0, 0.25, 0.25, 0.3, 8, { layer: M.fm.metal });
  // Ladder cage.
  ladder(mb, 0, 1.3, 0.2, 7.3, M.fm.metal);
  for (let y = 2; y < 7.3; y += 0.8) ring(mb, 0, y, 1.55, 0.3, 0.33, 8, { layer: M.fm.metal });
  tube(mb, [0.9, 6.8, 0.6], [1.9, 2.2, 1.4], 0.14, 6, { layer: M.fm.metal });
};

export const barn: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, M.fm.stone, 0.2);
  const walls = L(ctx, "a_batten"), trim = M.paint;
  const hw = W / 2 - 0.3, hd = D / 2 - 0.1, h = 3.2;
  const sideDoorX = 0;
  for (const side of ["s", "e", "n", "w"] as const) {
    const P = wallP(side, hw, hd);
    const len = side === "s" || side === "n" ? hw * 2 : hd * 2;
    const ops: Op[] = side === "s" ? [{ u: sideDoorX, w: 2.2, v0: 0, v1: 2.7, kind: "door", head: "flat", door: "plank" }] : side === "n" ? [] : [{ u: -len / 4, w: 0.6, v0: 1.3, v1: 2.0, kind: "win", head: "flat", mull: "cross", lit: lit(p, 3) }, { u: len / 4, w: 0.6, v0: 1.3, v1: 2.0, kind: "win", head: "flat", mull: "cross" }];
    facade(mb, { P, u0: -len / 2, u1: len / 2, y0: 0.2, y1: 0.2 + h, ops, wall: { layer: walls, tint: p.tint as V3 }, mats: { ...M.fm, frame: trim, door: walls }, st: p.st, seed: p.b.seed, mobile: ctx.quality === "mobile" });
    // Corner trims.
    wbox(mb, P, -len / 2, -len / 2 + 0.14, 0.2, 0.2 + h, 0, 0.05, { layer: trim }, "flr");
    wbox(mb, P, len / 2 - 0.14, len / 2, 0.2, 0.2 + h, 0, 0.05, { layer: trim }, "flr");
  }
  // Big door X-braces.
  const PS = wallP("s", hw, hd);
  for (const [u0, u1] of [[sideDoorX - 1.1, sideDoorX], [sideDoorX, sideDoorX + 1.1]] as const) {
    wbox(mb, PS, u0, u1, 0.2, 2.9, -0.18, -0.14, { layer: trim }, "f");
    const a = PS(u0 + 0.08, 0.3, -0.12), c = PS(u1 - 0.08, 2.8, -0.12), b = PS(u1 - 0.08, 0.3, -0.12), d = PS(u0 + 0.08, 2.8, -0.12);
    mb.beam(a, c, 0.1, { layer: trim }); mb.beam(b, d, 0.1, { layer: trim });
  }
  mb.box(sideDoorX, 2.95, hd + 0.2, 3.0, 0.08, 0.1, { layer: M.fm.metal });
  roof(mb, { x0: -hw, x1: hw, z0: -hd, z1: hd, y: 0.2 + h, kind: "gambrel", pitch: 1, eave: [0.3, 0.3, 0.35, 0.35], alongX: false, mat: M.R, trim, gable: walls, soffit: M.fm.wood, seed: p.b.seed, snow: M.snow, mobile: ctx.quality === "mobile" });
  // Hay bales + lean-to fence.
  for (let i = 0; i < 3; i++) mb.bevelBox(hw + 0.02 - 0.5, 0.2 + i * 0.01, -hd + 0.6 + i * 0.75, 0.5, 0.5, 0.7, 0.08, { layer: M.R === L(ctx, "a_roof2") ? L(ctx, "a_roof2") : M.cm.cloth2, tint: [1.2, 1.05, 0.6] });
  crate(mb, -hw + 0.6, 0.2, hd + 0.35, M.cm);
};

export const container: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "a_concrete"), 0.1);
  const corr = L(ctx, "a_corr");
  const tints: V3[] = [[1.25, 0.55, 0.4], [0.5, 0.75, 1.15], [0.6, 1.0, 0.6], [1.25, 0.95, 0.45], [1.1, 1.1, 1.1], [0.9, 0.55, 0.9]];
  const levels = Math.max(1, Math.min(2, p.b.floors));
  const len = Math.min(W - 0.3, 6.0), dep = 2.35, h = 2.55;
  for (let lv = 0; lv < levels; lv++) {
    const off = lv === 0 ? 0 : (p.r(40) - 0.5) * 0.8;
    const z = -D / 2 + 0.2 + dep / 2 + (lv === 0 ? Math.min(0.5, (D - dep - 0.4) * 0.5) : 0);
    const y = 0.1 + lv * h;
    const tint = tints[Math.floor(p.r(41 + lv) * tints.length)]!;
    mb.push(0, off, 0, z);
    mb.box(0, y, 0, len, h, dep, { layer: corr, tint, uvs: undefined }, "tnsew", { layer: corr, tint: [tint[0] * 0.85, tint[1] * 0.85, tint[2] * 0.85] });
    // Corner castings + frame rails.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.box(sx * (len / 2 - 0.08), y, sz * (dep / 2 - 0.08), 0.18, h, 0.18, { layer: M.fm.metal, tint: [tint[0] * 0.7, tint[1] * 0.7, tint[2] * 0.7] });
    for (const yy of [y, y + h - 0.14]) mb.box(0, yy, dep / 2 + 0.01, len, 0.14, 0.04, { layer: M.fm.metal, tint: [tint[0] * 0.75, tint[1] * 0.75, tint[2] * 0.75] });
    // Door end (+x) with locking bars; one converted with a window + door on the front.
    for (const sz of [-0.55, 0.55]) mb.quad([len / 2 + 0.01, y + 0.1, sz + 0.52], [len / 2 + 0.01, y + 0.1, sz - 0.52], [len / 2 + 0.01, y + h - 0.15, sz - 0.52], [len / 2 + 0.01, y + h - 0.15, sz + 0.52], { layer: corr, tint: [tint[0] * 0.9, tint[1] * 0.9, tint[2] * 0.9] });
    for (const sz of [-0.8, -0.3, 0.3, 0.8]) mb.box(len / 2 + 0.05, y + 0.1, sz, 0.04, h - 0.25, 0.04, { layer: M.fm.metal });
    if (lv === 0 || p.r(44) < 0.5) {
      const dx = (p.r(45 + lv) - 0.5) * (len - 2.2);
      mb.quad([dx - 0.45, y, dep / 2 + 0.02], [dx + 0.45, y, dep / 2 + 0.02], [dx + 0.45, y + 2.0, dep / 2 + 0.02], [dx - 0.45, y + 2.0, dep / 2 + 0.02], { layer: M.fm.dark, tint: [0.35, 0.3, 0.28] });
      winAt(mb, dx + 1.3, y + 1.0, dep / 2, 0.8, 0.6, lit(p, 10 + lv), M);
      if (lv === 0) mb.box(dx, y + 2.05, dep / 2 + 0.3, 1.3, 0.05, 0.6, { layer: corr, tint: [0.9, 0.9, 0.9] });
    }
    // Stencil band.
    mb.quad([-len / 2 + 0.4, y + h - 0.7, dep / 2 + 0.02], [-len / 2 + 1.6, y + h - 0.7, dep / 2 + 0.02], [-len / 2 + 1.6, y + h - 0.35, dep / 2 + 0.02], [-len / 2 + 0.4, y + h - 0.35, dep / 2 + 0.02], { layer: M.fm.cloth, tint: [1.4, 1.4, 1.4] });
    mb.pop();
  }
  if (levels > 1) {
    // External stair to the upper box.
    const x0 = -len / 2 + 0.3, zf = -D / 2 + 0.2 + dep + Math.min(0.5, (D - dep - 0.4) * 0.5) + 0.05;
    for (let i = 0; i < 9; i++) mb.box(x0 + i * 0.3, 0.1 + i * 0.28, zf + 0.35, 0.3, 0.05, 0.7, { layer: M.fm.metal });
    mb.beam([x0 - 0.15, 1.0, zf + 0.72], [x0 + 2.6, 3.6, zf + 0.72], 0.05, { layer: M.fm.metal });
    for (let i = 0; i <= 3; i++) mb.box(x0 + i * 0.9, 0.1 + i * 0.84, zf + 0.72, 0.04, 0.9, 0.04, { layer: M.fm.metal });
  }
  drum(mb, len / 2 + 0.2 < W / 2 - 0.3 ? len / 2 + 0.3 : W / 2 - 0.4, 0.1, D / 2 - 0.45, M.cm, [1.2, 0.5, 0.35]);
  pallet(mb, -W / 2 + 0.8, 0.1, D / 2 - 0.55, M.cm, 10);
  lantern(ctx, (u, v, t = 0) => [u, v, -D / 2 + 0.2 + dep + t + Math.min(0.5, (D - dep - 0.4) * 0.5)], 0, 2.3, { metal: M.fm.metal, lit: M.fm.lit }, 5);
};

export const gasstation: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "a_concrete"), 0.12);
  const cw = W - 0.8, cd = 3.2, cz = D / 2 - cd / 2 - 0.4, h = 3.4;
  for (const sx of [-1, 1]) mb.box(sx * (cw / 2 - 0.6), 0.12, cz, 0.3, h - 0.12, 0.3, { layer: M.fm.metal, tint: [1.15, 1.15, 1.15] });
  mb.box(0, h, cz, cw, 0.5, cd, { layer: M.fm.metal, tint: [1.2, 1.2, 1.2] }, "tnsew");
  mb.quad([cw / 2, h, cz + cd / 2], [-cw / 2, h, cz + cd / 2], [-cw / 2, h, cz - cd / 2], [cw / 2, h, cz - cd / 2], { layer: M.fm.lit, emissive: 0.4, tint: [1, 1, 1] });
  mb.quad([-cw / 2, h + 0.1, cz + cd / 2 + 0.01], [cw / 2, h + 0.1, cz + cd / 2 + 0.01], [cw / 2, h + 0.4, cz + cd / 2 + 0.01], [-cw / 2, h + 0.4, cz + cd / 2 + 0.01], { layer: M.neon, emissive: 1, uvs: [[0, 0.95], [1, 0.95], [1, 0.62], [0, 0.62]] });
  for (const sx of [-1, 1]) {
    const x = sx * 1.1;
    mb.bevelBox(x, 0.12, cz, 0.7, 0.2, 1.8, 0.04, { layer: M.fm.stone });
    mb.box(x, 0.32, cz, 0.5, 1.35, 0.6, { layer: M.fm.metal, tint: sx < 0 ? [1.3, 0.55, 0.45] : [0.55, 0.8, 1.25] });
    mb.quad([x - 0.18, 1.0, cz + 0.31], [x + 0.18, 1.0, cz + 0.31], [x + 0.18, 1.45, cz + 0.31], [x - 0.18, 1.45, cz + 0.31], { layer: M.fm.lit, emissive: 1 });
    tube(mb, [x + 0.26, 1.2, cz + 0.2], [x + 0.35, 0.6, cz + 0.45], 0.03, 4, { layer: M.fm.dark });
  }
  for (const sx of [-1, 1]) light(ctx, [sx * 1.6, h - 0.2, cz], [1, 0.95, 0.85], 6, 1.0, "canopy");
  // Kiosk.
  const kz = -D / 2 + 1.1, kw = Math.min(3.2, W - 1.4);
  mb.box(-W / 2 + 0.4 + kw / 2, 0.12, kz, kw, 2.7, 1.8, { layer: L(ctx, "a_concrete"), tint: p.tint as V3 });
  mb.quad([-W / 2 + 0.6, 0.5, kz + 0.91], [-W / 2 + 0.4 + kw - 0.2, 0.5, kz + 0.91], [-W / 2 + 0.4 + kw - 0.2, 2.2, kz + 0.91], [-W / 2 + 0.6, 2.2, kz + 0.91], { layer: M.fm.lit, emissive: 0.8 });
  mb.box(-W / 2 + 0.4 + kw / 2, 2.82, kz, kw + 0.3, 0.2, 2.1, { layer: M.fm.metal });
  // Price sign on a pole.
  const sx = W / 2 - 0.5, sz = -D / 2 + 0.6;
  mb.box(sx, 0.12, sz, 0.14, 4.2, 0.14, { layer: M.fm.metal });
  mb.box(sx, 4.3, sz, 1.1, 1.3, 0.2, { layer: M.fm.metal, tint: [1.2, 1.2, 1.2] });
  mb.quad([sx - 0.5, 4.4, sz + 0.11], [sx + 0.5, 4.4, sz + 0.11], [sx + 0.5, 5.5, sz + 0.11], [sx - 0.5, 5.5, sz + 0.11], { layer: M.neon, emissive: 1, uvs: [[0, 1], [0.5, 1], [0.5, 0.5], [0, 0.5]] });
  if (p.kit.deco.includes("ruin") || p.kit.deco.includes("rust")) { drum(mb, W / 2 - 0.5, 0.12, D / 2 - 0.5, M.cm, [1.2, 0.5, 0.35]); crate(mb, -W / 2 + 0.6, 0.12, D / 2 - 0.5, M.cm); }
};

/** Eastern tiered pagoda. */
export const pagoda: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W;
  mb.bevelBox(0, -0.3, 0, W, 0.9, p.D, 0.06, { layer: M.fm.stone });
  const tiers = 3 + (p.b.floors >= 3 ? 1 : 0);
  let y = 0.6, s = W - 1.3;
  for (let i = 0; i < tiers; i++) {
    const h = i === 0 ? 2.2 : 1.45;
    const P = (side: "s" | "e" | "n" | "w") => wallP(side, s / 2, s / 2);
    for (const side of ["s", "e", "n", "w"] as const) {
      const ops: Op[] = i === 0 ? (side === "s" ? [{ u: 0, w: 1.1, v0: 0, v1: 1.95, kind: "door", head: "flat", door: "sliding", lit: true }] : [{ u: 0, w: 0.9, v0: 0.6, v1: 1.6, kind: "win", head: "flat", lattice: true, lit: lit(p, i) }]) : [{ u: 0, w: Math.min(0.9, s - 0.8), v0: 0.35, v1: 1.15, kind: "win", head: "flat", lattice: true, lit: lit(p, i * 4 + 1) }];
      facade(mb, { P: P(side), u0: -s / 2, u1: s / 2, y0: y, y1: y + h, ops, wall: { layer: L(ctx, "a_plaster") }, mats: M.fm, st: p.st, seed: p.b.seed + i, mobile: ctx.quality === "mobile" });
      for (const u of [-s / 2 + 0.1, s / 2 - 0.1]) wbox(mb, P(side), u - 0.1, u + 0.1, y, y + h, 0, 0.1, { layer: M.F }, "flr");
      wbox(mb, P(side), -s / 2, s / 2, y + h - 0.2, y + h, 0, 0.12, { layer: M.F }, "ftb");
      if (i > 0) { wbox(mb, P(side), -s / 2, s / 2, y + 0.3, y + 0.36, 0.1, 0.4, { layer: M.fm.dark }, "ftb"); for (let k = 0; k <= 5; k++) wbox(mb, P(side), -s / 2 + (s * k) / 5 - 0.02, -s / 2 + (s * k) / 5 + 0.02, y, y + 0.36, 0.36, 0.4, { layer: M.fm.dark }, "flr"); }
    }
    const last = i === tiers - 1;
    const e = 0.95 - i * 0.08;
    roof(mb, { x0: -s / 2, x1: s / 2, z0: -s / 2, z1: s / 2, y: y + h, kind: last ? "pyramid" : "hip", pitch: last ? 0.9 : 0.42, eave: [e, e, e, e], alongX: true, mat: M.R, trim: M.fm.dark, gable: M.F, soffit: M.F, rafters: true, curved: true, upturn: 0.45, seed: p.b.seed + i, snow: M.snow, ridge: "none", mobile: ctx.quality === "mobile" });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const c: V3 = [sx * (s / 2 + e - 0.05), y + h + 0.2, sz * (s / 2 + e - 0.05)];
      mb.box(c[0], c[1] - 0.35, c[2], 0.06, 0.3, 0.06, { layer: M.fm.brass });
      mb.cyl(c[0], c[1] - 0.55, c[2], 0.07, 0.1, 0.2, 6, { layer: M.fm.brass });
    }
    y += h + (last ? 0 : 0.55);
    s = Math.max(1.4, s - 0.5);
  }
  // Sorin spire.
  const topY = y + s * 0.5 * 0.9 * 1.25;
  mb.cyl(0, topY - 0.1, 0, 0.08, 0.05, 2.0, 6, { layer: M.fm.brass });
  for (let k = 0; k < 6; k++) mb.cyl(0, topY + 0.3 + k * 0.22, 0, 0.2 - k * 0.018, 0.2 - k * 0.018, 0.05, 8, { layer: M.fm.brass });
  mb.blob(0, topY + 1.95, 0, 0.12, 0.16, 0.12, { layer: M.fm.brass }, 1);
  paperLantern(ctx, [-(W - 1.3) / 2 - 0.4, 2.6, (W - 1.3) / 2 + 0.6], M.fm.cloth, M.fm.dark, 0.2);
  paperLantern(ctx, [(W - 1.3) / 2 + 0.4, 2.6, (W - 1.3) / 2 + 0.6], M.fm.cloth, M.fm.dark, 0.2);
};

/** Open pavilion: stone platform, columns, low railing, curved roof (square or octagonal). */
export const pavilion: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  const eastern = p.lang === "eastern";
  const plat = 0.5;
  mb.bevelBox(0, -0.3, 0, W, plat + 0.3, D, 0.05, { layer: M.fm.stone });
  const oct = p.r(60) < 0.4 && Math.abs(W - D) < 0.6;
  const hw = W / 2 - 0.55, hd = D / 2 - 0.55, h = 2.6;
  const colL = eastern ? M.F : M.fm.stone;
  const posts: [number, number][] = oct ? Array.from({ length: 8 }, (_, i) => [Math.cos((i + 0.5) * Math.PI / 4) * hw * 1.05, Math.sin((i + 0.5) * Math.PI / 4) * hd * 1.05]) : [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], ...(W > 4.5 ? [[0, -hd], [0, hd]] as [number, number][] : [])];
  for (const [x, z] of posts) {
    mb.cyl(x, plat, z, 0.13, 0.12, h, 8, { layer: colL });
    mb.cyl(x, plat, z, 0.2, 0.2, 0.18, 8, { layer: M.fm.stone });
  }
  // Railing (seat rail) between posts except front middle.
  const ring2 = oct ? posts : [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as [number, number][];
  for (let i = 0; i < ring2.length; i++) {
    const a = ring2[i]!, c = ring2[(i + 1) % ring2.length]!;
    if ((a[1] + c[1]) / 2 > hd * 0.7 && Math.abs((a[0] + c[0]) / 2) < 0.8) continue;
    mb.beam([a[0], plat + 0.55, a[1]], [c[0], plat + 0.55, c[1]], 0.09, { layer: eastern ? M.F : M.fm.stone });
    mb.beam([a[0], plat + 0.12, a[1]], [c[0], plat + 0.12, c[1]], 0.06, { layer: eastern ? M.fm.dark : M.fm.stone });
    const n = Math.max(2, Math.round(Math.hypot(c[0] - a[0], c[1] - a[1]) / 0.3));
    for (let k = 1; k < n; k++) { const t = k / n; mb.box(a[0] + (c[0] - a[0]) * t, plat + 0.12, a[1] + (c[1] - a[1]) * t, 0.04, 0.43, 0.04, { layer: eastern ? M.fm.dark : M.fm.stone }); }
  }
  // Beams ring.
  for (let i = 0; i < ring2.length; i++) { const a = ring2[i]!, c = ring2[(i + 1) % ring2.length]!; mb.beam([a[0], plat + h - 0.1, a[1]], [c[0], plat + h - 0.1, c[1]], 0.18, { layer: eastern ? M.F : M.fm.stone }); }
  if (oct) {
    const y0 = plat + h;
    const r = Math.max(hw, hd) + 0.9;
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
      const lift = 0.3;
      const A: V3 = [Math.cos(a0) * r, y0 - 0.15 + lift, Math.sin(a0) * r], B: V3 = [Math.cos(a1) * r, y0 - 0.15 + lift, Math.sin(a1) * r];
      const Mid: V3 = [Math.cos((a0 + a1) / 2) * r * 0.97, y0 - 0.15, Math.sin((a0 + a1) / 2) * r * 0.97];
      const top: V3 = [0, y0 + r * 0.95, 0];
      const mid2 = (q: V3, f: number): V3 => [q[0] * f, y0 - 0.15 + (top[1] - y0 + 0.15) * (1 - f) * (1 - f * 0.25) + (q[1] - y0 + 0.15) * f, q[2] * f];
      for (const [q1, q2] of [[A, Mid], [Mid, B]] as const) {
        for (const [f0, f1] of [[1, 0.55], [0.55, 0.02]] as const) quadOut(mb, mid2(q1, f0), mid2(q2, f0), mid2(q2, f1), mid2(q1, f1), [0, 1, 0], { layer: M.R });
        mb.beam([q1[0], q1[1] - 0.06, q1[2]], [q2[0], q2[1] - 0.06, q2[2]], 0.1, { layer: M.fm.dark });
      }
      mb.beam([A[0], A[1] + 0.04, A[2]], [0, top[1], 0], 0.1, { layer: M.R, tint: [0.75, 0.75, 0.8] });
    }
    mb.cyl(0, y0 + r * 0.95 - 0.1, 0, 0.16, 0.05, 0.9, 8, { layer: M.fm.brass });
    mb.blob(0, y0 + r * 0.95 + 0.85, 0, 0.14, 0.18, 0.14, { layer: M.fm.brass });
  } else {
    roof(mb, { x0: -hw, x1: hw, z0: -hd, z1: hd, y: plat + h, kind: eastern ? "irimoya" : "hip", pitch: eastern ? 0.7 : 0.5, eave: [0.8, 0.8, 0.8, 0.8], alongX: W >= D, mat: M.R, trim: M.fm.dark, gable: M.F, soffit: M.F, rafters: true, curved: eastern, ridge: eastern ? "shachi" : "finial", seed: p.b.seed, snow: M.snow, mobile: ctx.quality === "mobile" });
  }
  // Table + stools, lanterns.
  mb.cyl(0, plat, 0, 0.45, 0.45, 0.75, 10, { layer: M.fm.stone });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; mb.cyl(Math.cos(a) * 0.9, plat, Math.sin(a) * 0.9, 0.18, 0.2, 0.42, 8, { layer: M.fm.stone }); }
  if (eastern) { paperLantern(ctx, [hw + 0.3, plat + h - 0.1, hd + 0.3], M.fm.cloth, M.fm.dark, 0.18); paperLantern(ctx, [-hw - 0.3, plat + h - 0.1, hd + 0.3], M.fm.cloth, M.fm.dark, 0.18, false); }
  mb.bevelBox(0, -0.3, D / 2 + 0.2, 1.4, 0.3 + plat * 0.5, 0.45, 0.03, { layer: M.fm.stone });
};

/** Theatre stage: raised platform, back wall with curtain, roof. */
export const stage: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  const carnival = p.lang === "whimsy";
  const plat = 1.0;
  pad(mb, p, M.fm.stone, 0.15);
  mb.box(0, 0.15, -0.3, W - 0.4, plat - 0.15, D - 0.9, { layer: M.fm.dark }, "tnsew", { layer: M.fm.wood });
  const hw = W / 2 - 0.35, back = -D / 2 + 0.4, front = D / 2 - 0.75;
  mb.box(0, plat, back, W - 0.4, 2.8, 0.25, { layer: carnival ? M.awning : L(ctx, "a_plaster") });
  // Curtains.
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const x = sx * (hw - 0.25 - k * 0.2);
      mb.quad([x - 0.12, plat, front - 0.2 - k * 0.02], [x + 0.12, plat, front - 0.2 - k * 0.02 - 0.08], [x + 0.12, plat + 2.8, front - 0.2 - k * 0.02 - 0.08], [x - 0.12, plat + 2.8, front - 0.2 - k * 0.02], { layer: M.fm.cloth, doubleSided: true, tint: [0.8, 0.3, 0.3] });
    }
  }
  mb.box(0, plat + 2.45, front - 0.2, W - 0.5, 0.45, 0.1, { layer: M.fm.cloth, tint: [0.8, 0.3, 0.3] });
  for (const sx of [-1, 1]) mb.cyl(sx * hw, plat, front, 0.12, 0.12, 2.9, 8, { layer: carnival ? M.fm.stone : M.F });
  roof(mb, { x0: -hw, x1: hw, z0: back, z1: front, y: plat + 2.9, kind: p.lang === "eastern" ? "irimoya" : "gable", pitch: 0.6, eave: [0.7, 0.3, 0.5, 0.5], alongX: true, mat: carnival ? M.awning : M.R, trim: M.fm.dark, gable: M.F, soffit: M.F, curved: p.lang === "eastern", ridge: p.lang === "eastern" ? "shachi" : "finial", seed: p.b.seed, snow: M.snow, rafters: true, mobile: ctx.quality === "mobile" });
  // Footlights + steps.
  for (let i = 0; i < 5; i++) mb.box(-hw + 0.5 + ((hw * 2 - 1) * i) / 4, plat, front + 0.05, 0.15, 0.1, 0.12, { layer: M.fm.lit, emissive: 1 });
  light(ctx, [0, plat + 0.6, front], ctx.lampColor, 5, 0.9, "stage");
  for (let i = 0; i < 3; i++) mb.box(hw - 0.5, 0.15 + i * 0.28, front + 0.3 + (2 - i) * 0.1, 0.9, 0.28, 0.3, { layer: M.fm.wood });
  if (p.lang === "eastern") { paperLantern(ctx, [-hw, plat + 2.7, front + 0.4], M.fm.cloth, M.fm.dark); paperLantern(ctx, [hw, plat + 2.7, front + 0.4], M.fm.cloth, M.fm.dark, 0.2, false); }
};

/** Round hut: wattle wall, deep conical thatch, smoke hole, hide door, bone ornaments. */
export const roundhut: SB = (ctx, p, M) => {
  const mb = ctx.mb, r = Math.min(p.W, p.D) / 2 - 0.35;
  pad(mb, p, L(ctx, "ground2"), 0.08);
  mb.cyl(0, 0.05, 0, r + 0.12, r + 0.1, 0.25, 14, { layer: M.fm.stone }, false);
  mb.cyl(0, 0.1, 0, r, r, 1.75, 14, { layer: L(ctx, "a_batten"), tint: p.tint as V3 }, false);
  // Door opening (dark) + hide flap.
  mb.quad([-0.4, 0.1, r + 0.02], [0.4, 0.1, r + 0.02], [0.4, 1.6, r + 0.02], [-0.4, 1.6, r + 0.02], { layer: M.fm.dark, tint: [0.2, 0.18, 0.15] });
  mb.quad([-0.45, 0.15, r + 0.06], [0.05, 0.15, r + 0.1], [0.05, 1.65, r + 0.07], [-0.45, 1.65, r + 0.05], { layer: M.fm.cloth, tint: [0.9, 0.8, 0.65], doubleSided: true });
  mb.box(0, 1.6, r + 0.05, 1.1, 0.12, 0.14, { layer: M.fm.wood });
  // Thatch cone in two courses.
  const R0 = r + 0.75;
  mb.cyl(0, 1.2, 0, R0, r * 0.62, 1.1, 14, { layer: M.R });
  mb.cyl(0, 2.3, 0, r * 0.68, 0.18, 1.5, 14, { layer: M.R, tint: [0.92, 0.9, 0.85] });
  mb.cyl(0, 1.12, 0, R0 + 0.02, R0 - 0.1, 0.12, 14, { layer: M.R, tint: [0.75, 0.72, 0.65] }, false);
  // Poles through the apex.
  for (let i = 0; i < 4; i++) { const a = i * 1.7; mb.beam([Math.cos(a) * 0.1, 3.3, Math.sin(a) * 0.1], [Math.cos(a) * 0.35, 4.2, Math.sin(a) * 0.35], 0.06, { layer: M.fm.wood }); }
  if (p.kit.deco.includes("bones")) {
    mb.blob(0, 2.0, r + 0.55, 0.16, 0.14, 0.14, { layer: L(ctx, "paper"), tint: [1.05, 1.0, 0.9] });
    for (const sx of [-1, 1]) mb.beam([sx * 0.1, 2.05, r + 0.6], [sx * 0.5, 2.5, r + 0.55], 0.05, { layer: L(ctx, "paper"), tint: [1.05, 1.0, 0.9] });
  }
  for (let i = 0; i < 3; i++) { const a = 0.8 + i * 0.5; mb.cyl(Math.cos(a) * (r + 0.45), 0.08, Math.sin(a) * (r + 0.45), 0.15, 0.2, 0.35, 8, { layer: M.fm.stone, tint: [1.1, 0.8, 0.6] }); }
  const tx = -r - 0.2, tz = r * 0.7;
  mb.beam([tx, 0, tz], [tx, 1.9, tz], 0.07, { layer: M.fm.wood });
  mb.box(tx, 1.9, tz, 0.14, 0.2, 0.14, { layer: M.fm.lit, emissive: 1, tint: [1, 0.7, 0.4] });
  light(ctx, [tx, 2.1, tz], [1, 0.55, 0.25], 4.5, 0.9, "torch");
};

/** Hide tent (tipi) with poles, painted band, door flap. */
export const hidetent: SB = (ctx, p, M) => {
  const mb = ctx.mb, r = Math.min(p.W, p.D) / 2 - 0.25;
  pad(mb, p, L(ctx, "ground2"), 0.06);
  const h = 3.4;
  const hide = L(ctx, "cloth2");
  const seg = 9;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2 + Math.PI / 2 + Math.PI / seg, a1 = ((i + 1) / seg) * Math.PI * 2 + Math.PI / 2 + Math.PI / seg;
    const A: V3 = [Math.cos(a0) * r, 0.05, Math.sin(a0) * r], B: V3 = [Math.cos(a1) * r, 0.05, Math.sin(a1) * r];
    const top: V3 = [0, h * 0.86, 0];
    const mA: V3 = [A[0] * 0.55, h * 0.86 * 0.45, A[2] * 0.55], mB: V3 = [B[0] * 0.55, h * 0.86 * 0.45, B[2] * 0.55];
    const doorSeg = i === 0;
    if (!doorSeg) quadOut(mb, A, B, mB, mA, [(A[0] + B[0]) / 2, 0.5, (A[2] + B[2]) / 2], { layer: hide, tint: [1.0, 0.92, 0.78] });
    quadOut(mb, mA, mB, top, top, [(A[0] + B[0]) / 2, 0.8, (A[2] + B[2]) / 2], { layer: hide, tint: [0.95, 0.88, 0.75] });
    // Painted band.
    const b0: V3 = [A[0] * 0.8, h * 0.86 * 0.2 + 0.2, A[2] * 0.8], b1: V3 = [B[0] * 0.8, h * 0.86 * 0.2 + 0.2, B[2] * 0.8];
    if (!doorSeg) quadOut(mb, b0, b1, [b1[0] * 0.97, b1[1] + 0.25, b1[2] * 0.97], [b0[0] * 0.97, b0[1] + 0.25, b0[2] * 0.97], [(A[0] + B[0]), 0.4, (A[2] + B[2])], { layer: M.fm.cloth, tint: [1.1, 0.7, 0.5] });
  }
  // Door flap opening (dark) + poles.
  mb.tri([-0.45, 0.06, r * 0.92], [0.45, 0.06, r * 0.92], [0, 1.5, r * 0.6], { layer: M.fm.dark, tint: [0.2, 0.17, 0.14] });
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; mb.beam([Math.cos(a) * r * 0.98, 0.05, Math.sin(a) * r * 0.98], [-Math.cos(a) * 0.25, h + 0.6, -Math.sin(a) * 0.25], 0.05, { layer: M.fm.wood }); }
  if (p.kit.deco.includes("feathers")) for (let i = 0; i < 3; i++) mb.card(0.1 * i - 0.1, h + 0.4, 0.1, 0.12, 0.35, i * 50, { layer: M.fm.cloth, wind: true });
  woodpile(mb, r * 0.6, 0.05, r + 0.2, M.cm, 0.8, 20);
};

/** Stilt hut: deck on posts, ladder, walls, steep thatch. */
export const stilthut: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "ground2"), 0.05);
  const deckY = 2.0, hw = W / 2 - 0.3, hd = D / 2 - 0.4;
  const postL = p.lang === "eastern" ? L(ctx, "a_lacquer") : M.fm.wood;
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [0, -hd], [0, hd]] as const) mb.cyl(x, 0, z, 0.1, 0.09, deckY + 2.2, 6, { layer: postL });
  for (const [a, b] of [[[-hw, -hd], [hw, hd]], [[hw, -hd], [-hw, hd]]] as const) mb.beam([a[0], 0.3, a[1]], [b[0], deckY - 0.2, b[1]], 0.07, { layer: postL });
  mb.box(0, deckY - 0.12, 0.1, W - 0.4, 0.12, D - 0.6, { layer: M.fm.wood }, "tnsew");
  const bw = W - 1.4, bd = D - 1.5;
  const walls = p.lang === "eastern" ? L(ctx, "a_batten") : L(ctx, "a_batten");
  for (const side of ["s", "e", "n", "w"] as const) {
    const P = wallP(side, bw / 2, bd / 2, 0, -0.1);
    const len = side === "s" || side === "n" ? bw : bd;
    const ops: Op[] = side === "s" ? [{ u: -len / 4, w: 0.8, v0: 0, v1: 1.8, kind: "door", head: "flat", door: p.lang === "tribal" ? "hide" : "sliding", lit: true }, { u: len / 4, w: 0.6, v0: 0.8, v1: 1.4, kind: "win", head: "flat", lattice: p.lang === "eastern", lit: lit(p, 4) }] : [{ u: 0, w: 0.6, v0: 0.8, v1: 1.4, kind: "win", head: "flat", lattice: p.lang === "eastern" }];
    facade(mb, { P, u0: -len / 2, u1: len / 2, y0: deckY, y1: deckY + 2.1, ops, wall: { layer: walls }, mats: M.fm, st: p.st, seed: p.b.seed, mobile: ctx.quality === "mobile" });
  }
  roof(mb, { x0: -bw / 2, x1: bw / 2, z0: -bd / 2 - 0.1, z1: bd / 2 - 0.1, y: deckY + 2.1, kind: p.lang === "eastern" ? "irimoya" : "gable", pitch: 1.2, eave: [0.7, 0.6, 0.6, 0.6], alongX: bw >= bd, mat: M.R, trim: M.fm.wood, gable: walls, soffit: M.fm.wood, curved: p.lang === "eastern", seed: p.b.seed, snow: M.snow, mobile: ctx.quality === "mobile" });
  // Deck railing + ladder.
  for (const [x0, z0, x1, z1] of [[-hw, hd, -0.4, hd], [0.9, hd, hw, hd], [hw, -hd, hw, hd], [-hw, -hd, -hw, hd]] as const) { mb.beam([x0, deckY + 0.8, z0], [x1, deckY + 0.8, z1], 0.06, { layer: postL }); }
  for (let i = 0; i < 7; i++) mb.box(0.25, deckY - 0.3 * (i + 1), hd + 0.2 + i * 0.1, 0.8, 0.05, 0.14, { layer: M.fm.wood });
  mb.beam([-0.15, 0, hd + 1.0], [-0.15, deckY + 0.9, hd + 0.2], 0.06, { layer: M.fm.wood });
  mb.beam([0.65, 0, hd + 1.0], [0.65, deckY + 0.9, hd + 0.2], 0.06, { layer: M.fm.wood });
  if (p.lang === "eastern") paperLantern(ctx, [hw - 0.1, deckY + 2.0, hd + 0.3], M.fm.cloth, M.fm.dark, 0.17);
  else lantern(ctx, wallP("s", bw / 2, bd / 2, 0, -0.1), bw / 2 - 0.3, deckY + 1.9, { metal: M.fm.metal, lit: M.fm.lit }, 4.5);
  barrel(mb, -hw + 0.3, 0.05, hd + 0.2, M.cm, 0.8);
};

/** Watchtower: braced legs, platform with rail, small roof, ladder. */
export const watchtower: SB = (ctx, p, M) => {
  const mb = ctx.mb;
  const pencil = p.b.theme === "T22";
  pad(mb, p, M.fm.stone, 0.12);
  const legL = pencil ? L(ctx, "wall") : M.fm.wood, top = 5.2;
  if (pencil) {
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      mb.push(0, x * 0.95, 0, z * 0.95);
      mb.cyl(0, 0.1, 0, 0.18, 0.16, top - 0.1, 6, { layer: legL, tint: [1.2, 1.0, 0.4] });
      mb.pop();
    }
    trestle(mb, 0.95, 0.85, 0.8, top, M.fm.wood, 0.06, 2);
  } else trestle(mb, 1.05, 0.8, 0.1, top, legL, 0.16, 3);
  mb.box(0, top, 0, 2.3, 0.14, 2.3, { layer: M.fm.wood }, "tnsew");
  for (const [x0, z0, x1, z1] of [[-1.1, -1.1, 1.1, -1.1], [1.1, -1.1, 1.1, 1.1], [1.1, 1.1, -1.1, 1.1], [-1.1, 1.1, -1.1, -1.1]] as const) {
    mb.box((x0 + x1) / 2, top + 0.14, (z0 + z1) / 2, Math.abs(x1 - x0) + 0.08, 0.9, Math.abs(z1 - z0) + 0.08, { layer: L(ctx, "a_batten"), tint: [0.95, 0.9, 0.85] });
  }
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]] as const) mb.box(x, top, z, 0.12, 2.3, 0.12, { layer: legL });
  roof(mb, { x0: -1.1, x1: 1.1, z0: -1.1, z1: 1.1, y: top + 2.3, kind: pencil ? "cone" : "pyramid", pitch: 0.8, eave: [0.35, 0.35, 0.35, 0.35], alongX: true, mat: pencil ? L(ctx, "wood") : M.R, trim: M.fm.wood, gable: M.fm.wood, soffit: M.fm.wood, seed: p.b.seed, snow: M.snow, mobile: ctx.quality === "mobile" });
  if (pencil) mb.cyl(0, top + 2.3 + 1.6 * 0.8 * 1.62 - 0.4, 0, 0.14, 0.02, 0.5, 6, { layer: L(ctx, "metal"), tint: [0.3, 0.3, 0.32] });
  ladder(mb, 0, 1.3, 0.1, top + 0.2, M.fm.wood);
  const c: V3 = [0.9, top + 1.2, 0.9];
  mb.box(c[0], c[1], c[2], 0.16, 0.24, 0.16, { layer: M.fm.lit, emissive: 1, tint: [1, 0.75, 0.45] });
  light(ctx, [c[0], c[1] + 0.1, c[2]], [1, 0.6, 0.3], 5, 0.9, "torch");
  if (p.kit.deco.includes("banners") || p.kit.deco.includes("feathers")) {
    mb.cyl(-1.1, top + 2.3, -1.1, 0.03, 0.03, 1.6, 4, { layer: M.fm.wood });
    mb.quad([-1.1, top + 3.2, -1.1], [-0.4, top + 3.3, -1.1], [-0.4, top + 3.8, -1.1], [-1.1, top + 3.9, -1.1], { layer: M.fm.cloth, doubleSided: true, wind: true });
  }
};

/** Clock tower: stone shaft in stages, four clock faces, belfry arches, spire. */
export const clocktower: SB = (ctx, p, M) => {
  const mb = ctx.mb, s = Math.min(p.W, p.D) - 0.9;
  mb.bevelBox(0, -0.3, 0, p.W, 0.55, p.D, 0.05, { layer: M.fm.stone });
  const wall = p.st.mat.G === "stone" || p.lang === "medieval" ? M.fm.stone : p.lang === "victorian" ? L(ctx, "a_brick") : L(ctx, "a_plaster");
  const stages = [{ h: 3.0, s }, { h: 3.2, s: s - 0.2 }, { h: 2.4, s: s - 0.2 }];
  let y = 0.25;
  for (let i = 0; i < stages.length; i++) {
    const st = stages[i]!;
    for (const side of ["s", "e", "n", "w"] as const) {
      const P = wallP(side, st.s / 2, st.s / 2);
      const ops: Op[] = i === 0 ? (side === "s" ? [{ u: 0, w: 1.1, v0: 0, v1: 2.5, kind: "door", head: "round", door: "double", lit: true }] : [{ u: 0, w: 0.5, v0: 1.0, v1: 2.2, kind: "win", head: "round", lit: lit(p, 20) }])
        : i === 1 ? [{ u: 0, w: 0.45, v0: 0.9, v1: 2.4, kind: "win", head: "round", lit: lit(p, 21 + ["s", "e", "n", "w"].indexOf(side)), mull: "vert" }]
        : [{ u: -0.42, w: 0.6, v0: 0.2, v1: 1.9, kind: "arcade", head: "round", depth: 0.5 }, { u: 0.42, w: 0.6, v0: 0.2, v1: 1.9, kind: "arcade", head: "round", depth: 0.5 }];
      facade(mb, { P, u0: -st.s / 2, u1: st.s / 2, y0: y, y1: y + st.h, ops, wall: { layer: wall, tint: p.tint as V3 }, mats: M.fm, st: { ...p.st, surround: "stone" }, seed: p.b.seed + i, mobile: ctx.quality === "mobile" });
    }
    mb.bevelBox(0, y + st.h - 0.12, 0, st.s + 0.24, 0.24, st.s + 0.24, 0.05, { layer: M.fm.stone });
    // Clock faces on the middle stage top.
    if (i === 1) {
      for (const side of ["s", "e", "n", "w"] as const) {
        const P = wallP(side, st.s / 2, st.s / 2);
        const c = P(0, y + st.h - 0.75, 0.06), c2 = P(0, y + st.h - 0.75, 0.16);
        const nrm: V3 = [c2[0] - c[0], 0, c2[2] - c[2]];
        const ax: V3 = side === "s" ? [1, 0, 0] : side === "n" ? [-1, 0, 0] : side === "e" ? [0, 0, -1] : [0, 0, 1];
        const disc = (rr: number, t: number, layer: number, em = 0) => {
          const n = 14;
          for (let k = 0; k < n; k++) {
            const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
            const pt = (a: number): V3 => [c[0] + ax[0] * Math.cos(a) * rr + nrm[0] * t * 10, c[1] + Math.sin(a) * rr, c[2] + ax[2] * Math.cos(a) * rr + nrm[2] * t * 10];
            mb.tri([c[0] + nrm[0] * t * 10, c[1], c[2] + nrm[2] * t * 10], pt(a0), pt(a1), { layer, emissive: em });
          }
        };
        disc(0.62, 0.0, M.fm.brass);
        disc(0.52, 0.004, L(ctx, "paper"), 0.5);
        const hand = (ang: number, len: number) => { const tip: V3 = [c[0] + ax[0] * Math.sin(ang) * len + nrm[0] * 0.08, c[1] + Math.cos(ang) * len, c[2] + ax[2] * Math.sin(ang) * len + nrm[2] * 0.08]; mb.beam([c[0] + nrm[0] * 0.08, c[1], c[2] + nrm[2] * 0.08], tip, 0.04, { layer: M.fm.dark }); };
        hand(0.9, 0.42); hand(3.7, 0.3);
      }
    }
    y += st.h;
  }
  // Bell inside the belfry.
  lathe(mb, 0, y - 2.1, 0, [[0.42, 0], [0.34, 0.2], [0.26, 0.6], [0.2, 0.8], [0.02, 0.85]], 10, { layer: M.fm.brass });
  const ss = s - 0.2;
  roof(mb, { x0: -ss / 2, x1: ss / 2, z0: -ss / 2, z1: ss / 2, y, kind: p.lang === "mediterranean" ? "pyramid" : "pyramid", pitch: p.lang === "mediterranean" ? 0.7 : 1.6, eave: [0.25, 0.25, 0.25, 0.25], alongX: true, mat: M.R, trim: M.fm.stone, gable: wall, soffit: M.fm.wood, seed: p.b.seed, snow: M.snow, ridge: "finial", mobile: ctx.quality === "mobile" });
  const topY = y + (ss / 2) * (p.lang === "mediterranean" ? 0.7 : 1.6) * 1.25;
  mb.cyl(0, topY, 0, 0.05, 0.03, 1.1, 6, { layer: M.fm.metal });
  obox(mb, [0.18, topY + 0.85, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], 0.2, 0.08, 0.01, { layer: M.fm.metal });
  lantern(ctx, wallP("s", s / 2, s / 2), -0.9, 2.3, { metal: M.fm.metal, lit: M.fm.lit });
};

/** Observatory: drum + metal dome with slit and telescope; or an octagonal glasshouse (snow themes). */
export const observatory: SB = (ctx, p, M) => {
  const mb = ctx.mb, r = Math.min(p.W, p.D) / 2 - 0.5;
  mb.bevelBox(0, -0.3, 0, p.W, 0.6, p.D, 0.05, { layer: M.fm.stone });
  const glass = p.st.snow;
  if (glass) {
    mb.cyl(0, 0.3, 0, r, r, 0.5, 8, { layer: L(ctx, "a_log") }, false);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; mb.box(Math.cos(a) * r * 0.97, 0.8, Math.sin(a) * r * 0.97, 0.1, 2.0, 0.1, { layer: M.fm.dark }); }
    mb.cyl(0, 0.8, 0, r * 0.98, r * 0.98, 2.0, 8, { layer: M.fm.lit, emissive: 0.7 }, false);
    mb.cyl(0, 2.8, 0, r + 0.15, r + 0.15, 0.14, 8, { layer: M.fm.dark });
    mb.cyl(0, 2.94, 0, r + 0.1, 0.3, 1.8, 8, { layer: M.fm.glass, tint: [1.1, 1.15, 1.25] });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; mb.beam([Math.cos(a) * (r + 0.1), 2.95, Math.sin(a) * (r + 0.1)], [Math.cos(a) * 0.3, 4.74, Math.sin(a) * 0.3], 0.07, { layer: M.fm.dark }); }
    light(ctx, [0, 1.8, 0], ctx.lampColor, 6, 1.2, "interior");
    if (M.snow >= 0) mb.cyl(0, 2.97, 0, r + 0.12, r * 0.6, 0.35, 8, { layer: M.snow });
  } else {
    const wall = p.lang === "victorian" ? L(ctx, "a_brick") : M.fm.stone;
    mb.cyl(0, 0.3, 0, r, r, 2.8, 14, { layer: wall, tint: p.tint as V3 }, false);
    mb.cyl(0, 3.0, 0, r + 0.15, r + 0.15, 0.2, 14, { layer: M.fm.stone });
    dome(mb, 0, 3.2, 0, r + 0.05, r * 0.95, 14, 5, { layer: M.fm.metal, tint: [0.75, 1.05, 0.95] });
    // Slit + telescope.
    const sw = 0.4;
    mb.quad([-sw / 2, 3.4, r * 0.95 + 0.06], [sw / 2, 3.4, r * 0.95 + 0.06], [sw / 2, 3.2 + r * 0.9, 0.35], [-sw / 2, 3.2 + r * 0.9, 0.35], { layer: M.fm.dark, tint: [0.15, 0.15, 0.2] });
    tube(mb, [0, 3.5, 0], [0, 4.6, r * 0.9], 0.2, 8, { layer: M.fm.brass }, true, 0.26);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; mb.beam([Math.cos(a) * (r + 0.06), 3.25, Math.sin(a) * (r + 0.06)], [Math.cos(a) * 0.2, 3.2 + r * 0.95, Math.sin(a) * 0.2], 0.035, { layer: M.fm.metal, tint: [0.6, 0.8, 0.75] }); }
    doorAt(mb, 0, r - 0.05, 0.3, 0.9, 2.0, M.fm.door, M.fm.stone, true);
    for (const a of [0.9, 2.2]) winAt(mb, Math.cos(a) * r, 1.3, Math.sin(a) * r, 0.4, 0.8, lit(p, 30), M, 90 - a * 180 / Math.PI);
  }
  lantern(ctx, (u, v, t = 0) => [u, v, r + t], 0.9, 2.3, { metal: M.fm.metal, lit: M.fm.lit });
};

/** Minehead: timber headframe with sheave wheel, hoist shed, adit, rails and cart. */
export const minehead: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "ground2"), 0.1);
  const h = 7.2, wood = M.fm.wood;
  // A-frame headframe.
  for (const sx of [-1, 1]) {
    mb.beam([sx * 1.2, 0.1, -0.6], [sx * 0.4, h, -0.1], 0.22, { layer: wood });
    mb.beam([sx * 1.2, 0.1, 0.6], [sx * 0.4, h, 0.1], 0.22, { layer: wood });
    for (let k = 1; k < 4; k++) { const t = k / 4, x = sx * (1.2 - 0.8 * t), y = 0.1 + (h - 0.1) * t; mb.beam([x, y, -0.6 + 0.5 * t], [x, y, 0.6 - 0.5 * t], 0.1, { layer: wood }); mb.beam([x, y, -0.6 + 0.5 * t], [sx * (1.2 - 0.8 * (t + 0.25)), y + (h - 0.1) * 0.25, 0.6 - 0.5 * (t + 0.25)], 0.08, { layer: wood }); }
  }
  mb.beam([-1.2, 3.2, 0], [1.2, 3.2, 0], 0.14, { layer: wood });
  // Back strut toward the hoist house.
  mb.beam([0, h - 0.3, 0], [0, 0.1, -D / 2 + 1.2], 0.22, { layer: wood });
  // Sheave wheel.
  const wc: V3 = [0, h + 0.3, 0];
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
    mb.beam([wc[0] + Math.cos(a0) * 0.9, wc[1] + Math.sin(a0) * 0.9, 0], [wc[0] + Math.cos(a1) * 0.9, wc[1] + Math.sin(a1) * 0.9, 0], 0.1, { layer: M.fm.metal });
    if (i % 2 === 0) mb.beam(wc, [wc[0] + Math.cos(a0) * 0.9, wc[1] + Math.sin(a0) * 0.9, 0], 0.05, { layer: M.fm.metal });
  }
  tube(mb, [0, wc[1], -0.3], [0, wc[1], 0.3], 0.12, 6, { layer: M.fm.metal }, true);
  tube(mb, [0.9, wc[1], 0], [0.9, 1.2, 0], 0.025, 4, { layer: M.fm.dark });
  tube(mb, [0, wc[1] - 0.9, 0], [0, 1.0, -D / 2 + 1.5], 0.025, 4, { layer: M.fm.dark });
  // Cage at the bottom.
  mb.box(0.9, 0.1, 0, 0.9, 1.1, 0.9, { layer: M.fm.metal, tint: [0.7, 0.7, 0.7] }, "tnsew");
  // Hoist shed.
  const hz = -D / 2 + 0.95;
  mb.box(0, 0.1, hz, Math.min(W - 0.6, 3.6), 2.3, 1.5, { layer: L(ctx, "a_batten"), tint: p.tint as V3 });
  roof(mb, { x0: -Math.min(W - 0.6, 3.6) / 2, x1: Math.min(W - 0.6, 3.6) / 2, z0: hz - 0.75, z1: hz + 0.75, y: 2.4, kind: "shed", pitch: 0.4, eave: [0.3, 0.2, 0.2, 0.2], alongX: true, mat: L(ctx, "a_corr"), trim: wood, gable: L(ctx, "a_batten"), soffit: wood, seed: p.b.seed, snow: M.snow });
  mb.cyl(1.2, 2.4, hz - 0.2, 0.16, 0.16, 1.6, 8, { layer: M.fm.metal });
  // Rails + cart.
  for (const sx of [-0.35, 0.35]) mb.box(-1.4 + sx, 0.12, D / 2 - 1.0, 0.05, 0.05, 2.4, { layer: M.fm.metal });
  for (let i = 0; i < 6; i++) mb.box(-1.4, 0.1, D / 2 - 2.1 + i * 0.42, 0.95, 0.04, 0.14, { layer: wood });
  mb.box(-1.4, 0.3, D / 2 - 0.8, 0.8, 0.55, 1.0, { layer: M.fm.metal, tint: [0.8, 0.7, 0.6] }, "nsew");
  mb.blob(-1.4, 0.7, D / 2 - 0.8, 0.35, 0.2, 0.45, { layer: M.fm.stone, tint: [0.6, 0.55, 0.5] }, 1, 0.3);
  lantern(ctx, (u, v, t = 0) => [u, v, hz + 0.75 + t], 0.6, 2.1, { metal: M.fm.metal, lit: M.fm.lit });
};

/** Station hall: brick end walls, iron-and-glass barrel roof, clock over the entrance. */
export const stationhall: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, M.fm.stone, 0.25);
  const hw = W / 2 - 0.1, hd = D / 2 - 0.1, h = 3.4;
  const wall = L(ctx, "a_brick");
  for (const side of ["s", "n", "e", "w"] as const) {
    const len = side === "s" || side === "n" ? hw * 2 : hd * 2;
    const P = wallP(side, hw, hd);
    const ops: Op[] = side === "s" ? [{ u: 0, w: 2.0, v0: 0, v1: 3.0, kind: "door", head: "round", door: "glass", lit: true }, { u: -len / 2 + 1.0, w: 0.8, v0: 0.9, v1: 2.6, kind: "win", head: "round", lit: lit(p, 40), mull: "grid" }, { u: len / 2 - 1.0, w: 0.8, v0: 0.9, v1: 2.6, kind: "win", head: "round", lit: lit(p, 41), mull: "grid" }]
      : Array.from({ length: Math.max(1, Math.floor(len / 1.6)) }, (_, i) => ({ u: -len / 2 + (len / Math.max(1, Math.floor(len / 1.6))) * (i + 0.5), w: 0.8, v0: 0.9, v1: 2.6, kind: "win" as const, head: "round" as const, lit: lit(p, 42 + i), mull: "grid" as const }));
    facade(mb, { P, u0: -len / 2, u1: len / 2, y0: 0.25, y1: 0.25 + h, ops, wall: { layer: wall, tint: p.tint as V3 }, mats: M.fm, st: { ...p.st, surround: "keystone" }, seed: p.b.seed, mobile: ctx.quality === "mobile" });
  }
  mb.bevelBox(0, 0.25 + h - 0.1, 0, W, 0.25, D, 0.05, { layer: M.fm.stone });
  roof(mb, { x0: -hw, x1: hw, z0: -hd, z1: hd, y: 0.25 + h + 0.15, kind: "barrel", pitch: 0.5, eave: [0.3, 0.3, 0.3, 0.3], alongX: false, mat: M.fm.glass, trim: M.fm.metal, gable: wall, soffit: M.fm.metal, seed: p.b.seed, accent: M.fm.lit });
  const span = W;
  for (let i = 0; i <= Math.round(D / 1.2); i++) {
    const z = -hd + (2 * hd * i) / Math.round(D / 1.2);
    for (let k = 0; k < 7; k++) { const t0 = k / 7, t1 = (k + 1) / 7; mb.beam([-span / 2 + span * t0, 0.25 + h + 0.15 + Math.sin(Math.PI * t0) * span * 0.28, z], [-span / 2 + span * t1, 0.25 + h + 0.15 + Math.sin(Math.PI * t1) * span * 0.28, z], 0.06, { layer: M.fm.metal }); }
  }
  // Front gable with clock.
  const cy = 0.25 + h + span * 0.2;
  const PS = wallP("s", hw, hd);
  const c = PS(0, cy, 0.3);
  mb.cyl(c[0], c[1] - 0.6, c[2], 0.62, 0.62, 0.1, 14, { layer: M.fm.brass });
  mb.box(c[0], c[1] - 0.95, c[2] - 0.2, 1.6, 1.3, 0.3, { layer: wall });
  mb.quad([c[0] - 0.5, c[1] - 0.8, c[2] + 0.12], [c[0] + 0.5, c[1] - 0.8, c[2] + 0.12], [c[0] + 0.5, c[1] + 0.2, c[2] + 0.12], [c[0] - 0.5, c[1] + 0.2, c[2] + 0.12], { layer: L(ctx, "paper"), emissive: 0.5 });
  mb.beam([c[0], c[1] - 0.3, c[2] + 0.15], [c[0] + 0.25, c[1] - 0.1, c[2] + 0.15], 0.04, { layer: M.fm.dark });
  mb.beam([c[0], c[1] - 0.3, c[2] + 0.15], [c[0], c[1] + 0.05, c[2] + 0.15], 0.04, { layer: M.fm.dark });
  lantern(ctx, PS, -1.4, 2.6, { metal: M.fm.metal, lit: M.fm.lit });
  lantern(ctx, PS, 1.4, 2.6, { metal: M.fm.metal, lit: M.fm.lit });
};

/** Stave church: tiered roofs with dragon-head gables, dark boards, spire. */
export const stavechurch: SB = (ctx, p, M) => {
  const mb = ctx.mb, s = Math.min(p.W, p.D) - 0.8;
  mb.bevelBox(0, -0.3, 0, p.W, 0.6, p.D, 0.05, { layer: M.fm.stone });
  const boards = L(ctx, "a_batten");
  const tiers = [{ s, h: 2.3 }, { s: s * 0.72, h: 1.6 }, { s: s * 0.46, h: 1.4 }];
  let y = 0.3;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]!;
    for (const side of ["s", "e", "n", "w"] as const) {
      const P = wallP(side, t.s / 2, t.s / 2);
      const ops: Op[] = i === 0 && side === "s" ? [{ u: 0, w: 1.0, v0: 0, v1: 2.1, kind: "door", head: "round", door: "plank" }] : i === 1 ? [{ u: 0, w: 0.3, v0: 0.5, v1: 1.1, kind: "win", head: "round", lit: lit(p, 50 + i) }] : [];
      facade(mb, { P, u0: -t.s / 2, u1: t.s / 2, y0: y, y1: y + t.h, ops, wall: { layer: boards, tint: [0.62, 0.52, 0.45] }, mats: M.fm, st: p.st, seed: p.b.seed + i, mobile: ctx.quality === "mobile" });
    }
    const last = i === tiers.length - 1;
    const info = roof(mb, { x0: -t.s / 2, x1: t.s / 2, z0: -t.s / 2, z1: t.s / 2, y: y + t.h, kind: last ? "pyramid" : "gable", pitch: last ? 2.2 : 1.1, eave: [0.35, 0.35, 0.35, 0.35], alongX: true, mat: M.R, trim: M.fm.dark, gable: boards, soffit: M.fm.dark, seed: p.b.seed + i, snow: M.snow, mobile: ctx.quality === "mobile" });
    if (!last) {
      // Dragon heads at the gable apexes.
      for (const sx of [-1, 1]) {
        const a: V3 = [sx * (t.s / 2 + 0.35), info.ridgeY, 0];
        mb.beam(a, [a[0] + sx * 0.55, a[1] + 0.6, 0], 0.12, { layer: M.fm.dark });
        mb.beam([a[0] + sx * 0.55, a[1] + 0.6, 0], [a[0] + sx * 0.85, a[1] + 0.55, 0], 0.1, { layer: M.fm.dark });
      }
      // Cross gable on the other axis.
      roof(mb, { x0: -t.s / 4, x1: t.s / 4, z0: -t.s / 2, z1: t.s / 2, y: y + t.h, kind: "gable", pitch: 1.6, eave: [0.35, 0.35, 0, 0], alongX: false, mat: M.R, trim: M.fm.dark, gable: boards, soffit: M.fm.dark, seed: p.b.seed + i + 9, snow: M.snow, mobile: ctx.quality === "mobile" });
    }
    y += t.h + (last ? 0 : (t.s / 2) * 1.1 * 0.55);
  }
  // Covered arcade (svalgang) skirt around the base.
  const e = s / 2 + 0.55;
  roof(mb, { x0: -s / 2, x1: s / 2, z0: -s / 2, z1: s / 2, y: 1.7, kind: "hip", pitch: 0.55, eave: [0.55, 0.55, 0.55, 0.55], alongX: true, mat: M.R, trim: M.fm.dark, gable: boards, soffit: M.fm.dark, seed: p.b.seed + 3, snow: M.snow, mobile: ctx.quality === "mobile" });
  for (const [x, z] of [[-e + 0.1, e - 0.1], [e - 0.1, e - 0.1], [-e + 0.1, -e + 0.1], [e - 0.1, -e + 0.1]] as const) mb.box(x, 0.3, z, 0.12, 1.35, 0.12, { layer: M.fm.dark });
  lantern(ctx, wallP("s", s / 2, s / 2), 0.9, 1.9, { metal: M.fm.metal, lit: M.fm.lit });
};

/** Watermill: house (generic body) + big undershot wheel with flume. */
export const watermillWheel = (ctx: Ctx, p: Plan, M: Mats, x: number, z: number, r = 1.5) => {
  const mb = ctx.mb, wood = M.fm.wood;
  const cy = r + 0.05;
  for (const dx of [-0.3, 0.3]) {
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
      mb.beam([x + dx, cy + Math.sin(a0) * r, z + Math.cos(a0) * r], [x + dx, cy + Math.sin(a1) * r, z + Math.cos(a1) * r], 0.1, { layer: wood });
      if (i % 2 === 0) mb.beam([x + dx, cy, z], [x + dx, cy + Math.sin(a0) * r, z + Math.cos(a0) * r], 0.07, { layer: wood });
    }
  }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; obox(mb, [x, cy + Math.sin(a) * (r - 0.1), z + Math.cos(a) * (r - 0.1)], [1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)], 0.36, 0.16, 0.025, { layer: wood, tint: [0.9, 0.85, 0.8] }); }
  tube(mb, [x - 0.6, cy, z], [x + 0.2, cy, z], 0.12, 6, { layer: M.fm.metal }, true);
  // Flume.
  mb.box(x, 2 * r + 0.15, z - r * 0.5, 0.6, 0.1, r * 1.2, { layer: wood });
  for (const dx of [-0.3, 0.3]) mb.box(x + dx, 2 * r + 0.15, z - r * 0.5, 0.05, 0.3, r * 1.2, { layer: wood });
  mb.quad([x - 0.25, 2 * r + 0.28, z - r * 1.1], [x + 0.25, 2 * r + 0.28, z - r * 1.1], [x + 0.25, 2 * r + 0.28, z + 0.1], [x - 0.25, 2 * r + 0.28, z + 0.1], { layer: M.water });
  mb.box(x, 0, z - r * 1.0, 0.12, 2 * r + 0.15, 0.12, { layer: wood });
  void p;
};

export const gantry: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D;
  pad(mb, p, L(ctx, "a_concrete"), 0.1);
  const h = 7.5, hw = W / 2 - 0.4, zb = -D / 2 + 0.7;
  const steel = L(ctx, "a_corr");
  const paint: V3 = p.r(70) < 0.5 ? [1.3, 0.85, 0.35] : [1.25, 0.5, 0.35];
  for (const sx of [-1, 1]) {
    mb.beam([sx * hw, 0.1, zb - 0.6], [sx * hw, h, zb], 0.3, { layer: M.fm.metal, tint: paint });
    mb.beam([sx * hw, 0.1, zb + 0.6], [sx * hw, h, zb], 0.3, { layer: M.fm.metal, tint: paint });
    mb.beam([sx * hw, 2.5, zb - 0.45], [sx * hw, 2.5, zb + 0.45], 0.14, { layer: M.fm.metal, tint: paint });
    mb.box(sx * hw, 0.1, zb, 0.5, 0.35, 1.8, { layer: M.fm.metal, tint: [0.4, 0.4, 0.42] });
  }
  mb.box(0, h, zb, W - 0.3, 0.7, 0.8, { layer: M.fm.metal, tint: paint });
  mb.box(0, h + 0.7, zb, W - 0.3, 0.06, 0.9, { layer: M.fm.metal });
  // Trolley + hook + cab.
  const tx = (p.r(71) - 0.5) * (W - 2);
  mb.box(tx, h - 0.4, zb, 0.9, 0.4, 1.0, { layer: M.fm.metal, tint: [0.9, 0.9, 0.9] });
  for (const dz of [-0.2, 0.2]) tube(mb, [tx, h - 0.4, zb + dz], [tx, 2.2, zb + dz], 0.02, 4, { layer: M.fm.dark });
  mb.box(tx, 1.9, zb, 0.4, 0.3, 0.4, { layer: M.fm.metal, tint: [1.3, 1.1, 0.4] });
  mb.box(hw - 0.9, h - 1.5, zb + 0.5, 1.0, 1.0, 0.9, { layer: steel, tint: paint });
  mb.quad([hw - 1.35, h - 1.3, zb + 0.96], [hw - 0.45, h - 1.3, zb + 0.96], [hw - 0.45, h - 0.65, zb + 0.96], [hw - 1.35, h - 0.65, zb + 0.96], { layer: M.fm.lit, emissive: 0.8 });
  for (let i = 0; i < 4; i++) mb.box(-hw + 0.8, 0.1 + i * 1.8, zb + 0.55, 0.5, 0.05, 0.5, { layer: M.fm.metal });
  // Cargo under the crane.
  for (let i = 0; i < 2; i++) mb.box(-1.2 + i * 2.4, 0.1, D / 2 - 1.4, 2.0, 1.2, 1.1, { layer: steel, tint: i ? [0.5, 0.75, 1.15] : [1.2, 0.55, 0.4] });
  light(ctx, [0, h - 0.5, zb + 0.6], [1, 0.95, 0.85], 7, 1.0, "flood");
};

export const helpers = { pad, fence, trestle, ladder, railRing, doorAt, winAt, lit, crate, barrel, onion, rotZ, lathe };
export type { FaceOpts };
