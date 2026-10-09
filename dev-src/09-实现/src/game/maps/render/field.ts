// Coarse occupancy field for baked ambient occlusion + baked point-light contribution.
// Resolution: 0.25 m horizontally and vertically. Solid = terrain columns + building volumes + props.
import type { FloorLayout } from "../types";
import type { RGB } from "./color";

export const RES = 4; // samples per metre
const DISTS = [0.18, 0.42, 0.8];
const COS6 = [0, 1, 2, 3, 4, 5].map((i) => Math.cos((i / 6) * Math.PI * 2 + 0.3));
const SIN6 = [0, 1, 2, 3, 4, 5].map((i) => Math.sin((i / 6) * Math.PI * 2 + 0.3));
export class Field {
  w: number; h: number; ny: number; y0: number;
  solid: Uint8Array;
  constructor(layout: FloorLayout, minY: number, maxY: number) {
    this.w = layout.width * RES; this.h = layout.height * RES;
    this.y0 = Math.floor(minY) - 1;
    this.ny = Math.ceil((maxY - this.y0 + 2) * RES);
    this.solid = new Uint8Array(this.w * this.h * this.ny);
  }
  idx(ix: number, iy: number, iz: number) { return (iz * this.w + ix) * this.ny + iy; }
  fillBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const ax = Math.max(0, Math.floor((x0 + 0.5) * RES)), bx = Math.min(this.w - 1, Math.ceil((x1 + 0.5) * RES) - 1);
    const az = Math.max(0, Math.floor((z0 + 0.5) * RES)), bz = Math.min(this.h - 1, Math.ceil((z1 + 0.5) * RES) - 1);
    const ay = Math.max(0, Math.floor((y0 - this.y0) * RES)), by = Math.min(this.ny - 1, Math.ceil((y1 - this.y0) * RES) - 1);
    for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) {
      const base = (z * this.w + x) * this.ny;
      for (let y = ay; y <= by; y++) this.solid[base + y] = 1;
    }
  }
  at(x: number, y: number, z: number) {
    const ix = Math.floor((x + 0.5) * RES), iz = Math.floor((z + 0.5) * RES), iy = Math.floor((y - this.y0) * RES);
    if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return 1;
    if (iy < 0) return 1;
    if (iy >= this.ny) return 0;
    return this.solid[(iz * this.w + ix) * this.ny + iy]!;
  }
  private cache = new Map<number, number>();
  /** Hemisphere AO, cached per quantized position + normal (shared vertices are computed once). */
  ao(x: number, y: number, z: number, nx: number, ny: number, nz: number) {
    const qx = Math.round(x * 8) & 0x3ff, qy = Math.round((y - this.y0) * 8) & 0x3ff, qz = Math.round(z * 8) & 0x3ff;
    const qn = (Math.round(nx * 2) + 2) * 25 + (Math.round(ny * 2) + 2) * 5 + (Math.round(nz * 2) + 2);
    const key = ((qx * 1024 + qy) * 1024 + qz) * 128 + qn;
    let v = this.cache.get(key);
    if (v === undefined) { v = this.aoRaw(x, y, z, nx, ny, nz); this.cache.set(key, v); }
    return v;
  }
  /** Occupancy lookup without bounds allocation (inlined hot path). */
  private occ(x: number, y: number, z: number) {
    const ix = ((x + 0.5) * RES) | 0, iz = ((z + 0.5) * RES) | 0, iy = ((y - this.y0) * RES) | 0;
    if (x < -0.5 || z < -0.5 || ix >= this.w || iz >= this.h || y < this.y0) return 1;
    if (iy >= this.ny) return 0;
    return this.solid[(iz * this.w + ix) * this.ny + iy]!;
  }
  aoRaw(x: number, y: number, z: number, nx: number, ny: number, nz: number) {
    const e = 0.06;
    const px = x + nx * e, py = y + ny * e, pz = z + nz * e;
    let tx = -nz, ty = 0, tz = nx;
    if (ny > 0.9 || ny < -0.9) { tx = 1; ty = 0; tz = 0; }
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    let occ = 0, tot = 0;
    for (let di = 0; di < 3; di++) {
      const dist = DISTS[di]!, w = 1 / (0.6 + dist);
      for (let i = 0; i < 6; i++) {
        const c = COS6[(i + di) % 6]!, sn = SIN6[(i + di) % 6]!;
        const dx = nx + (tx * c + bx * sn) * 0.75, dy = ny + (ty * c + by * sn) * 0.75, dz = nz + (tz * c + bz * sn) * 0.75;
        const l = dist / Math.sqrt(dx * dx + dy * dy + dz * dz);
        tot += w;
        if (this.occ(px + dx * l, py + dy * l, pz + dz * l)) occ += w;
      }
      tot += w;
      if (this.occ(px + nx * dist, py + ny * dist, pz + nz * dist)) occ += w;
    }
    const open = 1 - occ / tot;
    return Math.max(0.28, Math.min(1, 0.16 + open * 0.95));
  }
  /** Is the straight segment p→q free (coarse march)? */
  visible(px: number, py: number, pz: number, qx: number, qy: number, qz: number) {
    const dx = qx - px, dy = qy - py, dz = qz - pz, len = Math.hypot(dx, dy, dz);
    const steps = Math.ceil(len / 0.25);
    for (let i = 2; i < steps - 1; i++) {
      const t = i / steps;
      if (this.at(px + dx * t, py + dy * t, pz + dz * t)) return false;
    }
    return true;
  }
}

export type PointLight = { x: number; y: number; z: number; color: RGB; radius: number; intensity: number; kind: string };

/** Spatial hash of lights for quick lookup during baking. */
export class LightGrid {
  cells = new Map<string, PointLight[]>();
  constructor(public lights: PointLight[], public cell = 6) {
    for (const l of lights) {
      const r = Math.ceil(l.radius / cell);
      const cx = Math.floor(l.x / cell), cz = Math.floor(l.z / cell);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const k = `${cx + dx},${cz + dz}`;
        let a = this.cells.get(k);
        if (!a) { a = []; this.cells.set(k, a); }
        a.push(l);
      }
    }
  }
  near(x: number, z: number) { return this.cells.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`) ?? []; }
}
