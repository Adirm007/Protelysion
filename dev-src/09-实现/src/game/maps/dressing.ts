// "Life" pass: props are placed as clusters that belong to places (doorsteps, plazas, street edges, wall
// feet, open ground) instead of being sprinkled over the map. Blocking props use safeToBlock, which by
// construction can never disconnect circulation, a doorway, a landing or a gameplay point.
import { SURFACE, RES, DIRS, FACING_VEC, type Grid } from "./grid";
import { safeToBlock, isStairCode, type Draft } from "./draft";
import { propInfo } from "./props";
import type { Building, Point } from "./types";

const S = SURFACE;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function addProp(d: Draft, kind: string, x: number, z: number, rot = 0, variant = 0, scale = 1, y?: number) {
  const g = d.g, k = g.i(x, z);
  const info = propInfo(kind);
  if (info.block) {
    if (!safeToBlock(g, k)) return false;
    g.block(k, S.prop);
  } else if (!g.in(x, z)) return false;
  d.props.push([kind, x, z, r2(y ?? g.top[k]!), Math.round(rot) % 360, variant, r2(scale)]);
  return true;
}

/** Free walkable cells around a point in increasing distance (same height, not reserved as path). */
function around(g: Grid, c: Point, radius: number, h: number, allowPath = false) {
  const out: Point[] = [];
  for (let rr = 1; rr <= radius; rr++) for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== rr) continue;
    const x = c.x + dx, z = c.z + dz;
    if (!g.inner(x, z, 1)) continue;
    const k = g.i(x, z);
    if (!g.walk[k] || isStairCode(g.surf[k]!) || Math.abs(g.top[k]! - h) > 0.01) continue;
    if (!allowPath && g.res[k]! & (RES.path | RES.landing | RES.door | RES.poi)) continue;
    out.push({ x, z });
  }
  return out;
}

/** Cells in front of a facade (street side) along the building's front wall. */
function facadeCells(g: Grid, b: Building) {
  const out: Point[] = [];
  const [fx, fz] = FACING_VEC[b.facing];
  if (b.facing === "s" || b.facing === "n") {
    const z = b.facing === "s" ? b.z + b.d : b.z - 1;
    for (let x = b.x; x < b.x + b.w; x++) out.push({ x, z });
  } else {
    const x = b.facing === "e" ? b.x + b.w : b.x - 1;
    for (let z = b.z; z < b.z + b.d; z++) out.push({ x, z });
  }
  void fx; void fz;
  return out.filter((p) => g.inner(p.x, p.z, 1));
}

const DOOR_CLUSTER = ["barrel", "crates", "sacks", "pot", "barrel", "planterbox", "bench", "woodpile"];

