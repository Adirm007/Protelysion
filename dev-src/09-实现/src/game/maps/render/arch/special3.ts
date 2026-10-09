// Signature and special building forms (hd2d-architecture-3), part 3: the backstage theatre set (baroque
// theatre with fly tower rigging, suspended marionette control booth, scenery store) and the carnival
// carousel. Shared rigging helpers (pulley wheels, sandbags, marionette figure) are exported for reuse.
import type { FaceOpts, MeshBuilder, V3 } from "../mesh";
import type { Ctx } from "../ground";
import { quadOut, triOut, tube, wallP, wbox, wq } from "./geo";
import { roof } from "./roofs";
import { facade, type Op } from "./facade";
import { barrel, crate, lantern, light } from "./parts";
import { pad, type SB } from "./special";
import type { Plan } from "./plan";
import type { Mats } from "./house";

const L = (ctx: Ctx, id: string) => ctx.layer(id);
const mob = (ctx: Ctx) => ctx.quality === "mobile";
const lit = (p: Plan, i: number) => p.r(700 + i) < 0.6;

// ------------------------------------------------------------------------------------------------
// Rigging helpers.

/** Vertical wheel in the plane spanned by unit axes `ax` (horizontal) and y, centred at c. */
export function wheel(mb: MeshBuilder, c: V3, ax: V3, r: number, o: FaceOpts, hub: FaceOpts, seg = 12, spokes = 6, rimT = 0.07) {
  const at = (a: number, rr: number): V3 => [c[0] + ax[0] * Math.cos(a) * rr, c[1] + Math.sin(a) * rr, c[2] + ax[2] * Math.cos(a) * rr];
  for (let i = 0; i < seg; i++) mb.beam(at((i / seg) * Math.PI * 2, r), at(((i + 1) / seg) * Math.PI * 2, r), rimT, o);
  for (let i = 0; i < spokes; i++) mb.beam(c, at((i / spokes) * Math.PI * 2 + 0.3, r), rimT * 0.55, o);
  const n: V3 = [-ax[2], 0, ax[0]];
  mb.beam([c[0] - n[0] * 0.09, c[1], c[2] - n[2] * 0.09], [c[0] + n[0] * 0.09, c[1], c[2] + n[2] * 0.09], rimT * 1.7, hub);
}

/** Rope with a hanging sandbag (counterweight) at its lower end. */
export function sandbag(mb: MeshBuilder, top: V3, y: number, rope: number, bag: number, s = 1) {
  tube(mb, top, [top[0], y + 0.34 * s, top[2]], 0.014, 3, { layer: rope });
  mb.blob(top[0], y + 0.17 * s, top[2], 0.17 * s, 0.2 * s, 0.15 * s, { layer: bag, tint: [0.92, 0.84, 0.7] }, 1, 0.25, Math.round(top[0] * 31 + top[2] * 17));
  mb.box(top[0], y + 0.33 * s, top[2], 0.1 * s, 0.05 * s, 0.1 * s, { layer: rope });
}

export type PuppetMats = { wood: number; cloth: number; face: number; string: number; bar: number };
/**
 * Marionette hanging from a cross-shaped control bar: head, torso, jointed arms and legs, and strings
 * from the bar to head, hands and knees. `c` is the control bar centre; the figure hangs `drop` below it.
 */
