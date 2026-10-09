// Roof grammar (hd2d-architecture-3). One slope-grid generator covers gable, hip, half-hip (jerkinhead),
// irimoya (hip-and-gable with curved, upturned eaves), pyramid; plus mansard, gambrel, shed, flat
// (parapet + roof clutter), barrel, saw-tooth, dome and cone. Eaves get fascia, soffits, rafter tails or
// brackets; ridges get caps and ornaments; snow themes get a snow blanket.
import type { FaceOpts, MeshBuilder, V3 } from "../mesh";
import { hash3 } from "../mesh";
import { dome as domeMesh, tube, quadOut, triOut } from "./geo";
import type { RoofKind } from "./plan";

export type RoofOpts = {
  x0: number; x1: number; z0: number; z1: number; y: number;
  kind: RoofKind; pitch: number;
  /** Overhang per side: front(+z), back(-z), right(+x), left(-x). */
  eave: [number, number, number, number];
  alongX: boolean;
  mat: number; trim: number; gable: number; soffit: number;
  rafters?: boolean; brackets?: boolean; ridge?: "none" | "finial" | "shachi" | "cresting";
  curved?: boolean; upturn?: number;
  snow?: number; tint?: V3; seed: number;
  /** Suppress gable/hip geometry on one end (roof butts into a taller block): "+x" | "-x". */
  butt?: string;
  cap?: number; accent?: number; metal?: number;
  mobile?: boolean;
};
export type RoofInfo = {
  ridgeY: number;
  /** Roof surface height at local (x, z) (top of the slope), or the flat deck height. */
  at: (x: number, z: number) => number;
  /** Ridge segment (local). */
  ridge: [V3, V3];
  alongX: boolean;
};

/** Emit a roof over the wall rectangle; returns ridge / surface info for dormers and chimneys. */
export function roof(mb: MeshBuilder, o: RoofOpts): RoofInfo {
  switch (o.kind) {
    case "flat": return flat(mb, o);
    case "shed": return shed(mb, o);
    case "barrel": case "saw": return barrel(mb, o);
    case "dome": return domeRoof(mb, o);
    case "cone": return cone(mb, o);
    case "mansard": return mansard(mb, o);
    case "gambrel": return gambrel(mb, o);
    case "none": return { ridgeY: o.y, at: () => o.y, ridge: [[0, o.y, 0], [0, o.y, 0]], alongX: o.alongX };
    default: return pitched(mb, o);
  }
}

/** Frame helper: roof coordinates (s across the span, l along the ridge) → local xyz. */
function frame(o: RoofOpts) {
  const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
  const hxw = (o.x1 - o.x0) / 2, hzw = (o.z1 - o.z0) / 2;
  const [ef, eb, er, el] = o.eave;
  // Span axis: z when the ridge runs along x.
  const sHalf = o.alongX ? hzw : hxw, lHalf = o.alongX ? hxw : hzw;
  const sE: [number, number] = o.alongX ? [eb, ef] : [el, er]; // overhang on the -s / +s side
  const lE: [number, number] = o.alongX ? [el, er] : [eb, ef]; // overhang on the -l / +l end
  const map = (s: number, l: number, h: number): V3 => (o.alongX ? [cx + l, o.y + h, cz + s] : [cx + s, o.y + h, cz + l]);
  return { cx, cz, sHalf, lHalf, sE, lE, map };
}

