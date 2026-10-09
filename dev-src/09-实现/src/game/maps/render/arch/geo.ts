// Geometry helpers for the building grammar: wall-space mapping, oriented boxes, tubes, domes, arcs.
// Everything works in the building's local frame (origin at footprint centre on the lot top, +z front).
import type { FaceOpts, MeshBuilder, V3 } from "../mesh";

export type Side = "s" | "n" | "e" | "w";
/** Wall-space mapping: u along the wall (left→right seen from outside), v up, t outward. */
export type WallP = (u: number, v: number, t?: number) => V3;

/** Wall mapping for the face `side` of a rectangle [-hw,hw]×[-hd,hd] centred at (cx,cz). */
export function wallP(side: Side, hw: number, hd: number, cx = 0, cz = 0): WallP {
  switch (side) {
    case "s": return (u, v, t = 0) => [cx + u, v, cz + hd + t];
    case "n": return (u, v, t = 0) => [cx - u, v, cz - hd - t];
    case "e": return (u, v, t = 0) => [cx + hw + t, v, cz - u];
    default: return (u, v, t = 0) => [cx - hw - t, v, cz + u];
  }
}
/** Half-length of the wall for a side. */
export const sideHalf = (side: Side, hw: number, hd: number) => (side === "s" || side === "n" ? hw : hd);

/** Quad in wall space (u0..u1 × v0..v1 at offset t), facing outward. */
export function wq(mb: MeshBuilder, P: WallP, u0: number, u1: number, v0: number, v1: number, t: number, o: FaceOpts) {
  mb.quad(P(u0, v0, t), P(u1, v0, t), P(u1, v1, t), P(u0, v1, t), o);
}
/** Box in wall space: u0..u1, v0..v1, t0..t1 (t1 outermost). Faces: front, top, bottom, left, right. */
export function wbox(mb: MeshBuilder, P: WallP, u0: number, u1: number, v0: number, v1: number, t0: number, t1: number, o: FaceOpts, faces = "ftblr", top?: FaceOpts) {
  if (faces.includes("f")) mb.quad(P(u0, v0, t1), P(u1, v0, t1), P(u1, v1, t1), P(u0, v1, t1), o);
  if (faces.includes("t")) mb.quad(P(u0, v1, t1), P(u1, v1, t1), P(u1, v1, t0), P(u0, v1, t0), top ?? o);
  if (faces.includes("b")) mb.quad(P(u0, v0, t0), P(u1, v0, t0), P(u1, v0, t1), P(u0, v0, t1), o);
  if (faces.includes("l")) mb.quad(P(u0, v0, t0), P(u0, v0, t1), P(u0, v1, t1), P(u0, v1, t0), o);
  if (faces.includes("r")) mb.quad(P(u1, v0, t1), P(u1, v0, t0), P(u1, v1, t0), P(u1, v1, t1), o);
}

/** Oriented box: centre c, unit axes ax/ay/az, half sizes. */
export function obox(mb: MeshBuilder, c: V3, ax: V3, ay: V3, az: V3, hx: number, hy: number, hz: number, o: FaceOpts, faces = "tbnsew") {
  const p = (sx: number, sy: number, sz: number): V3 => [
    c[0] + ax[0] * hx * sx + ay[0] * hy * sy + az[0] * hz * sz,
    c[1] + ax[1] * hx * sx + ay[1] * hy * sy + az[1] * hz * sz,
    c[2] + ax[2] * hx * sx + ay[2] * hy * sy + az[2] * hz * sz,
  ];
  if (faces.includes("t")) mb.quad(p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), p(-1, 1, -1), o);
  if (faces.includes("b")) mb.quad(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), o);
  if (faces.includes("s")) mb.quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), o);
  if (faces.includes("n")) mb.quad(p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), o);
  if (faces.includes("e")) mb.quad(p(1, -1, 1), p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), o);
  if (faces.includes("w")) mb.quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), o);
}