export function marionette(mb: MeshBuilder, c: V3, drop: number, h: number, yaw: number, m: PuppetMats, seed: number, costume: V3 = [1.25, 0.4, 0.4]) {
  const k = h / 2.2;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  // Local (x across, y up, z toward viewer) → world.
  const W = (x: number, y: number, z: number): V3 => [c[0] + x * cy + z * sy, c[1] + y, c[2] - x * sy + z * cy];
  // Control bar: main bar + cross bar + hook.
  mb.beam(W(-0.55 * k, 0, 0), W(0.55 * k, 0, 0), 0.07 * k, { layer: m.bar });
  mb.beam(W(0, 0, -0.4 * k), W(0, 0, 0.4 * k), 0.07 * k, { layer: m.bar });
  const top = -drop; // top of the head, relative to the bar
  const neck = top - 0.42 * k, hip = neck - 0.78 * k;
  const sway = (seed % 7) / 7 - 0.5;
  // Head (with a painted face on the front) + hat.
  mb.blob(W(0, top - 0.2 * k, 0)[0], W(0, top - 0.2 * k, 0)[1], W(0, top - 0.2 * k, 0)[2], 0.19 * k, 0.21 * k, 0.19 * k, { layer: m.face, tint: [1.06, 0.95, 0.86] }, 1, 0.05, seed);
  const hat = W(0, top - 0.04 * k, 0);
  mb.cyl(hat[0], hat[1], hat[2], 0.2 * k, 0.12 * k, 0.18 * k, 6, { layer: m.cloth, tint: costume });
  for (const ex of [-0.07, 0.07]) { const e = W(ex * k, top - 0.19 * k, 0.18 * k); mb.box(e[0], e[1], e[2], 0.04 * k, 0.05 * k, 0.02 * k, { layer: m.bar, tint: [0.2, 0.15, 0.15] }); }
  // Torso (costume) + collar ruff.
  const t0 = W(0, hip, 0);
  mb.push(-(yaw * 180) / Math.PI, t0[0], t0[1], t0[2]);
  mb.bevelBox(0, 0, 0, 0.5 * k, 0.78 * k, 0.28 * k, 0.05 * k, { layer: m.cloth, tint: costume });
  mb.box(0, 0.7 * k, 0, 0.56 * k, 0.1 * k, 0.34 * k, { layer: m.face, tint: [1.1, 1.08, 1.02] });
  mb.box(0, -0.02 * k, 0, 0.52 * k, 0.1 * k, 0.3 * k, { layer: m.bar });
  mb.pop();
  // Arms: shoulder → elbow → hand (one raised, one hanging).
  const armL: V3[] = [W(-0.3 * k, neck - 0.12 * k, 0), W(-0.52 * k, neck - 0.45 * k, 0.1 * k), W(-0.6 * k, neck - 0.1 * k + sway * 0.3 * k, 0.22 * k)];
  const armR: V3[] = [W(0.3 * k, neck - 0.12 * k, 0), W(0.42 * k, neck - 0.52 * k, 0.05 * k), W(0.46 * k, neck - 0.9 * k, 0.12 * k)];
  for (const arm of [armL, armR]) {
    mb.beam(arm[0]!, arm[1]!, 0.1 * k, { layer: m.cloth, tint: costume });
    mb.beam(arm[1]!, arm[2]!, 0.08 * k, { layer: m.wood });
    mb.blob(arm[2]![0], arm[2]![1], arm[2]![2], 0.06 * k, 0.07 * k, 0.06 * k, { layer: m.face, tint: [1.06, 0.95, 0.86] }, 0);
  }
  // Legs: hip → knee → foot (mid-step).
  const legL: V3[] = [W(-0.13 * k, hip, 0), W(-0.2 * k, hip - 0.5 * k, 0.18 * k), W(-0.18 * k, hip - 0.98 * k, 0.1 * k)];
  const legR: V3[] = [W(0.13 * k, hip, 0), W(0.15 * k, hip - 0.52 * k, -0.04 * k), W(0.16 * k, hip - 1.02 * k, -0.02 * k)];
  for (const leg of [legL, legR]) {
    mb.beam(leg[0]!, leg[1]!, 0.12 * k, { layer: m.cloth, tint: [costume[0] * 0.55, costume[1] * 0.55, costume[2] * 0.7] });
    mb.beam(leg[1]!, leg[2]!, 0.1 * k, { layer: m.wood });
    const f = leg[2]!;
    mb.push(-(yaw * 180) / Math.PI, f[0], f[1] - 0.05 * k, f[2]);
    mb.box(0, 0, 0.05 * k, 0.12 * k, 0.08 * k, 0.24 * k, { layer: m.bar });
    mb.pop();
  }
  // Strings.
  const s = { layer: m.string, tint: [1.2, 1.18, 1.1] as V3 };
  tube(mb, W(-0.5 * k, 0, 0), armL[2]!, 0.006, 3, s);
  tube(mb, W(0.5 * k, 0, 0), armR[2]!, 0.006, 3, s);
  tube(mb, W(0, 0, -0.36 * k), W(0, top, 0), 0.006, 3, s);
  tube(mb, W(-0.2 * k, 0, 0.36 * k), legL[1]!, 0.006, 3, s);
  tube(mb, W(0.2 * k, 0, 0.36 * k), legR[1]!, 0.006, 3, s);
}

/** Gathered stage drape pulled to one side (fold strips + tie-back), hanging from `top` to `bottom`. */
function drape(mb: MeshBuilder, P: (u: number, v: number, t?: number) => V3, u0: number, u1: number, vTop: number, vBot: number, t: number, velvet: number, rope: number, left: boolean) {
  const n = 5, w = u1 - u0;
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n;
    // Tie-back pinches the drape toward the jamb at 45% height.
    const pinch = (v: number) => { const q = (v - vBot) / (vTop - vBot); const tie = Math.abs(q - 0.42); return 0.35 + Math.min(0.65, tie * 1.6); };
    const uAt = (f: number, v: number) => (left ? u0 + w * f * pinch(v) : u1 - w * f * pinch(v));
    const rows = [vBot, vBot + (vTop - vBot) * 0.42, vTop];
    for (let r = 0; r < 2; r++) {
      const va = rows[r]!, vb = rows[r + 1]!;
      const tz = t + (i % 2 === 0 ? 0.03 : 0);
      const A = P(uAt(a, va), va, tz), B = P(uAt(b, va), va, tz), C = P(uAt(b, vb), vb, tz), D = P(uAt(a, vb), vb, tz);
      const uv0 = left ? a : 1 - a, uv1 = left ? b : 1 - b;
      const face: FaceOpts = { layer: velvet, uvs: [[uv0 * 0.5, r === 0 ? 0.995 : 0.6], [uv1 * 0.5, r === 0 ? 0.995 : 0.6], [uv1 * 0.5, r === 0 ? 0.6 : 0.02], [uv0 * 0.5, r === 0 ? 0.6 : 0.02]] };
      if (left) mb.quad(A, B, C, D, face); else mb.quad(B, A, D, C, { ...face, uvs: [face.uvs![1]!, face.uvs![0]!, face.uvs![3]!, face.uvs![2]!] });
    }
  }
  const tieV = vBot + (vTop - vBot) * 0.42, tu = left ? u0 + w * 0.35 : u1 - w * 0.35;
  mb.beam(P(left ? u0 : u1, tieV, t + 0.04), P(tu, tieV, t + 0.05), 0.05, { layer: rope, tint: [1.3, 1.05, 0.5] });
}