function pitched(mb: MeshBuilder, o: RoofOpts): RoofInfo {
  const F = frame(o), { sHalf, lHalf, sE, lE, map } = F;
  const kind = o.kind;
  const rise = sHalf * o.pitch * (kind === "pyramid" ? 1.25 : 1);
  const curved = !!o.curved;
  const up = o.upturn ?? (curved ? 0.34 : 0);
  // Profile: height below the ridge at horizontal fraction q (0 ridge … 1 eave edge) of side k (0: -s, 1: +s).
  const reach = (k: number) => sHalf + sE[k]!;
  const qWall = (k: number) => sHalf / reach(k);
  const shape = (q: number) => (curved ? 0.5 * q + 0.5 * (1 - (1 - q) * (1 - q)) : q);
  const dropK = (k: number) => rise / shape(qWall(k));
  const drop = (q: number, k: number) => dropK(k) * shape(q);
  // Hip / gable layout along the ridge.
  const ends = [lHalf + lE[0]!, lHalf + lE[1]!]; // eave-edge half lengths toward -l / +l
  const hipAll = kind === "hip" || kind === "pyramid";
  const qg = kind === "irimoya" ? 0.42 : kind === "halfhip" ? 0.36 : 0;
  // Half length of the slope outline at q (toward end e∈{0,1}).
  const avgReach = (reach(0) + reach(1)) / 2;
  const ridgeHalf = (e: number) => {
    if (kind === "gable") return ends[e]!;
    if (hipAll) return Math.max(0, ends[e]! - avgReach);
    if (kind === "irimoya") return Math.max(0.3, ends[e]! - avgReach * (1 - qg));
    return Math.max(0.3, ends[e]! - avgReach * qg); // halfhip: small hip at the top
  };
  const halfLen = (q: number, e: number) => {
    const rh = ridgeHalf(e), full = ends[e]!;
    if (kind === "gable") return full;
    if (hipAll) return rh + (full - rh) * q;
    if (kind === "irimoya") return q <= qg ? rh : rh + (full - rh) * ((q - qg) / (1 - qg));
    return q >= qg ? full : rh + (full - rh) * (q / qg); // halfhip
  };
  const lift = (a: number, q: number) => (up ? up * Math.pow(Math.max(0, (Math.abs(a) - 0.5) / 0.5), 2) * q * q : 0);
  const ridgeY = rise;
  const P = (s: number, l: number, h: number) => map(s, l, h);
  const tintO = (layer: number, extra: Partial<FaceOpts> = {}): FaceOpts => ({ layer, tint: o.tint, ...extra });
  const UP: V3 = [0, 1, 0], DOWN: V3 = [0, -1, 0];
  const rows = curved ? 5 : 2, cols = up ? 6 : 1;
  // Geometric tile courses (hd2d-architecture-3): each course is a strip whose lower edge is lifted by the
  // tile thickness, leaving a lit / shadowed lip — the stepped relief of real tile, slate and thatch roofs.
  // Course length matches the texture rows (V = 0.6 per horizontal metre) so painted and modelled rows agree.
  const course = o.mobile ? undefined : mb.courses.get(o.mat);
  const courseQs = (reachLen: number, q0: number, q1: number, n0: number) => {
    const qs: number[] = [];
    if (!course) { for (let i = 0; i <= n0; i++) qs.push(q0 + ((q1 - q0) * i) / n0); return qs; }
    const d0 = q0 * reachLen, d1 = q1 * reachLen, len = course[0];
    qs.push(q0);
    for (let n = Math.floor(d0 / len) + 1; n * len < d1 - len * 0.4; n++) qs.push((n * len) / reachLen);
    qs.push(q1);
    return qs;
  };
  const lipTint: V3 = o.tint ? [o.tint[0] * 0.58, o.tint[1] * 0.58, o.tint[2] * 0.6] : [0.58, 0.58, 0.6];
  const COURSE_MUL: [number, number, number, number] = [1.04, 1.04, 0.8, 0.8];
  /** One course strip A,B (lower, at surface) → C,D (upper) with a lifted lower edge and a lip facing `out`. */
  const courseQuad = (A: V3, B: V3, C: V3, D: V3, out: V3, uvs: [number, number][]) => {
    if (!course) { quadOut(mb, A, B, C, D, UP, tintO(o.mat, { uvs })); return; }
    const h = course[1];
    const A2: V3 = [A[0], A[1] + h, A[2]], B2: V3 = [B[0], B[1] + h, B[2]];
    quadOut(mb, A2, B2, C, D, UP, tintO(o.mat, { uvs, mul: COURSE_MUL }));
    const lipV = 0.6 * h;
    quadOut(mb, A, B, B2, A2, out, { layer: o.mat, tint: lipTint, uvs: [uvs[0]!, uvs[1]!, [uvs[1]![0], uvs[1]![1] - lipV], [uvs[0]![0], uvs[0]![1] - lipV]] });
  };
  // ---- long slopes ----
  for (const k of [1, 0]) {
    const sg = k === 1 ? 1 : -1;
    // a: left→right seen from outside. For the +s slope (alongX: front) left = -l.
    const pt = (a: number, q: number): V3 => {
      const l = a * sg * halfLen(q, (a * sg) < 0 ? 0 : 1);
      return P(sg * reach(k) * q, l, ridgeY - drop(q, k) + lift(a, q));
    };
    const outS: V3 = o.alongX ? [0, 0, sg] : [sg, 0, 0];
    const qs = courseQs(reach(k), 0, 1, rows);
    for (let i = 0; i < qs.length - 1; i++) {
      const q0 = qs[i]!, q1 = qs[i + 1]!;
      for (let j = 0; j < cols; j++) {
        const a0 = -1 + (2 * j) / cols, a1 = -1 + (2 * (j + 1)) / cols;
        const A = pt(a0, q1), B = pt(a1, q1), C = pt(a1, q0), D = pt(a0, q0);
        const lenA = (a: number, q: number) => a * sg * halfLen(q, (a * sg) < 0 ? 0 : 1) * sg;
        const uvs: [number, number][] = [[lenA(a0, q1) * 0.5, q1 * reach(k) * 0.6], [lenA(a1, q1) * 0.5, q1 * reach(k) * 0.6], [lenA(a1, q0) * 0.5, q0 * reach(k) * 0.6], [lenA(a0, q0) * 0.5, q0 * reach(k) * 0.6]];
        courseQuad(A, B, C, D, outS, uvs);
      }
    }
    // Soffit under the overhang band + fascia along the eave edge.
    const qw = qWall(k);
    for (let j = 0; j < cols; j++) {
      const a0 = -1 + (2 * j) / cols, a1 = -1 + (2 * (j + 1)) / cols;
      const d = (v: V3): V3 => [v[0], v[1] - 0.09, v[2]];
      quadOut(mb, d(pt(a1, 1)), d(pt(a0, 1)), d(pt(a0, qw)), d(pt(a1, qw)), DOWN, { layer: o.soffit, tint: [0.7, 0.68, 0.66] });
      mb.beam(d(pt(a0, 1)), d(pt(a1, 1)), 0.12, { layer: o.trim });
    }
    // Rafter tails / brackets under the eave.
    if ((o.rafters || o.brackets) && !o.mobile) {
      const len = lHalf * 2, n = Math.max(2, Math.round(len / (o.brackets && !o.rafters ? 0.9 : 0.42)));
      for (let i = 0; i <= n; i++) {
        const lpos = -lHalf + (len * i) / n;
        const a = (lpos / Math.max(0.01, halfLen(1, lpos < 0 ? 0 : 1))) * sg;
        const edge = pt(a, 0.985), wallPt = P(sg * sHalf, lpos, ridgeY - drop(qw, k) + lift(a, qw));
        if (o.rafters) mb.beam([wallPt[0], wallPt[1] - 0.12, wallPt[2]], [edge[0], edge[1] - 0.14, edge[2]], 0.09, { layer: o.trim, tint: [0.85, 0.85, 0.85] });
        if (o.brackets && i % 2 === 0) {
          const w0 = P(sg * (sHalf + 0.02), lpos, ridgeY - drop(qw, k) - 0.55);
          mb.beam(w0, [wallPt[0] + (edge[0] - wallPt[0]) * 0.55, wallPt[1] - 0.1, wallPt[2] + (edge[2] - wallPt[2]) * 0.55], 0.1, { layer: o.trim });
        }
      }
    }
  }
  // ---- ends: hip faces / gable walls ----
  for (const e of [0, 1]) {
    if (o.butt === (e === 1 ? "+l" : "-l")) continue;
    const se = e === 1 ? 1 : -1;
    const hipped = kind !== "gable";
    const qFrom = kind === "irimoya" ? qg : 0, qTo = kind === "halfhip" ? qg : 1;
    if (hipped) {
      // a: left→right seen from outside the end. For the +l end, left = +s.
      const pe = (a: number, q: number): V3 => {
        const k = -a * se < 0 ? 0 : 1; // which side of the span
        const s = -a * se * reach(k) * q;
        return P(s, se * halfLen(q, e), ridgeY - drop(q, k) + lift(a, q));
      };
      const erows = curved ? 4 : 1;
      const outL: V3 = o.alongX ? [se, 0, 0] : [0, 0, se];
      const eqs = courseQs(avgReach, qFrom, qTo, erows);
      for (let i = 0; i < eqs.length - 1; i++) {
        const q0 = eqs[i]!, q1 = eqs[i + 1]!;
        for (let j = 0; j < cols; j++) {
          const a0 = -1 + (2 * j) / cols, a1 = -1 + (2 * (j + 1)) / cols;
          const A = pe(a0, q1), B = pe(a1, q1), C = pe(a1, q0), D = pe(a0, q0);
          const sA = (a: number, q: number) => a * avgReach * q;
          courseQuad(A, B, C, D, outL, [[sA(a0, q1) * 0.5, q1 * avgReach * 0.6], [sA(a1, q1) * 0.5, q1 * avgReach * 0.6], [sA(a1, q0) * 0.5, q0 * avgReach * 0.6], [sA(a0, q0) * 0.5, q0 * avgReach * 0.6]]);
        }
      }
      if (qTo >= 1) for (let j = 0; j < cols; j++) {
        const a0 = -1 + (2 * j) / cols, a1 = -1 + (2 * (j + 1)) / cols;
        const d = (v: V3): V3 => [v[0], v[1] - 0.09, v[2]];
        const qw = lHalf / Math.max(0.01, ends[e]!);
        quadOut(mb, d(pe(a1, 1)), d(pe(a0, 1)), d(pe(a0, Math.min(0.99, qw))), d(pe(a1, Math.min(0.99, qw))), DOWN, { layer: o.soffit, tint: [0.7, 0.68, 0.66] });
        mb.beam(d(pe(a0, 1)), d(pe(a1, 1)), 0.12, { layer: o.trim });
      }
      // Hip caps along the two hip lines.
      const hq0 = qFrom, hq1 = qTo;
      for (const a of [-1, 1]) {
        const segs = curved ? 4 : 1;
        for (let i = 0; i < segs; i++) {
          const qa = hq0 + ((hq1 - hq0) * i) / segs, qb = hq0 + ((hq1 - hq0) * (i + 1)) / segs;
          const A = pe(a, qa), B = pe(a, qb);
          mb.beam([A[0], A[1] + 0.05, A[2]], [B[0], B[1] + 0.05, B[2]], 0.14, { layer: o.cap ?? o.mat, tint: [0.82, 0.82, 0.86] });
        }
      }
    }
    // Gable wall (triangle / pentagon following the profile) for gable, irimoya (upper), halfhip (lower).
    if (kind === "gable" || kind === "irimoya" || kind === "halfhip") {
      const lw = se * (kind === "irimoya" ? ridgeHalf(e) - 0.08 : lHalf);
      const qa = kind === "halfhip" ? qg : 0, qb = kind === "irimoya" ? qg : qWall(0);
      const pts: V3[] = [];
      const N = curved ? 6 : 1;
      // left side (s<0) from bottom to top, then right side top to bottom.
      const prof = (k: number, q: number) => ridgeY - drop(q, k) - 0.05;
      const bottomQ0 = kind === "irimoya" ? qg : qWall(0), bottomQ1 = kind === "irimoya" ? qg : qWall(1);
      const baseY0 = kind === "irimoya" ? prof(0, qg) : 0, baseY1 = kind === "irimoya" ? prof(1, qg) : 0;
      void qb;
      pts.push(P(-reach(0) * bottomQ0, lw, baseY0));
      for (let i = N; i >= 0; i--) { const q = qa + ((bottomQ0 - qa) * i) / N; pts.push(P(-reach(0) * q, lw, prof(0, q))); }
      for (let i = 0; i <= N; i++) { const q = qa + ((bottomQ1 - qa) * i) / N; pts.push(P(reach(1) * q, lw, prof(1, q))); }
      pts.push(P(reach(1) * bottomQ1, lw, baseY1));
      // Fan from the bottom centre (outward = ±l).
      const c = P(0, lw, (baseY0 + baseY1) / 2);
      const lOut: V3 = o.alongX ? [se, 0, 0] : [0, 0, se];
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i]!, B = pts[i + 1]!;
        if (Math.abs(A[1] - B[1]) < 1e-4 && Math.abs(A[0] - B[0]) + Math.abs(A[2] - B[2]) < 1e-4) continue;
        triOut(mb, c, A, B, lOut, { layer: o.gable, tint: o.tint });
      }
      // Barge boards along the roof edge at the gable (overhanging end).
      const lb = se * (kind === "irimoya" ? ridgeHalf(e) : ends[e]!);
      const bq0 = kind === "halfhip" ? qg : 0;
      for (const k of [0, 1]) {
        const sg = k === 1 ? 1 : -1, bq1 = kind === "irimoya" ? qg : 1;
        const segs = curved ? 4 : 1;
        for (let i = 0; i < segs; i++) {
          const q0 = bq0 + ((bq1 - bq0) * i) / segs, q1 = bq0 + ((bq1 - bq0) * (i + 1)) / segs;
          const A = P(sg * reach(k) * q0, lb, ridgeY - drop(q0, k) + lift(1, q0) - 0.04), B = P(sg * reach(k) * q1, lb, ridgeY - drop(q1, k) + lift(1, q1) - 0.04);
          mb.beam(A, B, 0.16, { layer: o.trim });
        }
      }
      // Gable ornament: attic vent / window (western), hanging fish (eastern).
      if (kind === "gable" && !o.mobile && ridgeY > 1.1) {
        const wy = ridgeY * 0.42, lo = lw + se * 0.03;
        const hw = Math.min(0.28, ridgeY * 0.18);
        const gOut: V3 = o.alongX ? [se, 0, 0] : [0, 0, se];
        const q = (a: V3, b: V3, c2: V3, d: V3, opts: FaceOpts) => quadOut(mb, a, b, c2, d, gOut, opts);
        q(P(-hw, lo, wy - hw), P(hw, lo, wy - hw), P(hw, lo, wy + hw), P(-hw, lo, wy + hw), { layer: o.accent ?? o.trim, emissive: o.accent !== undefined ? 1 : 0 });
        const ft = 0.06;
        for (const [s0, s1, h0, h1] of [[-hw - ft, hw + ft, wy - hw - ft, wy - hw], [-hw - ft, hw + ft, wy + hw, wy + hw + ft], [-hw - ft, -hw, wy - hw, wy + hw], [hw, hw + ft, wy - hw, wy + hw]] as const)
          q(P(s0, lo + se * 0.02, h0), P(s1, lo + se * 0.02, h0), P(s1, lo + se * 0.02, h1), P(s0, lo + se * 0.02, h1), { layer: o.trim });
      }
      if (kind === "irimoya" && !o.mobile) {
        const top = P(0, lb + se * 0.02, ridgeY - 0.05);
        mb.box(top[0], top[1] - 0.55, top[2], o.alongX ? 0.06 : 0.22, 0.55, o.alongX ? 0.22 : 0.06, { layer: o.trim });
      }
    }
  }
  // ---- ridge ----
  const rl0 = -ridgeHalf(0), rl1 = ridgeHalf(1);
  const R0 = P(0, rl0 + (kind === "gable" ? 0 : 0), ridgeY + 0.03), R1 = P(0, rl1, ridgeY + 0.03);
  if (rl1 - rl0 > 0.05) {
    mb.beam(R0, R1, 0.2, { layer: o.cap ?? o.mat, tint: [0.8, 0.8, 0.84] });
    if (curved || o.ridge === "shachi") mb.beam([R0[0], R0[1] + 0.12, R0[2]], [R1[0], R1[1] + 0.12, R1[2]], 0.12, { layer: o.cap ?? o.mat, tint: [0.7, 0.7, 0.74] });
  }
  if (o.ridge === "shachi" || curved) {
    // Upturned ridge-end ornaments (chiwen / shachi).
    for (const [e, R] of [[0, R0], [1, R1]] as const) {
      const se = e === 1 ? 1 : -1;
      const out = o.alongX ? [se * 0.1, 0] : [0, se * 0.1];
      const base: V3 = [R[0], R[1] + 0.05, R[2]];
      const tip: V3 = [R[0] + out[0]! * 2.5, R[1] + 0.62, R[2] + out[1]! * 2.5];
      mb.beam(base, [base[0] + out[0]!, base[1] + 0.3, base[2] + out[1]!], 0.2, { layer: o.cap ?? o.mat, tint: [0.62, 0.62, 0.66] });
      mb.beam([base[0] + out[0]!, base[1] + 0.3, base[2] + out[1]!], tip, 0.12, { layer: o.accent ?? o.trim, tint: [0.9, 0.9, 0.9] });
    }
  } else if (o.ridge === "finial" || kind === "pyramid") {
    const top = P(0, 0, ridgeY);
    mb.cyl(top[0], top[1], top[2], 0.07, 0.02, 0.7, 6, { layer: o.metal ?? o.trim });
    mb.cyl(top[0], top[1] + 0.35, top[2], 0.1, 0.1, 0.1, 6, { layer: o.metal ?? o.trim });
  } else if (o.ridge === "cresting" && rl1 - rl0 > 0.4) {
    const n = Math.max(2, Math.round((rl1 - rl0) / 0.35));
    for (let i = 0; i <= n; i++) { const p = P(0, rl0 + ((rl1 - rl0) * i) / n, ridgeY + 0.1); mb.box(p[0], p[1], p[2], 0.04, 0.28, 0.04, { layer: o.metal ?? o.trim }); }
    mb.beam(P(0, rl0, ridgeY + 0.36), P(0, rl1, ridgeY + 0.36), 0.04, { layer: o.metal ?? o.trim });
  }
  // ---- snow blanket ----
  if (o.snow !== undefined && o.snow >= 0) {
    for (const k of [1, 0]) {
      const sg = k === 1 ? 1 : -1;
      const pt = (a: number, q: number): V3 => {
        const l = a * sg * halfLen(q, (a * sg) < 0 ? 0 : 1) * 0.985;
        const v = P(sg * reach(k) * q, l, ridgeY - drop(q, k) + lift(a, q) + 0.09);
        return v;
      };
      const q1 = 0.94;
      quadOut(mb, pt(-1, q1), pt(1, q1), pt(1, 0), pt(-1, 0), UP, { layer: o.snow, uvScale: 0.5 });
      // Thick lip along the eave.
      mb.beam(pt(-1, q1), pt(1, q1), 0.16, { layer: o.snow });
    }
  }
  const info: RoofInfo = {
    ridgeY: o.y + ridgeY, alongX: o.alongX, ridge: [R0, R1],
    at: (x: number, z: number) => {
      const s = o.alongX ? z - F.cz : x - F.cx, l = o.alongX ? x - F.cx : z - F.cz;
      const k = s >= 0 ? 1 : 0, q = Math.min(1, Math.abs(s) / reach(k));
      let h = ridgeY - drop(q, k);
      const e = l >= 0 ? 1 : 0, rh = ridgeHalf(e);
      if (hipAll && Math.abs(l) > rh) h = Math.min(h, ridgeY - drop(Math.min(1, (Math.abs(l) - rh) / Math.max(0.01, ends[e]! - rh)), k));
      return o.y + h;
    },
  };
  void hash3;
  return info;
}

