import type { Point, Rect, Road } from "./types";
export const round = (v: number) => Math.round(v * 10000) / 10000;
export const point = (x: number, z: number): Point => ({
  x: round(x),
  z: round(z),
});
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export const same = (a: Point, b: Point) => a.x === b.x && a.z === b.z;
export function hash32(text: string) {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) {
    n ^= text.charCodeAt(i);
    n = Math.imul(n, 16777619);
  }
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}
export class Random {
  constructor(private state: number) {}
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a: number, b: number) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  range(a: number, b: number) {
    return a + this.next() * (b - a);
  }
  pick<T>(a: readonly T[]): T {
    return a[this.int(0, a.length - 1)]!;
  }
  shuffle<T>(a: readonly T[]) {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [b[i], b[j]] = [b[j]!, b[i]!];
    }
    return b;
  }
}
export function rectangle(
  cx: number,
  cz: number,
  w: number,
  d: number,
  yaw = 0,
): Point[] {
  const t = (yaw * Math.PI) / 180,
    c = Math.cos(t),
    s = Math.sin(t);
  return (
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ] as [number, number][]
  ).map(([x, z]) => point(cx + c * x + s * z, cz - s * x + c * z));
}
export function box(poly: Point[]): Rect {
  const xs = poly.map((p) => p.x),
    zs = poly.map((p) => p.z);
  const x = Math.min(...xs),
    z = Math.min(...zs);
  return { x, z, w: Math.max(...xs) - x, d: Math.max(...zs) - z };
}
export function inside(p: Point, poly: Point[]) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!,
      b = poly[(i + 1) % poly.length]!,
      k = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
    if (Math.abs(k) < 1e-7) continue;
    const s = Math.sign(k);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}
export function overlap(a: Point[], b: Point[], gap = 0) {
  for (const p of [a, b])
    for (let i = 0; i < p.length; i++) {
      const q = p[i]!,
        r = p[(i + 1) % p.length]!,
        dx = r.x - q.x,
        dz = r.z - q.z,
        len = Math.hypot(dx, dz),
        nx = -dz / len,
        nz = dx / len;
      const aa = a.map((v) => v.x * nx + v.z * nz),
        bb = b.map((v) => v.x * nx + v.z * nz);
      if (
        Math.max(...aa) + gap <= Math.min(...bb) + 1e-5 ||
        Math.max(...bb) + gap <= Math.min(...aa) + 1e-5
      )
        return false;
    }
  return true;
}
export function distanceSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    v = dx * dx + dz * dz;
  const t = v
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / v))
    : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
export function roadPieces(roads: Road[], padding = 0) {
  return roads.flatMap((road) =>
    road.points.slice(1).map((b, i) => {
      const a = road.points[i]!,
        len = dist(a, b);
      return {
        road,
        a,
        b,
        len,
        poly: rectangle(
          (a.x + b.x) / 2,
          (a.z + b.z) / 2,
          road.width + padding * 2,
          len + road.width + padding * 2,
          (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI,
        ),
      };
    }),
  );
}
export function roadDistance(p: Point, roads: Road[]) {
  let d = Infinity;
  for (const r of roads)
    for (let i = 1; i < r.points.length; i++)
      d = Math.min(
        d,
        distanceSegment(p, r.points[i - 1]!, r.points[i]!) - r.width / 2,
      );
  return d;
}
export function gridPath(tiles: string[], start: Point, target?: Point) {
  const h = tiles.length,
    w = tiles[0]!.length,
    s = Math.round(start.z) * w + Math.round(start.x),
    end = target ? Math.round(target.z) * w + Math.round(target.x) : -1;
  const seen = new Int32Array(w * h).fill(-1),
    queue = new Int32Array(w * h);
  if (tiles[Math.round(start.z)]?.[Math.round(start.x)] !== ".")
    return { seen, count: 0, distance: -1, path: [] as Point[] };
  seen[s] = s;
  queue[0] = s;
  let n = 1;
  for (let k = 0; k < n; k++) {
    const p = queue[k]!,
      x = p % w,
      z = Math.floor(p / w);
    for (const q of [p - 1, p + 1, p - w, p + w]) {
      const nx = q % w,
        nz = Math.floor(q / w);
      if (
        q < 0 ||
        q >= w * h ||
        Math.abs(nx - x) + Math.abs(nz - z) !== 1 ||
        seen[q]! >= 0 ||
        tiles[nz]![nx] !== "."
      )
        continue;
      seen[q] = p;
      queue[n++] = q;
    }
  }
  const path: Point[] = [];
  if (end >= 0 && seen[end]! >= 0) {
    let p = end;
    while (p !== s) {
      path.push({ x: p % w, z: Math.floor(p / w) });
      p = seen[p]!;
    }
    path.push(start);
    path.reverse();
  }
  return { seen, count: n, distance: path.length ? path.length - 1 : -1, path };
}
export function cellPolygon(
  poly: Point[],
  width: number,
  height: number,
  fn: (x: number, z: number) => void,
) {
  const b = box(poly);
  for (
    let z = Math.max(0, Math.floor(b.z));
    z <= Math.min(height - 1, Math.ceil(b.z + b.d));
    z++
  )
    for (
      let x = Math.max(0, Math.floor(b.x));
      x <= Math.min(width - 1, Math.ceil(b.x + b.w));
      x++
    )
      if (inside({ x, z }, poly)) fn(x, z);
}
