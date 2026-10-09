// P5 building placement (hd2d-architecture-1). Buildings are fitted onto flat, unreserved cells beside
// streets, face the street they are entered from, and can never disconnect circulation: every footprint
// is verified by a flood fill before it is committed. Geometry itself is produced by the render kernel.
import { hash32 } from "./geometry";
import { SURFACE, FACING_VEC, OPPOSITE, RES, flood, type Grid } from "./grid";
import { isStairCode, type Draft } from "./draft";
import type { Building, Facing, Point, RoofForm } from "./types";
import type { BuildingStyle } from "./themes";
import { KINDS, kindSpec, type ThemeKit } from "./kits";

export const BUILDING_VERSION = "hd2d-architecture-3" as const;
export const BUILDING_RENDER_BUDGET = Object.freeze({
  maxFloors: 4,
  maxFootprint: 9,
  maxTrianglesPerBuildingDesktop: 16000,
  maxTrianglesPerBuildingMobile: 6000,
});

const S = SURFACE;
const C = (c: string) => c.charCodeAt(0);

export const STYLE_ROOFS: Record<BuildingStyle, RoofForm[]> = {
  stucco: ["hip", "gable", "gable", "flat"],
  western: ["flat", "gable", "gable"],
  asian: ["eaves", "eaves", "hip"],
  keep: ["gable", "hip", "cone"],
  brick: ["gable", "mansard", "gable", "hip"],
  industrial: ["saw", "flat", "barrel"],
  modern: ["flat", "flat", "saw"],
  hut: ["tent", "cone", "gable"],
  organic: ["dome", "barrel", "dome"],
  paper: ["gable", "hip", "eaves"],
  crystal: ["cone", "dome", "hip"],
  tent: ["tent", "cone", "dome"],
  lodge: ["gable", "gable", "hip"],
  coral: ["dome", "barrel", "flat"],
  pencil: ["cone", "gable", "hip"],
  salt: ["dome", "flat", "hip"],
  adobe: ["flat", "flat", "dome"],
};

/** Conical / tent / dome roofs only suit small, nearly square footprints; long houses get a hip instead. */
export function pickRoof(roof: RoofForm, w: number, d: number): RoofForm {
  const square = Math.abs(w - d) <= 1 && Math.max(w, d) <= 5;
  if ((roof === "cone" || roof === "tent" || roof === "dome") && !square) return roof === "dome" ? "barrel" : "hip";
  return roof;
}

type Fit = { x: number; z: number; w: number; d: number; facing: Facing; door: Point; stoop: Point; baseY: number; score: number };

/** Can cell k be part of a footprint at height h? Walkable-unreserved or a wall-foot planter at the same height. */
function freeCell(g: Grid, k: number, h: number) {
  if (g.own[k]) return false;
  if (Math.abs(g.top[k]! - h) > 0.01) return false;
  const c = g.surf[k]!;
  if (g.walk[k]) return !(g.res[k]! & (RES.path | RES.corridor | RES.plaza | RES.poi | RES.landing | RES.door)) && !isStairCode(c);
  return c === C(S.planter) || c === C(S.edge);
}