/** Flat roof: deck, parapet with coping, roof clutter (tank / vents / AC / stair hut). */
function flat(mb: MeshBuilder, o: RoofOpts): RoofInfo {
  const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2, W = o.x1 - o.x0, D = o.z1 - o.z0, y = o.y;
  const deck = o.gable, par = o.mat;
  mb.quad([o.x0, y + 0.02, o.z1], [o.x1, y + 0.02, o.z1], [o.x1, y + 0.02, o.z0], [o.x0, y + 0.02, o.z0], { layer: deck, tint: [0.78, 0.78, 0.76] });
  const t = 0.18, ph = 0.55;
  for (const [px, pz, pw, pd] of [[cx, o.z1 - t / 2, W, t], [cx, o.z0 + t / 2, W, t], [o.x1 - t / 2, cz, t, D - 2 * t], [o.x0 + t / 2, cz, t, D - 2 * t]] as const)
    mb.box(px, y, pz, pw, ph, pd, { layer: par, tint: o.tint });
  // Coping.
  for (const [px, pz, pw, pd] of [[cx, o.z1 - t / 2, W + 0.1, t + 0.1], [cx, o.z0 + t / 2, W + 0.1, t + 0.1], [o.x1 - t / 2, cz, t + 0.1, D], [o.x0 + t / 2, cz, t + 0.1, D]] as const)
    mb.bevelBox(px, y + ph, pz, pw, 0.09, pd, 0.02, { layer: o.trim });
  const r = (i: number) => hash3(o.seed + i * 131);
  if (!o.mobile) {
    if (r(1) < 0.55 && W > 3 && D > 3) {
      // Water tank on a steel stand.
      const tx = cx + (r(2) - 0.5) * (W - 2), tz = cz - D / 4;
      for (const [sx, sz] of [[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]] as const) mb.box(tx + sx, y, tz + sz, 0.08, 0.9, 0.08, { layer: o.metal ?? o.trim });
      mb.cyl(tx, y + 0.9, tz, 0.62, 0.62, 1.0, 10, { layer: o.metal ?? o.trim, tint: [0.95, 0.95, 0.98] });
      mb.cyl(tx, y + 1.9, tz, 0.64, 0.08, 0.3, 10, { layer: o.metal ?? o.trim });
    }
    if (r(3) < 0.7) { const ax = cx + (r(4) - 0.5) * (W - 1.4), az = cz + (r(5) - 0.5) * (D - 1.4); mb.box(ax, y, az, 0.8, 0.55, 0.55, { layer: o.metal ?? o.trim, tint: [1.05, 1.05, 1.05] }); mb.cyl(ax, y + 0.56, az, 0.2, 0.2, 0.03, 8, { layer: o.trim, tint: [0.3, 0.3, 0.3] }); }
    if (r(6) < 0.5) { const vx = cx + (r(7) - 0.5) * (W - 1), vz = cz + (r(8) - 0.5) * (D - 1); mb.cyl(vx, y, vz, 0.12, 0.12, 0.8, 6, { layer: o.metal ?? o.trim }); mb.cyl(vx, y + 0.8, vz, 0.22, 0.02, 0.18, 6, { layer: o.metal ?? o.trim }); }
    if (r(9) < 0.3 && W > 4 && D > 3.5) { const hx = o.x0 + 1.0, hz = o.z0 + 0.9; mb.box(hx, y, hz, 1.3, 2.1, 1.3, { layer: par, tint: o.tint }); mb.box(hx, y + 2.1, hz, 1.45, 0.12, 1.45, { layer: o.trim }); }
  }
  if (o.snow !== undefined && o.snow >= 0) mb.quad([o.x0 + t, y + 0.1, o.z1 - t], [o.x1 - t, y + 0.1, o.z1 - t], [o.x1 - t, y + 0.1, o.z0 + t], [o.x0 + t, y + 0.1, o.z0 + t], { layer: o.snow });
  return { ridgeY: y + ph, at: () => y + 0.02, ridge: [[cx, y, cz], [cx, y, cz]], alongX: o.alongX };
}