/** Rotate a point about the z axis through pivot (roll). */
export const rotZ = (p: V3, a: number, px = 0, py = 0): V3 => {
  const c = Math.cos(a), s = Math.sin(a), x = p[0] - px, y = p[1] - py;
  return [px + x * c - y * s, py + x * s + y * c, p[2]];
};
/** Rotate a point about the x axis through pivot (pitch). */
export const rotX = (p: V3, a: number, py = 0, pz = 0): V3 => {
  const c = Math.cos(a), s = Math.sin(a), y = p[1] - py, z = p[2] - pz;
  return [p[0], py + y * c - z * s, pz + y * s + z * c];
};
export const rotY = (p: V3, a: number, px = 0, pz = 0): V3 => {
  const c = Math.cos(a), s = Math.sin(a), x = p[0] - px, z = p[2] - pz;
  return [px + x * c + z * s, p[1], pz - x * s + z * c];
};
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Tube (n-gon section) between two points, optional end caps. */
export function tube(mb: MeshBuilder, a: V3, b: V3, r: number, seg: number, o: FaceOpts, caps = false, r2 = r) {
  const f = norm(sub(b, a));
  let s = cross(f, [0, 1, 0]);
  if (Math.hypot(...s) < 0.1) s = cross(f, [1, 0, 0]);
  s = norm(s);
  const u = cross(s, f);
  const ring = (c: V3, rr: number) => Array.from({ length: seg }, (_, i) => {
    const t = (i / seg) * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t);
    return [c[0] + (s[0] * cs + u[0] * sn) * rr, c[1] + (s[1] * cs + u[1] * sn) * rr, c[2] + (s[2] * cs + u[2] * sn) * rr] as V3;
  });
  const A = ring(a, r), B = ring(b, r2);
  const len = Math.hypot(...sub(b, a));
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    mb.quad(A[i]!, B[i]!, B[j]!, A[j]!, { ...o, uvs: o.uvs ?? [[i / seg * r * 3, 0], [i / seg * r * 3, len * 0.5], [(i + 1) / seg * r * 3, len * 0.5], [(i + 1) / seg * r * 3, 0]] });
  }
  if (caps) {
    const back: V3 = [-f[0], -f[1], -f[2]];
    for (let i = 1; i < seg - 1; i++) { triOut(mb, A[0]!, A[i]!, A[i + 1]!, back, o); triOut(mb, B[0]!, B[i]!, B[i + 1]!, f, o); }
  }
}

/** Dome (half ellipsoid) from a ring of radius r at y0, height h. */
export function dome(mb: MeshBuilder, cx: number, y0: number, cz: number, r: number, h: number, seg: number, rings: number, o: FaceOpts, profile?: (t: number) => number) {
  const prof = profile ?? ((t: number) => Math.cos(t * Math.PI / 2));
  for (let i = 0; i < rings; i++) {
    const t0 = i / rings, t1 = (i + 1) / rings;
    const r0 = r * prof(t0), r1 = r * prof(t1);
    const y00 = y0 + h * Math.sin(t0 * Math.PI / 2), y11 = y0 + h * Math.sin(t1 * Math.PI / 2);
    mb.cyl(cx, y00, cz, r0, Math.max(0.001, r1), y11 - y00, seg, o, i === rings - 1);
  }
}

/** Onion dome: bulge then pointed tip. */
export function onion(mb: MeshBuilder, cx: number, y0: number, cz: number, r: number, h: number, seg: number, o: FaceOpts) {
  const pts: [number, number][] = [[0.78, 0], [1.0, 0.14], [1.06, 0.3], [0.98, 0.46], [0.72, 0.62], [0.36, 0.8], [0.12, 0.92], [0.02, 1]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ra, ya] = pts[i]!, [rb, yb] = pts[i + 1]!;
    mb.cyl(cx, y0 + ya * h, cz, ra * r, Math.max(0.001, rb * r), (yb - ya) * h, seg, o, i === pts.length - 2);
  }
}

