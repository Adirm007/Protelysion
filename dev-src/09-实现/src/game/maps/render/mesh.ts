// Geometry accumulator for the P5 render kernel. Coordinates: cell (x,z) centre at world (x, z),
// y up. Vertex format (shared by three.js preview and Godot):
//   position(3) normal(3) uv(2, metres/2 so one texture tile = 2 m) color(4: rgb light/AO, a blend)
//   layer(2: x = layerA + 128·layerB, y = emissive + 2·wind, or -1 = unlit cut-away cap)
//   lamp(3: baked point-light irradiance, linear rgb)
export type Pass = "opaque" | "cutout" | "water" | "glow";
export type V3 = [number, number, number];

/** Growable typed array (avoids huge boxed number[] arrays and GC churn). */
export class FArr {
  a: Float32Array; length = 0;
  constructor(cap = 1024) { this.a = new Float32Array(cap); }
  push(...v: number[]) {
    if (this.length + v.length > this.a.length) { const n = new Float32Array(Math.max(this.a.length * 2, this.length + v.length)); n.set(this.a.subarray(0, this.length)); this.a = n; }
    for (let i = 0; i < v.length; i++) this.a[this.length++] = v[i]!;
    return this.length;
  }
  get(i: number) { return this.a[i]!; }
  set(i: number, v: number) { this.a[i] = v; }
  view() { return this.a.subarray(0, this.length); }
}
export class UArr {
  a: Uint32Array; length = 0;
  constructor(cap = 1024) { this.a = new Uint32Array(cap); }
  push(...v: number[]) {
    if (this.length + v.length > this.a.length) { const n = new Uint32Array(Math.max(this.a.length * 2, this.length + v.length)); n.set(this.a.subarray(0, this.length)); this.a = n; }
    for (let i = 0; i < v.length; i++) this.a[this.length++] = v[i]!;
    return this.length;
  }
  view() { return this.a.subarray(0, this.length); }
}
export class Batch {
  pos = new FArr(); nor = new FArr(); uv = new FArr(); col = new FArr(); lay = new FArr(); lamp = new FArr(); idx = new UArr();
  /** Vertices excluded from baked lamp light (cut-away wall caps). */
  dark: Set<number> = new Set();
  get vertices() { return this.pos.length / 3; }
  get triangles() { return this.idx.length / 3; }
}
export type AOFn = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => number;
export type FaceOpts = {
  layer: number;
  layerB?: number;
  blend?: [number, number, number, number];
  emissive?: number;
  wind?: boolean;
  tint?: V3;
  /** Per-vertex light multipliers (overrides AO). */
  shade?: [number, number, number, number];
  /** Per-vertex multipliers applied on top of AO (course shading, grime bands). */
  mul?: [number, number, number, number];
  /** Explicit UVs (a,b,c,d). */
  uvs?: [number, number][];
  /** UV scale in texture tiles per metre (default 0.5 → a 64 px tile covers 2 m). */
  uvScale?: number;
  uvOffset?: [number, number];
  noAO?: boolean;
  doubleSided?: boolean;
  /** Exclude from baked lamp light (e.g. black cut-away caps). */
  unlit?: boolean;
};

/** Yaw + translation + uniform scale transform. */
type Xf = { c: number; s: number; tx: number; ty: number; tz: number; k: number };
const IDENT: Xf = { c: 1, s: 0, tx: 0, ty: 0, tz: 0, k: 1 };

export class MeshBuilder {
  batches = new Map<string, Batch>();
  target: Batch;
  targetKey = "";
  private stack: Xf[] = [];
  private xf: Xf = IDENT;
  ao: AOFn | null = null;
  chunk = 16;
  /** When set, geometry goes to this named group instead of spatial chunks. */
  group: string | null = null;
  pass: Pass = "opaque";
  uvLocal = false;
  /** Roof materials with geometric tile courses: layer → [course length (m, horizontal), lip height (m)]. */
  courses = new Map<number, [number, number]>();
  constructor() { this.target = this.batch("0,0,opaque"); }
  batch(key: string) {
    let b = this.batches.get(key);
    if (!b) { b = new Batch(); this.batches.set(key, b); }
    return b;
  }
  /** Select the batch for world position (x,z). */
  select(x: number, z: number, pass: Pass = this.pass) {
    const key = this.group ? `${this.group}|${pass}` : `${Math.floor((x + 0.5) / this.chunk)},${Math.floor((z + 0.5) / this.chunk)},${pass}`;
    if (key !== this.targetKey) { this.target = this.batch(key); this.targetKey = key; }
    return this.target;
  }
  push(yawDeg = 0, tx = 0, ty = 0, tz = 0, k = 1) {
    this.stack.push(this.xf);
    const a = (yawDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), p = this.xf;
    // compose: world = p( R(a)·k·local + t )
    const [wx, wy, wz] = this.apply(tx, ty, tz);
    this.xf = { c: p.c * c - p.s * s, s: p.s * c + p.c * s, tx: wx, ty: wy, tz: wz, k: p.k * k };
  }
  pop() { this.xf = this.stack.pop() ?? IDENT; }
  apply(x: number, y: number, z: number): V3 {
    const t = this.xf;
    return [t.tx + (t.c * x + t.s * z) * t.k, t.ty + y * t.k, t.tz + (-t.s * x + t.c * z) * t.k];
  }
  rot(nx: number, ny: number, nz: number): V3 {
    const t = this.xf;
    return [t.c * nx + t.s * nz, ny, -t.s * nx + t.c * nz];
  }
  get scale() { return this.xf.k; }