export function dressOutdoor(d: Draft) {
  const g = d.g, r = d.stream("dressing"), themeProps = d.design.props;
  let lights = 0;
  // 1) Doorsteps: a small cluster beside the door + a lantern / hanging sign on the facade.
  for (const b of d.buildings) {
    const cells = facadeCells(g, b).filter((p) => !(p.x === b.door.x + FACING_VEC[b.facing][0] && p.z === b.door.z + FACING_VEC[b.facing][1]));
    const want = r.int(1, 3);
    let n = 0;
    for (const p of r.shuffle(cells)) {
      if (n >= want) break;
      const k = g.i(p.x, p.z);
      if (!g.walk[k] || g.res[k]! & (RES.path | RES.door | RES.landing | RES.poi) || Math.abs(g.top[k]! - b.baseY) > 0.01) continue;
      const kind = r.next() < 0.35 && themeProps.length ? `theme:${r.pick(themeProps)}` : r.pick(DOOR_CLUSTER);
      if (addProp(d, kind, p.x, p.z, r.int(0, 3) * 90 + r.int(-12, 12), r.int(0, 3), r.range(0.85, 1.1))) n++;
    }
    // Wall-mounted lantern + sign (non-blocking; rendered on the facade next to the door).
    d.props.push(["sconce", b.door.x, b.door.z, r2(b.baseY), { n: 0, e: 90, s: 180, w: 270 }[b.facing], 0, 1]);
    lights++;
    if (b.enterable || r.next() < 0.45) d.props.push(["hangsign", b.door.x, b.door.z, r2(b.baseY), { n: 0, e: 90, s: 180, w: 270 }[b.facing], r.int(0, 5), 1]);
    if (r.next() < 0.5) d.props.push(["awning", b.door.x, b.door.z, r2(b.baseY), { n: 0, e: 90, s: 180, w: 270 }[b.facing], r.int(0, 3), 1]);
    d.props.push(["doormat", b.door.x + FACING_VEC[b.facing][0], b.door.z + FACING_VEC[b.facing][1], r2(b.baseY), { n: 0, e: 90, s: 180, w: 270 }[b.facing], 0, 1]);
  }
  // 2) Plazas: a centrepiece (fountain / well / statue) off the path, benches, a stall, lamps.
  for (const pl of d.plazas) {
    const h = g.top[g.i(pl.center.x, pl.center.z)]!;
    const ring = around(g, pl.center, Math.max(2, pl.radius), h);
    const centre = pl.kind === "civic" ? (d.archetype === "works" ? "statue" : r.pick(["fountain", "well", "statue", "fountain"])) : r.pick(["well", "noticeboard", "statue"]);
    let placedCentre = false;
    for (const p of ring) if (!placedCentre && addProp(d, centre, p.x, p.z, r.int(0, 3) * 90, r.int(0, 3), 1)) placedCentre = true;
    let benches = 0, stalls = 0, lamps = 0;
    for (const p of r.shuffle(ring)) {
      if (benches < 2 && addProp(d, "bench", p.x, p.z, r.int(0, 3) * 90, r.int(0, 3), 1)) { benches++; continue; }
      if (pl.kind === "civic" && stalls < 2 && addProp(d, "stall", p.x, p.z, r.int(0, 3) * 90, r.int(0, 5), 1)) { stalls++; continue; }
      if (lamps < 2 && addProp(d, "streetlamp", p.x, p.z, 0, 0, 1)) { lamps++; lights++; continue; }
      if (r.next() < 0.3 && themeProps.length) addProp(d, `theme:${r.pick(themeProps)}`, p.x, p.z, r.int(0, 359), r.int(0, 3), 1);
    }
  }
  // 3) Street lamps: along reserved paths, on a free neighbour cell every ~7 m.
  let since = 99;
  for (const road of d.roads) {
    if (road.kind === "stair" || road.kind === "bridge") continue;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1]!, b = road.points[i]!;
      const len = Math.abs(b.x - a.x) + Math.abs(b.z - a.z), sx = Math.sign(b.x - a.x), sz = Math.sign(b.z - a.z);
      for (let t = 0; t <= len; t++) {
        since++;
        if (since < 7) continue;
        const x = a.x + sx * t, z = a.z + sz * t;
        const sides = sx ? [[0, 2], [0, -2], [0, 1], [0, -1]] : [[2, 0], [-2, 0], [1, 0], [-1, 0]];
        for (const [ox, oz] of sides) {
          const px = x + ox!, pz = z + oz!;
          if (!g.inner(px, pz, 1)) continue;
          const k = g.i(px, pz);
          if (!g.walk[k] || g.res[k]! & (RES.path | RES.door | RES.landing | RES.poi | RES.plaza)) continue;
          if (addProp(d, "streetlamp", px, pz, 0, 0, 1)) { since = 0; lights++; break; }
        }
      }
    }
  }
  // 4) Wall feet & terrace edges: flowers, vines, reeds (non-blocking) on planters/edges beside walkable cells.
  for (let k = 0; k < g.n; k++) {
    const c = g.code(k);
    const x = k % g.w, z = (k / g.w) | 0;
    if ((c === S.planter || c === S.edge) && r.next() < 0.28) d.props.push([r.next() < 0.5 ? "flowers" : "vine", x, z, r2(g.top[k]!), r.int(0, 359), r.int(0, 3), r2(r.range(0.8, 1.2))]);
  }
  // 5) Open ground: grass tufts, fallen leaves, puddles (non-blocking).
  for (let k = 0; k < g.n; k++) {
    if (!g.walk[k] || isStairCode(g.surf[k]!)) continue;
    const c = g.code(k), x = k % g.w, z = (k / g.w) | 0;
    const roll = r.next();
    if ((c === S.ground || c === S.worn) && roll < 0.2) d.props.push(["tuft", x, z, r2(g.top[k]!), r.int(0, 359), r.int(0, 3), r2(r.range(0.7, 1.3))]);
    else if ((c === S.street || c === S.plaza) && roll < 0.018) d.props.push([r.next() < 0.5 ? "puddle" : "leaves", x, z, r2(g.top[k]!), r.int(0, 359), r.int(0, 3), 1]);
  }
  // 6) Laundry lines between facing buildings over narrow streets (visual only).
  for (const road of d.roads) {
    if (road.kind !== "branch" && road.kind !== "loop") continue;
    if (r.next() < 0.5 && road.points.length > 1) {
      const p = road.points[Math.floor(road.points.length / 2)]!;
      const k = g.i(p.x, p.z);
      d.props.push(["laundry", p.x, p.z, r2(g.top[k]!), road.points[0]!.x === road.points[1]!.x ? 0 : 90, r.int(0, 3), 1]);
    }
  }
  // 7) Theme vignettes on open unreserved cells: small groups of theme props.
  const open: number[] = [];
  for (let k = 0; k < g.n; k++) if (g.walk[k] && !(g.res[k]! & (RES.path | RES.corridor | RES.plaza | RES.door | RES.landing | RES.poi)) && !isStairCode(g.surf[k]!)) open.push(k);
  let vignettes = 0;
  for (const k of r.shuffle(open)) {
    if (vignettes >= 6 || !themeProps.length) break;
    const x = k % g.w, z = (k / g.w) | 0;
    if (addProp(d, `theme:${r.pick(themeProps)}`, x, z, r.int(0, 359), r.int(0, 3), 1)) {
      vignettes++;
      for (const [dx, dz] of r.shuffle(DIRS).slice(0, 2)) addProp(d, r.pick(["barrel", "crates", "sacks", "pot"]), x + dx, z + dz, r.int(0, 359), r.int(0, 3), 0.9);
    }
  }
  return lights;
}