/** Mono-pitch roof: high at the back (-z), low at the front (+z) (or along x). */
function shed(mb: MeshBuilder, o: RoofOpts): RoofInfo {
  const [ef, eb, er, el] = o.eave;
  const x0 = o.x0 - el, x1 = o.x1 + er, z0 = o.z0 - eb, z1 = o.z1 + ef;
  const rise = (o.z1 - o.z0) * o.pitch;
  const yb = o.y + rise + eb * o.pitch, yf = o.y - ef * o.pitch;
  quadOut(mb, [x0, yf, z1], [x1, yf, z1], [x1, yb, z0], [x0, yb, z0], [0, 1, 0], { layer: o.mat, tint: o.tint, uvs: [[x0 * 0.5, (z1 - z0) * 0.6], [x1 * 0.5, (z1 - z0) * 0.6], [x1 * 0.5, 0], [x0 * 0.5, 0]] });
  quadOut(mb, [x1, yf - 0.1, z1], [x0, yf - 0.1, z1], [x0, yb - 0.1, z0], [x1, yb - 0.1, z0], [0, -1, 0], { layer: o.soffit, tint: [0.7, 0.68, 0.66] });
  mb.beam([x0, yf - 0.05, z1], [x1, yf - 0.05, z1], 0.14, { layer: o.trim });
  mb.beam([x0, yb - 0.05, z0], [x1, yb - 0.05, z0], 0.14, { layer: o.trim });
  // Side walls (trapezoid tops).
  for (const sx of [o.x0, o.x1]) {
    const a: V3 = [sx, o.y, o.z1], b: V3 = [sx, o.y, o.z0], c: V3 = [sx, o.y + rise, o.z0];
    triOut(mb, a, b, c, [sx === o.x1 ? 1 : -1, 0, 0], { layer: o.gable, tint: o.tint });
  }
  if (o.snow !== undefined && o.snow >= 0) mb.quad([x0 + 0.05, yf + 0.1, z1 - 0.1], [x1 - 0.05, yf + 0.1, z1 - 0.1], [x1 - 0.05, yb + 0.1, z0], [x0 + 0.05, yb + 0.1, z0], { layer: o.snow });
  return { ridgeY: yb, at: (_x, z) => yf + (yb - yf) * ((z1 - z) / (z1 - z0)), ridge: [[x0, yb, z0], [x1, yb, z0]], alongX: true };
}

