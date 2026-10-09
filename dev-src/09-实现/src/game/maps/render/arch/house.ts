// Generic house builder (hd2d-architecture-3): turns a Plan (language style sheet + kind preset +
// massing) into a detailed building — lot plinth, storeys with jetties / setbacks, facades from the
// facade grammar, half-timber or lacquered post frames, quoins, string courses, cornices, roofs with
// dormers and chimneys, porches and galleries, false fronts, eastern skirt roofs, bay windows, shop
// signage, lamps and clutter. Enterable houses keep the cut-away groups used by the renderer.
import type { FaceOpts, MeshBuilder, V3 } from "../mesh";
import { hash3 } from "../mesh";
import type { Ctx } from "../ground";
import { quadOut, tube, wallP, wbox, wq, type Side, type WallP } from "./geo";
import { facade, quoins, timberFrame, type FacadeMats, type Op } from "./facade";
import { roof, type RoofInfo, type RoofOpts } from "./roofs";
import { awning, banner, chimney, clutter, dormer, hangSign, lantern, neonBox, noren, paperLantern, steps, acUnit, light, type ClutterMats } from "./parts";
import type { Block, Plan, Style } from "./plan";

export type Mats = {
  G: number; U: number; P: number; T: number; F: number; R: number; S: number; D: number; X: number;
  fm: FacadeMats; cm: ClutterMats; snow: number; roofCap: number; water: number; neon: number; sign: number; awning: number; lattice: number; paint: number;
};

export function houseMats(ctx: Ctx, p: Plan): Mats {
  const L = (id: string) => ctx.layer(id);
  const st = p.st;
  const frameL = st.lang === "victorian" || st.lang === "frontier" || st.lang === "nordic" ? L("a_paint") : st.lang === "industrial" || st.lang === "urban" ? L("metal") : st.lang === "mediterranean" ? L("a_wood") : L("darkwood");
  const fm: FacadeMats = {
    trim: L(st.mat.T), frame: frameL, glass: L("glass"), lit: L("window"), lattice: L("a_lattice"), door: L(st.mat.D), shutter: L(st.mat.S),
    metal: L("metal"), wood: L("a_wood"), flowers: L("flowers"), stone: L("stone"), dark: L("darkwood"), corr: L("a_corr"), cloth: L("cloth"), brass: L("brass"),
  };
  const cm: ClutterMats = { wood: L("a_wood"), dark: L("darkwood"), metal: L("metal"), stone: L("stone"), cloth: L("cloth"), cloth2: L("cloth2"), flowers: L("flowers"), leaves: L("foliage"), paper: L("paper") };
  return {
    G: L(st.mat.G), U: L(st.mat.U), P: L(st.mat.P), T: L(st.mat.T), F: L(st.mat.F), R: L(st.mat.R), S: L(st.mat.S), D: L(st.mat.D), X: L(st.mat.X),
    fm, cm, snow: st.snow ? L("ground") : -1, roofCap: L(st.mat.R), water: L("water"), neon: L("a_neon"), sign: L("a_sign"), awning: L("a_awning"), lattice: L("a_lattice"), paint: L("a_paint"),
  };
}

const SIDES: Side[] = ["s", "e", "n", "w"];

