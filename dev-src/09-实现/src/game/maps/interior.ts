// Whole-floor interiors (9 sub-grammars). Rooms are carved from solid wall, joined by doorways that form
// loops, split levels are joined by stairs, and furniture is placed by room function. The south wall of
// each room is rendered as a low cut-away wall by the kernel so the top-down camera can see inside.
import { SURFACE, RES, DIRS, Noise, flood, label, legalStep, type Grid } from "./grid";
import { DSU, legalize, prune, clearance, commitStair, heightRegions, stairSites, safeToBlock, isStairCode, toRoad, routeCells, reservePath, doorBoxPenalty, reserveDoorBox, type Draft } from "./draft";
import { addProp } from "./dressing";
import type { Point, Room } from "./types";

const S = SURFACE;
const C = (c: string) => c.charCodeAt(0);
type Box = { x: number; z: number; w: number; d: number };

function carve(g: Grid, b: Box, code: string, y: number, lvl = 0) {
  for (let z = b.z; z < b.z + b.d; z++) for (let x = b.x; x < b.x + b.w; x++) {
    if (!g.inner(x, z, 1)) continue;
    const k = g.i(x, z);
    g.ground(k, code, y);
    g.lvl[k] = lvl;
  }
}
function solid(g: Grid) {
  for (let k = 0; k < g.n; k++) { g.block(k, S.wall, 0); g.lvl[k] = -1; }
}
function addRoom(d: Draft, b: Box, kind: string, y = 0): Room {
  const room: Room = { id: `rm${d.rooms.length}`, kind, x: b.x, z: b.z, w: b.w, d: b.d, y, building: null };
  d.rooms.push(room);
  return room;
}

/** BSP split of a box into rooms with 1-cell walls between them. */
function bsp(r: { next(): number; int(a: number, b: number): number }, b: Box, min: number, out: Box[], depth = 0) {
  const canH = b.d >= min * 2 + 1, canV = b.w >= min * 2 + 1;
  if ((!canH && !canV) || (depth > 1 && b.w * b.d < min * min * 2.6 && r.next() < 0.5)) { out.push(b); return; }
  const vertical = canV && (!canH || b.w > b.d * 1.15 || (b.w >= b.d * 0.87 && r.next() < 0.5));
  if (vertical) {
    const cut = r.int(b.x + min, b.x + b.w - min - 1);
    bsp(r, { x: b.x, z: b.z, w: cut - b.x, d: b.d }, min, out, depth + 1);
    bsp(r, { x: cut + 1, z: b.z, w: b.x + b.w - cut - 1, d: b.d }, min, out, depth + 1);
  } else {
    const cut = r.int(b.z + min, b.z + b.d - min - 1);
    bsp(r, { x: b.x, z: b.z, w: b.w, d: cut - b.z }, min, out, depth + 1);
    bsp(r, { x: b.x, z: cut + 1, w: b.w, d: b.z + b.d - cut - 1 }, min, out, depth + 1);
  }
}

/**
 * A doorway through a 1-cell wall between rooms at different heights: the wall cell becomes the top step
 * and the flight continues into the lower room, with a landing beyond. Returns false if there is no room.
 */
