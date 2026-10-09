// Terrain, walls, water, stairs, bridges, edges and boundary for the P5 kernel.
import type { FloorLayout } from "../types";
import type { MeshBuilder, FaceOpts, V3 } from "./mesh";
import { hash3 } from "./mesh";
import type { Field } from "./field";

export type Ctx = {
  L: FloorLayout;
  flora?: string[];
  tree?: (x: number, y: number, z: number, kind: string, k: number) => void;
  mb: MeshBuilder;
  field: Field;
  layer: (id: string) => number;
  W: number; H: number;
  top: (x: number, z: number) => number;
  s: (x: number, z: number) => string;
  walk: (x: number, z: number) => boolean;
  waterY: number;
  wild: boolean;
  quality: "desktop" | "mobile";
  lights: { x: number; y: number; z: number; color: [number, number, number]; radius: number; intensity: number; kind: string }[];
  glowColor: [number, number, number];
  lampColor: [number, number, number];
  boundTop: Float32Array;
};

const FLOORISH = "gcpdwmfatoDIPEFHCYU";
const hsh = (x: number, z: number, s = 0) => hash3(((x * 73856093) ^ (z * 19349663) ^ (s * 83492791)) | 0);
/** Smooth 2D value noise for UV-space blends (deterministic, world-space). */
function vnoise(x: number, z: number, seed: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hsh(ix, iz, seed), b = hsh(ix + 1, iz, seed), c = hsh(ix, iz + 1, seed), d = hsh(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export function surfaceLayer(ctx: Ctx, c: string): { a: string; b?: string } {
  const L = ctx.L;
  switch (c) {
    case "g": return L.interior ? { a: "floor" } : { a: "ground", b: "ground2" };
    case "d": return { a: "ground2", b: "ground" };
    case "c": return L.interior ? { a: "floor" } : { a: "path" };
    case "p": return { a: "plaza" };
    case "w": return { a: "wood" };
    case "m": return { a: L.archetype === "works" || L.interior ? "path" : "metal" };
    case "f": return { a: "floor" };
    case "a": return { a: "rug" };
    case "t": return { a: "tile" };
    case "o": return { a: "stone" };
    case "D": return { a: L.interior ? "floor" : "stone" };
    case "I": return { a: "floor" };
    case "U": return { a: "floor" };
    case "Y": return { a: "floor" };
    default: return L.interior ? { a: "floor" } : { a: "ground", b: "ground2" };
  }
}

/** Blend weight at a world point for two-layer grounds. */
export function blendAt(x: number, z: number) {
  const n = vnoise(x * 0.23, z * 0.23, 7) * 0.65 + vnoise(x * 0.9, z * 0.9, 11) * 0.35;
  return Math.max(0, Math.min(1, (n - 0.42) * 3.2));
}

/** Top face of one cell, subdivided into 2×2 so blends and baked light have enough resolution. */
function cellTop(ctx: Ctx, x: number, z: number, y: number, c: string) {
  const { a, b } = surfaceLayer(ctx, c);
  const la = ctx.layer(a), lb = b ? ctx.layer(b) : la;
  const sub = ctx.quality === "desktop" && b ? 2 : 1;
  const st = 1 / sub;
  for (let j = 0; j < sub; j++) for (let i = 0; i < sub; i++) {
    const x0 = x - 0.5 + i * st, x1 = x0 + st, z0 = z - 0.5 + j * st, z1 = z0 + st;
    const blend: [number, number, number, number] = b ? [blendAt(x0, z1), blendAt(x1, z1), blendAt(x1, z0), blendAt(x0, z0)] : [0, 0, 0, 0];
    ctx.mb.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], { layer: la, layerB: lb, blend });
  }
}