/** Valance with scallops along a wall-space span. */
function valance(mb: MeshBuilder, P: (u: number, v: number, t?: number) => V3, u0: number, u1: number, v: number, t: number, velvet: number, fringe: number) {
  const n = Math.max(3, Math.round((u1 - u0) / 0.45));
  wq(mb, P, u0, u1, v - 0.32, v, t, { layer: velvet, uvs: [[0, 0.6], [(u1 - u0) * 0.5, 0.6], [(u1 - u0) * 0.5, 0.3], [0, 0.3]] });
  for (let i = 0; i < n; i++) {
    const a = u0 + ((u1 - u0) * i) / n, b = u0 + ((u1 - u0) * (i + 1)) / n;
    mb.tri(P(a, v - 0.32, t), P((a + b) / 2, v - 0.5, t), P(b, v - 0.32, t), { layer: velvet, tint: [0.85, 0.8, 0.8] });
    mb.box(...P((a + b) / 2, v - 0.56, t), 0.05, 0.1, 0.05, { layer: fringe });
  }
}

/** Fly-tower rigging on a side wall: gridiron beams, two pulley wheels, ropes and counterweight bags. */
export function rigging(ctx: Ctx, M: Mats, x: number, z0: number, z1: number, yTop: number, side: 1 | -1) {
  const mb = ctx.mb, wood = M.fm.dark, rope = M.cm.cloth2;
  const out = side * 0.55;
  // Outrigger beams from the wall top + a longitudinal header.
  for (const z of [z0 + 0.2, z1 - 0.2]) mb.beam([x, yTop - 0.1, z], [x + out, yTop + 0.25, z], 0.14, { layer: wood });
  mb.beam([x + out, yTop + 0.25, z0 + 0.1], [x + out, yTop + 0.25, z1 - 0.1], 0.16, { layer: wood });
  // Pulley wheels hanging below the header.
  const zs = [z0 + (z1 - z0) * 0.3, z0 + (z1 - z0) * 0.72];
  zs.forEach((z, i) => {
    const r = 0.42 - i * 0.08, c: V3 = [x + out, yTop - r + 0.05, z];
    mb.beam([x + out, yTop + 0.2, z], [x + out, c[1], z], 0.08, { layer: M.fm.metal });
    wheel(mb, c, [0, 0, 1], r, { layer: wood }, { layer: M.fm.metal }, mob(ctx) ? 8 : 12, 5, 0.07);
    // Ropes run off the wheel: one to a sandbag, one tied off low on a cleat rail.
    const bagY = 2.2 + i * 0.9;
    sandbag(mb, [x + out, c[1], z + r], bagY, rope, M.cm.cloth2, 1.1);
    tube(mb, [x + out, c[1], z - r], [x + side * 0.08, 1.3, z - r - 0.1], 0.014, 3, { layer: rope });
  });
  // Cleat (pin) rail on the wall.
  mb.box(x + side * 0.06, 1.2, (z0 + z1) / 2, 0.12, 0.12, Math.min(1.8, z1 - z0 - 0.4), { layer: wood });
  for (let i = 0; i < 5; i++) mb.box(x + side * 0.13, 1.22, (z0 + z1) / 2 - 0.7 + i * 0.35, 0.05, 0.22, 0.05, { layer: M.fm.brass });
}

// ------------------------------------------------------------------------------------------------
/** Baroque theatre: rusticated base with three arched doors, a marquee, posters, piano-nobile windows with
 * velvet drapes, pilasters, a gilded cornice and pediment medallion, and a tall fly tower with rigging. */