function barrel(mb: MeshBuilder, o: RoofOpts): RoofInfo {
  const saw = o.kind === "saw";
  const alongX = o.alongX;
  const x0 = o.x0 - o.eave[3] * 0.5, x1 = o.x1 + o.eave[2] * 0.5, z0 = o.z0 - o.eave[1] * 0.5, z1 = o.z1 + o.eave[0] * 0.5;
  const span = alongX ? z1 - z0 : x1 - x0, len = alongX ? x1 - x0 : z1 - z0;
  const rise = saw ? Math.min(1.4, span * 0.3) : span * 0.28;
  const segs = saw ? 2 : 7;
  const n = saw ? Math.max(2, Math.round(len / 2.6)) : 1;
  const y = o.y;
  const hAt = (t: number) => (saw ? (t < 0.78 ? t / 0.78 : (1 - t) / 0.22) * rise : Math.sin(Math.PI * t) * rise);
  const M = (s: number, l: number, h: number): V3 => (alongX ? [x0 + l, y + h, z0 + s] : [x0 + s, y + h, z0 + l]);
  for (let k = 0; k < n; k++) {
    const l0 = (len / n) * k, l1 = l0 + len / n;
    const ts = saw ? [0, 0.78, 1] : Array.from({ length: segs + 1 }, (_, i) => i / segs);
    for (let i = 0; i < ts.length - 1; i++) {
      const t0 = ts[i]!, t1 = ts[i + 1]!;
      const glassFace = saw && i === 1;
      const A = M(span * t0, l0, hAt(t0)), B = M(span * t1, l0, hAt(t1)), C = M(span * t1, l1, hAt(t1)), D = M(span * t0, l1, hAt(t0));
      const opts: FaceOpts = { layer: glassFace ? (o.accent ?? o.trim) : o.mat, tint: glassFace ? undefined : o.tint, emissive: glassFace ? 0.6 : 0 };
      const mid = M(span * (t0 + t1) / 2, (l0 + l1) / 2, (hAt(t0) + hAt(t1)) / 2), ctr = M(span / 2, (l0 + l1) / 2, -rise);
      quadOut(mb, A, B, C, D, [mid[0] - ctr[0], mid[1] - ctr[1], mid[2] - ctr[2]], opts);
    }
    // End walls.
    for (const l of [l0, l1]) {
      if (n > 1 && l !== 0 && l !== len && saw) continue;
      const pts = (saw ? [0, 0.78, 1] : Array.from({ length: segs + 1 }, (_, i) => i / segs)).map((t) => M(span * t, l, hAt(t)));
      const base = M(span / 2, l, 0);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!, c = pts[i + 1]!;
        const lo: V3 = alongX ? [l === l0 ? -1 : 1, 0, 0] : [0, 0, l === l0 ? -1 : 1];
        triOut(mb, base, a, c, lo, { layer: o.gable, tint: o.tint });
      }
    }
    mb.beam(M(0, l0, -0.05), M(0, l1, -0.05), 0.12, { layer: o.trim });
    mb.beam(M(span, l0, -0.05), M(span, l1, -0.05), 0.12, { layer: o.trim });
  }
  return { ridgeY: y + rise, at: () => y + rise * 0.6, ridge: [M(span / 2, 0, rise), M(span / 2, len, rise)], alongX };
}