/** Vertical face between cell (x,z) (higher, top y1) and neighbour side, down to y0. dir: 'n'|'s'|'e'|'w'. */
export function wallFace(ctx: Ctx, x: number, z: number, dir: string, y0: number, y1: number, mat: string, rocky: boolean, tint?: V3) {
  if (y1 - y0 < 0.01) return;
  const mb = ctx.mb, o: FaceOpts = { layer: ctx.layer(mat), tint };
  // Face endpoints (counter-clockwise seen from outside = from the lower neighbour).
  let ax: number, az: number, bx: number, bz: number, nx: number, nz: number;
  if (dir === "s") { ax = x - 0.5; az = z + 0.5; bx = x + 0.5; bz = z + 0.5; nx = 0; nz = 1; }
  else if (dir === "n") { ax = x + 0.5; az = z - 0.5; bx = x - 0.5; bz = z - 0.5; nx = 0; nz = -1; }
  else if (dir === "e") { ax = x + 0.5; az = z + 0.5; bx = x + 0.5; bz = z - 0.5; nx = 1; nz = 0; }
  else { ax = x - 0.5; az = z - 0.5; bx = x - 0.5; bz = z + 0.5; nx = -1; nz = 0; }
  if (!rocky) {
    // Split into ≤1 m rows so baked AO / light have resolution on tall walls.
    const rows = Math.max(1, Math.ceil((y1 - y0) / 1.0));
    for (let r = 0; r < rows; r++) {
      const ya = y0 + ((y1 - y0) * r) / rows, yb = y0 + ((y1 - y0) * (r + 1)) / rows;
      mb.quad([ax, ya, az], [bx, ya, bz], [bx, yb, bz], [ax, yb, az], o);
    }
    return;
  }
  // Rocky: 2 columns × 0.5 m rows displaced by a 3D field (shared vertices → crack-free).
  const cols = 2, ys: number[] = [y0];
  for (let yy = Math.ceil(y0 * 2 + 1e-6) / 2; yy < y1 - 1e-6; yy += 0.5) if (yy > y0 + 1e-6) ys.push(yy);
  ys.push(y1);
  const disp = (px: number, py: number, pz: number): V3 => {
    const taper = Math.min(1, (y1 - py) / 0.45, (py - y0) / 0.3 + 0.4);
    const a = 0.2 * Math.max(0, taper);
    return [
      px + (vnoise(px * 1.7 + py * 0.9, pz * 1.7, 3) - 0.5) * a * 2 + nx * a * 0.6,
      py + (vnoise(px * 1.3, pz * 1.3 + py, 5) - 0.5) * a * 0.6,
      pz + (vnoise(px * 1.7, pz * 1.7 + py * 0.9, 9) - 0.5) * a * 2 + nz * a * 0.6,
    ];
  };
  for (let r = 0; r < ys.length - 1; r++) for (let c = 0; c < cols; c++) {
    const t0 = c / cols, t1 = (c + 1) / cols;
    const p = (t: number, yy: number) => disp(ax + (bx - ax) * t, yy, az + (bz - az) * t);
    mb.quad(p(t0, ys[r]!), p(t1, ys[r]!), p(t1, ys[r + 1]!), p(t0, ys[r + 1]!), o);
  }
}

const isStair = (c: string) => c === "S";
const isBridge = (c: string) => c === "B";

/** Infer ascending direction of a stair cell from walkable neighbours. */
function stairDir(ctx: Ctx, x: number, z: number): [number, number] {
  const h = ctx.top(x, z);
  let best: [number, number] = [0, -1], bd = -Infinity;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx, nz = z + dz;
    if (!ctx.walk(nx, nz)) continue;
    const back = ctx.walk(x - dx, z - dz) ? ctx.top(x - dx, z - dz) : h;
    const d = ctx.top(nx, nz) - back;
    if (d > bd) { bd = d; best = [dx, dz]; }
  }
  return best;
}

export function buildGround(ctx: Ctx) {
  const { L, mb, W, H } = ctx;
  const wild = ctx.wild;
  const retain = "retain", cliff = "cliff";
  const coping = ctx.layer("stone");
  // 1) Tops and walls for every non-water/void cell.
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = ctx.s(x, z), y = ctx.top(x, z);
    if (c === "W" || c === "V" || c === "K" || c === "Q") continue;
    if (c === "Z" || c === "R" || c === "X") continue; // boundary / walls handled separately
    if (isStair(c)) { stairCell(ctx, x, z); continue; }
    if (isBridge(c)) { bridgeCell(ctx, x, z); continue; }
    if (c === "C") { cheekCell(ctx, x, z); continue; }
    if (c === "H") continue; // building covers it
    if (c === "Y") { seatCell(ctx, x, z); continue; }
    cellTop(ctx, x, z, y, c === "P" || c === "E" ? (L.interior ? "f" : "g") : c);
    if (c === "E") edgeCell(ctx, x, z);
    if (c === "P") planterCell(ctx, x, z);
  }
  // 2) Vertical faces: for each cell, faces toward lower neighbours.
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = ctx.s(x, z);
    if (c === "V" || c === "Z" || c === "R" || c === "X" || c === "S" || c === "B" || c === "C" || c === "Y") continue;
    const y1 = c === "W" || c === "K" || c === "Q" ? ctx.top(x, z) : ctx.top(x, z);
    for (const [dx, dz, dir] of [[0, 1, "s"], [0, -1, "n"], [1, 0, "e"], [-1, 0, "w"]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const nc = ctx.s(nx, nz);
      if (nc === "Z" || nc === "R" || nc === "X") continue;
      let y0 = ctx.top(nx, nz);
      if (nc === "V") y0 = y1 - (1.6 + hsh(x, z, 4) * 1.4);
      else if (nc === "W") y0 = ctx.waterY - 1.2;
      else if (nc === "K") y0 = -6.5;
      else if (nc === "Q") y0 = ctx.top(nx, nz);
      else if (nc === "S" || nc === "B" || nc === "C" || nc === "Y") continue; // handled by those cells
      if (c === "W" || c === "K" || c === "Q" || c === "V") continue;
      if (y1 - y0 < 0.06) continue;
      const rocky = nc === "V" || nc === "K" || (wild && nc !== "W") || (L.archetype === "cliff" && nc === "W");
      const mat = nc === "Q" ? "tile" : rocky ? cliff : L.interior ? "stone" : retain;
      wallFace(ctx, x, z, dir, y0, y1, mat, rocky);
      // Coping stone along the top of built retaining walls (outdoor, masonry, not tiny steps).
      if (!rocky && !L.interior && y1 - y0 > 0.5 && nc !== "Q") copingRun(ctx, x, z, dir, y1, coping);
    }
  }
  // 3) Water, pits, pools.
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = ctx.s(x, z);
    if (c === "W") waterCell(ctx, x, z, ctx.waterY);
    else if (c === "Q") { const b = ctx.top(x, z); cellTop(ctx, x, z, b, "t"); waterCell(ctx, x, z, b + 0.42); }
    else if (c === "K") pitCell(ctx, x, z);
  }
  // 4) Boundary ring / solid rock / interior walls.
  boundary(ctx);
  void mb;
}