export const theater: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D, mobile = mob(ctx);
  pad(mb, p, M.fm.stone, 0.25);
  const y0 = 0.25, fh = 2.75, top = y0 + fh * 2;
  const hw = W / 2 - 0.25, zf = D / 2 - 0.45, zb = -D / 2 + 1.25;
  const cz = (zf + zb) / 2, hd = (zf - zb) / 2;
  const stone = M.fm.stone, plaster = L(ctx, "a_plaster"), velvet = L(ctx, "a_velvet"), gilt = M.fm.brass;
  const warm: V3 = [p.tint[0] * 1.04, p.tint[1] * 0.96, p.tint[2] * 0.88];
  const st = p.st;
  // ---- hall facades ----
  for (const side of ["s", "e", "w", "n"] as const) {
    const len = side === "s" || side === "n" ? hw * 2 : hd * 2;
    const P = wallP(side, hw, hd, 0, cz);
    for (const storey of [0, 1]) {
      const ops: Op[] = [];
      const yb = y0 + storey * fh;
      if (side === "s") {
        const us = [-hw * 0.62, 0, hw * 0.62];
        us.forEach((u, i) => {
          if (storey === 0) ops.push(i === 1 ? { u, w: 1.3, v0: 0, v1: 2.35, kind: "door", head: "round", door: "glass", lit: true, transom: true } : { u, w: 0.95, v0: 0, v1: 2.2, kind: "door", head: "round", door: "double", lit: true });
          else ops.push({ u, w: 0.95, v0: 0.35, v1: 2.35, kind: "win", head: "round", lit: true, mull: "none", balcony: i === 1 ? "iron" : null });
        });
      } else if (side !== "n") {
        const n = Math.max(1, Math.floor((len - 0.6) / 1.5));
        for (let i = 0; i < n; i++) ops.push({ u: -len / 2 + (len / n) * (i + 0.5), w: 0.62, v0: storey ? 0.5 : 0.7, v1: storey ? 2.1 : 1.9, kind: "win", head: "round", lit: lit(p, i + storey * 5 + (side === "e" ? 11 : 0)), mull: st.mull });
      }
      facade(mb, { P, u0: -len / 2, u1: len / 2, y0: yb, y1: yb + fh, ops, wall: storey === 0 ? { layer: stone, tint: [0.96, 0.94, 0.9] } : { layer: plaster, tint: warm }, mats: M.fm, st, seed: p.b.seed + storey * 7 + side.charCodeAt(0), mobile });
    }
    // String course + cornice with a gilded fillet.
    wbox(mb, P, -len / 2 - 0.06, len / 2 + 0.06, y0 + fh - 0.08, y0 + fh + 0.1, 0, 0.12, { layer: stone }, "ftb");
    wbox(mb, P, -len / 2 - 0.14, len / 2 + 0.14, top - 0.05, top + 0.28, 0, 0.26, { layer: stone, tint: [1.02, 1, 0.96] }, "ftb");
    wbox(mb, P, -len / 2 - 0.1, len / 2 + 0.1, top - 0.14, top - 0.07, 0, 0.2, { layer: gilt }, "f");
  }
  const PS = wallP("s", hw, hd, 0, cz);
  // Pilasters on the piano nobile + rusticated joints on the base.
  for (const u of [-hw + 0.12, -hw * 0.31, hw * 0.31, hw - 0.12]) {
    wbox(mb, PS, u - 0.13, u + 0.13, y0 + fh + 0.1, top - 0.05, 0, 0.1, { layer: stone, tint: [1.04, 1.02, 0.98] }, "flr");
    wbox(mb, PS, u - 0.17, u + 0.17, top - 0.32, top - 0.05, 0, 0.14, { layer: gilt, tint: [0.9, 0.85, 0.8] }, "ftlr");
  }
  if (!mobile) for (let v = y0 + 0.45; v < y0 + fh - 0.2; v += 0.45) wbox(mb, PS, -hw, hw, v, v + 0.035, -0.01, 0.015, { layer: stone, tint: [0.6, 0.58, 0.56] }, "f");
  // Velvet drapes inside the upper arched windows.
  for (const u of [-hw * 0.62, 0, hw * 0.62]) {
    const vb = y0 + fh + 0.35, vt = y0 + fh + 2.1;
    drape(mb, PS, u - 0.47, u - 0.1, vt, vb, -0.14, velvet, gilt, true);
    drape(mb, PS, u + 0.1, u + 0.47, vt, vb, -0.14, velvet, gilt, false);
  }
  // Marquee canopy over the doors, bulbs underneath, title board on top.
  wbox(mb, PS, -hw * 0.9, hw * 0.9, y0 + 2.5, y0 + 2.72, 0, 1.05, { layer: gilt }, "ftblr", { layer: M.fm.dark });
  const nb = mobile ? 8 : 16;
  for (let i = 0; i < nb; i++) { const u = -hw * 0.86 + (hw * 1.72 * i) / (nb - 1), c = PS(u, y0 + 2.46, 1.0); mb.box(c[0], c[1], c[2], 0.07, 0.07, 0.07, { layer: M.fm.lit, emissive: 1 }); }
  wbox(mb, PS, -hw * 0.55, hw * 0.55, y0 + 2.72, y0 + 3.1, 0.9, 0.96, { layer: L(ctx, "a_sign"), tint: [1.1, 0.95, 0.8] }, "ftlr");
  for (const u of [-hw * 0.9, hw * 0.9]) { const a = PS(u, y0 + 2.62, 1.0), b = PS(u, y0 + fh + 0.6, 0.02); mb.beam(a, b, 0.04, { layer: M.fm.metal }); }
  light(ctx, PS(0, y0 + 2.2, 1.2), ctx.lampColor, 6.5, 1.2, "wall");
  // Posters between the doors.
  for (const u of [-hw * 0.31, hw * 0.31]) {
    wq(mb, PS, u - 0.32, u + 0.32, y0 + 0.75, y0 + 1.95, 0.03, { layer: L(ctx, "a_poster"), uvs: [[0.02, 0.98], [0.98, 0.98], [0.98, 0.02], [0.02, 0.02]] });
    wbox(mb, PS, u - 0.37, u + 0.37, y0 + 0.7, y0 + 2.0, 0.0, 0.03, { layer: gilt }, "tblr");
  }
  // Pediment with a medallion (comedy / tragedy roundel).
  const pw = hw * 0.72, ph = 1.05, pz = zf + 0.16;
  triOut(mb, [-pw, top + 0.28, pz], [pw, top + 0.28, pz], [0, top + 0.28 + ph, pz], [0, 0, 1], { layer: stone, tint: [1.03, 1.0, 0.95] });
  for (const sx of [-1, 1]) mb.beam([sx * (pw + 0.12), top + 0.24, pz + 0.04], [0, top + 0.34 + ph, pz + 0.04], 0.16, { layer: stone, tint: [1.05, 1.03, 0.98] });
  mb.push(0, 0, top + 0.28 + ph * 0.42, pz + 0.02);
  for (let i = 0; i < 10; i++) { const a0 = (i / 10) * Math.PI * 2, a1 = ((i + 1) / 10) * Math.PI * 2; mb.tri([0, 0, 0.05], [Math.cos(a0) * 0.3, Math.sin(a0) * 0.3, 0.05], [Math.cos(a1) * 0.3, Math.sin(a1) * 0.3, 0.05], { layer: gilt }); }
  mb.pop();
  // Hall roof: hip with cresting.
  roof(mb, { x0: -hw, x1: hw, z0: zb, z1: zf, y: top + 0.28, kind: "hip", pitch: 0.42, eave: [0.3, 0.3, 0.3, 0.3], alongX: true, mat: M.R, trim: stone, gable: plaster, soffit: M.fm.wood, seed: p.b.seed, snow: M.snow, ridge: "cresting", metal: M.fm.metal, mobile });
  // ---- fly tower (behind) ----
  const ft = Math.min(hw - 0.35, 2.2), fz0 = -D / 2 + 0.3, fz1 = zb + 1.5, fyTop = 9.4;
  const brick = L(ctx, "a_brick");
  for (const side of ["e", "w", "n", "s"] as const) {
    const fhw = ft, fhd = (fz1 - fz0) / 2, fcz = (fz0 + fz1) / 2;
    const P = wallP(side, fhw, fhd, 0, fcz);
    const len = side === "s" || side === "n" ? fhw * 2 : fhd * 2;
    const yStart = side === "s" ? top + 0.28 : y0;
    const ops: Op[] = side === "s" ? [] : [{ u: 0, w: 0.5, v0: fyTop - yStart - 2.2, v1: fyTop - yStart - 1.2, kind: "win", head: "round", lit: false, mull: "none" }];
    facade(mb, { P, u0: -len / 2, u1: len / 2, y0: yStart, y1: fyTop, ops, wall: { layer: brick, tint: [0.92, 0.86, 0.82] }, mats: M.fm, st, seed: p.b.seed + 40 + side.charCodeAt(0), mobile });
    wbox(mb, P, -len / 2 - 0.1, len / 2 + 0.1, fyTop - 0.05, fyTop + 0.22, 0, 0.14, { layer: stone }, "ftb");
  }
  roof(mb, { x0: -ft, x1: ft, z0: fz0, z1: fz1, y: fyTop + 0.2, kind: "gable", pitch: 0.35, eave: [0.15, 0.15, 0.15, 0.15], alongX: false, mat: M.R, trim: stone, gable: brick, soffit: M.fm.wood, seed: p.b.seed + 3, snow: M.snow, mobile });
  rigging(ctx, M, ft, fz0 + 0.1, fz1 - 0.1, fyTop - 0.4, 1);
  // Lamp posts flanking the steps.
  for (const sx of [-1, 1]) {
    const x = sx * (hw - 0.05), z = D / 2 - 0.2;
    mb.cyl(x, 0.25, z, 0.07, 0.05, 2.3, 6, { layer: M.fm.metal });
    mb.box(x, 2.45, z, 0.26, 0.38, 0.26, { layer: M.fm.lit, emissive: 1 });
    mb.cyl(x, 2.83, z, 0.2, 0.02, 0.2, 4, { layer: M.fm.metal });
    light(ctx, [x, 2.6, z], ctx.lampColor, 4.5, 0.9, "post");
  }
};