function stairDoor(d: Draft, wall: number, p: number, q: number) {
  const g = d.g;
  const lower = g.top[p]! < g.top[q]! ? p : q, upper = lower === p ? q : p;
  const h0 = g.top[lower]!, h1 = g.top[upper]!, rise = h1 - h0;
  if (rise > 2.3 || rise < 0.05) return false;
  const k = Math.max(2, Math.ceil(rise / 0.45) - 1);
  const wx = wall % g.w, wz = (wall / g.w) | 0, dx = (lower % g.w) - wx, dz = ((lower / g.w) | 0) - wz;
  const cells = [wall];
  for (let j = 1; j < k; j++) {
    const x = wx + dx * j, z = wz + dz * j;
    if (!g.inner(x, z, 1)) return false;
    const c = g.i(x, z);
    if (!g.walk[c] || Math.abs(g.top[c]! - h0) > 0.01 || g.res[c]! & (RES.door | RES.landing | RES.poi) || isStairCode(g.surf[c]!)) return false;
    cells.push(c);
  }
  for (const j of [k, k + 1]) {
    const x = wx + dx * j, z = wz + dz * j;
    if (!g.inner(x, z, 1)) return false;
    const c = g.i(x, z);
    if (!g.walk[c] || Math.abs(g.top[c]! - h0) > 0.01) return false;
  }
  if (!g.walk[upper]) return false;
  cells.forEach((c, j) => {
    g.top[c] = h0 + ((k - j) * rise) / (k + 1);
    g.surf[c] = C(S.stair);
    g.walk[c] = 1;
    g.lvl[c] = 0;
    g.res[c] = g.res[c]! | RES.path | (j === 0 ? RES.door : 0);
  });
  const land = g.i(wx + dx * k, wz + dz * k);
  g.res[land] = g.res[land]! | RES.landing;
  g.res[upper] = g.res[upper]! | RES.landing;
  const xs = cells.map((c) => c % g.w), zs = cells.map((c) => (c / g.w) | 0), x0 = Math.min(...xs), z0 = Math.min(...zs);
  const dir = dx === 1 ? "w" : dx === -1 ? "e" : dz === 1 ? "n" : "s"; // ascending points back toward the wall
  d.stairs.push({ id: `st${d.stairs.length}`, x: x0, z: z0, w: Math.max(...xs) - x0 + 1, d: Math.max(...zs) - z0 + 1, dir,
    h0: Math.round(h0 * 1000) / 1000, h1: Math.round(h1 * 1000) / 1000, kind: "wood" });
  return true;
}

/** Doorways through 1-cell walls between rooms: spanning tree + extra loops; split levels get stair-doors. */
function doorways(d: Draft, rooms: Box[], loops: number, code: string, hubs: number[] = [0]) {
  const g = d.g, r = d.stream("doors");
  type Cand = { a: number; b: number; k: number; p: number; q: number; flat: boolean };
  const cands: Cand[] = [];
  const roomAt = new Int32Array(g.n).fill(-1);
  rooms.forEach((b, i) => { for (let z = b.z; z < b.z + b.d; z++) for (let x = b.x; x < b.x + b.w; x++) if (g.inner(x, z, 1)) roomAt[g.i(x, z)] = i; });
  for (let z = 1; z < g.h - 1; z++) for (let x = 1; x < g.w - 1; x++) {
    const k = g.i(x, z);
    if (g.walk[k] || g.code(k) !== S.wall) continue;
    const pairs: [number, number][] = [[g.i(x - 1, z), g.i(x + 1, z)], [g.i(x, z - 1), g.i(x, z + 1)]];
    for (const [p, q] of pairs) {
      const a = roomAt[p]!, b = roomAt[q]!;
      if (a < 0 || b < 0 || a === b || !g.walk[p] || !g.walk[q] || isStairCode(g.surf[p]!) || isStairCode(g.surf[q]!)) continue;
      const flat = Math.abs(g.top[p]! - g.top[q]!) < 0.01;
      cands.push({ a: Math.min(a, b), b: Math.max(a, b), k, p, q, flat });
    }
  }
  const dsu = new DSU(rooms.length), used = new Set<string>();
  const hub = (c: Cand) => (hubs.includes(c.a) || hubs.includes(c.b) ? 1 : 0);
  const shuffled = r.shuffle(cands).sort((u, v) => Number(v.flat) - Number(u.flat) || hub(v) - hub(u));
  const open = (c: Cand) => {
    if (!c.flat) return stairDoor(d, c.k, c.p, c.q);
    if (g.walk[c.k]) return false;
    g.ground(c.k, code, g.top[c.p]!);
    g.lvl[c.k] = 0;
    g.res[c.k] = g.res[c.k]! | RES.door;
    return true;
  };
  for (const c of shuffled) {
    if (dsu.find(c.a) === dsu.find(c.b)) continue;
    if (open(c)) { dsu.union(c.a, c.b); used.add(`${c.a}-${c.b}`); }
  }
  let extra = loops;
  for (const c of shuffled) {
    if (extra <= 0) break;
    if (used.has(`${c.a}-${c.b}`) || !c.flat) continue;
    if (open(c)) { used.add(`${c.a}-${c.b}`); extra--; d.loops++; }
  }
}