function copingRun(ctx: Ctx, x: number, z: number, dir: string, y: number, layer: number) {
  const mb = ctx.mb, t = 0.14, out = 0.1, o: FaceOpts = { layer };
  const e = 0.5 + 0.001;
  if (dir === "s") mb.bevelBox(x, y - 0.02, z + 0.5 - 0.08 + out / 2, 1.0 + 0.002, t, 0.16 + out, 0.03, o);
  else if (dir === "n") mb.bevelBox(x, y - 0.02, z - 0.5 + 0.08 - out / 2, 1.0 + 0.002, t, 0.16 + out, 0.03, o);
  else if (dir === "e") mb.bevelBox(x + 0.5 - 0.08 + out / 2, y - 0.02, z, 0.16 + out, t, 1.0 + 0.002, 0.03, o);
  else mb.bevelBox(x - 0.5 + 0.08 - out / 2, y - 0.02, z, 0.16 + out, t, 1.0 + 0.002, 0.03, o);
  void e;
}

function stairCell(ctx: Ctx, x: number, z: number) {
  const mb = ctx.mb, y = ctx.top(x, z), [ax, az] = stairDir(ctx, x, z);
  // Height of the lower end (neighbour below).
  const bx = x - ax, bz = z - az;
  const low = ctx.walk(bx, bz) ? ctx.top(bx, bz) : y - 0.42;
  const rise = Math.max(0.05, y - low);
  const kind = ctx.L.interior ? (ctx.L.archetype === "foundry" ? "metal" : ctx.L.archetype === "cave" ? "cliff" : "wood") : ctx.wild ? "cliff" : ctx.L.archetype === "works" ? "metal" : "stone";
  const tread = ctx.layer(kind === "cliff" ? "stone" : kind), riserL = ctx.layer(kind === "wood" ? "darkwood" : kind === "cliff" ? "stone" : kind);
  // Two treads per cell: lower half at y - rise/2, upper half at y.
  const sub = 2;
  for (let i = 0; i < sub; i++) {
    const t0 = -0.5 + i / sub, t1 = t0 + 1 / sub; // along ascending axis
    const yy = y - rise + (rise * (i + 1)) / sub;
    const yPrev = y - rise + (rise * i) / sub;
    // tread quad
    const P = (u: number, v: number): V3 => ax !== 0 ? [x + u * ax, yy, z + v] : [x + v, yy, z + u * az];
    let q: V3[] = [P(t0, -0.5), P(t1, -0.5), P(t1, 0.5), P(t0, 0.5)];
    // ensure upward normal ordering
    const nrm = (q[1]![0] - q[0]![0]) * (q[3]![2] - q[0]![2]) - (q[1]![2] - q[0]![2]) * (q[3]![0] - q[0]![0]);
    if (nrm > 0) q = [q[0]!, q[3]!, q[2]!, q[1]!];
    mb.quad(q[0]!, q[1]!, q[2]!, q[3]!, { layer: tread });
    // nosing lip
    // riser at t0 facing down-slope (-a)
    const R = (v: number, yv: number): V3 => ax !== 0 ? [x + t0 * ax, yv, z + v] : [x + v, yv, z + t0 * az];
    let r: V3[] = [R(-0.5, yPrev), R(0.5, yPrev), R(0.5, yy), R(-0.5, yy)];
    // riser normal should face -a
    const ux = r[1]![0] - r[0]![0], uz = r[1]![2] - r[0]![2];
    const nx = -uz, nz = ux; // normal of (u, up) = u × up ... approximate orientation test
    if (nx * -ax + nz * -az < 0) r = [r[1]!, r[0]!, r[3]!, r[2]!];
    mb.quad(r[0]!, r[1]!, r[2]!, r[3]!, { layer: riserL, tint: [0.86, 0.86, 0.9] });
  }
  // Side faces down to the lower neighbours (if any side is lower, e.g. free-standing flights).
  for (const [dx, dz, dir] of [[0, 1, "s"], [0, -1, "n"], [1, 0, "e"], [-1, 0, "w"]] as const) {
    if (dx === ax && dz === az) continue;
    if (dx === -ax && dz === -az) continue;
    const nx2 = x + dx, nz2 = z + dz, nc = ctx.s(nx2, nz2);
    if (nc === "S" || nc === "C") continue;
    const y0 = nc === "V" ? y - 2 : nc === "W" ? ctx.waterY - 1 : nc === "K" ? -6 : ctx.top(nx2, nz2);
    if (y - y0 > 0.05) wallFace(ctx, x, z, dir, y0, y - rise / 2, ctx.wild ? "cliff" : "retain", false);
  }
}