function domeRoof(mb: MeshBuilder, o: RoofOpts): RoofInfo {
  const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2, r = Math.min(o.x1 - o.x0, o.z1 - o.z0) / 2;
  const W = o.x1 - o.x0, D = o.z1 - o.z0;
  mb.bevelBox(cx, o.y - 0.1, cz, W + 0.2, 0.3, D + 0.2, 0.05, { layer: o.trim });
  mb.cyl(cx, o.y + 0.2, cz, r * 0.92, r * 0.92, 0.35, 16, { layer: o.gable, tint: o.tint }, false);
  domeMesh(mb, cx, o.y + 0.55, cz, r * 0.95, r * 0.85, 16, 5, { layer: o.mat, tint: o.tint });
  mb.cyl(cx, o.y + 0.55 + r * 0.85, cz, 0.16, 0.16, 0.25, 8, { layer: o.metal ?? o.trim });
  mb.cyl(cx, o.y + 0.8 + r * 0.85, cz, 0.08, 0.01, 0.7, 6, { layer: o.metal ?? o.trim });
  return { ridgeY: o.y + 0.55 + r * 0.85, at: () => o.y + 0.3, ridge: [[cx, o.y, cz], [cx, o.y, cz]], alongX: o.alongX };
}

function cone(mb: MeshBuilder, o: RoofOpts): RoofInfo {
  const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
  const r = Math.max(o.x1 - o.x0, o.z1 - o.z0) / 2 * 1.02 + o.eave[0];
  const h = r * o.pitch * 1.6;
  mb.cyl(cx, o.y - o.eave[0] * 0.5, cz, r, 0.03, h, 12, { layer: o.mat, tint: o.tint });
  mb.cyl(cx, o.y - o.eave[0] * 0.5 - 0.12, cz, r, r, 0.12, 12, { layer: o.trim }, false);
  mb.cyl(cx, o.y + h - 0.2, cz, 0.06, 0.02, 0.9, 6, { layer: o.metal ?? o.trim });
  if (!o.mobile) tube(mb, [cx, o.y + h + 0.45, cz], [cx + 0.35, o.y + h + 0.45, cz], 0.02, 4, { layer: o.metal ?? o.trim });
  return { ridgeY: o.y + h, at: () => o.y + h * 0.3, ridge: [[cx, o.y + h, cz], [cx, o.y + h, cz]], alongX: o.alongX };
}