export function buildHouse(ctx: Ctx, p: Plan) {
  const mb = ctx.mb, b = p.b, st = p.st, r = p.r, mobile = ctx.quality === "mobile";
  const M = houseMats(ctx, p);
  const g = (cut: boolean) => (b.enterable && cut ? `b:${b.id}:cut` : `b:${b.id}`);
  mb.group = g(false);
  const tint = p.tint as V3;
  // ---- lot plinth ----
  const W = p.W, D = p.D;
  const plinthTop = st.plinth;
  if (st.lang === "eastern") {
    mb.bevelBox(0, -0.3, 0, W + 0.1, plinthTop + 0.3, D + 0.1, 0.06, { layer: M.P }, { layer: M.P, tint: [0.95, 0.95, 0.95] });
    mb.box(0, plinthTop - 0.06, 0, W + 0.16, 0.06, D + 0.16, { layer: M.fm.dark }, "tnsew");
  } else if (st.mat.P === "a_wood") {
    mb.box(0, -0.3, 0, W, plinthTop + 0.3, D, { layer: M.fm.dark, tint: [0.7, 0.7, 0.7] }, "nsew", { layer: M.P });
    mb.quad([-W / 2, plinthTop, D / 2], [W / 2, plinthTop, D / 2], [W / 2, plinthTop, -D / 2], [-W / 2, plinthTop, -D / 2], { layer: M.P, uvs: [[0, D * 0.9], [W * 0.9, D * 0.9], [W * 0.9, 0], [0, 0]] });
  } else mb.bevelBox(0, -0.3, 0, W + 0.12, plinthTop + 0.3, D + 0.12, 0.04, { layer: M.P });
  // ---- blocks ----
  const roofs: { bl: Block; info: RoofInfo; rect: { x0: number; x1: number; z0: number; z1: number } }[] = [];
  const main = p.blocks[0]!;
  let frontDoorU = 0, frontDoorV = 0, frontDoorW = 1.1, doorTop = 2.2, shopSpan: [number, number] | null = null;
  const falseFront = st.lang === "frontier" && st.falseFront > 0 && r(13) < st.falseFront && main.roof === "gable" && !["motel", "diner"].includes(p.kind);
  if (falseFront) main.alongX = false;
  for (const bl of p.blocks) {
    const isMain = bl === main;
    const wing = p.blocks.find((x) => x !== bl && x.role === "wing");
    for (let fl = 0; fl < bl.floors; fl++) {
      const y0 = bl.y0 + fl * bl.fh, y1 = y0 + bl.fh;
      const jet = bl.jetty * fl;
      const x0 = bl.x0, x1 = bl.x1, z0 = bl.z0, z1 = bl.z1 + jet;
      const hw = (x1 - x0) / 2, hd = (z1 - z0) / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const upper = fl > 0;
      const wallL = upper ? M.U : M.G;
      const halfTimber = st.frame === "half" && (upper || st.mat.G === st.mat.U) && isMain;
      const wallO: FaceOpts = { layer: wallL, tint };
      for (const side of SIDES) {
        const len = side === "s" || side === "n" ? hw * 2 : hd * 2;
        const P = wallP(side, hw, hd, cx, cz);
        // Walls hidden against the main block (wing side) get no openings.
        const against = !isMain && ((side === "e" && bl.x1 <= main.x0 + 0.01) || (side === "w" && bl.x0 >= main.x1 - 0.01));
        const mainAgainst = isMain && wing && fl < wing.floors + 1 && ((side === "e" && wing.x0 >= bl.x1 - 0.01) || (side === "w" && wing.x1 <= bl.x0 + 0.01));
        if (against) { wq(mb, P, -len / 2, len / 2, y0, y1, 0, wallO); continue; }
        const ops = mainAgainst ? [] : layout(p, bl, side, fl, len, isMain, falseFront);
        mb.group = g(side !== "n");
        facade(mb, { P, u0: -len / 2, u1: len / 2, y0, y1, ops, wall: wallO, mats: M.fm, st, seed: b.seed + fl * 31 + SIDES.indexOf(side) * 7, mobile });
        if (halfTimber) timberFrame(mb, P, -len / 2, len / 2, y0, y1, ops, M.F, b.seed + fl * 13 + SIDES.indexOf(side), mobile);
        if (st.frame === "post") postFrame(mb, P, len, y0, y1, ops, M, fl === 0);
        if (isMain && side === "s" && fl === 0) {
          const d = ops.find((o) => o.kind === "door");
          if (d) { frontDoorU = d.u; frontDoorW = d.w; frontDoorV = y0; doorTop = d.v1; }
          const sh = ops.filter((o) => o.kind === "shop" || o.kind === "door");
          if (ops.some((o) => o.kind === "shop")) shopSpan = [Math.min(...sh.map((o) => o.u - o.w / 2)), Math.max(...sh.map((o) => o.u + o.w / 2))];
        }
        // Quoins up both corners of this face.
        if (st.quoins && !mobile && (side === "s" || side === "e" || side === "w")) {
          quoins(mb, P, -len / 2, 1, y0, y1, M.fm.stone);
          quoins(mb, P, len / 2, -1, y0, y1, M.fm.stone);
        }
        // Log corner ends.
        if ((st.mat.G === "a_log" && !upper || st.mat.U === "a_log" && upper) && !mobile && (side === "s" || side === "n")) {
          for (const u of [-len / 2, len / 2]) for (let k = 0; k < Math.round(bl.fh / 0.26); k++) {
            const yy = y0 + 0.13 + k * 0.26, a = P(u, yy, 0.18), c = P(u, yy, -0.05);
            tube(mb, a, c, 0.11, 5, { layer: M.fm.wood, tint: [1.08, 0.98, 0.84] }, true);
          }
        }
      }
      mb.group = g(true);
      // String course / floor band.
      if (upper && (st.course || st.frame === "post")) mb.bevelBox(cx, y0 - 0.09, cz, hw * 2 + 0.12, 0.16, hd * 2 + 0.12, 0.03, { layer: st.frame === "post" ? M.fm.dark : M.T });
      // Jetty: joists + soffit + corner brackets under the overhang.
      if (upper && bl.jetty > 0) {
        const zPrev = bl.z1 + bl.jetty * (fl - 1);
        mb.quad([x1, y0, zPrev], [x0, y0, zPrev], [x0, y0, z1], [x1, y0, z1], { layer: M.F, tint: [0.7, 0.7, 0.7] });
        if (!mobile) {
          const n = Math.max(3, Math.round((x1 - x0) / 0.42));
          for (let i = 0; i <= n; i++) { const x = x0 + 0.08 + ((x1 - x0 - 0.16) * i) / n; mb.box(x, y0 - 0.14, (zPrev + z1) / 2 + 0.03, 0.1, 0.14, z1 - zPrev + 0.06, { layer: M.F }); }
        }
        for (const x of [x0 + 0.1, x1 - 0.1]) mb.beam([x, y0 - 0.75, zPrev + 0.01], [x, y0 - 0.1, z1 - 0.05], 0.11, { layer: M.F });
      }
    }
    // ---- top of block: cornice + false front + roof ----
    const top = bl.y0 + bl.floors * bl.fh;
    const tz1 = bl.z1 + bl.jetty * Math.max(0, bl.floors - 1);
    const rect = { x0: bl.x0, x1: bl.x1, z0: bl.z0, z1: tz1 };
    const rw = rect.x1 - rect.x0, rd = rect.z1 - rect.z0, rcx = (rect.x0 + rect.x1) / 2, rcz = (rect.z0 + rect.z1) / 2;
    mb.group = g(true);
    cornice(mb, st, M, rect, top, bl.roof, mobile, b.seed);
    const eaveBase = bl.roof === "flat" ? 0 : st.eave;
    const eave: [number, number, number, number] = [eaveBase, eaveBase, eaveBase, eaveBase];
    let butt: string | undefined;
    if (!isMain) {
      // Wing butts into the main block on its inner side.
      if (bl.x1 <= main.x0 + 0.01) { eave[2] = 0; butt = bl.alongX ? "+l" : undefined; }
      if (bl.x0 >= main.x1 - 0.01) { eave[3] = 0; butt = bl.alongX ? "-l" : undefined; }
    }
    if (isMain && p.porch && st.lang === "eastern") eave[0] = Math.max(eave[0], p.porch.depth + 0.35);
    if (falseFront && isMain) eave[0] = 0.05;
    const ropts: RoofOpts = {
      ...rect, y: top + (bl.roof === "flat" ? 0 : 0.02), kind: bl.roof, pitch: bl.pitch, eave, alongX: bl.alongX,
      mat: bl.roof === "flat" ? (st.lang === "urban" || st.lang === "industrial" ? M.G : M.U) : M.R, trim: st.lang === "eastern" ? M.fm.dark : M.T === M.fm.stone ? M.fm.wood : M.T,
      gable: bl.roof === "flat" ? ctxLayer(ctx, "a_concrete") : st.frame === "half" ? M.U : st.lang === "eastern" ? M.F : bl.floors > 1 ? M.U : M.G,
      soffit: st.lang === "eastern" ? M.F : M.fm.wood, rafters: st.rafters, brackets: st.brackets, ridge: st.ridge, curved: bl.roof === "irimoya",
      snow: M.snow, tint: bl.roof === "flat" ? tint : undefined, seed: b.seed + (isMain ? 0 : 99), butt, cap: M.R, accent: st.lang === "eastern" ? M.fm.dark : undefined,
      metal: M.fm.metal, mobile,
    };
    if (bl.roof === "gable" && st.lang !== "eastern" && hash3(b.seed + 41) < 0.35) ropts.accent = M.fm.lit;
    const info = roof(mb, ropts);
    roofs.push({ bl, info, rect });
    if (falseFront && isMain) falseFrontWall(ctx, p, M, rect, top, info.ridgeY);
    // Eastern: skirt roof at each upper floor line.
    if (st.lang === "eastern" && bl.floors > 1) for (let fl = 1; fl < bl.floors; fl++) skirt(mb, rect, bl.y0 + fl * bl.fh, M, mobile);
    void rw; void rd; void rcx; void rcz;
  }
  // ---- chimneys + dormers on the main roof ----
  mb.group = g(true);
  const mr = roofs[0]!;
  if (main.roof !== "flat" && main.roof !== "cone" && main.roof !== "pyramid" && r(21) < st.chimney) {
    const cxp = mr.rect.x0 + (mr.rect.x1 - mr.rect.x0) * (0.2 + r(22) * 0.6), czp = mr.bl.alongX ? (mr.rect.z0 + mr.rect.z1) / 2 - 0.5 : mr.rect.z0 + (mr.rect.z1 - mr.rect.z0) * 0.3;
    const yb = mr.info.at(cxp, czp) - 0.3;
    chimney(mb, cxp, czp, yb, Math.max(mr.info.ridgeY + 0.7, yb + 1.1), st.lang === "victorian" ? M.G : M.fm.stone, M.fm.stone, undefined, st.lang === "victorian" ? 3 : 2);
    if (p.kind === "workshop") light(ctx, [cxp, mr.info.ridgeY + 1, czp], [1, 0.5, 0.25], 3, 0.4, "forge");
  }
  if ((main.roof === "gable" || main.roof === "halfhip" || main.roof === "hip" || main.roof === "mansard") && main.alongX && (main.floors >= 2 || p.kind === "cottage") && r(23) < st.dormer && !mobile) {
    const n = mr.rect.x1 - mr.rect.x0 > 5 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const x = mr.rect.x0 + ((mr.rect.x1 - mr.rect.x0) * (i + 0.5)) / n;
      const zW = main.roof === "mansard" ? mr.rect.z1 - 0.3 : mr.rect.z1 - 0.55;
      const ys = main.roof === "mansard" ? mr.bl.y0 + mr.bl.floors * mr.bl.fh + 0.3 : mr.info.at(x, zW) + 0.05;
      dormer(mb, x, zW, ys, 0.95, main.roof === "mansard" ? 0.6 : 1.1, { wall: st.frame === "half" ? M.U : M.G, roof: M.R, trim: M.fm.frame, glass: M.fm.glass, lit: M.fm.lit }, r(24 + i) < 0.5, undefined, st.lang === "frontier");
    }
  }
  // Tribal gables: crossed poles over the ridge ends + a skull on the front gable.
  if (st.lang === "tribal" && main.roof === "gable") {
    const [R0, R1] = mr.info.ridge;
    for (const R of [R0, R1]) {
      const along = main.alongX ? 0 : 1;
      const out = (R === R1 ? 1 : -1) * 0.35;
      const ox = along ? 0 : out, oz = along ? out : 0;
      mb.beam([R[0] - (along ? 0.5 : 0) + ox * 0.2, R[1] - 0.5, R[2] - (along ? 0 : 0.5) + oz * 0.2], [R[0] + (along ? 0.35 : 0) + ox, R[1] + 0.7, R[2] + (along ? 0 : 0.35) + oz], 0.08, { layer: M.fm.wood });
      mb.beam([R[0] + (along ? 0.5 : 0) + ox * 0.2, R[1] - 0.5, R[2] + (along ? 0 : 0.5) + oz * 0.2], [R[0] - (along ? 0.35 : 0) + ox, R[1] + 0.7, R[2] - (along ? 0 : 0.35) + oz], 0.08, { layer: M.fm.wood });
    }
    if (p.kit.deco.includes("bones") && !mobile) {
      const f = R1Front(mr.info.ridge, main);
      mb.blob(f[0], f[1] - 0.9, f[2] + 0.1, 0.18, 0.15, 0.15, { layer: ctx.layer("paper"), tint: [1.05, 1.0, 0.9] });
      for (const sx of [-1, 1]) mb.beam([f[0] + sx * 0.1, f[1] - 0.85, f[2] + 0.12], [f[0] + sx * 0.55, f[1] - 0.4, f[2] + 0.1], 0.05, { layer: ctx.layer("paper"), tint: [1.05, 1.0, 0.9] });
    }
  }
  // ---- climbing ivy / roses near wall corners (leafy temperate languages only) ----
  const leafy = (ctx.flora ?? []).some((f) => f === "broadleaf" || f === "willow" || f === "birch" || f === "maple" || f === "pine");
  if (!mobile && leafy && ["medieval", "victorian", "mediterranean", "nordic", "frontier"].includes(st.lang) && r(61) < 0.5) {
    const ivy = ctx.layer("leafcard"), rose = ctx.layer("flowers");
    const n = r(62) < 0.4 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const side = i === 0 ? "s" : r(63) < 0.5 ? "e" : "w";
      const hw = (main.x1 - main.x0) / 2, hd = (main.z1 - main.z0) / 2;
      const P = wallP(side, hw, hd, (main.x0 + main.x1) / 2, (main.z0 + main.z1) / 2);
      const half = side === "s" ? hw : hd, sgn = r(64 + i) < 0.5 ? -1 : 1;
      const u = sgn * (half - 0.35 - r(66 + i) * 0.3);
      if (side === "s" && Math.abs(u - frontDoorU) < frontDoorW / 2 + 0.7) continue;
      const top = Math.min(main.floors * main.fh - 0.2, 1.6 + r(68 + i) * 2.6), y0 = main.y0;
      const rows = Math.max(2, Math.round(top / 0.9));
      for (let k = 0; k < rows; k++) {
        const f = k / rows, w = 1.25 * (1 - f * 0.55) + r(70 + k) * 0.25, du = (r(80 + k + i * 9) - 0.5) * 0.3;
        wq(mb, P, u + du - w / 2, u + du + w / 2, y0 + (top * k) / rows - 0.08, y0 + (top * (k + 1)) / rows + 0.12, 0.05 + k * 0.004, { layer: ivy, tint: [0.92, 0.98, 0.88], uvs: [[0.05, 0.95], [0.95, 0.95], [0.95, 0.05], [0.05, 0.05]] });
      }
      if (st.lang === "mediterranean" || r(90 + i) < 0.3) wq(mb, P, u - 0.45, u + 0.45, y0 + top * 0.35, y0 + top * 0.35 + 0.7, 0.075, { layer: rose, uvs: [[0.05, 0.95], [0.95, 0.95], [0.95, 0.05], [0.05, 0.05]] });
    }
  }
  // ---- iron fire escapes on urban walk-ups (landings with railings + switchback stairs + drop ladder) ----
  if (st.lang === "urban" && main.floors >= 2 && !mobile && r(95) < 0.8) {
    // Put it on the wall that faces the camera (world +z) for this facing; south-facing lots use a flank.
    const side: Side = b.facing === "e" ? "w" : b.facing === "w" ? "e" : b.facing === "n" ? "n" : r(96) < 0.5 ? "e" : "w";
    const hw = (main.x1 - main.x0) / 2, hd = (main.z1 - main.z0) / 2;
    const P = wallP(side, hw, hd, (main.x0 + main.x1) / 2, (main.z0 + main.z1) / 2);
    const iron: FaceOpts = { layer: M.fm.metal, tint: [0.42, 0.4, 0.4] };
    const len = side === "n" ? hw * 2 : hd * 2;
    const span = Math.min(2.2, len - 0.6), u0 = -span / 2 + (r(97) - 0.5) * 0.3, u1 = u0 + span, dep = 0.85;
    const across = side === "n" ? [0.18, 0.5] : [0.5, 0.18];
    for (let fl = 1; fl < main.floors; fl++) {
      const v = main.y0 + fl * main.fh + 0.02;
      wbox(mb, P, u0, u1, v - 0.07, v, 0, dep, iron, "ftblr");
      for (const uu of [u0, u1]) { wbox(mb, P, uu - 0.025, uu + 0.025, v, v + 0.92, dep - 0.05, dep, iron, "flr"); wbox(mb, P, uu - 0.02, uu + 0.02, v + 0.86, v + 0.9, 0, dep, iron, "tlr"); }
      wbox(mb, P, u0, u1, v + 0.86, v + 0.92, dep - 0.05, dep, iron, "ftb");
      wbox(mb, P, u0, u1, v + 0.44, v + 0.47, dep - 0.04, dep, iron, "ft");
      for (let k = 1; k < 8; k++) { const uu = u0 + (span * k) / 8; wbox(mb, P, uu - 0.012, uu + 0.012, v, v + 0.86, dep - 0.03, dep - 0.01, iron, "f"); }
      const vb = fl > 1 ? v - main.fh : v - 1.3;
      if (fl > 1) {
        for (const dt of [-0.24, 0.24]) mb.beam(P(u0 + 0.2, v, dep * 0.5 + dt), P(u1 - 0.3, vb, dep * 0.5 + dt), 0.05, iron);
        const nStep = 9;
        for (let k = 1; k < nStep; k++) { const t = k / nStep, c = P(u0 + 0.2 + (u1 - u0 - 0.5) * t, v + (vb - v) * t, dep * 0.5); mb.box(c[0], c[1] - 0.02, c[2], across[0]!, 0.03, across[1]!, iron); }
      } else for (const du of [0.25, 0.65]) wbox(mb, P, u1 - du - 0.02, u1 - du + 0.02, vb, v, dep - 0.12, dep - 0.08, iron, "flr");
    }
  }
  // ---- porch / gallery ----
  if (p.porch) porch(ctx, p, M, main, frontDoorU);
  if (p.bay) bayWindow(ctx, p, M, main);
  if (p.kind === "chapel") bellCote(ctx, p, M, main, roofs[0]!.info.ridgeY);
  // ---- front door dressing ----
  mb.group = g(false);
  const PF = wallP("s", (main.x1 - main.x0) / 2, (main.z1 - main.z0) / 2, (main.x0 + main.x1) / 2, (main.z0 + main.z1) / 2);
  const lotFront = D / 2;
  if (!p.porch) steps(mb, (main.x0 + main.x1) / 2 + frontDoorU, lotFront + 0.02, frontDoorW + 0.2, plinthTop, M.fm.stone, 0.5);
  else steps(mb, (main.x0 + main.x1) / 2 + frontDoorU, lotFront + 0.02, 1.4, plinthTop, st.mat.P === "a_wood" ? M.fm.wood : M.fm.stone, 0.5);
  const dv = frontDoorV + doorTop;
  const wantAwning = !p.porch && (shopSpan !== null ? r(31) < st.awning + 0.3 : r(31) < st.awning * 0.6);
  if (wantAwning && st.lang !== "eastern") {
    const [a0, a1] = shopSpan ?? [frontDoorU - frontDoorW / 2 - 0.25, frontDoorU + frontDoorW / 2 + 0.25];
    awning(mb, PF, a0 - 0.1, a1 + 0.1, dv + 0.42, shopSpan ? 1.1 : 0.8, 0.45, st.lang === "urban" || st.lang === "industrial" ? M.awning : r(32) < 0.7 ? M.awning : M.fm.cloth, M.fm.metal);
  }
  // Fascia sign board over shopfronts (western / victorian / urban).
  if (shopSpan && (st.lang === "victorian" || st.lang === "frontier" || st.lang === "urban" || st.lang === "mediterranean" || st.lang === "industrial")) {
    const [a0, a1] = shopSpan;
    const sv = dv + (wantAwning ? 0.5 : 0.12);
    wbox(mb, PF, a0 - 0.15, a1 + 0.15, sv, sv + 0.42, 0, 0.1, { layer: M.fm.frame }, "ftblr");
    const neonSign = st.sign === "neon";
    const q = Math.floor(r(33) * 4);
    wq(mb, PF, a0 - 0.05, a1 + 0.05, sv + 0.06, sv + 0.36, 0.105, neonSign ? { layer: M.neon, emissive: 1, uvs: [[0, 0.5], [1, 0.5], [1, 0.28], [0, 0.28]] } : { layer: M.sign, uvs: [[(q % 2) * 0.5 + 0.06, Math.floor(q / 2) * 0.5 + 0.34], [(q % 2) * 0.5 + 0.44, Math.floor(q / 2) * 0.5 + 0.34], [(q % 2) * 0.5 + 0.44, Math.floor(q / 2) * 0.5 + 0.16], [(q % 2) * 0.5 + 0.06, Math.floor(q / 2) * 0.5 + 0.16]] });
  }
  // Signs by language.
  const shopish = b.enterable || b.role === "shop" || p.kind === "shop" || p.kind === "inn" || p.kind === "teahouse";
  const signQ = p.kind === "inn" || p.kind === "teahouse" ? 0 : Math.floor(r(34) * 4);
  const du = frontDoorU;
  const hwM = (main.x1 - main.x0) / 2;
  const sideU = du + frontDoorW / 2 + 0.45 < hwM - 0.2 ? du + frontDoorW / 2 + 0.45 : du - frontDoorW / 2 - 0.45;
  if (shopish || r(35) < 0.25) {
    if (st.sign === "shield" || (st.sign === "board" && !shopSpan)) hangSign(mb, PF, sideU, dv + 0.55, M.sign, M.fm.metal, signQ, st.sign === "shield");
    else if (st.sign === "noren" || (st.lang === "eastern" && shopish)) noren(mb, PF, du - frontDoorW / 2, du + frontDoorW / 2, dv - 0.02, M.fm.cloth, M.fm.dark);
    else if (st.sign === "neon") neonBox(ctx, PF, hwM - 0.35, frontDoorV + 2.4, 1.4, M.neon, M.fm.metal);
    else if (st.sign === "banner") banner(mb, PF, sideU, dv + 0.6, 1.4, M.fm.cloth, M.fm.wood);
    if (st.lang === "eastern" && !mobile) {
      // Wooden plaque above the door.
      wbox(mb, PF, du - 0.55, du + 0.55, dv + 0.2, dv + 0.55, 0, 0.08, { layer: M.fm.dark }, "ftblr");
      wq(mb, PF, du - 0.45, du + 0.45, dv + 0.26, dv + 0.49, 0.085, { layer: M.fm.brass, tint: [0.9, 0.8, 0.5] });
    }
  }
  // Lamps.
  if (st.lamp === "lantern" || st.lamp === "sconce") lantern(ctx, PF, du + (sideU > du ? -1 : 1) * (frontDoorW / 2 + 0.3), frontDoorV + 2.25, { metal: M.fm.metal, lit: M.fm.lit });
  else if (st.lamp === "paper") {
    const hang = (u: number) => { const pp = PF(u, frontDoorV + doorTop + 0.55, 0.45); paperLantern(ctx, pp, M.fm.cloth, M.fm.dark, 0.19); };
    hang(du - frontDoorW / 2 - 0.35); if (!mobile) hang(du + frontDoorW / 2 + 0.35);
  } else if (st.lamp === "torch") {
    const pp = PF(du - frontDoorW / 2 - 0.3, frontDoorV + 1.6, 0.2);
    mb.beam([pp[0], pp[1] - 0.5, pp[2] - 0.15], [pp[0], pp[1], pp[2]], 0.06, { layer: M.fm.wood });
    mb.box(pp[0], pp[1], pp[2], 0.14, 0.22, 0.14, { layer: M.fm.lit, emissive: 1, tint: [1, 0.7, 0.4] });
    light(ctx, [pp[0], pp[1] + 0.2, pp[2]], [1, 0.55, 0.25], 4.5, 0.9, "torch");
  } else if (st.lamp === "neon" && !shopSpan) lantern(ctx, PF, du - frontDoorW / 2 - 0.3, frontDoorV + 2.3, { metal: M.fm.metal, lit: M.fm.lit }, 4.5);
  // Urban AC units + drain pipe.
  if (st.lang === "urban" && !mobile) {
    const PE = wallP("e", (main.x1 - main.x0) / 2, (main.z1 - main.z0) / 2, (main.x0 + main.x1) / 2, (main.z0 + main.z1) / 2);
    for (let fl = 1; fl < main.floors; fl++) if (r(50 + fl) < 0.7) acUnit(mb, PE, (r(60 + fl) - 0.5) * ((main.z1 - main.z0) - 1.2), main.y0 + fl * main.fh + 0.3, M.cm);
  }
  if ((st.lang === "victorian" || st.lang === "urban" || st.lang === "mediterranean") && !mobile) {
    const x = main.x1 - 0.12, z = main.z1 + 0.06, topY = main.y0 + main.floors * main.fh;
    mb.cyl(x, 0.2, z, 0.05, 0.05, topY - 0.2, 6, { layer: M.fm.metal, tint: [0.7, 0.72, 0.75] }, false);
  }
  // ---- clutter beside the facade ----
  if (!mobile && st.clutter.length) {
    const n = 1 + Math.floor(r(70) * 2.2);
    for (let i = 0; i < n; i++) {
      const kind = st.clutter[Math.floor(r(71 + i) * st.clutter.length)]!;
      const side = r(80 + i) < 0.5 ? -1 : 1;
      const u = side < 0 ? -hwM + 0.45 + r(90 + i) * 0.3 : hwM - 0.45 - r(90 + i) * 0.3;
      if (Math.abs(u - du) < frontDoorW / 2 + 0.7) continue;
      const zc = p.porch ? D / 2 - 0.45 : D / 2 + 0.28;
      if (kind === "rail" || kind === "trough" || kind === "bench") { if (!p.porch && kind !== "bench") continue; }
      clutter(mb, kind, (main.x0 + main.x1) / 2 + u, p.porch ? plinthTop : 0, zc, M.cm, b.seed + i * 17, M.water);
    }
  }
  // ---- ruin dressing (rubble at the wall foot) ----
  if (st.ruin > 0 && r(100) < st.ruin && !mobile) {
    for (let i = 0; i < 5; i++) {
      const x = (r(101 + i) - 0.5) * (W - 0.6), z = D / 2 + 0.2 + r(111 + i) * 0.25;
      mb.blob(x, 0.05, z, 0.25 + r(121 + i) * 0.2, 0.14, 0.2, { layer: M.fm.stone, tint: [0.85, 0.83, 0.8] }, 0, 0.3, b.seed + i);
    }
  }
  if (b.enterable) interior(ctx, p, main);
}