function cheekCell(ctx: Ctx, x: number, z: number) {
  // Stair side wall: top follows the neighbouring stair step + balustrade height, clamped to terrain.
  let stairH = -Infinity, upper = -Infinity;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const c = ctx.s(x + dx, z + dz), t = ctx.top(x + dx, z + dz);
    if (c === "S") stairH = Math.max(stairH, t);
    else if (c !== "W" && c !== "V" && c !== "K" && c !== "Z" && c !== "X" && c !== "R") upper = Math.max(upper, t);
  }
  const own = ctx.top(x, z);
  const topY = stairH > -Infinity ? Math.max(own + 0.3, Math.min(Math.max(upper, own), stairH + 0.55)) : Math.max(own, upper);
  const mat = ctx.wild ? "cliff" : ctx.L.interior ? (ctx.L.archetype === "foundry" ? "metal" : "darkwood") : "retain";
  const base = Math.min(own, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => { const c = ctx.s(x + dx!, z + dz!); return c === "V" ? own - 2 : c === "W" ? ctx.waterY - 1 : c === "K" ? -6 : ctx.top(x + dx!, z + dz!); }));
  if (ctx.L.interior && ctx.L.archetype !== "cave") {
    // Wooden balustrade with posts.
    const wood = ctx.layer(mat);
    ctx.mb.box(x, own, z, 0.98, Math.max(0.1, topY - own - 0.5), 0.98, { layer: wood });
    ctx.mb.box(x, topY - 0.5, z, 0.12, 0.5, 0.12, { layer: wood });
    ctx.mb.box(x, topY - 0.06, z, 0.98, 0.08, 0.16, { layer: wood });
    return;
  }
  ctx.mb.bevelBox(x, base, z, 1.0, topY - base, 1.0, 0.05, { layer: ctx.layer(mat) }, { layer: ctx.layer(ctx.wild ? "cliff" : "stone") });
}

function edgeCell(ctx: Ctx, x: number, z: number) {
  // Upper-edge cell: which sides drop?
  const y = ctx.top(x, z), mb = ctx.mb;
  const drops: string[] = [];
  for (const [dx, dz, dir] of [[0, 1, "s"], [0, -1, "n"], [1, 0, "e"], [-1, 0, "w"]] as const) {
    const c = ctx.s(x + dx, z + dz);
    if (c === "V" || c === "W" || c === "K" || ctx.top(x + dx, z + dz) < y - 0.5) drops.push(dir);
  }
  const hv = hsh(x >> 2, z >> 2, 21);
  if (ctx.L.interior) {
    // Railed gallery edge.
    const wood = ctx.layer(ctx.L.archetype === "foundry" ? "metal" : "darkwood");
    for (const d of drops.length ? drops : ["s"]) railing(ctx, x, z, d, y, wood, 0.9);
    return;
  }
  if (ctx.wild) {
    // Rocks + grass + a leaning fence post now and then.
    if (hsh(x, z, 2) < 0.45) mb.blob(x + (hsh(x, z, 3) - 0.5) * 0.4, y + 0.12, z + (hsh(x, z, 4) - 0.5) * 0.4, 0.34, 0.24, 0.3, { layer: ctx.layer("cliff") }, 1, 0.5, x * 31 + z);
    bushCluster(ctx, x, z, y, 0.55 + hsh(x, z, 9) * 0.25);
    return;
  }
  if (hv < 0.55) {
    // Stone balustrade: plinth + balusters + rail along drop sides.
    for (const d of drops.length ? drops : ["s"]) balustrade(ctx, x, z, d, y);
    if (hsh(x, z, 5) < 0.5) flowerPot(ctx, x, z, y);
  } else {
    // Raised planter bed with shrubs and flowers.
    const stone = ctx.layer("stone");
    mb.bevelBox(x, y, z, 0.96, 0.32, 0.96, 0.04, { layer: stone }, { layer: ctx.layer("ground2") });
    bushCluster(ctx, x, z, y + 0.3, 0.5);
  }
}