/** Mansard: steep lower slopes (with dormer sockets) + low hip top, cornice at the break. */
function mansard(mb: MeshBuilder, o: RoofOpts): RoofInfo {
  const e = 0.12, hm = 1.75, inset = 0.62;
  const x0 = o.x0 - e, x1 = o.x1 + e, z0 = o.z0 - e, z1 = o.z1 + e;
  const X0 = o.x0 + inset, X1 = o.x1 - inset, Z0 = o.z0 + inset, Z1 = o.z1 - inset;
  const y0 = o.y, y1 = o.y + hm;
  const T = (layer: number, uvs?: [number, number][]): FaceOpts => ({ layer, tint: o.tint, uvs });
  const faces: [V3, V3, V3, V3][] = [
    [[x0, y0, z1], [x1, y0, z1], [X1, y1, Z1], [X0, y1, Z1]],
    [[x1, y0, z0], [x0, y0, z0], [X0, y1, Z0], [X1, y1, Z0]],
    [[x1, y0, z1], [x1, y0, z0], [X1, y1, Z0], [X1, y1, Z1]],
    [[x0, y0, z0], [x0, y0, z1], [X0, y1, Z1], [X0, y1, Z0]],
  ];
  const mcx = (o.x0 + o.x1) / 2, mcz = (o.z0 + o.z1) / 2;
  for (const [a, b, c, d] of faces) {
    const w = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const mid: V3 = [(a[0] + b[0]) / 2 - mcx, 0.5, (a[2] + b[2]) / 2 - mcz];
    quadOut(mb, a, b, c, d, mid, T(o.mat, [[0, 1.0], [w * 0.5, 1.0], [w * 0.5 - 0.3, 0], [0.3, 0]]));
  }
  // Curb / cornice at the break.
  mb.bevelBox((X0 + X1) / 2, y1 - 0.02, (Z0 + Z1) / 2, X1 - X0 + 0.2, 0.14, Z1 - Z0 + 0.2, 0.04, { layer: o.trim });
  // Low hip top.
  const top = pitched(mb, { ...o, kind: "hip", x0: X0, x1: X1, z0: Z0, z1: Z1, y: y1 + 0.1, pitch: 0.32, eave: [0.1, 0.1, 0.1, 0.1], rafters: false, brackets: false, snow: o.snow, curved: false, upturn: 0 });
  mb.beam([x0, y0 - 0.04, z1], [x1, y0 - 0.04, z1], 0.12, { layer: o.trim });
  const W = o.x1 - o.x0, D = o.z1 - o.z0;
  void W; void D;
  return { ridgeY: top.ridgeY, alongX: o.alongX, ridge: top.ridge, at: (x, z) => {
    const dx = Math.max(o.x0 - x, x - o.x1, 0), dz = Math.max(o.z0 - z, z - o.z1, 0);
    void dx; void dz;
    const din = Math.min(x - o.x0, o.x1 - x, z - o.z0, o.z1 - z);
    return din < inset ? y0 + (din / inset) * hm : top.at(x, z);
  } };
}