const ctxLayer = (ctx: Ctx, id: string) => ctx.layer(id);
/** Front-most ridge end (largest z). */
const R1Front = (ridge: [V3, V3], _main: Block): V3 => (ridge[0][2] > ridge[1][2] ? ridge[0] : ridge[1]);

/** Opening layout per storey / side. */
function layout(p: Plan, bl: Block, side: Side, fl: number, len: number, isMain: boolean, falseFront: boolean): Op[] {
  const st = p.st, b = p.b, r = p.r;
  const ops: Op[] = [];
  const fh = bl.fh;
  const key = fl * 100 + ["s", "e", "n", "w"].indexOf(side) * 1000 + (isMain ? 0 : 5000);
  const lit = (i: number) => r(key + 300 + i) < 0.5;
  const ruin = st.ruin > 0 && r(key + 7) < st.ruin;
  const tall = p.kind === "tower";
  const winKind = fl === 0 ? st.win : st.winU;
  const head = (k: string): Op["head"] => (k === "arch" ? "round" : k === "segment" ? "segment" : k === "pointed" ? "pointed" : "flat");
  const mkWin = (u: number, w: number, i: number, extra: Partial<Op> = {}): Op => {
    const k = tall && fl > 0 ? (st.lang === "eastern" ? "lattice" : r(key + i) < 0.5 ? "slit" : winKind) : winKind;
    let wW = w, v0 = st.sill, v1 = Math.min(fh - 0.28, st.sill + st.winH);
    if (k === "slit") { wW = 0.28; v0 = 0.7; v1 = Math.min(fh - 0.4, 1.9); }
    if (k === "strip") { v0 = Math.max(st.sill, fh - 1.35); v1 = fh - 0.3; }
    const lattice = k === "lattice";
    const round = k === "round";
    if (round) { wW = Math.min(w, 0.85); v0 = fh * 0.5 - wW / 2 + 0.1; v1 = v0 + wW; }
    return {
      u, w: wW, v0, v1, kind: "win", head: round ? "round" : head(k), round, lit: lit(i), lattice,
      shutters: !lattice && !round && k !== "strip" && k !== "slit" && r(key + 40 + i) < st.shutters,
      box: fl > 0 && !lattice && k !== "strip" && r(key + 60 + i) < st.flowers,
      boarded: ruin && r(key + 80 + i) < 0.55,
      mull: k === "strip" ? "grid" : st.mull,
      ...extra,
    };
  };
  if (side === "s" && isMain) {
    let n = Math.max(1, Math.floor((len - 0.3) / st.bayW));
    if (tall) n = Math.max(1, Math.min(2, n));
    const bay = len / n;
    const U = (i: number) => -len / 2 + bay * (i + 0.5);
    if (fl === 0) {
      const shop = (st.shopfront || b.role === "shop") && len >= 3.2;
      const arcade = !shop && !b.enterable && st.arcade > 0 && r(key + 3) < st.arcade && bay >= 1.4 && fh >= 2.7;
      let doorBay = n === 1 ? 0 : n % 2 === 1 ? (r(key + 4) < 0.7 ? (n - 1) / 2 : r(key + 5) < 0.5 ? 0 : n - 1) : n / 2 - (r(key + 4) < 0.5 ? 1 : 0);
      if (shop && n >= 2) doorBay = r(key + 4) < 0.5 ? 0 : n - 1;
      if (p.bay && doorBay === p.bay.i) doorBay = p.bay.i === 0 ? Math.min(n - 1, 1) : n - 2;
      const dk = st.door;
      const dW = dk === "double" || dk === "sliding" || dk === "rollup" ? Math.min(bay - 0.3, dk === "rollup" ? 2.2 : 1.45) : Math.min(bay - 0.3, 1.05);
      const dTop = Math.min(fh - 0.22, st.doorArch ? 2.5 : 2.2);
      for (let i = 0; i < n; i++) {
        const u = U(i);
        if (i === doorBay) {
          const dh: Op["head"] = st.doorArch && dk !== "rollup" && dk !== "glass" ? (st.lang === "victorian" ? "segment" : st.lang === "arcane" || st.lang === "classical" && p.kind === "chapel" ? "pointed" : "round") : "flat";
          ops.push({ u, w: n === 1 && shop ? Math.min(1.05, dW) : dW, v0: 0, v1: dTop, kind: "door", head: dh, door: dk, open: b.enterable, lit: lit(i), transom: dh === "flat" && (st.lang === "victorian" || st.lang === "mediterranean") });
          if (n === 1 && shop && len >= 3.2) { ops[ops.length - 1]!.u = -len / 2 + 0.75; ops.push({ u: 0.55, w: len - 2.4, v0: 0.55, v1: Math.min(fh - 0.35, 2.25), kind: "shop", head: "flat", lit: lit(9) }); }
        } else if (p.bay && i === p.bay.i) continue;
        else if (arcade) ops.push({ u, w: bay - 0.4, v0: 0, v1: Math.min(fh - 0.2, 2.55), kind: "arcade", head: "round" });
        else if (shop) ops.push({ u, w: bay - 0.32, v0: 0.55, v1: Math.min(fh - 0.35, 2.25), kind: "shop", head: "flat", lit: lit(i), boarded: ruin && r(key + 90 + i) < 0.5 });
        else ops.push(mkWin(u, Math.min(bay - 0.4, st.winW), i));
      }
      void falseFront;
    } else {
      const balBay = r(key + 6) < st.balcony ? Math.floor(r(key + 8) * n) : -1;
      for (let i = 0; i < n; i++) {
        const u = U(i);
        if (p.bay && i === p.bay.i && fl < p.bay.floors) continue;
        if (i === balBay && !tall) {
          const w = Math.min(bay - 0.4, st.lang === "urban" ? 1.4 : 0.95);
          ops.push({ u, w, v0: 0, v1: Math.min(fh - 0.3, 2.25), kind: "french", head: st.winU === "arch" ? "round" : st.winU === "segment" ? "segment" : "flat", lit: lit(i), lattice: st.win === "lattice", balcony: st.lang === "mediterranean" || st.lang === "classical" ? (r(key + 9) < 0.5 ? "stone" : "iron") : st.lang === "victorian" || st.lang === "urban" ? "iron" : "wood", shutters: r(key + 10) < st.shutters, mull: st.mull });
        } else ops.push(mkWin(u, Math.min(bay - 0.4, st.winW), i));
      }
    }
    return ops;
  }
  // Sides / back / wing faces.
  const spacing = st.lang === "eastern" ? 1.8 : 1.9;
  const n = Math.max(1, Math.floor((len - 0.5) / spacing));
  const bay = len / n;
  const presence = side === "n" ? 0.55 : 0.7;
  for (let i = 0; i < n; i++) {
    const u = -len / 2 + bay * (i + 0.5);
    if (!isMain && side === "s" && fl === 0 && i === Math.floor(n / 2)) {
      ops.push({ u, w: Math.min(bay - 0.3, 1.0), v0: 0, v1: Math.min(fh - 0.25, 2.15), kind: "door", head: "flat", door: st.door === "rollup" ? "rollup" : st.door === "sliding" ? "sliding" : "plank", lit: lit(i) });
      continue;
    }
    if (side === "n" && fl === 0 && b.backY !== null && i === 0) {
      ops.push({ u, w: 1.0, v0: Math.max(0, b.backY - (bl.y0 + b.baseY) - bl.y0), v1: Math.min(fh - 0.25, 2.2), kind: "door", head: "flat", door: "plank" });
      continue;
    }
    if (r(key + 200 + i) < presence) ops.push(mkWin(u, Math.min(bay - 0.5, st.winW * (st.lang === "eastern" ? 0.9 : 1)), i + 20));
  }
  return ops;
}