function planterCell(ctx: Ctx, x: number, z: number) {
  const y = ctx.top(x, z), mb = ctx.mb;
  if (ctx.L.interior) {
    // Closed-off floor corner: crates or a plant.
    if (hsh(x, z, 1) < 0.5) mb.bevelBox(x, y, z, 0.8, 0.7, 0.8, 0.04, { layer: ctx.layer("wood") });
    return;
  }
  if (ctx.wild) {
    if (hsh(x, z, 7) < 0.6) mb.blob(x, y + 0.15, z, 0.42, 0.32, 0.4, { layer: ctx.layer("cliff") }, 1, 0.6, x * 7 + z * 13);
    bushCluster(ctx, x, z, y, 0.6);
    return;
  }
  // Wall-foot planter box: timber or stone curb, soil, bushes/flowers.
  const curb = ctx.layer(hsh(x >> 1, z >> 1, 3) < 0.5 ? "wood" : "stone");
  mb.bevelBox(x, y, z, 0.92, 0.42, 0.92, 0.04, { layer: curb }, { layer: ctx.layer("ground2") });
  bushCluster(ctx, x, z, y + 0.4, 0.5);
}

export function bushCluster(ctx: Ctx, x: number, z: number, y: number, size: number) {
  const mb = ctx.mb, leaves = ctx.layer("leaves");
  const n = 2 + Math.floor(hsh(x, z, 11) * 2);
  for (let i = 0; i < n; i++) {
    const ox = (hsh(x, z, 20 + i) - 0.5) * 0.5, oz = (hsh(x, z, 30 + i) - 0.5) * 0.5, r = size * (0.45 + hsh(x, z, 40 + i) * 0.35);
    mb.blob(x + ox, y + r * 0.55, z + oz, r, r * 0.8, r, { layer: leaves, wind: true, uvScale: 0.9 }, 1, 0.35, x * 17 + z * 5 + i, true);
  }
  if (hsh(x, z, 50) < 0.6) {
    const flower = ctx.layer("flowers");
    mb.card(x + (hsh(x, z, 51) - 0.5) * 0.4, y, z + 0.2, 0.7, 0.55, 20 + hsh(x, z, 52) * 40, { layer: flower, wind: true });
  }
}

function flowerPot(ctx: Ctx, x: number, z: number, y: number) {
  const mb = ctx.mb;
  mb.cyl(x, y + 0.02, z, 0.16, 0.22, 0.3, 8, { layer: ctx.layer("roof") });
  mb.card(x, y + 0.28, z, 0.55, 0.45, 30, { layer: ctx.layer("flowers"), wind: true });
  mb.card(x, y + 0.28, z, 0.55, 0.45, 120, { layer: ctx.layer("flowers"), wind: true });
}

export function balustrade(ctx: Ctx, x: number, z: number, dir: string, y: number) {
  const mb = ctx.mb, stone = ctx.layer("stone");
  const along = dir === "n" || dir === "s";
  const off = dir === "s" ? 0.38 : dir === "n" ? -0.38 : dir === "e" ? 0.38 : -0.38;
  const cx = along ? x : x + off, cz = along ? z + off : z;
  mb.box(cx, y, cz, along ? 1.0 : 0.26, 0.12, along ? 0.26 : 1.0, { layer: stone });
  for (let i = 0; i < 4; i++) {
    const t = -0.375 + i * 0.25;
    const bx = along ? x + t : cx, bz = along ? cz : z + t;
    mb.cyl(bx, y + 0.12, bz, 0.055, 0.045, 0.5, 6, { layer: stone }, false);
  }
  mb.bevelBox(cx, y + 0.62, cz, along ? 1.02 : 0.24, 0.1, along ? 0.24 : 1.02, 0.03, { layer: stone });
}

export function railing(ctx: Ctx, x: number, z: number, dir: string, y: number, layer: number, h = 0.95) {
  const mb = ctx.mb;
  const along = dir === "n" || dir === "s";
  const off = dir === "s" ? 0.42 : dir === "n" ? -0.42 : dir === "e" ? 0.42 : -0.42;
  const cx = along ? x : x + off, cz = along ? z + off : z;
  mb.box(cx, y + h - 0.07, cz, along ? 1.0 : 0.08, 0.07, along ? 0.08 : 1.0, { layer });
  mb.box(cx, y + h * 0.45, cz, along ? 1.0 : 0.05, 0.05, along ? 0.05 : 1.0, { layer });
  mb.box(along ? x - 0.45 : cx, y, along ? cz : z - 0.45, 0.08, h, 0.08, { layer });
}