/** Join height regions with stairs (interior flights, 1-2 wide). */
function joinLevels(d: Draft, kind: "wood" | "masonry" | "metal" | "rock" | "tier") {
  const g = d.g;
  for (let round = 0; round < 3; round++) {
    const { lab, sizes } = heightRegions(g);
    if (sizes.length <= 1) return;
    const sites = stairSites(d, lab, sizes, { widths: [2, 1, 3], maxRise: 2.2, minRegion: 4, cut: 0.4 });
    const r = d.stream(`ist${round}`);
    for (const s of sites) s.score += r.next();
    sites.sort((a, b) => b.score - a.score);
    const comp = label(g, (k) => g.walk[k] === 1, (a, b) => legalStep(g, a, b)).lab;
    const dsu = new DSU(sizes.length), rep = new Map<number, number>();
    for (let k = 0; k < g.n; k++) if (lab[k]! >= 0) { const c = comp[k]!; if (rep.has(c)) dsu.union(rep.get(c)!, lab[k]!); else rep.set(c, lab[k]!); }
    let progress = false;
    for (const s of sites) {
      if (dsu.find(s.ra) === dsu.find(s.rb)) continue;
      if (!commitStair(d, s, kind)) continue;
      dsu.union(s.ra, s.rb); progress = true;
    }
    legalize(d);
    if (!progress) return;
  }
}

/** Put furniture along room walls, keeping a walkable ring and never blocking doors. */
function furnish(d: Draft, room: Room, kinds: string[], count: number, centre?: string[]) {
  const g = d.g, r = d.stream(`furn-${room.id}`);
  const wallSide: Point[] = [], inner: Point[] = [];
  for (let z = room.z; z < room.z + room.d; z++) for (let x = room.x; x < room.x + room.w; x++) {
    if (!g.inner(x, z, 1)) continue;
    const k = g.i(x, z);
    if (!g.walk[k] || g.res[k]! & (RES.door | RES.path | RES.landing | RES.poi)) continue;
    let walls = 0;
    for (const [dx, dz] of DIRS) { const c = g.code(g.i(x + dx, z + dz)); if (c === S.wall || c === S.rock) walls++; }
    (walls ? wallSide : inner).push({ x, z });
  }
  let n = 0;
  for (const p of r.shuffle(wallSide)) {
    if (n >= count) break;
    // Face away from the adjacent wall.
    let rot = 0;
    if (g.code(g.i(p.x, p.z - 1)) === S.wall) rot = 180; else if (g.code(g.i(p.x - 1, p.z)) === S.wall) rot = 90; else if (g.code(g.i(p.x + 1, p.z)) === S.wall) rot = 270;
    if (addProp(d, r.pick(kinds), p.x, p.z, rot, r.int(0, 3), 1)) n++;
  }
  if (centre) for (const p of r.shuffle(inner).slice(0, Math.max(1, Math.floor(inner.length / 14)))) {
    addProp(d, r.pick(centre), p.x, p.z, r.int(0, 3) * 90, r.int(0, 3), 1);
  }
  return n;
}

const FURNITURE: Record<string, { wall: string[]; centre?: string[] }> = {
  lobby: { wall: ["sofa", "plant", "counter", "bookcase", "lamp"], centre: ["table", "column"] },
  guest: { wall: ["bed", "wardrobe", "desk", "lamp", "plant"], centre: ["chair"] },
  office: { wall: ["cabinet", "bookcase", "desk", "plant"], centre: ["desk", "chair"] },
  kitchen: { wall: ["counter", "cabinet", "fridge", "shelf"], centre: ["table"] },
  store: { wall: ["crates", "barrel", "shelf", "sacks"], centre: ["crates"] },
  chapel: { wall: ["candles", "statue", "bookcase"], centre: ["seats", "altar"] },
  shop: { wall: ["shelf", "counter", "barrel", "crates", "plant"], centre: ["table"] },
  lab: { wall: ["tank", "console", "cabinet", "machine"], centre: ["table"] },
  machine: { wall: ["machine", "boiler", "locker", "console"], centre: ["crate"] },
  library: { wall: ["bookcase", "bookcase", "desk", "lamp"], centre: ["table", "chair"] },
};