  /** Emit a quad a,b,c,d (counter-clockwise seen from the front) in local coordinates. */
  quad(a: V3, b: V3, c: V3, d: V3, o: FaceOpts) {
    const A = this.apply(...a), B = this.apply(...b), C = this.apply(...c), D = this.apply(...d);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    this.emit([A, B, C, D], [[nx, ny, nz], [nx, ny, nz], [nx, ny, nz], [nx, ny, nz]], o, [a, b, c, d]);
    if (o.doubleSided) this.emit([A, D, C, B], [[-nx, -ny, -nz], [-nx, -ny, -nz], [-nx, -ny, -nz], [-nx, -ny, -nz]], { ...o, blend: o.blend && [o.blend[0], o.blend[3], o.blend[2], o.blend[1]], shade: o.shade && [o.shade[0], o.shade[3], o.shade[2], o.shade[1]], mul: o.mul && [o.mul[0], o.mul[3], o.mul[2], o.mul[1]], uvs: o.uvs && [o.uvs[0]!, o.uvs[3]!, o.uvs[2]!, o.uvs[1]!] }, [a, d, c, b]);
  }
  /** Triangle with explicit (smooth) vertex normals; UVs are projected once from the face normal so the
   *  texture does not tear across the triangle. */
  triN(a: V3, b: V3, c: V3, na: V3, nb: V3, nc: V3, o: FaceOpts) {
    const A = this.apply(...a), B = this.apply(...b), C = this.apply(...c);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const fx = Math.abs(uy * vz - uz * vy), fy = Math.abs(uz * vx - ux * vz), fz = Math.abs(ux * vy - uy * vx);
    const sc = o.uvScale ?? 0.5, P = [A, B, C];
    const uvs: [number, number][] = o.uvs ? o.uvs : P.map((q): [number, number] => (fy >= fx && fy >= fz ? [q[0] * sc, q[2] * sc] : fx >= fz ? [q[2] * sc, -q[1] * sc] : [q[0] * sc, -q[1] * sc]));
    const bt = this.select((A[0] + B[0] + C[0]) / 3, (A[2] + B[2] + C[2]) / 3, this.pass);
    const base = bt.vertices, N = [this.rot(...na), this.rot(...nb), this.rot(...nc)], locals = [a, b, c];
    const oo: FaceOpts = { ...o, uvs };
    for (let i = 0; i < 3; i++) this.vertex(bt, P[i]!, N[i]!, oo, i, locals[i]!);
    bt.idx.push(base, base + 1, base + 2);
  }
  /** Emit a triangle (as a degenerate quad-free path). */
  tri(a: V3, b: V3, c: V3, o: FaceOpts) {
    const A = this.apply(...a), B = this.apply(...b), C = this.apply(...c);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const bt = this.select((A[0] + B[0] + C[0]) / 3, (A[2] + B[2] + C[2]) / 3, this.pass);
    const base = bt.vertices;
    const pts = [A, B, C], locals = [a, b, c];
    for (let i = 0; i < 3; i++) this.vertex(bt, pts[i]!, [nx, ny, nz], o, i, locals[i]!);
    bt.idx.push(base, base + 1, base + 2);
  }
  private emit(P: V3[], N: V3[], o: FaceOpts, local: V3[]) {
    const cx = (P[0]![0] + P[2]![0]) / 2, cz = (P[0]![2] + P[2]![2]) / 2;
    const bt = this.select(cx, cz, this.pass);
    const base = bt.vertices;
    for (let i = 0; i < 4; i++) this.vertex(bt, P[i]!, N[i]!, o, i, local[i]!);
    bt.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  private vertex(bt: Batch, p: V3, n: V3, o: FaceOpts, i: number, local: V3) {
    if (o.unlit) bt.dark.add(bt.vertices);
    bt.pos.push(p[0], p[1], p[2]);
    bt.nor.push(n[0], n[1], n[2]);
    // UV: explicit, or planar projection chosen by the dominant normal axis.
    let u: number, v: number;
    if (o.uvs) { u = o.uvs[i]![0]; v = o.uvs[i]![1]; }
    else {
      const q = this.uvLocal ? local : p, s = o.uvScale ?? 0.5;
      const ln = this.uvLocal ? this.unrot(n) : n;
      const ax = Math.abs(ln[0]), ay = Math.abs(ln[1]), az = Math.abs(ln[2]);
      if (ay >= ax && ay >= az) { u = q[0] * s; v = q[2] * s; }
      else if (ax >= az) { u = (ln[0] > 0 ? -q[2] : q[2]) * s; v = -q[1] * s; }
      else { u = (ln[2] > 0 ? q[0] : -q[0]) * s; v = -q[1] * s; }
      if (o.uvOffset) { u += o.uvOffset[0]; v += o.uvOffset[1]; }
    }
    bt.uv.push(u, v);
    let l: number;
    if (o.shade) l = o.shade[i]!;
    else if (o.noAO || !this.ao) l = 1;
    else l = this.ao(p[0], p[1], p[2], n[0], n[1], n[2]);
    if (o.mul) l *= o.mul[i]!;
    const t = o.tint ?? [1, 1, 1];
    bt.col.push(l * t[0], l * t[1], l * t[2], o.blend ? o.blend[i]! : 0);
    bt.lay.push((o.layer | 0) + 128 * ((o.layerB ?? o.layer) | 0), o.unlit ? -1 : (o.emissive ?? 0) + (o.wind ? 2 : 0));
    bt.lamp.push(0, 0, 0);
  }
  private unrot(n: V3): V3 { const t = this.xf; return [t.c * n[0] - t.s * n[2], n[1], t.s * n[0] + t.c * n[2]]; }

  // ---------------------------------------------------------------------------------------------
  /** Axis-aligned box in local space: centre (cx,cz), bottom y0, size w×h×d. `faces` mask skips hidden faces. */
  box(cx: number, y0: number, cz: number, w: number, h: number, d: number, o: FaceOpts, faces = "tnsew", top?: FaceOpts) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
    if (faces.includes("t")) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top ?? o);
    if (faces.includes("s")) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], o);
    if (faces.includes("n")) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], o);
    if (faces.includes("e")) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], o);
    if (faces.includes("w")) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], o);
    if (faces.includes("b")) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], o);
  }
  /** Box with chamfered top edges (b = chamfer size) — reads as carved stone / planed wood. */
  bevelBox(cx: number, y0: number, cz: number, w: number, h: number, d: number, b: number, o: FaceOpts, top?: FaceOpts) {
    b = Math.min(b, w / 3, d / 3, h / 2);
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h, ym = y1 - b;
    const t = top ?? o;
    this.quad([x0 + b, y1, z1 - b], [x1 - b, y1, z1 - b], [x1 - b, y1, z0 + b], [x0 + b, y1, z0 + b], t);
    // chamfers
    this.quad([x0, ym, z1], [x1, ym, z1], [x1 - b, y1, z1 - b], [x0 + b, y1, z1 - b], t);
    this.quad([x1, ym, z0], [x0, ym, z0], [x0 + b, y1, z0 + b], [x1 - b, y1, z0 + b], t);
    this.quad([x1, ym, z1], [x1, ym, z0], [x1 - b, y1, z0 + b], [x1 - b, y1, z1 - b], t);
    this.quad([x0, ym, z0], [x0, ym, z1], [x0 + b, y1, z1 - b], [x0 + b, y1, z0 + b], t);
    // sides
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, ym, z1], [x0, ym, z1], o);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, ym, z0], [x1, ym, z0], o);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, ym, z0], [x1, ym, z1], o);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, ym, z1], [x0, ym, z0], o);
  }
  /** Vertical cylinder / frustum. */
  cyl(cx: number, y0: number, cz: number, r0: number, r1: number, h: number, seg: number, o: FaceOpts, cap = true, capO?: FaceOpts) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const uv0 = i / seg * r0 * 3.14, uv1 = (i + 1) / seg * r0 * 3.14;
      // Outward-facing side (angle increases clockwise seen from above, so walk a1 → a0).
      this.quad([cx + c1 * r0, y0, cz + s1 * r0], [cx + c0 * r0, y0, cz + s0 * r0], [cx + c0 * r1, y0 + h, cz + s0 * r1], [cx + c1 * r1, y0 + h, cz + s1 * r1],
        { ...o, uvs: o.uvs ?? [[uv1, -y0 * 0.5], [uv0, -y0 * 0.5], [uv0, -(y0 + h) * 0.5], [uv1, -(y0 + h) * 0.5]] });
    }
    if (cap && r1 > 0.001) {
      const co = capO ?? o;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        this.tri([cx, y0 + h, cz], [cx + Math.cos(a1) * r1, y0 + h, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, y0 + h, cz + Math.sin(a0) * r1], { ...co, uvs: undefined });
      }
    }
  }
  /** Low-poly ellipsoid (octahedral subdivision) with optional lumpiness; smooth-ish normals by face. */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, o: FaceOpts, detail = 1, lump = 0, seed = 1, smooth = false) {
    const verts: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    let faces: [number, number, number][] = [[2, 4, 0], [2, 0, 5], [2, 5, 1], [2, 1, 4], [3, 0, 4], [3, 5, 0], [3, 1, 5], [3, 4, 1]];
    const mid = new Map<string, number>();
    const m = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      let i = mid.get(key);
      if (i === undefined) {
        const p = verts[a]!, q = verts[b]!, v: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
        const l = Math.hypot(...v);
        verts.push([v[0] / l, v[1] / l, v[2] / l]); i = verts.length - 1; mid.set(key, i);
      }
      return i;
    };
    for (let d = 0; d < detail; d++) {
      const nf: [number, number, number][] = [];
      for (const [a, b, c] of faces) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      faces = nf;
    }
    const P = verts.map((v, i) => {
      const n = lump ? 1 + (hash3(i * 7 + seed) - 0.5) * lump : 1;
      return [cx + v[0] * rx * n, cy + v[1] * ry * n, cz + v[2] * rz * n] as V3;
    });
    if (smooth) {
      const Nn = verts.map((v): V3 => { const x = v[0] / rx, y = v[1] / ry, z = v[2] / rz, l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; });
      for (const [a, b, c] of faces) this.triN(P[a]!, P[b]!, P[c]!, Nn[a]!, Nn[b]!, Nn[c]!, o);
      return;
    }
    for (const [a, b, c] of faces) this.tri(P[a]!, P[b]!, P[c]!, o);
  }
  /** Upright alpha card (both sides), centred at (cx,cz), bottom y0. */
  card(cx: number, y0: number, cz: number, w: number, h: number, yawDeg: number, o: FaceOpts, u0 = 0, u1 = 1) {
    const a = (yawDeg * Math.PI) / 180, dx = (Math.cos(a) * w) / 2, dz = (-Math.sin(a) * w) / 2;
    const prev = this.pass;
    this.pass = "cutout";
    this.quad([cx - dx, y0, cz - dz], [cx + dx, y0, cz + dz], [cx + dx, y0 + h, cz + dz], [cx - dx, y0 + h, cz - dz],
      { ...o, doubleSided: true, uvs: [[u0, 1], [u1, 1], [u1, 0], [u0, 0]] });
    this.pass = prev;
  }
  /** Beam between two local points (square section). */
  beam(a: V3, b: V3, t: number, o: FaceOpts) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1;
    const fx = dx / len, fy = dy / len, fz = dz / len;
    // pick a side vector
    let sx = -fz, sy = 0, sz = fx;
    if (Math.hypot(sx, sz) < 0.1) { sx = 1; sy = 0; sz = 0; }
    const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl;
    const ux = fy * sz - fz * sy, uy = fz * sx - fx * sz, uz = fx * sy - fy * sx;
    const h = t / 2;
    const corners = (p: V3): V3[] => [
      [p[0] + (sx + ux) * h, p[1] + (sy + uy) * h, p[2] + (sz + uz) * h],
      [p[0] + (-sx + ux) * h, p[1] + (-sy + uy) * h, p[2] + (-sz + uz) * h],
      [p[0] + (-sx - ux) * h, p[1] + (-sy - uy) * h, p[2] + (-sz - uz) * h],
      [p[0] + (sx - ux) * h, p[1] + (sy - uy) * h, p[2] + (sz - uz) * h],
    ];
    const A = corners(a), B = corners(b);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quad(A[j]!, A[i]!, B[i]!, B[j]!, o); }
  }
  stats() {
    let v = 0, t = 0;
    for (const b of this.batches.values()) { v += b.vertices; t += b.triangles; }
    return { vertices: v, triangles: t, batches: [...this.batches.values()].filter((b) => b.vertices).length };
  }
}
export function hash3(n: number) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