export function dressInterior(d: Draft) {
  const g = d.g, r = d.stream("idress");
  let lights = 0;
  // Ceiling/wall lights: a sconce every ~5 cells along walls, a chandelier per large room.
  for (const room of d.rooms) {
    if (room.w * room.d >= 36) { d.props.push(["chandelier", room.x + (room.w >> 1), room.z + (room.d >> 1), r2(room.y), 0, r.int(0, 3), 1]); lights++; }
    else if (room.w * room.d >= 12) { d.props.push(["pendant", room.x + (room.w >> 1), room.z + (room.d >> 1), r2(room.y), 0, 1, 1]); lights++; }
  }
  let since = 0;
  for (let k = 0; k < g.n; k++) {
    if (!g.walk[k]) continue;
    const x = k % g.w, z = (k / g.w) | 0;
    // A wall directly north → a sconce on that wall.
    if (g.inner(x, z - 1, 0) && (g.code(g.i(x, z - 1)) === S.wall || g.code(g.i(x, z - 1)) === S.rock) && ++since >= 5) {
      d.props.push(["sconce", x, z, r2(g.top[k]!), 180, 0, 1]); since = 0; lights++;
    }
  }
  // Rugs in rooms, decor tufts in caves.
  for (const room of d.rooms) if (room.w >= 3 && room.d >= 3 && r.next() < 0.7 && d.archetype !== "cave") d.props.push(["rug", room.x + (room.w >> 1), room.z + (room.d >> 1), r2(room.y), r.pick([0, 90]), r.int(0, 3), r2(Math.min(room.w, room.d) * 0.6)]);
  return lights;
}