/** Try all footprints whose front row touches the street cell `st` from direction `f`. */
function fitsAt(g: Grid, st: number, f: Facing, sizes: [number, number][], margin: number): Fit[] {
  const out: Fit[] = [];
  const sx = st % g.w, sz = (st / g.w) | 0;
  // Building lies on the opposite side of the street cell, i.e. the door faces toward `f` = street direction.
  const [fx, fz] = FACING_VEC[f];
  const doorX = sx - fx, doorZ = sz - fz; // cell adjacent to the street, inside the footprint
  if (!g.inner(doorX, doorZ, margin)) return out;
  const dk = g.i(doorX, doorZ), h = g.top[st]!;
  if (!freeCell(g, dk, h) || !g.walk[dk]) return out;
  for (const [w0, d0] of sizes) {
    const along = f === "n" || f === "s" ? w0 : d0; // extent along the street
    const deep = f === "n" || f === "s" ? d0 : w0;
    for (let off = 1; off < along - 1; off++) {
      let x: number, z: number, w: number, d: number;
      if (f === "s") { x = doorX - off; z = doorZ - deep + 1; w = along; d = deep; }
      else if (f === "n") { x = doorX - off; z = doorZ; w = along; d = deep; }
      else if (f === "e") { x = doorX - deep + 1; z = doorZ - off; w = deep; d = along; }
      else { x = doorX; z = doorZ - off; w = deep; d = along; }
      if (x < margin || z < margin || x + w > g.w - margin || z + d > g.h - margin) continue;
      let ok = true, planter = 0;
      for (let zz = z; zz < z + d && ok; zz++) for (let xx = x; xx < x + w; xx++) {
        const k = g.i(xx, zz);
        if (!freeCell(g, k, h)) { ok = false; break; }
        if (!g.walk[k]) planter++;
      }
      if (!ok) continue;
      out.push({ x, z, w, d, facing: f, door: { x: doorX, z: doorZ }, stoop: { x: sx, z: sz }, baseY: h, score: planter * 0.08 });
    }
  }
  return out;
}

/** Everything reachable before must stay reachable (except the footprint itself). */
function keepsConnectivity(d: Draft, cells: number[], door: number | null, reach: Int32Array) {
  const g = d.g, saved = cells.map((k) => g.walk[k]!);
  for (const k of cells) g.walk[k] = 0;
  if (door !== null) g.walk[door] = 1;
  const f = flood(g, d.spawn);
  let ok = true;
  for (let k = 0; k < g.n && ok; k++) if (reach[k]! >= 0 && g.walk[k] && f.seen[k]! < 0) ok = false;
  cells.forEach((k, i) => (g.walk[k] = saved[i]!));
  return ok;
}

/** Height of the terrace directly behind the back wall (split-level houses), or null. */
function backHeight(g: Grid, fit: Fit) {
  const [fx, fz] = FACING_VEC[OPPOSITE[fit.facing]];
  let best: number | null = null;
  const cells: Point[] = [];
  if (fit.facing === "s") for (let x = fit.x; x < fit.x + fit.w; x++) cells.push({ x, z: fit.z - 1 });
  else if (fit.facing === "n") for (let x = fit.x; x < fit.x + fit.w; x++) cells.push({ x, z: fit.z + fit.d });
  else if (fit.facing === "e") for (let z = fit.z; z < fit.z + fit.d; z++) cells.push({ x: fit.x - 1, z });
  else for (let z = fit.z; z < fit.z + fit.d; z++) cells.push({ x: fit.x + fit.w, z });
  void fx; void fz;
  let hits = 0;
  for (const p of cells) {
    if (!g.in(p.x, p.z)) continue;
    const t = g.top[g.i(p.x, p.z)]!;
    if (g.lvl[g.i(p.x, p.z)]! >= 0 && t > fit.baseY + 0.9) { hits++; best = best === null ? t : Math.min(best, t); }
  }
  return hits >= Math.ceil(cells.length * 0.6) ? best : null;
}

export type PlaceOptions = {
  count: number;
  enterable: number;
  sizes: [number, number][];
  enterSizes: [number, number][];
  margin: number;
  styleRoofs: RoofForm[];
  floors: [number, number];
  role?: Building["role"];
  /** Theme kit: kinds (footprints, floors, enterable) + signature forms. */
  kit?: ThemeKit;
  /** Chance that the floor gets its signature building. */
  sigChance?: number;
};

/** All footprint sizes (along × deep) allowed for a kind, as fitsAt size tuples for facing f. */
function kindSizes(kind: string, f: Facing, minDeep = 0, minAlong = 0): [number, number][] {
  const k = kindSpec(kind), out: [number, number][] = [];
  for (let a = Math.max(k.a[0], minAlong); a <= k.a[1]; a++) for (let d = Math.max(k.d[0], minDeep); d <= k.d[1]; d++) out.push(f === "n" || f === "s" ? [a, d] : [d, a]);
  return out;
}