/** Lacquered post-and-beam frame (eastern): columns between bays, lintel, wainscot. */
function postFrame(mb: MeshBuilder, P: WallP, len: number, y0: number, y1: number, ops: Op[], M: Mats, ground: boolean) {
  const cols: number[] = [-len / 2 + 0.1, len / 2 - 0.1];
  const sorted = [...ops].sort((a, b) => a.u - b.u);
  for (let i = 0; i < sorted.length - 1; i++) cols.push((sorted[i]!.u + sorted[i]!.w / 2 + sorted[i + 1]!.u - sorted[i + 1]!.w / 2) / 2);
  for (const u of cols) wbox(mb, P, u - 0.1, u + 0.1, y0, y1, -0.02, 0.1, { layer: M.F }, "flr");
  wbox(mb, P, -len / 2, len / 2, y1 - 0.24, y1, 0, 0.12, { layer: M.F }, "ftb");
  if (ground) wbox(mb, P, -len / 2, len / 2, y0, y0 + 0.14, 0, 0.06, { layer: M.fm.dark }, "ft");
}

/** Cornice at the wall top by style. */
function cornice(mb: MeshBuilder, st: Style, M: Mats, rc: { x0: number; x1: number; z0: number; z1: number }, top: number, roofKind: string, mobile: boolean, seed: number) {
  const W = rc.x1 - rc.x0, D = rc.z1 - rc.z0, cx = (rc.x0 + rc.x1) / 2, cz = (rc.z0 + rc.z1) / 2;
  if (st.cornice === "none" || roofKind === "flat" && st.lang !== "mediterranean" && st.lang !== "classical" && st.lang !== "victorian") {
    if (roofKind !== "flat") mb.box(cx, top - 0.14, cz, W + 0.04, 0.14, D + 0.04, { layer: st.lang === "eastern" ? M.F : M.T }, "nsew");
    return;
  }
  if (st.cornice === "timber") { mb.box(cx, top - 0.16, cz, W + 0.06, 0.16, D + 0.06, { layer: M.F }, "nsew"); return; }
  mb.bevelBox(cx, top - 0.2, cz, W + 0.14, 0.2, D + 0.14, 0.04, { layer: M.T });
  if (st.cornice === "dentil" && !mobile) {
    const n = Math.max(4, Math.round(W / 0.22));
    for (let i = 0; i < n; i++) { const x = rc.x0 + 0.1 + ((W - 0.2) * i) / (n - 1); mb.box(x, top - 0.32, rc.z1 + 0.04, 0.09, 0.12, 0.09, { layer: M.T }); mb.box(x, top - 0.32, rc.z0 - 0.04, 0.09, 0.12, 0.09, { layer: M.T }); }
    const m = Math.max(3, Math.round(D / 0.22));
    for (let i = 0; i < m; i++) { const z = rc.z0 + 0.1 + ((D - 0.2) * i) / (m - 1); mb.box(rc.x1 + 0.04, top - 0.32, z, 0.09, 0.12, 0.09, { layer: M.T }); mb.box(rc.x0 - 0.04, top - 0.32, z, 0.09, 0.12, 0.09, { layer: M.T }); }
  }
  if (st.cornice === "bracket" && !mobile) {
    const n = Math.max(2, Math.round(W / 0.8));
    for (let i = 0; i <= n; i++) {
      const x = rc.x0 + 0.1 + ((W - 0.2) * i) / n;
      mb.box(x, top - 0.5, rc.z1 + 0.05, 0.1, 0.32, 0.1, { layer: M.T });
      mb.box(x, top - 0.28, rc.z1 + 0.08, 0.1, 0.1, 0.16, { layer: M.T });
    }
  }
  void seed;
}