function waterCell(ctx: Ctx, x: number, z: number, y: number) {
  const mb = ctx.mb, prev = mb.pass;
  mb.pass = "water";
  // Shore factor in the AO channel: 0 at shore → 1 open water (for foam in the shader).
  const shore = (px: number, pz: number) => {
    let near = 3;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const cx = Math.round(px + dx * 0.5), cz = Math.round(pz + dz * 0.5), c = ctx.s(cx, cz);
      if (c !== "W" && c !== "Q" && c !== "B") near = Math.min(near, Math.hypot(dx * 0.5, dz * 0.5));
    }
    return Math.min(1, near / 1.6);
  };
  const x0 = x - 0.5, x1 = x + 0.5, z0 = z - 0.5, z1 = z + 0.5;
  mb.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], { layer: ctx.layer("water"), shade: [shore(x0, z1), shore(x1, z1), shore(x1, z0), shore(x0, z0)] });
  mb.pass = prev;
  // River bed below.
  mb.quad([x0, y - 1.1, z1], [x1, y - 1.1, z1], [x1, y - 1.1, z0], [x0, y - 1.1, z0], { layer: ctx.layer("ground2"), tint: [0.35, 0.4, 0.42], noAO: true });
}

function pitCell(ctx: Ctx, x: number, z: number) {
  const mb = ctx.mb;
  mb.quad([x - 0.5, -6.5, z + 0.5], [x + 0.5, -6.5, z + 0.5], [x + 0.5, -6.5, z - 0.5], [x - 0.5, -6.5, z - 0.5], { layer: ctx.layer("cliff"), tint: [0.18, 0.18, 0.22], noAO: true });
}

function seatCell(ctx: Ctx, x: number, z: number) {
  // Tiered seating: a riser block + a row of upholstered seats on top.
  const mb = ctx.mb, y = ctx.top(x, z);
  // Lowest adjacent floor to draw the riser front down to.
  const south = ctx.top(x, z + 1), base = Math.min(y - 0.45, south);
  mb.box(x, base, z, 1.0, y - base, 1.0, { layer: ctx.layer("floor") }, "tnsew", { layer: ctx.layer("rug") });
  const seat = ctx.layer("cloth"), frame = ctx.layer("darkwood");
  for (let i = 0; i < 2; i++) {
    const sx = x - 0.25 + i * 0.5;
    mb.box(sx, y, z + 0.05, 0.42, 0.28, 0.38, { layer: seat });
    mb.box(sx, y + 0.28, z - 0.18, 0.42, 0.42, 0.1, { layer: seat });
    mb.box(sx + 0.22, y, z, 0.04, 0.45, 0.45, { layer: frame });
  }
}