/** Gambrel (barn) roof: steep lower + gentle upper pitch, pentagonal gable ends with hay door. */
function gambrel(mb: MeshBuilder, o: RoofOpts): RoofInfo {
  const F = frame(o), { sHalf, lHalf, sE, lE, map } = F;
  const e = sE[1]!;
  const prof: [number, number][] = [[sHalf + e, -e * 1.6], [sHalf * 0.62, sHalf * 0.8], [0, sHalf * 1.05]];
  const L0 = -(lHalf + lE[0]!), L1 = lHalf + lE[1]!;
  for (const k of [1, -1]) {
    for (let i = 0; i < prof.length - 1; i++) {
      const [sa, ha] = prof[i]!, [sb, hb] = prof[i + 1]!;
      const A = map(k * sa, k > 0 ? L0 : L1, ha), B = map(k * sa, k > 0 ? L1 : L0, ha), C = map(k * sb, k > 0 ? L1 : L0, hb), D = map(k * sb, k > 0 ? L0 : L1, hb);
      const slen = Math.hypot(sa - sb, ha - hb);
      quadOut(mb, A, B, C, D, [0, 1, 0], { layer: o.mat, tint: o.tint, uvs: [[L0 * 0.5, slen * 0.6], [L1 * 0.5, slen * 0.6], [L1 * 0.5, 0], [L0 * 0.5, 0]] });
    }
  }
  mb.beam(map(0, L0, sHalf * 1.05 + 0.04), map(0, L1, sHalf * 1.05 + 0.04), 0.18, { layer: o.mat, tint: [0.75, 0.75, 0.78] });
  for (const se of [-1, 1]) {
    const l = se * lHalf;
    const pts: V3[] = [map(-sHalf, l, 0), map(-sHalf * 0.62, l, sHalf * 0.8 - 0.05), map(0, l, sHalf * 1.05 - 0.05), map(sHalf * 0.62, l, sHalf * 0.8 - 0.05), map(sHalf, l, 0)];
    const c = map(0, l, 0.3);
    const gOut: V3 = o.alongX ? [se, 0, 0] : [0, 0, se];
    for (let i = 0; i < pts.length - 1; i++) triOut(mb, c, pts[i]!, pts[i + 1]!, gOut, { layer: o.gable, tint: o.tint });
    triOut(mb, pts[0]!, pts[4]!, c, gOut, { layer: o.gable, tint: o.tint });
    // Barge boards.
    const lb = se * (lHalf + lE[se > 0 ? 1 : 0]!);
    for (const k of [1, -1]) for (let i = 0; i < prof.length - 1; i++) mb.beam(map(k * prof[i]![0], lb, prof[i]![1]), map(k * prof[i + 1]![0], lb, prof[i + 1]![1]), 0.15, { layer: o.trim });
    // Hay-loft door + hoist beam.
    const hd = map(0, l + se * 0.04, sHalf * 0.3);
    const hy = sHalf * 0.3;
    const q = (a: V3, b: V3, c2: V3, d: V3, opts: FaceOpts) => quadOut(mb, a, b, c2, d, gOut, opts);
    q(map(-0.45, l + se * 0.05, hy), map(0.45, l + se * 0.05, hy), map(0.45, l + se * 0.05, hy + 1.1), map(-0.45, l + se * 0.05, hy + 1.1), { layer: o.trim, tint: [0.8, 0.8, 0.8] });
    mb.beam(map(0, l, sHalf * 1.0), map(0, l + se * 0.8, sHalf * 1.0), 0.14, { layer: o.trim });
    void hd;
  }
  return { ridgeY: o.y + sHalf * 1.05, alongX: o.alongX, ridge: [map(0, L0, sHalf * 1.05), map(0, L1, sHalf * 1.05)], at: (x, z) => o.y + sHalf * 1.05 - Math.abs(o.alongX ? z - F.cz : x - F.cx) * 0.5 };
}