/** Pick a kind from a weighted list, damping kinds already used on this floor. */
function pickKind(r: { next(): number }, kinds: [string, number][], used: Map<string, number>) {
  let tot = 0;
  const w = kinds.map(([k, wt]) => { const cap = KINDS[k]?.max ?? 99, n = used.get(k) ?? 0; const v = n >= cap ? 0 : wt / (1 + n * 0.6); tot += v; return v; });
  if (tot <= 0) return "house";
  let x = r.next() * tot;
  for (let i = 0; i < kinds.length; i++) { x -= w[i]!; if (x <= 0) return kinds[i]![0]; }
  return kinds[kinds.length - 1]![0];
}

/** Nearest fitting kind of a kit for an existing footprint (collage floors re-skin houses). */
export function kindForFootprint(kit: ThemeKit, along: number, deep: number, enterable: boolean, roll: number) {
  const fits = kit.kinds.filter(([k]) => { const s = kindSpec(k); return along >= s.a[0] && along <= s.a[1] + 1 && deep >= s.d[0] && deep <= s.d[1] + 1 && (!enterable || s.enter); });
  const pool = fits.length ? fits : kit.kinds.filter(([k]) => !enterable || kindSpec(k).enter);
  if (!pool.length) return enterable ? "shop" : "house";
  return pool[Math.floor(roll * pool.length) % pool.length]![0];
}