function bridgeCell(ctx: Ctx, x: number, z: number) {
  const mb = ctx.mb, y = ctx.top(x, z), L = ctx.L;
  const stoneBridge = L.archetype === "canal" || (!ctx.wild && L.archetype !== "isles" && L.archetype !== "canyon");
  const deckL = ctx.layer(stoneBridge ? "plaza" : "wood");
  // Direction of travel: along the axis with bridge/land on both ends.
  const ew = (ctx.s(x - 1, z) === "B" || ctx.walk(x - 1, z)) && (ctx.s(x + 1, z) === "B" || ctx.walk(x + 1, z));
  const thick = stoneBridge ? 0.5 : 0.18;
  if (stoneBridge) {
    mb.box(x, y - thick, z, 1.0, thick, 1.0, { layer: ctx.layer("stone") }, "tnsewb", { layer: deckL });
  } else {
    // Planks with small gaps across the travel direction.
    for (let i = 0; i < 4; i++) {
      const t = -0.375 + i * 0.25;
      if (ew) mb.box(x + t, y - thick, z, 0.22, thick, 1.0, { layer: deckL, uvOffset: [hsh(x, z, i), 0] });
      else mb.box(x, y - thick, z + t, 1.0, thick, 0.22, { layer: deckL, uvOffset: [hsh(x, z, i), 0] });
    }
    // Stringers.
    const dark = ctx.layer("darkwood");
    if (ew) { mb.box(x, y - thick - 0.16, z - 0.42, 1.0, 0.16, 0.12, { layer: dark }); mb.box(x, y - thick - 0.16, z + 0.42, 1.0, 0.16, 0.12, { layer: dark }); }
    else { mb.box(x - 0.42, y - thick - 0.16, z, 0.12, 0.16, 1.0, { layer: dark }); mb.box(x + 0.42, y - thick - 0.16, z, 0.12, 0.16, 1.0, { layer: dark }); }
  }
  // Railings on sides that face water/void/pit.
  for (const [dx, dz, dir] of [[0, 1, "s"], [0, -1, "n"], [1, 0, "e"], [-1, 0, "w"]] as const) {
    const c = ctx.s(x + dx, z + dz);
    if (c === "B" || ctx.walk(x + dx, z + dz)) continue;
    if (stoneBridge) balustrade(ctx, x, z, dir, y);
    else {
      const wood = ctx.layer("darkwood");
      railing(ctx, x, z, dir, y, wood, 0.9);
    }
  }
  // Stone arch underneath over water.
  if (stoneBridge) {
    const below = ctx.waterY;
    const lx = ew ? [x - 1, x + 1] : [z - 1, z + 1];
    void lx;
    // Arch spandrel: side faces from deck down to an arch curve (per-cell approximation).
    let span0 = 0, span1 = 0;
    if (ew) { let a = x; while (ctx.s(a - 1, z) === "B") a--; let b = x; while (ctx.s(b + 1, z) === "B") b++; span0 = a - 0.5; span1 = b + 0.5; }
    else { let a = z; while (ctx.s(x, a - 1) === "B") a--; let b = z; while (ctx.s(x, b + 1) === "B") b++; span0 = a - 0.5; span1 = b + 0.5; }
    const len = span1 - span0, cur0 = (ew ? x : z) - 0.5, cur1 = cur0 + 1;
    const archY = (t: number) => y - thick - Math.max(0.1, (1 - ((t - span0) / len * 2 - 1) ** 2) * 0) - 0.02 - (1 - Math.sin(Math.PI * Math.max(0, Math.min(1, (t - span0) / len)))) * (y - thick - below - 0.1);
    const stone = ctx.layer("stone");
    const steps = 2;
    for (let i = 0; i < steps; i++) {
      const t0 = cur0 + i / steps, t1 = cur0 + (i + 1) / steps;
      const a0 = archY(t0), a1 = archY(t1);
      for (const side of [-0.5, 0.5]) {
        if (ew) {
          const zz = z + side;
          const q: V3[] = [[t0, a0, zz], [t1, a1, zz], [t1, y - thick, zz], [t0, y - thick, zz]];
          if (side > 0) mb.quad(q[0]!, q[1]!, q[2]!, q[3]!, { layer: stone }); else mb.quad(q[1]!, q[0]!, q[3]!, q[2]!, { layer: stone });
        } else {
          const xx = x + side;
          const q: V3[] = [[xx, a0, t0], [xx, a1, t1], [xx, y - thick, t1], [xx, y - thick, t0]];
          if (side < 0) mb.quad(q[0]!, q[1]!, q[2]!, q[3]!, { layer: stone }); else mb.quad(q[1]!, q[0]!, q[3]!, q[2]!, { layer: stone });
        }
      }
      // Intrados (underside).
      if (ew) mb.quad([t0, a0, z - 0.5], [t1, a1, z - 0.5], [t1, a1, z + 0.5], [t0, a0, z + 0.5], { layer: stone, tint: [0.7, 0.7, 0.75] });
      else mb.quad([x + 0.5, a0, t0], [x + 0.5, a1, t1], [x - 0.5, a1, t1], [x - 0.5, a0, t0], { layer: stone, tint: [0.7, 0.7, 0.75] });
    }
    void cur1;
  } else if (ctx.s(x, z + 1) === "V" || ctx.s(x, z - 1) === "V" || ctx.s(x + 1, z) === "V" || ctx.s(x - 1, z) === "V" || ctx.s(x, z + 1) === "K") {
    // Rope/timber bridges: hanging posts every other cell.
    if ((x + z) % 2 === 0) {
      const dark = ctx.layer("darkwood");
      mb.beam([x - (ew ? 0 : 0.45), y - 0.35, z - (ew ? 0.45 : 0)], [x - (ew ? 0 : 0.45), y - 1.1, z - (ew ? 0.45 : 0)], 0.08, { layer: dark });
    }
  }
}