/** Frontier false front: tall parapet facade hiding the gable, cornice with brackets, painted sign. */
function falseFrontWall(ctx: Ctx, p: Plan, M: Mats, rc: { x0: number; x1: number; z0: number; z1: number }, top: number, ridgeY: number) {
  const mb = ctx.mb, r = p.r, W = rc.x1 - rc.x0, z = rc.z1;
  const h = ridgeY - top + 0.55 + r(140) * 0.4;
  const stepped = r(141) < 0.5;
  const P = wallP("s", W / 2, (rc.z1 - rc.z0) / 2, (rc.x0 + rc.x1) / 2, (rc.z0 + rc.z1) / 2);
  const wallO: FaceOpts = { layer: M.U, tint: p.tint as V3 };
  if (stepped) {
    wq(mb, P, -W / 2, W / 2, top, top + h * 0.7, 0, wallO);
    wq(mb, P, -W / 2 + 0.6, W / 2 - 0.6, top + h * 0.7, top + h, 0, wallO);
    wbox(mb, P, -W / 2, W / 2, top, top + h * 0.7, -0.14, 0, wallO, "tlr");
    mb.quad(P(W / 2, top, -0.14), P(-W / 2, top, -0.14), P(-W / 2, top + h * 0.7, -0.14), P(W / 2, top + h * 0.7, -0.14), { layer: M.U, tint: [0.7, 0.7, 0.7] });
    mb.quad(P(W / 2 - 0.6, top + h * 0.7, -0.14), P(-W / 2 + 0.6, top + h * 0.7, -0.14), P(-W / 2 + 0.6, top + h, -0.14), P(W / 2 - 0.6, top + h, -0.14), { layer: M.U, tint: [0.7, 0.7, 0.7] });
    wbox(mb, P, -W / 2 + 0.6, W / 2 - 0.6, top + h * 0.7, top + h, -0.14, 0, wallO, "lr");
    wbox(mb, P, -W / 2 - 0.08, W / 2 + 0.08, top + h * 0.7 - 0.02, top + h * 0.7 + 0.1, -0.2, 0.12, { layer: M.T }, "ftblr");
    wbox(mb, P, -W / 2 + 0.52, W / 2 - 0.52, top + h - 0.02, top + h + 0.12, -0.2, 0.14, { layer: M.T }, "ftblr");
  } else {
    wq(mb, P, -W / 2, W / 2, top, top + h, 0, wallO);
    mb.quad(P(W / 2, top, -0.14), P(-W / 2, top, -0.14), P(-W / 2, top + h, -0.14), P(W / 2, top + h, -0.14), { layer: M.U, tint: [0.7, 0.7, 0.7] });
    wbox(mb, P, -W / 2, W / 2, top, top + h, -0.14, 0, wallO, "lr");
    wbox(mb, P, -W / 2 - 0.1, W / 2 + 0.1, top + h - 0.02, top + h + 0.14, -0.22, 0.16, { layer: M.T }, "ftblr");
    for (let i = 0; i <= Math.round(W / 0.7); i++) { const u = -W / 2 + 0.1 + ((W - 0.2) * i) / Math.round(W / 0.7); wbox(mb, P, u - 0.05, u + 0.05, top + h - 0.3, top + h - 0.02, 0, 0.12, { layer: M.T }, "ftlr"); }
  }
  // Painted sign board on the parapet.
  const sw = Math.min(W - 1.0, 3.2), sy = top + 0.18, sh = Math.min(0.75, h * 0.55);
  wbox(mb, P, -sw / 2 - 0.06, sw / 2 + 0.06, sy - 0.06, sy + sh + 0.06, 0, 0.06, { layer: M.T }, "ftblr");
  const q = Math.floor(r(142) * 4);
  const neon = p.st.sign === "neon";
  wq(mb, P, -sw / 2, sw / 2, sy, sy + sh, 0.065, neon ? { layer: M.neon, emissive: 1, uvs: [[0, 0.95], [1, 0.95], [1, 0.55], [0, 0.55]] } : { layer: M.sign, uvs: [[(q % 2) * 0.5 + 0.05, Math.floor(q / 2) * 0.5 + 0.45], [(q % 2) * 0.5 + 0.45, Math.floor(q / 2) * 0.5 + 0.45], [(q % 2) * 0.5 + 0.45, Math.floor(q / 2) * 0.5 + 0.05], [(q % 2) * 0.5 + 0.05, Math.floor(q / 2) * 0.5 + 0.05]] });
  void z;
}