/** Lathe: revolve profile [(radius, y)] around the y axis. */
export function lathe(mb: MeshBuilder, cx: number, y0: number, cz: number, prof: [number, number][], seg: number, o: FaceOpts, capTop = true) {
  for (let i = 0; i < prof.length - 1; i++) {
    const [ra, ya] = prof[i]!, [rb, yb] = prof[i + 1]!;
    if (yb >= ya) mb.cyl(cx, y0 + ya, cz, ra, Math.max(0.001, rb), yb - ya, seg, o, capTop && i === prof.length - 2);
    else {
      // Overhanging step (profile goes down): draw inverted ring (normal pointing down/out).
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
        quadOut(mb, [cx + Math.cos(a1) * rb, y0 + yb, cz + Math.sin(a1) * rb], [cx + Math.cos(a0) * rb, y0 + yb, cz + Math.sin(a0) * rb], [cx + Math.cos(a0) * ra, y0 + ya, cz + Math.sin(a0) * ra], [cx + Math.cos(a1) * ra, y0 + ya, cz + Math.sin(a1) * ra], [Math.cos(am) * 0.3, -1, Math.sin(am) * 0.3], o);
      }
    }
  }
}

/** Ring (annulus) on a horizontal plane, facing up (or down). */
export function ring(mb: MeshBuilder, cx: number, y: number, cz: number, r0: number, r1: number, seg: number, o: FaceOpts, down = false) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (r: number, a: number): V3 => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    quadOut(mb, p(r0, a1), p(r0, a0), p(r1, a0), p(r1, a1), [0, down ? -1 : 1, 0], o);
  }
}

/** Arch curve heights: semicircle / segmental / pointed (gothic) / flat; x in [-1,1] → y in [0,1]. */
export type ArchKind = "round" | "segment" | "pointed" | "flat";
export function archY(kind: ArchKind, x: number) {
  x = Math.max(-1, Math.min(1, x));
  if (kind === "round") return Math.sqrt(1 - x * x);
  if (kind === "segment") return (Math.sqrt(1.69 - x * x * 0.69) - 1) / 0.3;
  if (kind === "pointed") { const ax = Math.abs(x); return Math.sqrt(Math.max(0, 1 - (ax + 0.6) * (ax + 0.6) / 2.56)) / Math.sqrt(1 - 0.36 / 2.56); }
  return 1;
}

/** Polygon fan in a vertical wall plane (points in wall space u,v at offset t). */
export function wfan(mb: MeshBuilder, P: WallP, pts: [number, number][], t: number, o: FaceOpts) {
  const c: [number, number] = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    mb.tri(P(c[0], c[1], t), P(a[0], a[1], t), P(b[0], b[1], t), o);
  }
}

export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Triangle whose front face points along `out` (winding fixed automatically). */
export function triOut(mb: MeshBuilder, a: V3, b: V3, c: V3, out: V3, o: FaceOpts) {
  const n = cross(sub(b, a), sub(c, a));
  if (dot(n, out) < 0) mb.tri(a, c, b, o); else mb.tri(a, b, c, o);
}
/** Quad whose front face points along `out` (winding + explicit UVs fixed automatically). */
export function quadOut(mb: MeshBuilder, a: V3, b: V3, c: V3, d: V3, out: V3, o: FaceOpts) {
  const n = cross(sub(b, a), sub(d, a));
  const n2 = cross(sub(d, c), sub(b, c));
  const s = dot(n, out) + dot(n2, out);
  if (s < 0) mb.quad(a, d, c, b, o.uvs || o.mul || o.shade || o.blend ? { ...o, uvs: o.uvs && [o.uvs[0]!, o.uvs[3]!, o.uvs[2]!, o.uvs[1]!], mul: o.mul && [o.mul[0], o.mul[3], o.mul[2], o.mul[1]], shade: o.shade && [o.shade[0], o.shade[3], o.shade[2], o.shade[1]], blend: o.blend && [o.blend[0], o.blend[3], o.blend[2], o.blend[1]] } : o);
  else mb.quad(a, b, c, d, o);
}