function roomKind(archetype: string, i: number, n: number, r: { pick<T>(a: readonly T[]): T }) {
  if (i === 0) return "lobby";
  const pool: Record<string, string[]> = {
    hall: ["guest", "office", "library", "kitchen", "store", "chapel"],
    corridor: ["guest", "guest", "office", "store"],
    cloister: ["library", "chapel", "office", "guest"],
    foundry: ["machine", "store", "lab", "office"],
    stacks: ["store", "shop", "office"],
    platform: ["shop", "office", "store"],
    tiered: ["office", "store", "lab"],
    pool: ["guest", "store"],
    cave: ["store"],
  };
  void n;
  return r.pick(pool[archetype] ?? ["store"]);
}

export function generateInterior(d: Draft): boolean {
  const g = d.g, r = d.stream("interior"), arch = d.archetype;
  solid(g);
  const W = g.w, H = g.h, M = 2;
  const floorCode = S.floor;
  const shell: Box = { x: M, z: M, w: W - 2 * M, d: H - 2 * M };
  let rooms: Box[] = [];
  const high = Math.round(r.range(1.2, 1.8) * 4) / 4;
  d.levels = [0];
  switch (arch) {
    case "hall": {
      // Central great hall with a raised gallery, side rooms by BSP on both flanks.
      const hw = Math.round(W * r.range(0.36, 0.46)), hx = Math.round((W - hw) / 2);
      const hall: Box = { x: hx, z: M, w: hw, d: H - 2 * M };
      const left: Box = { x: M, z: M, w: hx - M - 1, d: H - 2 * M }, right: Box = { x: hx + hw + 1, z: M, w: W - M - hx - hw - 1, d: H - 2 * M };
      const side: Box[] = [];
      bsp(r, left, 4, side); bsp(r, right, 4, side);
      rooms = [hall, ...side];
      carve(g, hall, S.alt, 0);
      // Raised gallery across the back of the hall.
      const gal: Box = { x: hall.x, z: hall.z, w: hall.w, d: r.int(3, 4) };
      carve(g, gal, S.floor, high, 1);
      for (const b of side) carve(g, b, floorCode, r.next() < 0.3 ? high : 0, 0);
      addRoom(d, hall, "hall", 0);
      side.forEach((b, i) => addRoom(d, b, roomKind(arch, i + 1, side.length, r), g.top[g.i(b.x, b.z)]!));
      d.levels = [0, high];
      break;
    }
    case "corridor": {
      // A long spine (with a cross corridor) and rows of guest rooms opening onto it.
      const cz = Math.round(H * r.range(0.42, 0.58)), cw = r.int(2, 3);
      const spine: Box = { x: M, z: cz, w: W - 2 * M, d: cw };
      const cross = r.int(Math.round(W * 0.3), Math.round(W * 0.7));
      carve(g, spine, S.rug, 0);
      carve(g, { x: cross, z: M, w: 2, d: H - 2 * M }, S.rug, 0);
      const north: Box = { x: M, z: M, w: cross - M - 1, d: cz - M - 1 }, north2: Box = { x: cross + 3, z: M, w: W - M - cross - 3, d: cz - M - 1 };
      const south: Box = { x: M, z: cz + cw + 1, w: cross - M - 1, d: H - M - cz - cw - 1 }, south2: Box = { x: cross + 3, z: cz + cw + 1, w: W - M - cross - 3, d: H - M - cz - cw - 1 };
      for (const band of [north, north2, south, south2]) {
        if (band.w < 3 || band.d < 3) continue;
        // Slice the band into guest rooms along x.
        let x = band.x;
        while (x + 3 <= band.x + band.w) {
          const w = Math.min(r.int(3, 5), band.x + band.w - x);
          if (w < 3) break;
          rooms.push({ x, z: band.z, w, d: band.d });
          x += w + 1;
        }
      }
      rooms.unshift(spine, { x: cross, z: M, w: 2, d: H - 2 * M });
      for (const b of rooms.slice(2)) carve(g, b, floorCode, 0);
      // Split level: everything east of the cross corridor sits a half-storey higher.
      const lift = Math.round(r.range(0.8, 1.1) * 4) / 4;
      for (let k = 0; k < g.n; k++) if (g.walk[k] && k % W > cross + 1) { g.top[k] = lift; g.lvl[k] = 1; }
      addRoom(d, spine, "corridor", 0);
      rooms.slice(2).forEach((b, i) => addRoom(d, b, roomKind(arch, i + 1, rooms.length, r), g.top[g.i(b.x, b.z)]!));
      d.levels = [0, lift];
      break;
    }
    case "cave": {
      // Cellular-automaton cave on two levels (lower basin + upper shelves).
      const nz = new Noise(r.int(1, 1 << 30));
      let open = new Uint8Array(g.n);
      for (let z = M; z < H - M; z++) for (let x = M; x < W - M; x++) open[g.i(x, z)] = r.next() < 0.56 ? 1 : 0;
      for (let it = 0; it < 5; it++) {
        const next = new Uint8Array(g.n);
        for (let z = M; z < H - M; z++) for (let x = M; x < W - M; x++) {
          let c = 0;
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (open[g.i(x + dx, z + dz)]) c++;
          next[g.i(x, z)] = c >= 5 ? 1 : 0;
        }
        open = next;
      }
      for (let k = 0; k < g.n; k++) if (open[k]) {
        const x = k % W, z = (k / W) | 0;
        const up = nz.fbm(x * 0.07, z * 0.07) + (1 - z / H) * 0.35 > 0.72;
        g.ground(k, S.worn, up ? high : 0); g.lvl[k] = up ? 1 : 0;
        g.surf[k] = C(up ? S.ground : S.worn);
      } else g.block(k, S.rock, 0);
      d.levels = [0, high];
      const { lab, sizes } = label(g, (k) => g.walk[k] === 1);
      // Tunnel all components together along straight corridors.
      let main = 0; for (let i = 1; i < sizes.length; i++) if (sizes[i]! > sizes[main]!) main = i;
      for (let i = 0; i < sizes.length; i++) {
        if (i === main || sizes[i]! < 6) continue;
        let a = -1, b = -1, best = Infinity;
        for (let k = 0; k < g.n; k += 3) if (lab[k] === i) for (let q = 0; q < g.n; q += 5) if (lab[q] === main) {
          const dd = Math.abs((k % W) - (q % W)) + Math.abs(((k / W) | 0) - ((q / W) | 0));
          if (dd < best) { best = dd; a = k; b = q; }
        }
        if (a < 0) continue;
        let x = a % W, z = (a / W) | 0; const tx = b % W, tz = (b / W) | 0, y = g.top[a]!;
        while (x !== tx || z !== tz) {
          if (x !== tx) x += Math.sign(tx - x); else z += Math.sign(tz - z);
          const k = g.i(x, z);
          if (!g.walk[k]) { g.ground(k, S.worn, y); g.lvl[k] = g.lvl[a]!; }
        }
      }
      for (let k = 0; k < g.n; k++) if (g.walk[k]) { /* cave rooms = height regions */ }
      addRoom(d, { x: M, z: M, w: W - 2 * M, d: H - 2 * M }, "cave", 0);
      break;
    }
    case "tiered": {
      // Auditorium / lecture hall: a raised stage at the north, an orchestra pit, stepped seating rows
      // rising toward the lobby at the south. Aisles are stair runs; seat rows are blocked tiers.
      const hall: Box = { x: M + 1, z: M, w: W - 2 * M - 2, d: H - 2 * M };
      const stageD = r.int(3, 4), pitD = 3, lobbyD = 4;
      carve(g, { x: hall.x, z: hall.z, w: hall.w, d: stageD }, S.alt, 0.9, 1);
      carve(g, { x: hall.x, z: hall.z + stageD, w: hall.w, d: pitD }, S.floor, 0, 0);
      const z0 = hall.z + stageD + pitD, lobbyZ = hall.z + hall.d - lobbyD, step = 0.45;
      const rows = Math.floor((lobbyZ - z0) / 2);
      const aisle = (x: number) => x === hall.x || x === hall.x + hall.w - 1 || (x - hall.x) % 9 === 4 || (x - hall.x) % 9 === 5;
      for (let z = z0; z < lobbyZ; z++) {
        const i = Math.floor((z - z0) / 2), dz = (z - z0) % 2;
        for (let x = hall.x; x < hall.x + hall.w; x++) {
          const k = g.i(x, z);
          if (i >= rows) { g.ground(k, S.rug, rows * step + 0.2); g.lvl[k] = 1; continue; }
          if (aisle(x)) { g.ground(k, S.stair, i * step + ((dz + 1) * step) / 2); g.lvl[k] = 0; g.res[k] = g.res[k]! | RES.path; }
          else { g.block(k, S.seats, (i + 1) * step); g.lvl[k] = 0; }
        }
      }
      const lobby: Box = { x: hall.x, z: lobbyZ, w: hall.w, d: lobbyD };
      carve(g, lobby, S.rug, rows * step + 0.2, 1);
      rooms = [hall];
      addRoom(d, lobby, "lobby", rows * step + 0.2);
      addRoom(d, { x: hall.x, z: hall.z, w: hall.w, d: stageD + pitD }, "stage", 0);
      d.levels = [0, 0.9, Math.round((rows * step + 0.2) * 100) / 100];
      break;
    }
    case "stacks": {
      // Big store hall with shelf rows (blocking) and aisles; offices/back rooms along the north.
      const back: Box = { x: M, z: M, w: W - 2 * M, d: r.int(4, 6) };
      const hall: Box = { x: M, z: back.z + back.d + 1, w: W - 2 * M, d: H - M - back.z - back.d - 1 };
      carve(g, hall, S.tile, 0);
      const side: Box[] = [];
      bsp(r, back, 4, side);
      for (const b of side) carve(g, b, floorCode, r.next() < 0.35 ? high : 0);
      rooms = [hall, ...side];
      addRoom(d, hall, "sales", 0);
      side.forEach((b, i) => addRoom(d, b, roomKind(arch, i + 1, side.length, r), g.top[g.i(b.x, b.z)]!));
      d.levels = [0, high];
      break;
    }
    case "platform": {
      // Station: a sunken track trench (or water channel) with platforms either side, joined by a footbridge.
      const tz = Math.round(H * r.range(0.4, 0.55));
      const p1: Box = { x: M, z: M, w: W - 2 * M, d: tz - M - 1 }, p2: Box = { x: M, z: tz + 4, w: W - 2 * M, d: H - M - tz - 4 };
      carve(g, p1, S.tile, 0); carve(g, p2, S.tile, 0);
      for (let z = tz - 1; z < tz + 4; z++) for (let x = M; x < W - M; x++) { const k = g.i(x, z); g.block(k, d.theme === "T17" || d.theme === "T35" ? S.pool : S.pit, -1.2); }
      // Footbridges across the trench.
      for (const bx of [Math.round(W * r.range(0.2, 0.35)), Math.round(W * r.range(0.6, 0.8))]) {
        for (let z = tz - 1; z < tz + 4; z++) for (let x = bx; x < bx + 2; x++) { const k = g.i(x, z); g.ground(k, S.bridge, 0); g.lvl[k] = 0; }
      }
      rooms = [p1, p2];
      addRoom(d, p1, "platform", 0); addRoom(d, p2, "platform", 0);
      break;
    }
    case "cloister": {
      // Arcaded walk around a courtyard (open-air garden), rooms outside the arcade.
      const cx = Math.round(W * 0.3), cz = Math.round(H * 0.3), cw = Math.round(W * 0.4), cd = Math.round(H * 0.38);
      const court: Box = { x: cx, z: cz, w: cw, d: cd };
      const walk: Box = { x: cx - 2, z: cz - 2, w: cw + 4, d: cd + 4 };
      carve(g, walk, S.alt, 0);
      carve(g, court, S.ground, -0.3, 0);
      for (let z = court.z; z < court.z + court.d; z++) for (let x = court.x; x < court.x + court.w; x++) {
        const k = g.i(x, z);
        if (x === court.x || z === court.z || x === court.x + court.w - 1 || z === court.z + court.d - 1) g.ground(k, S.worn, -0.3);
      }
      const bands: Box[] = [
        { x: M, z: M, w: W - 2 * M, d: walk.z - M - 1 },
        { x: M, z: walk.z + walk.d + 1, w: W - 2 * M, d: H - M - walk.z - walk.d - 1 },
        { x: M, z: walk.z, w: walk.x - M - 1, d: walk.d },
        { x: walk.x + walk.w + 1, z: walk.z, w: W - M - walk.x - walk.w - 1, d: walk.d },
      ];
      const side: Box[] = [];
      for (const b of bands) if (b.w >= 3 && b.d >= 3) bsp(r, b, 4, side);
      for (const b of side) carve(g, b, floorCode, 0);
      rooms = [walk, ...side];
      addRoom(d, walk, "cloister", 0);
      side.forEach((b, i) => addRoom(d, b, roomKind(arch, i + 1, side.length, r), 0));
      d.levels = [-0.3, 0];
      break;
    }
    case "foundry": {
      // Workshop floor with machine blocks; a raised catwalk runs along the north wall (railing edge,
      // reached by stairs); tool rooms along the south behind a wall.
      const cat: Box = { x: M, z: M, w: W - 2 * M, d: 3 };
      const floor: Box = { x: M, z: M + 3, w: W - 2 * M, d: H - 2 * M - 3 - 6 };
      carve(g, cat, S.grate, high, 1);
      carve(g, floor, S.grate, 0);
      const side: Box[] = [];
      bsp(r, { x: M, z: H - M - 5, w: W - 2 * M, d: 5 }, 4, side);
      for (const b of side) carve(g, b, floorCode, 0);
      rooms = [floor, cat, ...side];
      addRoom(d, floor, "workfloor", 0); addRoom(d, cat, "catwalk", high);
      side.forEach((b, i) => addRoom(d, b, roomKind(arch, i + 1, side.length, r), 0));
      d.levels = [0, high];
      break;
    }
    case "pool":
    default: {
      // Pool hall: a big basin of water in a tiled hall, with changing rooms and a raised deck.
      const hall: Box = { x: M, z: M, w: W - 2 * M, d: H - 2 * M - 5 };
      carve(g, hall, S.tile, 0);
      const px = Math.round(W * r.range(0.22, 0.3)), pz = Math.round(H * r.range(0.25, 0.32));
      const pw = Math.round(W * r.range(0.35, 0.45)), pd = Math.round(H * r.range(0.3, 0.38));
      for (let z = pz; z < pz + pd; z++) for (let x = px; x < px + pw; x++) { const k = g.i(x, z); g.block(k, S.pool, -0.6); }
      const lock: Box[] = [];
      bsp(r, { x: M, z: H - M - 4, w: W - 2 * M, d: 4 }, 3, lock);
      for (const b of lock) carve(g, b, S.floor, 0);
      const deck: Box = { x: M, z: M, w: Math.round(W * 0.3), d: 3 };
      carve(g, deck, S.deck, high * 0.6, 1);
      rooms = [hall, ...lock];
      addRoom(d, hall, "pool", 0);
      lock.forEach((b, i) => addRoom(d, b, i === 0 ? "lobby" : "guest", 0));
      d.levels = [0, Math.round(high * 0.6 * 100) / 100];
      break;
    }
  }
  if (arch !== "cave") doorways(d, rooms, arch === "corridor" ? 2 : 3, S.floor, arch === "corridor" ? [0, 1] : [0]);
  // Exterior doorways to lobbies are not needed: the floor is self-contained.
  joinLevels(d, arch === "foundry" ? "metal" : arch === "cave" ? "rock" : arch === "tiered" ? "tier" : "wood");
  legalize(d);
  // Spawn near the south (front), descent at the north (back).
  const clear = clearance(g);
  const pick = (want: Point, minC: number, reach: Int32Array | null, door = false) => {
    let best = -1, bs = Infinity;
    for (let k = 0; k < g.n; k++) {
      if (!g.walk[k] || isStairCode(g.surf[k]!) || clear[k]! < minC || (reach && reach[k]! < 0)) continue;
      // The descent door must be fully visible: an open box around it beats being nearer the back wall.
      const s = Math.abs((k % W) - want.x) + Math.abs(((k / W) | 0) - want.z) * 1.2 + (door ? doorBoxPenalty(g, k) * 1000 : 0);
      if (s < bs) { bs = s; best = k; }
    }
    return best < 0 ? null : { x: best % W, z: (best / W) | 0 };
  };
  const spawn = pick({ x: Math.round(W / 2 + r.range(-6, 6)), z: H - 3 }, 1, null);
  if (!spawn) return false;
  d.spawn = spawn;
  const reach = flood(g, spawn).seen;
  const down = pick({ x: Math.round(W / 2 + r.range(-10, 10)), z: 2 }, 1, reach, true);
  if (!down) return false;
  d.down = down;
  reserveDoorBox(g, down);
  for (const p of [spawn, down]) g.res[g.i(p.x, p.z)] = g.res[g.i(p.x, p.z)]! | RES.poi | RES.path;
  prune(d);
  const path = routeCells(d, spawn, down, undefined, clear);
  if (!path) return false;
  d.route = path;
  reservePath(d, path, 1);
  d.roads.push(toRoad("r0", "corridor", 2, path));
  // Furniture per room function + tiered seats / stacks shelves.
  if (arch === "stacks") {
    const hall = d.rooms[0]!;
    for (let z = hall.z + 2; z < hall.z + hall.d - 2; z += 3) for (let x = hall.x + 2; x < hall.x + hall.w - 2; x++) {
      if ((x - hall.x) % 9 === 0 || (x - hall.x) % 9 === 1) continue; // cross aisles
      addProp(d, d.theme === "T28" && r.next() < 0.3 ? "fridge" : "shelf", x, z, 0, r.int(0, 3), 1);
    }
  }
  if (arch === "foundry") {
    const fl = d.rooms[0]!;
    for (let i = 0; i < Math.floor(fl.w * fl.d / 26); i++) {
      const x = r.int(fl.x + 2, fl.x + fl.w - 3), z = r.int(fl.z + 2, fl.z + fl.d - 3);
      addProp(d, r.pick(["machine", "boiler", "crate", "machine"]), x, z, r.int(0, 3) * 90, r.int(0, 3), 1);
    }
  }
  if (arch === "hall" || arch === "cloister") {
    const hall = d.rooms[0]!;
    // Colonnades: a column every 3 cells two cells in from the long walls.
    for (let z = hall.z + 2; z < hall.z + hall.d - 1; z += 3) for (const x of [hall.x + 1, hall.x + hall.w - 2]) addProp(d, "column", x, z, 0, 0, 1);
  }
  for (const room of d.rooms) {
    const f = FURNITURE[room.kind];
    if (!f) continue;
    furnish(d, room, f.wall, Math.max(2, Math.round((room.w + room.d) * 0.55)), f.centre);
  }
  if (arch === "pool" || arch === "platform") for (const room of d.rooms.slice(0, 2)) furnish(d, room, ["lounger", "plant", "bench", "column"], 8);
  if (arch === "cave") {
    for (let i = 0; i < 40; i++) {
      const k = r.int(0, g.n - 1);
      if (g.walk[k] && !(g.res[k]! & (RES.path | RES.landing | RES.poi))) addProp(d, r.next() < 0.7 ? "rock" : "crystal", k % W, (k / W) | 0, r.int(0, 359), r.int(0, 3), r.range(0.7, 1.3));
    }
  }
  void safeToBlock;
  d.districts = d.rooms.length;
  return true;
}