/** Boundary ring, solid rock and interior walls. */
function boundary(ctx: Ctx) {
  const { L, mb, W, H } = ctx;
  const cliffL = ctx.layer("cliff"), wallL = ctx.layer(L.interior ? "inwall" : "retain");
  const capTint: V3 = [0.12, 0.1, 0.1];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = ctx.s(x, z);
    if (c !== "Z" && c !== "R" && c !== "X") continue;
    const y = ctx.boundTop[z * W + x]!;
    const lowest = Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => {
      const nx = x + dx!, nz = z + dz!;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) return y;
      const nc = ctx.s(nx, nz);
      if (nc === "Z" || nc === "R" || nc === "X") return ctx.boundTop[nz * W + nx]!;
      if (nc === "V") return y - 3;
      if (nc === "W") return ctx.waterY - 1;
      if (nc === "K") return -6.5;
      return ctx.top(nx, nz);
    }));
    const interiorWall = L.interior && c === "X";
    const cave = L.interior && c === "R";
    const topMat = interiorWall || cave ? { layer: interiorWall ? wallL : cliffL, tint: capTint, noAO: true, unlit: true } : { layer: ctx.layer(ctx.wild || L.archetype === "isles" ? "ground" : "ground2") };
    // Top.
    mb.quad([x - 0.5, y, z + 0.5], [x + 0.5, y, z + 0.5], [x + 0.5, y, z - 0.5], [x - 0.5, y, z - 0.5], topMat);
    // Sides toward lower neighbours.
    for (const [dx, dz, dir] of [[0, 1, "s"], [0, -1, "n"], [1, 0, "e"], [-1, 0, "w"]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const nc = ctx.s(nx, nz);
      const ny = nc === "Z" || nc === "R" || nc === "X" ? ctx.boundTop[nz * W + nx]! : nc === "V" ? y - 4 : nc === "W" ? ctx.waterY - 1 : nc === "K" ? -6.5 : ctx.top(nx, nz);
      if (y - ny < 0.05) continue;
      if (interiorWall) {
        if (y - ny > 1.3) {
          wallFace(ctx, x, z, dir, ny, ny + 0.95, "darkwood", false);
          wallFace(ctx, x, z, dir, ny + 0.95, y, "inwall", false);
          const off = 0.53, along = dir === "n" || dir === "s";
          const px = dir === "e" ? x + off : dir === "w" ? x - off : x, pz = dir === "s" ? z + off : dir === "n" ? z - off : z;
          mb.box(px, ny + 0.92, pz, along ? 1.0 : 0.06, 0.07, along ? 0.06 : 1.0, { layer: ctx.layer("wood") });
          mb.box(px, y - 0.14, pz, along ? 1.0 : 0.07, 0.1, along ? 0.07 : 1.0, { layer: ctx.layer("wood") });
        } else wallFace(ctx, x, z, dir, ny, y, "inwall", false);
      }
      else wallFace(ctx, x, z, dir, ny, y, cave || ctx.wild || c === "R" ? "cliff" : "retain", cave || ctx.wild || c === "R" || L.archetype === "isles");
    }
    // Vegetation on outdoor boundary tops (tree walls); a hedge line along the flush south edge.
    if (!L.interior && c === "Z" && y - lowest > 0.8 && hsh(x, z, 60) < (ctx.wild ? 0.5 : 0.25) && z < H - 3) bushCluster(ctx, x, z, y, 0.7);
    if (!L.interior && c === "Z" && z === H - 2 && x > 1 && x < W - 2 && hsh(x, z, 61) < 0.55) bushCluster(ctx, x, z, y, 0.55 + hsh(x, z, 62) * 0.3);
  }
  void cliffL;
}

/** Height of every boundary / wall cell (needed by field + faces). */
export function computeBoundTops(L: FloorLayout, top: (x: number, z: number) => number, s: (x: number, z: number) => string): Float32Array {
  const W = L.width, H = L.height, out = new Float32Array(W * H);
  const solid = (c: string) => c === "Z" || c === "R" || c === "X";
  // Max height of nearby open cells.
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = s(x, z);
    if (!solid(c)) { out[z * W + x] = top(x, z); continue; }
    let m = -Infinity;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const nc = s(nx, nz);
      if (solid(nc) || nc === "V" || nc === "W" || nc === "K") continue;
      m = Math.max(m, top(nx, nz));
    }
    if (m === -Infinity) m = 0;
    if (L.interior) {
      // Dollhouse cut-away: a wall with open floor within 2 cells to its north hides that room from the
      // camera, so it is lowered to a ledge; every other wall (back / side walls) is full height.
      let front: number | null = null;
      for (const k of [1, 2]) {
        if (z - k < 0) break;
        const nc = s(x, z - k);
        if (!solid(nc) && nc !== "V") { front = top(x, z - k); break; }
      }
      if (L.archetype === "cave") out[z * W + x] = front !== null ? front + 0.7 + hsh(x, z, 1) * 0.4 : m + 2.3 + hsh(x, z, 1) * 1.3;
      else out[z * W + x] = front !== null ? front + 0.85 : m + 2.6;
    } else {
      // Outdoor ring: a tall built/cliff backdrop at the north, rolling sides, and a flush south edge
      // (the foreground opens into the skirt). Heights vary smoothly along each side.
      const edgeN = z <= 1, edgeS = z >= H - 2;
      const smooth = (t: number, seed: number) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hsh(i, seed, 5) * (1 - u) + hsh(i + 1, seed, 5) * u; };
      const rise = edgeN ? 3.6 + smooth(x / 9, 1) * 2.4 : edgeS ? 0.0 : 1.6 + smooth(z / 7, x < W / 2 ? 2 : 3) * 1.8;
      out[z * W + x] = L.archetype === "isles" ? -9 : Math.round((m + rise) * 4) / 4;
    }
  }
  return out;
}