/** Eastern pent-roof skirt around a storey line with upturned corners. */
function skirt(mb: MeshBuilder, rc: { x0: number; x1: number; z0: number; z1: number }, y: number, M: Mats, mobile: boolean) {
  const e = 0.72, up = 0.18, h = 0.42;
  const x0 = rc.x0, x1 = rc.x1, z0 = rc.z0, z1 = rc.z1;
  const i = [[x0, y + h, z1], [x1, y + h, z1], [x1, y + h, z0], [x0, y + h, z0]] as V3[];
  const o = [[x0 - e, y + up, z1 + e], [x1 + e, y + up, z1 + e], [x1 + e, y + up, z0 - e], [x0 - e, y + up, z0 - e]] as V3[];
  const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, y - 0.02, (a[2] + b[2]) / 2];
  for (let k = 0; k < 4; k++) {
    const k2 = (k + 1) % 4;
    // Outer edge dips in the middle (curved eave): two quads per side.
    const m = mid(o[k]!, o[k2]!), mi: V3 = [(i[k]![0] + i[k2]![0]) / 2, y + h, (i[k]![2] + i[k2]![2]) / 2];
    quadOut(mb, o[k]!, m, mi, i[k]!, [0, 1, 0], { layer: M.R });
    quadOut(mb, m, o[k2]!, i[k2]!, mi, [0, 1, 0], { layer: M.R });
    mb.beam([o[k]![0], o[k]![1] - 0.06, o[k]![2]], [m[0], m[1] - 0.06, m[2]], 0.1, { layer: M.fm.dark });
    mb.beam([m[0], m[1] - 0.06, m[2]], [o[k2]![0], o[k2]![1] - 0.06, o[k2]![2]], 0.1, { layer: M.fm.dark });
    if (!mobile) { quadOut(mb, [o[k]![0], o[k]![1] - 0.08, o[k]![2]], [m[0], m[1] - 0.08, m[2]], [mi[0], mi[1] - 0.12, mi[2]], [i[k]![0], i[k]![1] - 0.12, i[k]![2]], [0, -1, 0], { layer: M.F, tint: [0.6, 0.6, 0.6] }); quadOut(mb, [m[0], m[1] - 0.08, m[2]], [o[k2]![0], o[k2]![1] - 0.08, o[k2]![2]], [i[k2]![0], i[k2]![1] - 0.12, i[k2]![2]], [mi[0], mi[1] - 0.12, mi[2]], [0, -1, 0], { layer: M.F, tint: [0.6, 0.6, 0.6] }); }
  }
  // Hip caps at the corners.
  for (let k = 0; k < 4; k++) mb.beam([i[k]![0], i[k]![1] + 0.04, i[k]![2]], [o[k]![0], o[k]![1] + 0.1, o[k]![2]], 0.12, { layer: M.R, tint: [0.75, 0.75, 0.8] });
}

