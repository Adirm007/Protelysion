// Offline acceptance checks for P5 floors (A3/A4/A6/A7 of the plan). Not a fallback generator.
import { gridPath } from "./geometry";
import { propInfo } from "./props";
import type { FloorLayout, LayoutIssue } from "./types";

const STAIRISH = new Set(["S", "B"]);
const WALKABLE = new Set("gcpdwmfatoSBDI");

export function validateFloor(g: FloorLayout): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const bad = (rule: string, ids: string[], detail: string) => issues.push({ rule, ids, detail });
  const W = g.width, H = g.height;
  if (g.tiles.length !== H || g.tiles.some((r) => r.length !== W)) bad("shape", [], "tiles 尺寸与宽高不符");
  if (g.surface.length !== H || g.heights.length !== W * H) bad("shape", [], "surface/heights 尺寸与宽高不符");
  const walk = (x: number, z: number) => g.tiles[z]?.[x] === ".";
  // Border must be closed.
  for (let x = 0; x < W; x++) if (walk(x, 0) || walk(x, H - 1)) bad("border", [], "地图边界存在可走格");
  for (let z = 0; z < H; z++) if (walk(0, z) || walk(W - 1, z)) bad("border", [], "地图边界存在可走格");
  // A4: every 4-adjacent walkable pair is a legal step.
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (!walk(x, z)) continue;
    const c = g.surface[z]![x]!;
    if (!WALKABLE.has(c)) bad("surface-walk", [], `${x},${z} 可走格使用了不可走表面 ${c}`);
    for (const [nx, nz] of [[x + 1, z], [x, z + 1]] as const) {
      if (!walk(nx, nz)) continue;
      const d = g.surface[nz]![nx]!;
      const limit = STAIRISH.has(c) || STAIRISH.has(d) ? 0.5 : 0.05;
      const dh = Math.abs(g.heights[z * W + x]! - g.heights[nz * W + nx]!);
      if (dh > limit + 1e-6) bad("grade", [], `${x},${z}→${nx},${nz} 高差 ${dh.toFixed(2)}m 超过${STAIRISH.has(c) || STAIRISH.has(d) ? "台阶" : "平地"}限值`);
    }
  }
  // A3: connectivity.
  const reach = gridPath(g.tiles, g.spawn, g.down);
  if (reach.distance < 0) bad("entry-down", [], "入口到下层口不连通");
  const total = g.tiles.join("").split(".").length - 1;
  if (reach.count !== total) bad("single-component", [], `存在孤立可走格：可达 ${reach.count} / 可走 ${total}`);
  const kinds = new Map<string, number>();
  const cells = new Set<string>();
  for (const p of g.pois) {
    kinds.set(p.kind, (kinds.get(p.kind) ?? 0) + 1);
    if (!Number.isInteger(p.x) || !Number.isInteger(p.z)) bad("poi-integer", [p.id], "交互点坐标不是整数格");
    if (!walk(p.x, p.z)) bad("poi-walkable", [p.id], "交互点不在可走格");
    else if (reach.seen[p.z * W + p.x]! < 0) bad("poi-reachable", [p.id], "交互点不可达");
    if (STAIRISH.has(g.surface[p.z]?.[p.x] ?? "")) bad("poi-stair", [p.id], "交互点落在楼梯或桥上");
    const key = `${p.x},${p.z}`;
    if (cells.has(key)) bad("poi-overlap", [p.id], "交互点重叠");
    cells.add(key);
  }
  if (kinds.get("entry") !== 1 || kinds.get("down") !== 1) bad("poi-core", [], "入口/下层口数量不为 1");
  if (kinds.get("chest") !== 1) bad("poi-chest", [], "宝箱候选点数量不为 1");
  if ((kinds.get("encounter") ?? 0) < 4) bad("encounter-pads", [], "不足4个独立敌群候选点");
  if ((kinds.get("supplier") ?? 0) > 1) bad("poi-supplier", [], "补给员候选点多于 1 个");
  // Encounter pads never seal a route: with all pads occupied every other POI stays reachable and each
  // pad keeps a free neighbour (the runtime blocks movement through undefeated encounters).
  {
    const pads = new Set(g.pois.filter((p) => p.kind === "encounter").map((p) => p.z * W + p.x));
    const seen = new Uint8Array(W * H), queue: number[] = [];
    const s0 = g.spawn.z * W + g.spawn.x;
    if (walk(g.spawn.x, g.spawn.z) && !pads.has(s0)) { seen[s0] = 1; queue.push(s0); }
    for (let k = 0; k < queue.length; k++) {
      const c = queue[k]!, x = c % W, z = (c / W) | 0;
      for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]] as const) {
        const n = nz * W + nx;
        if (!walk(nx, nz) || seen[n] || pads.has(n)) continue;
        seen[n] = 1; queue.push(n);
      }
    }
    for (const p of g.pois) {
      const ok = p.kind !== "encounter" ? !!seen[p.z * W + p.x]
        : [[p.x + 1, p.z], [p.x - 1, p.z], [p.x, p.z + 1], [p.x, p.z - 1]].some(([nx, nz]) => walk(nx!, nz!) && !!seen[nz! * W + nx!]);
      if (!ok) bad("encounter-bypass", [p.id], `${p.id} 被敌群候选点堵死（需绕行路线）`);
    }
  }
  const entry = g.pois.find((p) => p.kind === "entry"), down = g.pois.find((p) => p.kind === "down");
  if (entry && (entry.x !== g.spawn.x || entry.z !== g.spawn.z)) bad("poi-spawn", [], "entry 与 spawn 不一致");
  if (down && (down.x !== g.down.x || down.z !== g.down.z)) bad("poi-down", [], "down 与 layout.down 不一致");
  // Stairs are walkable, rise monotonically and stay within limits.
  for (const s of g.stairs) {
    let steps = 0;
    for (let z = s.z; z < s.z + s.d; z++) for (let x = s.x; x < s.x + s.w; x++) {
      if (g.surface[z]?.[x] !== "S") continue;
      steps++;
      if (!walk(x, z)) bad("stair-walk", [s.id], "楼梯格不可走");
      const h = g.heights[z * W + x]!;
      if (h < Math.min(s.h0, s.h1) - 1e-3 || h > Math.max(s.h0, s.h1) + 1e-3) bad("stair-range", [s.id], "楼梯高度越界");
    }
    if (!steps) bad("stair-empty", [s.id], "楼梯没有台阶格");
    if (s.h1 - s.h0 > 2.7) bad("stair-rise", [s.id], "单段楼梯落差过大");
  }
  // Buildings: footprint blocked except enterable interiors; door is walkable.
  for (const b of g.buildings) {
    if (b.x < 1 || b.z < 1 || b.x + b.w > W - 1 || b.z + b.d > H - 1) bad("building-bounds", [b.id], "建筑越出地图");
    for (let z = b.z; z < b.z + b.d; z++) for (let x = b.x; x < b.x + b.w; x++) {
      const edge = x === b.x || z === b.z || x === b.x + b.w - 1 || z === b.z + b.d - 1;
      const isDoor = x === b.door.x && z === b.door.z;
      if (isDoor) { if (b.enterable && !walk(x, z)) bad("door-walk", [b.id], "可进入建筑的门洞不可走"); continue; }
      if (edge || !b.enterable) { if (walk(x, z)) bad("building-solid", [b.id], `${x},${z} 建筑墙体可走`); }
      else if (!walk(x, z)) { /* furniture inside an enterable house is fine */ }
    }
    if (!g.anomaly.active && (b.yaw !== 0 || b.lift !== 0)) bad("normal-order", [b.id], "普通层出现错轴或悬置建筑");
  }
  // Props: blocking props sit on blocked cells.
  for (const p of g.decorations) {
    const [kind, x, z] = p;
    if (propInfo(kind).block && walk(x, z)) bad("prop-block", [kind], `${x},${z} 阻挡道具位于可走格`);
  }
  // A7: anomaly floors carry at least 8 recorded intrusions on blocked (occupied) cells.
  if (g.anomaly.active && g.anomaly.intrusions.length < 8) bad("anomaly-intrusions", [], `异常层闯入物只有 ${g.anomaly.intrusions.length} 个`);
  if (!g.anomaly.active && g.anomaly.intrusions.length) bad("anomaly-normal", [], "普通层记录了闯入物");
  for (const it of g.anomaly.intrusions) if (walk(it.x, it.z) && it.kind !== "stair-to-nowhere") bad("intrusion-block", [it.kind], "闯入物所在格仍可走");
  return issues;
}