/** Place street buildings. Returns placed buildings; enterable ones get a walkable interior. */
export function placeBuildings(d: Draft, opts: PlaceOptions): Building[] {
  const g = d.g, r = d.stream("buildings"), placed: Building[] = [];
  const reach = flood(g, d.spawn).seen;
  // Candidate street cells: walkable path/corridor cells with a free neighbour.
  const streets: { k: number; f: Facing }[] = [];
  for (let k = 0; k < g.n; k++) {
    if (!g.walk[k] || !(g.res[k]! & (RES.path | RES.corridor)) || isStairCode(g.surf[k]!)) continue;
    const x = k % g.w, z = (k / g.w) | 0;
    for (const f of ["n", "s", "e", "w"] as Facing[]) {
      const [fx, fz] = FACING_VEC[f];
      const nx = x - fx, nz = z - fz;
      if (!g.inner(nx, nz, opts.margin)) continue;
      if (freeCell(g, g.i(nx, nz), g.top[k]!) && g.walk[g.i(nx, nz)]) streets.push({ k, f });
    }
  }
  const order = r.shuffle(streets.map((_, i) => i));
  const kit = opts.kit;
  const used = new Map<string, number>();
  let attempts = 0, enterLeft = opts.enterable;
  const nearPlaza = (k: number) => {
    const x = k % g.w, z = (k / g.w) | 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (g.in(x + dx, z + dz) && g.res[g.i(x + dx, z + dz)]! & RES.plaza) return true;
    return false;
  };
  // Passes: signature form (once), enterable houses (so every floor gets its interiors), ordinary houses.
  type Pass = "sig" | "enter" | "house";
  const passes: Pass[] = kit && kit.sig.length && r.next() < (opts.sigChance ?? 0.8) ? ["sig", "enter", "house"] : ["enter", "house"];
  for (const pass of passes) {
    let sigDone = false;
    // Signature forms prefer street cells next to plazas.
    const seq = pass === "sig" ? [...order].sort((a, b) => Number(nearPlaza(streets[b]!.k)) - Number(nearPlaza(streets[a]!.k))) : order;
    for (const idx of seq) {
      if (placed.length >= opts.count || attempts > 260) break;
      if (pass === "enter" && enterLeft <= 0) break;
      if (pass === "sig" && sigDone) break;
      const { k, f } = streets[idx]!;
      if (g.walk[k] === 0 || g.own[k]) continue;
      const wantEnter = pass === "enter";
      let kind = "house";
      let sizes: [number, number][];
      if (kit) {
        if (pass === "sig") kind = kit.sig[Math.floor(r.next() * kit.sig.length) % kit.sig.length]!;
        else if (wantEnter) {
          const ek = kit.kinds.filter(([kk]) => kindSpec(kk).enter);
          kind = ek.length ? pickKind(r, ek, used) : "shop";
        } else kind = pickKind(r, kit.kinds, used);
        sizes = kindSizes(kind, f, wantEnter ? 5 : 0, wantEnter ? 5 : 0);
      } else sizes = wantEnter ? opts.enterSizes : opts.sizes;
      const fits = fitsAt(g, k, f, r.shuffle(sizes), opts.margin);
      if (!fits.length) continue;
      attempts++;
      // Prefer footprints against terrace walls (split-level) and facing south toward the camera.
      for (const fit of fits) fit.score += (fit.facing === "s" ? 0.6 : fit.facing === "n" ? -0.25 : 0.2) + r.next() * 0.5 + (backHeight(g, fit) !== null ? 0.5 : 0) + (pass === "sig" ? fit.w * fit.d * 0.01 : 0);
      fits.sort((a, b) => b.score - a.score);
      const fit = fits[0]!;
      const cells: number[] = [];
      for (let z = fit.z; z < fit.z + fit.d; z++) for (let x = fit.x; x < fit.x + fit.w; x++) cells.push(g.i(x, z));
      const doorK = g.i(fit.door.x, fit.door.z);
      const enter = wantEnter && fit.w >= 5 && fit.d >= 5;
      if (wantEnter && !enter) continue;
      // Enterable houses keep their interior walkable, so only the wall ring blocks.
      const blocking = enter ? cells.filter((c) => { const x = c % g.w, z = (c / g.w) | 0; return x === fit.x || z === fit.z || x === fit.x + fit.w - 1 || z === fit.z + fit.d - 1; }) : cells;
      if (!keepsConnectivity(d, blocking, enter ? doorK : null, reach)) continue;
      const id = `b${d.buildings.length}`;
      const seed = hash32(`${BUILDING_VERSION}|${id}|${fit.x},${fit.z}|${d.theme}`);
      const spec = KINDS[kind];
      const fl0 = Math.max(opts.floors[0], spec?.floors[0] ?? 1), fl1 = Math.min(Math.max(opts.floors[1], spec?.floors[0] ?? 1), spec?.floors[1] ?? 3, enter ? 2 : 4);
      const floors = r.int(Math.min(fl0, fl1), fl1);
      const b: Building = {
        id, role: opts.role ?? spec?.role ?? (enter ? "shop" : kit ? "house" : r.next() < 0.2 ? "tower" : "house"), theme: d.theme,
        x: fit.x, z: fit.z, w: fit.w, d: fit.d, baseY: Math.round(fit.baseY * 1000) / 1000, facing: fit.facing,
        door: fit.door, floors, style: d.design.style, kind, roof: pickRoof(r.pick(opts.styleRoofs), fit.w, fit.d), seed, enterable: enter,
        backY: null, yaw: 0, lift: 0,
      };
      if (enter && b.role !== "shop" && b.role !== "house") b.role = "shop";
      const bh = backHeight(g, fit);
      if (bh !== null && !(spec?.sig)) { b.backY = Math.round(bh * 1000) / 1000; b.floors = Math.max(b.floors, Math.min(3, Math.ceil((bh - fit.baseY) / 2.7) + 1)); }
      const owner = d.buildings.length + 1;
      for (const c of cells) {
        g.own[c] = owner;
        g.block(c, S.building);
      }
      if (enter) {
        for (const c of cells) {
          if (blocking.includes(c)) continue;
          g.ground(c, S.house, fit.baseY);
          g.res[c] = g.res[c]! | RES.keep;
        }
        g.ground(doorK, S.door, fit.baseY);
        g.res[doorK] = g.res[doorK]! | RES.door;
        d.rooms.push({ id: `room-${id}`, kind: "shop", x: fit.x + 1, z: fit.z + 1, w: fit.w - 2, d: fit.d - 2, y: b.baseY, building: id });
        enterLeft--;
      }
      const stoop = g.i(fit.stoop.x, fit.stoop.z);
      g.res[stoop] = g.res[stoop]! | RES.door;
      d.buildings.push(b);
      placed.push(b);
      used.set(kind, (used.get(kind) ?? 0) + 1);
      if (pass === "sig") sigDone = true;
    }
  }
  return placed;
}