/** Suspended marionette control booth: a cabin raised on posts over a tiny proscenium with velvet drapes,
 * a crane arm holding a giant cross control bar, and a life-size marionette dangling in front. */
export const puppetbooth: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D, mobile = mob(ctx);
  pad(mb, p, L(ctx, "plaza"), 0.12);
  const deck = 2.3, bw = Math.min(W - 0.9, 2.8), bd = Math.min(D - 1.6, 2.2), bz = -D / 2 + 0.5 + bd / 2;
  const wood = M.fm.wood, dark = M.fm.dark, velvet = L(ctx, "a_velvet"), gilt = M.fm.brass;
  // Posts + X bracing on the sides/back.
  const px = bw / 2 - 0.08, pz0 = bz - bd / 2 + 0.08, pz1 = bz + bd / 2 - 0.08;
  for (const [x, z] of [[-px, pz0], [px, pz0], [-px, pz1], [px, pz1]] as const) mb.box(x, 0.12, z, 0.16, deck - 0.12, 0.16, { layer: dark });
  for (const x of [-px, px]) { mb.beam([x, 0.3, pz0], [x, deck - 0.2, pz1], 0.07, { layer: dark }); mb.beam([x, deck - 0.2, pz0], [x, 0.3, pz1], 0.07, { layer: dark }); }
  mb.beam([-px, 0.3, pz0], [px, deck - 0.2, pz0], 0.07, { layer: dark });
  // Deck platform with a railing.
  mb.bevelBox(0, deck, bz, bw + 0.3, 0.16, bd + 0.5, 0.03, { layer: wood });
  const rz = bz + bd / 2 + 0.2;
  for (let i = 0; i <= 6; i++) mb.box(-bw / 2 - 0.1 + ((bw + 0.2) * i) / 6, deck + 0.16, rz, 0.05, 0.62, 0.05, { layer: dark });
  mb.beam([-bw / 2 - 0.12, deck + 0.8, rz], [bw / 2 + 0.12, deck + 0.8, rz], 0.07, { layer: dark });
  // Proscenium under the deck: velvet drapes + valance framing a dark little stage.
  const PF = wallP("s", px, bd / 2 - 0.08, 0, bz);
  wq(mb, PF, -px, px, 0.12, deck, -0.35, { layer: dark, tint: [0.25, 0.2, 0.2] });
  drape(mb, PF, -px + 0.05, -px * 0.25, deck - 0.3, 0.12, 0.02, velvet, gilt, true);
  drape(mb, PF, px * 0.25, px - 0.05, deck - 0.3, 0.12, 0.02, velvet, gilt, false);
  valance(mb, PF, -px, px, deck, 0.06, velvet, gilt);
  mb.box(0, 0.12, bz + bd / 2 - 0.2, px * 2, 0.5, 0.3, { layer: wood, tint: [0.8, 0.7, 0.6] });
  light(ctx, [0, 1.2, bz + bd / 2 + 0.5], ctx.lampColor, 4, 0.9, "wall");
  // Cabin on the deck.
  const cy0 = deck + 0.16, ch = 2.0, cbw = bw - 0.2, cbd = bd - 0.2;
  for (const side of ["s", "e", "w", "n"] as const) {
    const len = side === "s" || side === "n" ? cbw : cbd;
    const P = wallP(side, cbw / 2, cbd / 2, 0, bz);
    const ops: Op[] = side === "s" ? [{ u: 0, w: Math.min(1.4, len - 0.6), v0: 0.8, v1: 1.65, kind: "win", head: "segment", lit: true, mull: "vert", shutters: false }] : side === "n" ? [] : [{ u: 0, w: 0.55, v0: 0.85, v1: 1.55, kind: "win", head: "flat", lit: lit(p, side.charCodeAt(0)), mull: "cross" }];
    facade(mb, { P, u0: -len / 2, u1: len / 2, y0: cy0, y1: cy0 + ch, ops, wall: { layer: L(ctx, "a_siding"), tint: p.tint as V3 }, mats: M.fm, st: p.st, seed: p.b.seed + side.charCodeAt(0), mobile });
  }
  roof(mb, { x0: -cbw / 2, x1: cbw / 2, z0: bz - cbd / 2, z1: bz + cbd / 2, y: cy0 + ch, kind: "gable", pitch: 0.9, eave: [0.3, 0.3, 0.25, 0.25], alongX: true, mat: M.R, trim: dark, gable: L(ctx, "a_siding"), soffit: wood, seed: p.b.seed, snow: M.snow, mobile });
  // Ladder to the deck (side).
  const lx = bw / 2 + 0.25;
  for (const dz of [-0.2, 0.2]) mb.beam([lx + 0.25, 0.12, bz + dz], [lx - 0.02, deck + 0.9, bz + dz], 0.06, { layer: dark });
  for (let i = 1; i < 8; i++) { const t = i / 8; mb.box(lx + 0.25 - 0.27 * t, 0.12 + (deck + 0.78) * t, bz, 0.05, 0.04, 0.4, { layer: wood }); }
  // Crane arm from the ridge out over the front, control bar, marionette.
  const armY = cy0 + ch + 0.95, tipZ = D / 2 - 0.25;
  mb.beam([0, cy0 + ch - 0.1, bz - 0.2], [0, armY, bz], 0.14, { layer: dark });
  mb.beam([0, armY, bz - 0.4], [0, armY, tipZ], 0.14, { layer: dark });
  mb.beam([0, cy0 + ch + 0.1, bz + cbd / 2 + 0.2], [0, armY, bz + 0.9], 0.08, { layer: dark });
  wheel(mb, [0, armY - 0.18, tipZ - 0.1], [1, 0, 0], 0.16, { layer: M.fm.metal }, { layer: M.fm.metal }, 8, 4, 0.04);
  const barY = armY - 1.3;
  tube(mb, [0, armY - 0.3, tipZ - 0.1], [0, barY, tipZ - 0.1], 0.012, 3, { layer: M.cm.cloth2 });
  marionette(mb, [0, barY, tipZ - 0.1], 0.55, Math.min(2.3, barY - 0.55 - 0.25), 0.15, { wood, cloth: M.fm.cloth, face: L(ctx, "paper"), string: M.cm.cloth2, bar: dark }, p.b.seed, p.r(5) < 0.5 ? [1.3, 0.35, 0.35] : [0.4, 0.55, 1.25]);
  // A lantern on the deck post + a crate of spare limbs.
  lantern(ctx, (u, v, t = 0) => [bw / 2 + 0.05 + t * 0, v, bz + bd / 2 + 0.1 + t], 0, deck + 1.5, { metal: M.fm.metal, lit: M.fm.lit }, 4.5);
  crate(mb, -W / 2 + 0.55, 0.12, D / 2 - 0.55, M.cm, 0.8, 12);
};