/** Front porch (posts, deck rail, shed roof) or two-storey gallery with a railing. */
function porch(ctx: Ctx, p: Plan, M: Mats, main: Block, doorU: number) {
  const mb = ctx.mb, st = p.st, pr = p.porch!, mobile = ctx.quality === "mobile";
  const zw = main.z1, zf = p.D / 2, x0 = pr.x0, x1 = pr.x1;
  const y = st.plinth;
  const eastern = st.lang === "eastern";
  const postL = eastern ? M.F : st.lang === "frontier" || st.lang === "nordic" ? M.paint : M.fm.wood;
  const n = Math.max(2, Math.round((x1 - x0) / 1.9));
  const gallery = pr.gallery && main.floors >= 2;
  const topY = gallery ? main.y0 + main.fh * 2 - 0.1 : main.y0 + Math.min(main.fh, 2.75);
  mb.group = `b:${p.b.id}`;
  const doorX = (main.x0 + main.x1) / 2 + doorU;
  for (let i = 0; i <= n; i++) {
    const x = x0 + 0.12 + ((x1 - x0 - 0.24) * i) / n;
    if (eastern) mb.cyl(x, y, zf - 0.14, 0.1, 0.1, topY - y + (gallery ? 0 : 0.2), 8, { layer: postL });
    else {
      mb.box(x, y, zf - 0.14, 0.15, topY - y, 0.15, { layer: postL });
      if (!mobile) { mb.beam([x, topY - 0.45, zf - 0.14], [x + 0.3 * (i === n ? -1 : 1), topY - 0.08, zf - 0.14], 0.07, { layer: postL }); }
    }
    mb.box(x, y, zf - 0.14, 0.22, 0.1, 0.22, { layer: M.fm.stone });
  }
  // Rail between posts except at the door.
  if (!eastern && !mobile) for (let i = 0; i < n; i++) {
    const xa = x0 + 0.12 + ((x1 - x0 - 0.24) * i) / n, xb = x0 + 0.12 + ((x1 - x0 - 0.24) * (i + 1)) / n;
    if (doorX > xa - 0.3 && doorX < xb + 0.3) continue;
    mb.box((xa + xb) / 2, y + 0.82, zf - 0.14, xb - xa, 0.06, 0.07, { layer: postL });
    const k = Math.max(3, Math.round((xb - xa) / 0.16));
    for (let j = 1; j < k; j++) mb.box(xa + ((xb - xa) * j) / k, y + 0.06, zf - 0.14, 0.04, 0.76, 0.04, { layer: postL });
  }
  if (eastern) {
    // Engawa deck edge + stone step stones.
    mb.box((x0 + x1) / 2, y - 0.04, zf - (zf - zw) / 2, x1 - x0, 0.08, zf - zw, { layer: M.fm.wood }, "tnsew");
    return;
  }
  // Beam on the posts.
  mb.box((x0 + x1) / 2, topY - 0.16, zf - 0.14, x1 - x0, 0.16, 0.16, { layer: postL });
  if (gallery) {
    // Gallery deck at the second floor with balusters, plus a shed roof over it.
    const gy = main.y0 + main.fh;
    mb.box((x0 + x1) / 2, gy - 0.12, (zw + zf) / 2, x1 - x0, 0.12, zf - zw, { layer: M.fm.wood }, "tnsew", { layer: M.fm.wood });
    mb.box((x0 + x1) / 2, gy - 0.28, zf - 0.1, x1 - x0, 0.16, 0.12, { layer: postL });
    if (!mobile) {
      const k = Math.max(6, Math.round((x1 - x0) / 0.17));
      for (let j = 0; j <= k; j++) mb.box(x0 + 0.1 + ((x1 - x0 - 0.2) * j) / k, gy, zf - 0.12, 0.045, 0.85, 0.045, { layer: postL });
    }
    mb.box((x0 + x1) / 2, gy + 0.85, zf - 0.12, x1 - x0, 0.07, 0.1, { layer: postL });
  }
  // Shed roof from the wall to the posts.
  const yb = topY + 0.35, yf = topY + 0.02;
  roof(mb, { x0, x1, z0: zw, z1: zf - 0.14, y: yf, kind: "shed", pitch: (yb - yf) / Math.max(0.3, zf - 0.14 - zw), eave: [0.35, 0, 0.12, 0.12], alongX: true, mat: st.lang === "frontier" ? ctx.layer("a_corr") : M.R, trim: postL, gable: M.U, soffit: M.fm.wood, seed: p.b.seed + 7, snow: M.snow, mobile });
}