/** Scenery store: long open-fronted gable shed; painted flats stacked inside and leaning out front. */
export const scenerystore: SB = (ctx, p, M) => {
  const mb = ctx.mb, W = p.W, D = p.D, mobile = mob(ctx);
  pad(mb, p, L(ctx, "plaza"), 0.15);
  const hw = W / 2 - 0.3, zb = -D / 2 + 0.3, zf = D / 2 - 0.9, h = 3.1, y0 = 0.15;
  const wood = M.fm.wood, dark = M.fm.dark, flat = L(ctx, "a_flat"), siding = L(ctx, "a_siding");
  const cz = (zb + zf) / 2, hd = (zf - zb) / 2;
  // Back + side walls (boarded), open front on posts.
  for (const side of ["n", "e", "w"] as const) {
    const P = wallP(side, hw, hd, 0, cz), len = side === "n" ? hw * 2 : hd * 2;
    const ops: Op[] = side === "n" ? [] : [{ u: 0, w: 0.8, v0: 1.3, v1: 2.1, kind: "win", head: "flat", lit: false, mull: "grid" }];
    facade(mb, { P, u0: -len / 2, u1: len / 2, y0, y1: y0 + h, ops, wall: { layer: siding, tint: [0.86, 0.8, 0.74] }, mats: M.fm, st: p.st, seed: p.b.seed + side.charCodeAt(0), mobile });
  }
  wq(mb, wallP("n", hw, hd, 0, cz), -hw, hw, y0, y0 + h, -hd * 2 + 0.02, { layer: siding, tint: [0.5, 0.46, 0.44] });
  const nPost = Math.max(2, Math.round((hw * 2) / 2.2));
  for (let i = 0; i <= nPost; i++) mb.box(-hw + (hw * 2 * i) / nPost, y0, zf - 0.08, 0.18, h, 0.18, { layer: dark });
  mb.beam([-hw, y0 + h - 0.12, zf - 0.08], [hw, y0 + h - 0.12, zf - 0.08], 0.2, { layer: dark });
  // Floor boards inside.
  mb.box(0, y0, cz, hw * 2 - 0.1, 0.04, hd * 2 - 0.1, { layer: wood, tint: [0.8, 0.72, 0.62] }, "t");
  roof(mb, { x0: -hw, x1: hw, z0: zb, z1: zf, y: y0 + h, kind: "gable", pitch: 0.75, eave: [0.45, 0.25, 0.3, 0.3], alongX: true, mat: M.R, trim: dark, gable: siding, soffit: wood, seed: p.b.seed, snow: M.snow, mobile });
  // Flats: tall framed canvas panels, some stacked inside at an angle, some leaning outside.
  const panel = (x: number, z: number, w: number, hh: number, yaw: number, lean: number, tint: V3, back = false) => {
    mb.push(yaw, x, y0, z);
    const tz = Math.sin(lean) * hh, ty = Math.cos(lean) * hh;
    const A: V3 = [-w / 2, 0, 0], B: V3 = [w / 2, 0, 0], C: V3 = [w / 2, ty, -tz], Dd: V3 = [-w / 2, ty, -tz];
    if (back) mb.quad(B, A, Dd, C, { layer: wood, tint: [0.9, 0.85, 0.78] });
    else mb.quad(A, B, C, Dd, { layer: flat, tint, uvs: [[0.01, 0.99], [0.99, 0.99], [0.99, 0.01], [0.01, 0.01]] });
    mb.quad(B, A, Dd, C, { layer: wood, tint: [0.75, 0.7, 0.64] });
    for (const sx of [-1, 1]) mb.beam([sx * w / 2, 0, -0.03], [sx * w / 2, ty, -tz - 0.03], 0.05, { layer: wood });
    mb.beam([-w / 2, ty * 0.5, -tz * 0.5 - 0.04], [w / 2, ty * 0.5, -tz * 0.5 - 0.04], 0.04, { layer: wood });
    mb.pop();
  };
  const tints: V3[] = [[1, 1, 1], [1.1, 0.9, 0.8], [0.8, 0.9, 1.15], [1.05, 1.05, 0.85]];
  const nIn = mobile ? 3 : 5;
  for (let i = 0; i < nIn; i++) panel(-hw + 0.9 + ((hw * 2 - 1.8) * i) / Math.max(1, nIn - 1), zb + 0.55 + (i % 2) * 0.25, 1.6, 2.6, (p.r(30 + i) - 0.5) * 12, 0.12, tints[i % tints.length]!);
  const nOut = 2;
  for (let i = 0; i < nOut; i++) panel((i ? 1 : -1) * (hw - 1.0), D / 2 - 0.35, 1.5, 2.4, (i ? -1 : 1) * 8, 0.2 + i * 0.05, tints[(i + 2) % tints.length]!);
  // A rolled backdrop on trestles + rope coils + barrels.
  tube(mb, [-hw + 0.6, y0 + 0.85, zf - 0.6], [hw - 0.6, y0 + 0.85, zf - 0.6], 0.2, mobile ? 5 : 8, { layer: L(ctx, "a_velvet"), tint: [0.9, 0.85, 0.9] }, true);
  for (const x of [-hw + 0.9, hw - 0.9]) { mb.beam([x - 0.3, y0, zf - 0.6], [x, y0 + 0.66, zf - 0.6], 0.06, { layer: dark }); mb.beam([x + 0.3, y0, zf - 0.6], [x, y0 + 0.66, zf - 0.6], 0.06, { layer: dark }); }
  barrel(mb, hw - 0.35, y0, D / 2 - 0.4, M.cm, 0.85);
  lantern(ctx, wallP("s", hw, hd, 0, cz), -hw + 0.3, y0 + 2.6, { metal: M.fm.metal, lit: M.fm.lit }, 4.5);
};

/** Stopped carousel: round platform, mirrored centre drum, striped conical canopy with a scalloped valance
 * and bulbs, brass poles with galloping horses frozen mid-stride. */
export const carousel: SB = (ctx, p, M) => {
  const mb = ctx.mb, mobile = mob(ctx);
  const R = Math.min(p.W, p.D) / 2 - 0.45;
  pad(mb, p, L(ctx, "plaza"), 0.1);
  const y0 = 0.1, plat = 0.38, canopyY = 3.3, n = mobile ? 12 : 16;
  const canvas = L(ctx, "a_awning"), gilt = M.fm.brass, wood = M.fm.wood;
  const P = (a: number, r: number, y: number): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];
  // Platform + steps ring.
  mb.cyl(0, y0, 0, R, R, plat, n, { layer: wood, tint: [0.9, 0.8, 0.7] }, true, { layer: L(ctx, "a_paint"), tint: [1.05, 0.95, 0.85] });
  mb.cyl(0, y0, 0, R + 0.25, R + 0.25, 0.14, n, { layer: M.fm.stone }, true);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const c = P(a, R + 0.01, y0 + plat * 0.5); mb.box(c[0], c[1] - 0.04, c[2], 0.08, 0.08, 0.08, { layer: gilt }); }
  // Centre drum with mirror panels.
  const dr = Math.max(0.45, R * 0.24);
  mb.cyl(0, y0 + plat, 0, dr, dr, canopyY - plat - y0, 8, { layer: M.fm.lit, emissive: 0.5 }, false);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; const c = P(a, dr, y0 + plat); mb.box(c[0], c[1], c[2], 0.1, canopyY - plat - y0, 0.1, { layer: gilt }); }
  // Canopy: rim band, striped cone, scalloped valance, bulbs, finial + pennant.
  const rimR = R + 0.2;
  mb.cyl(0, canopyY, 0, rimR, rimR, 0.3, n, { layer: canvas }, false);
  mb.cyl(0, canopyY + 0.3, 0, rimR + 0.05, rimR + 0.05, 0.06, n, { layer: gilt }, false);
  const apex = canopyY + 0.35 + R * 0.62;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    triOut(mb, P(a0, rimR + 0.05, canopyY + 0.36), P(a1, rimR + 0.05, canopyY + 0.36), [0, apex, 0], [Math.cos(am), 0.7, Math.sin(am)], { layer: canvas, tint: i % 2 ? [1, 1, 1] : [1.08, 1.04, 1.0], uvs: [[0, 0.99], [0.5, 0.99], [0.25, 0.01]] });
    triOut(mb, P(a0, rimR, canopyY + 0.01), P(a1, rimR, canopyY + 0.01), P(am, rimR * 1.01, canopyY - 0.3), [Math.cos(am), -0.2, Math.sin(am)], { layer: M.fm.cloth, tint: i % 2 ? [1.3, 1.1, 0.5] : [1.2, 0.4, 0.4] });
    const b = P(am, rimR + 0.03, canopyY + 0.15);
    mb.box(b[0], b[1] - 0.04, b[2], 0.08, 0.08, 0.08, { layer: M.fm.lit, emissive: 1 });
  }
  for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2; mb.tri([0, canopyY, 0], P(a0, rimR, canopyY), P(a1, rimR, canopyY), { layer: canvas, tint: [0.55, 0.5, 0.5] }); }
  mb.cyl(0, apex - 0.05, 0, 0.12, 0.02, 0.8, 6, { layer: gilt });
  mb.blob(0, apex + 0.1, 0, 0.12, 0.12, 0.12, { layer: gilt }, 0);
  mb.quad([0, apex + 0.55, 0], [0.55, apex + 0.62, 0], [0.55, apex + 0.78, 0], [0, apex + 0.78, 0], { layer: M.fm.cloth, doubleSided: true, wind: true, tint: [1.3, 0.4, 0.4] });
  // Poles + horses.
  const nh = mobile ? 6 : 8, hr = (R + dr) / 2 + 0.1;
  const bone: V3 = p.kit.deco.includes("bones") ? [1.1, 1.08, 1.0] : [1.15, 1.05, 0.9];
  for (let i = 0; i < nh; i++) {
    const a = (i / nh) * Math.PI * 2 + 0.2, c = P(a, hr, 0);
    mb.cyl(c[0], y0 + plat, c[2], 0.035, 0.035, canopyY - plat - y0, 5, { layer: gilt });
    const hy = y0 + plat + 0.75 + (i % 2) * 0.35;
    const yawDeg = -(a * 180) / Math.PI;
    mb.push(yawDeg, c[0], hy, c[2]);
    // Horse faces along the tangent (+z local after the push = tangent direction).
    const body: FaceOpts = { layer: L(ctx, "a_paint"), tint: bone };
    mb.bevelBox(0, 0, 0, 0.26, 0.34, 0.8, 0.06, body);
    mb.beam([0, 0.28, 0.32], [0, 0.62, 0.5], 0.17, body);
    mb.bevelBox(0, 0.54, 0.62, 0.16, 0.18, 0.34, 0.04, body);
    mb.box(0, 0.62, 0.42, 0.05, 0.1, 0.3, { layer: M.fm.cloth, tint: [1.3, 0.9, 0.4] });
    for (const [lx, lz, fx, fz] of [[-0.08, 0.3, 0.25, 0.55], [0.08, 0.3, -0.05, 0.42], [-0.08, -0.32, -0.3, -0.55], [0.08, -0.32, 0.1, -0.5]] as const) {
      mb.beam([lx, 0.02, lz], [lx, -0.28, (lz + fz) / 2], 0.07, body);
      mb.beam([lx, -0.28, (lz + fz) / 2], [lx, -0.45 + (fx > 0 ? 0.12 : 0), fz], 0.06, body);
    }
    mb.beam([0, 0.2, -0.4], [0, -0.15, -0.62], 0.07, { layer: M.fm.dark, tint: [0.8, 0.7, 0.6] });
    mb.box(0, 0.34, -0.02, 0.3, 0.06, 0.3, { layer: M.fm.cloth, tint: i % 2 ? [0.4, 0.55, 1.25] : [1.25, 0.4, 0.4] });
    mb.pop();
  }
  // Ticket stand + rope barrier posts at the entrance.
  for (const sx of [-1, 1]) { mb.cyl(sx * 0.7, 0.1, R + 0.45, 0.05, 0.05, 0.9, 5, { layer: gilt }); mb.blob(sx * 0.7, 1.02, R + 0.45, 0.07, 0.07, 0.07, { layer: gilt }, 0); }
  tube(mb, [-0.7, 0.85, R + 0.45], [0, 0.72, R + 0.5], 0.03, 4, { layer: M.fm.cloth, tint: [1.2, 0.4, 0.4] });
  light(ctx, [0, canopyY - 0.4, 0], ctx.lampColor, 6, 1.1, "interior");
  light(ctx, [0, canopyY + 0.1, R + 0.4], ctx.lampColor, 4, 0.8, "wall");
};