/** Projecting bay window stack with its own small hip roof. */
function bayWindow(ctx: Ctx, p: Plan, M: Mats, main: Block) {
  const mb = ctx.mb, st = p.st, mobile = ctx.quality === "mobile";
  const mw = main.x1 - main.x0, n = Math.max(1, Math.floor((mw - 0.3) / st.bayW)), bay = mw / n;
  const cx = main.x0 + bay * (p.bay!.i + 0.5), bw = Math.min(bay - 0.2, 1.9), dep = 0.6, z0 = main.z1, z1 = main.z1 + dep;
  mb.group = `b:${p.b.id}`;
  const top = main.y0 + p.bay!.floors * main.fh;
  mb.bevelBox(cx, 0, (z0 + z1) / 2, bw + 0.14, main.y0, dep + 0.07, 0.03, { layer: M.fm.stone });
  for (let fl = 0; fl < p.bay!.floors; fl++) {
    const y0 = main.y0 + fl * main.fh, y1 = y0 + main.fh;
    for (const side of ["s", "e", "w"] as const) {
      const P = wallP(side, bw / 2, dep / 2, cx, (z0 + z1) / 2);
      const len = side === "s" ? bw : dep;
      const ops: Op[] = side === "s" ? [{ u: 0, w: bw - 0.5, v0: st.sill, v1: Math.min(main.fh - 0.3, st.sill + st.winH), kind: "win", head: "flat", lit: p.r(900 + fl) < 0.55, mull: "vert", depth: 0.12 }]
        : [{ u: 0, w: Math.min(0.34, len - 0.2), v0: st.sill, v1: Math.min(main.fh - 0.3, st.sill + st.winH), kind: "win", head: "flat", lit: p.r(910 + fl) < 0.55, mull: "none", depth: 0.08 }];
      facade(mb, { P, u0: -len / 2, u1: len / 2, y0, y1, ops, wall: { layer: fl === 0 ? M.G : M.U, tint: p.tint as V3 }, mats: M.fm, st: { ...st, surround: "frame" }, seed: p.b.seed + fl, mobile });
    }
    if (fl > 0) mb.box(cx, y0 - 0.08, (z0 + z1) / 2, bw + 0.1, 0.14, dep + 0.06, { layer: M.T });
  }
  mb.bevelBox(cx, top - 0.16, (z0 + z1) / 2, bw + 0.16, 0.18, dep + 0.1, 0.03, { layer: M.T });
  roof(mb, { x0: cx - bw / 2, x1: cx + bw / 2, z0, z1, y: top + 0.02, kind: "hip", pitch: 0.55, eave: [0.12, 0, 0.12, 0.12], alongX: true, mat: M.R, trim: M.T === M.fm.stone ? M.fm.wood : M.T, gable: M.U, soffit: M.fm.wood, seed: p.b.seed + 5, snow: M.snow, mobile, butt: "-s" });
}

/** Bell cote on the front gable apex (chapels). */
function bellCote(ctx: Ctx, p: Plan, M: Mats, main: Block, ridgeY: number) {
  const mb = ctx.mb, cx = (main.x0 + main.x1) / 2, z = main.z1 - 0.15;
  mb.group = `b:${p.b.id}`;
  const y0 = ridgeY - 0.35, h = 1.4, w = 1.0;
  for (const sx of [-1, 1]) mb.bevelBox(cx + sx * (w / 2 - 0.1), y0, z, 0.2, h, 0.35, 0.03, { layer: M.fm.stone });
  mb.bevelBox(cx, y0 + h, z, w + 0.1, 0.18, 0.45, 0.03, { layer: M.fm.stone });
  const top = y0 + h + 0.18;
  quadOut(mb, [cx - w / 2 - 0.12, top, z + 0.28], [cx, top + 0.45, z + 0.28], [cx, top + 0.45, z - 0.28], [cx - w / 2 - 0.12, top, z - 0.28], [-1, 1, 0], { layer: M.R });
  quadOut(mb, [cx, top + 0.45, z + 0.28], [cx + w / 2 + 0.12, top, z + 0.28], [cx + w / 2 + 0.12, top, z - 0.28], [cx, top + 0.45, z - 0.28], [1, 1, 0], { layer: M.R });
  mb.cyl(cx, top + 0.45, z, 0.05, 0.03, 0.6, 4, { layer: M.fm.metal });
  mb.box(cx, top + 0.85, z, 0.36, 0.05, 0.05, { layer: M.fm.metal });
  mb.box(cx, y0 + h - 0.1, z, 0.03, 0.12, 0.03, { layer: M.fm.dark });
  mb.cyl(cx, y0 + h - 0.62, z, 0.26, 0.12, 0.5, 8, { layer: M.fm.brass });
}

/** Cut-away interior: floor, inner walls, counter, shelves with goods, table, rug, hanging lamp. */
function interior(ctx: Ctx, p: Plan, main: Block) {
  const mb = ctx.mb, b = p.b;
  mb.group = `b:${b.id}:in`;
  const floorL = ctx.layer("floor"), inWall = ctx.layer("inwall"), wood = ctx.layer("wood"), dark = ctx.layer("darkwood");
  const W = main.x1 - main.x0, D = main.z1 - main.z0, cx = (main.x0 + main.x1) / 2, cz = (main.z0 + main.z1) / 2;
  const y = p.st.plinth - 0.34;
  const iw = W - 0.5, id = D - 0.5;
  mb.push(0, cx, 0, cz);
  mb.quad([-iw / 2, y + 0.02, id / 2], [iw / 2, y + 0.02, id / 2], [iw / 2, y + 0.02, -id / 2], [-iw / 2, y + 0.02, -id / 2], { layer: floorL });
  const H = Math.min(2.8, main.fh * main.floors - 0.2);
  mb.quad([iw / 2, y, -id / 2], [-iw / 2, y, -id / 2], [-iw / 2, y + H, -id / 2], [iw / 2, y + H, -id / 2], { layer: inWall });
  mb.quad([-iw / 2, y, -id / 2], [-iw / 2, y, id / 2], [-iw / 2, y + H, id / 2], [-iw / 2, y + H, -id / 2], { layer: inWall });
  mb.quad([iw / 2, y, id / 2], [iw / 2, y, -id / 2], [iw / 2, y + H, -id / 2], [iw / 2, y + H, id / 2], { layer: inWall });
  mb.box(0, y, -id / 2 + 0.03, iw, 0.14, 0.06, { layer: dark });
  // Ceiling beams.
  for (let i = 1; i < 4; i++) mb.box(-iw / 2 + (iw * i) / 4, y + H - 0.2, 0, 0.14, 0.18, id, { layer: dark });
  mb.bevelBox(0, y, -id / 2 + 1.2, Math.min(3, iw - 1), 1.0, 0.6, 0.03, { layer: wood });
  mb.box(0, y + 1.0, -id / 2 + 1.2, Math.min(3, iw - 1) + 0.1, 0.06, 0.7, { layer: dark });
  for (let i = 0; i < 3; i++) {
    const sx = -iw / 2 + 0.9 + i * ((iw - 1.8) / 2);
    mb.box(sx, y, -id / 2 + 0.25, 0.9, 1.9, 0.4, { layer: dark });
    for (let s = 0; s < 3; s++) mb.box(sx, y + 0.5 + s * 0.55, -id / 2 + 0.33, 0.8, 0.28, 0.2, { layer: ctx.layer(s % 2 ? "book" : "cloth") });
  }
  mb.cyl(iw / 2 - 0.6, y, id / 2 - 0.9, 0.3, 0.26, 0.8, 10, { layer: wood });
  mb.bevelBox(-iw / 4, y, 0.3, 1.1, 0.72, 0.8, 0.03, { layer: wood });
  for (const [sx, sz] of [[-iw / 4 - 0.7, 0.3], [-iw / 4 + 0.7, 0.3]] as const) mb.cyl(sx, y, sz, 0.18, 0.16, 0.45, 8, { layer: dark });
  mb.quad([-iw / 3, y + 0.03, id / 3], [iw / 3, y + 0.03, id / 3], [iw / 3, y + 0.03, -id / 5], [-iw / 3, y + 0.03, -id / 5], { layer: ctx.layer("rug") });
  const lamp: V3 = [0, y + 2.2, 0];
  mb.box(0, y + 2.1, 0, 0.3, 0.3, 0.3, { layer: ctx.layer("window"), emissive: 1 });
  mb.box(0, y + 2.4, 0, 0.02, H - 2.4, 0.02, { layer: dark });
  mb.pop();
  light(ctx, [cx + lamp[0], lamp[1], cz + lamp[2]], ctx.lampColor, 5, 1.2, "interior");
}
