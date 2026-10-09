// Facade grammar (hd2d-architecture-3): a wall face with openings of any head shape (flat, round,
// segmental, pointed arch, oculus), recessed reveals, panes / doors / shopfronts / open arcades, surrounds
// with keystones, sills, shutters, flower boxes, balconies and half-timber framing laid around openings.
import type { FaceOpts, MeshBuilder, V3 } from "../mesh";
import { hash3 } from "../mesh";
import { archY, wbox, wq, type ArchKind, type WallP } from "./geo";
import type { DoorKind, Style } from "./plan";

export type OpKind = "win" | "door" | "shop" | "french" | "arcade";
export type Op = {
  u: number; w: number; v0: number; v1: number;
  kind: OpKind;
  head: "flat" | ArchKind;
  round?: boolean;
  lit?: boolean;
  shutters?: boolean; box?: boolean;
  balcony?: "iron" | "stone" | "wood" | null;
  open?: boolean;
  boarded?: boolean;
  lattice?: boolean;
  door?: DoorKind;
  depth?: number;
  mull?: Style["mull"];
  transom?: boolean;
};
export type FacadeMats = {
  trim: number; frame: number; glass: number; lit: number; lattice: number; door: number; shutter: number;
  metal: number; wood: number; flowers: number; stone: number; dark: number; corr: number; cloth: number; brass: number;
};
export type WallSpec = {
  P: WallP; u0: number; u1: number; y0: number; y1: number;
  ops: Op[]; wall: FaceOpts; mats: FacadeMats; st: Style; seed: number; mobile: boolean;
  /** Wall-surface outward offset (for jetty / setbacks the caller shifts P instead). */
};

const ARCH_RISE: Record<string, number> = { round: 1, segment: 0.36, pointed: 1.35, flat: 0 };

/** Head (top edge) of an opening at wall coordinate u (absolute v). */
function headAt(o: Op, y0: number, u: number) {
  const hw = o.w / 2;
  if (o.round) { const x = (u - o.u) / hw; return y0 + (o.v0 + o.v1) / 2 + hw * Math.sqrt(Math.max(0, 1 - x * x)); }
  if (o.head === "flat") return y0 + o.v1;
  const rise = hw * ARCH_RISE[o.head]!;
  return y0 + o.v1 - rise + rise * archY(o.head, (u - o.u) / hw);
}
function footAt(o: Op, y0: number, u: number) {
  if (!o.round) return y0 + o.v0;
  const hw = o.w / 2, x = (u - o.u) / hw;
  return y0 + (o.v0 + o.v1) / 2 - hw * Math.sqrt(Math.max(0, 1 - x * x));
}
/** Spring line of an arched head (absolute v). */
function springAt(o: Op, y0: number) {
  if (o.round) return y0 + (o.v0 + o.v1) / 2;
  if (o.head === "flat") return y0 + o.v1;
  return y0 + o.v1 - (o.w / 2) * ARCH_RISE[o.head]!;
}

/** Wall face with openings. */
export function facade(mb: MeshBuilder, s: WallSpec) {
  const { P, y0, y1 } = s;
  const ops = [...s.ops].sort((a, b) => a.u - b.u);
  const N = s.mobile ? 4 : 7;
  let cur = s.u0;
  for (const o of ops) {
    const a = o.u - o.w / 2, c = o.u + o.w / 2;
    if (a > cur + 1e-4) wq(mb, P, cur, a, y0, y1, 0, s.wall);
    const curved = o.round || o.head !== "flat";
    const n = curved ? N : 1;
    for (let i = 0; i < n; i++) {
      const ua = a + ((c - a) * i) / n, ub = a + ((c - a) * (i + 1)) / n;
      // above
      const ha = headAt(o, y0, ua), hb = headAt(o, y0, ub);
      if (y1 - Math.min(ha, hb) > 1e-3) mb.quad(P(ua, ha, 0), P(ub, hb, 0), P(ub, y1, 0), P(ua, y1, 0), s.wall);
      // below
      const fa = footAt(o, y0, ua), fb = footAt(o, y0, ub);
      if (Math.max(fa, fb) - y0 > 1e-3) mb.quad(P(ua, y0, 0), P(ub, y0, 0), P(ub, fb, 0), P(ua, fa, 0), s.wall);
    }
    cur = c;
  }
  if (cur < s.u1 - 1e-4) wq(mb, P, cur, s.u1, y0, y1, 0, s.wall);
  for (const o of ops) opening(mb, s, o);
}

function opening(mb: MeshBuilder, s: WallSpec, o: Op) {
  const { P, y0, mats: m, st } = s;
  const a = o.u - o.w / 2, c = o.u + o.w / 2;
  const R = o.depth ?? (o.kind === "arcade" ? 1.0 : o.kind === "shop" ? 0.14 : o.kind === "door" || o.kind === "french" ? 0.2 : 0.2);
  const curved = !!o.round || o.head !== "flat";
  const N = s.mobile ? 4 : 7;
  const v0 = y0 + o.v0, sp = springAt(o, y0);
  const reveal: FaceOpts = { ...s.wall, tint: [(s.wall.tint?.[0] ?? 1) * 0.8, (s.wall.tint?.[1] ?? 1) * 0.8, (s.wall.tint?.[2] ?? 1) * 0.84] };
  // Outline points (u, v) going clockwise from bottom-left, used by reveal + surround.
  const outline: [number, number][] = [];
  if (o.round) {
    for (let i = 0; i < N * 2; i++) {
      const t = Math.PI + (i / (N * 2)) * Math.PI * 2;
      outline.push([o.u + Math.cos(t) * o.w / 2, (y0 + (o.v0 + o.v1) / 2) + Math.sin(-t) * o.w / 2]);
    }
  } else {
    outline.push([a, v0], [a, sp]);
    if (curved) for (let i = 1; i < N; i++) { const u = a + ((c - a) * i) / N; outline.push([u, headAt(o, y0, u)]); }
    outline.push([c, sp], [c, v0]);
  }
  // Reveal faces: each outline edge extruded inward (normal points into the opening).
  const L = outline.length;
  for (let i = 0; i < L; i++) {
    const p = outline[i]!, q = outline[(i + 1) % L]!;
    const isSill = !o.round && i === L - 1;
    if (isSill && (o.kind === "door" || o.kind === "arcade" || o.kind === "french")) continue;
    // Edge p→q runs clockwise (seen from outside); inward-facing quad: p(0) → q(0) → q(-R) → p(-R) reversed.
    mb.quad(P(q[0], q[1], 0), P(p[0], p[1], 0), P(p[0], p[1], -R), P(q[0], q[1], -R), reveal);
  }
  const back = -R + 0.03;
  // ---- contents ----
  if (o.kind === "arcade") {
    // Deep open arch: inner wall with a door or window at the back of the loggia; floor + ceiling via reveal.
    fill(mb, P, o, y0, -R, { ...s.wall, tint: [0.62, 0.6, 0.6] }, N);
    const iw = Math.min(0.9, o.w * 0.5);
    wq(mb, P, o.u - iw / 2, o.u + iw / 2, y0, y0 + Math.min(2.0, o.v1 - 0.4), -R + 0.02, { layer: hash3(s.seed + Math.round(o.u * 7)) < 0.5 ? m.door : m.glass, tint: [0.75, 0.72, 0.7] });
    mb.quad(P(a, v0 + 0.01, 0), P(c, v0 + 0.01, 0), P(c, v0 + 0.01, -R), P(a, v0 + 0.01, -R), { layer: m.stone, tint: [0.85, 0.85, 0.85] });
  } else if (o.kind === "door") door(mb, s, o, R);
  else if (o.kind === "shop") shopfront(mb, s, o, R);
  else {
    // Window / french door pane.
    const paneL = o.lattice ? m.lattice : o.lit ? m.lit : m.glass;
    const em = o.lit ? 1 : 0;
    if (o.boarded) {
      fill(mb, P, o, y0, back, { layer: m.dark, tint: [0.25, 0.22, 0.2], noAO: true }, N);
      const planks = 3;
      for (let i = 0; i < planks; i++) {
        const vv = v0 + ((sp - v0) * (i + 0.5)) / planks, tilt = (hash3(s.seed + i * 13 + Math.round(o.u * 5)) - 0.5) * 0.3;
        const A = P(a - 0.08, vv - 0.08 + tilt, 0.03), B = P(c + 0.08, vv - 0.08 - tilt, 0.03), C = P(c + 0.08, vv + 0.08 - tilt, 0.03), D = P(a - 0.08, vv + 0.08 + tilt, 0.03);
        mb.quad(A, B, C, D, { layer: m.wood, tint: [0.8, 0.74, 0.66] });
      }
    } else {
      const uvsFor = o.lattice ? (u: number, v: number): [number, number] => [(u - a) / Math.max(0.5, o.w) * 0.5, (1 - (v - v0) / Math.max(0.5, headAt(o, y0, o.u) - v0)) * 0.5] : null;
      fill(mb, P, o, y0, back, { layer: paneL, emissive: em, noAO: true }, N, uvsFor);
      if (!o.lattice) mullions(mb, P, o, y0, back + 0.03, m.frame, o.mull ?? st.mull, N);
      if (o.kind === "french" && !o.lattice) {
        // Door rail across the bottom + centre stile.
        wbox(mb, P, a, c, v0, v0 + 0.35, back, back + 0.04, { layer: m.frame }, "ft");
      }
    }
  }
  // ---- surround ----
  surround(mb, s, o, outline);
  // ---- shutters, flower box, balcony ----
  if (o.shutters && (o.kind === "win" || o.kind === "french") && !o.round) {
    const top = sp, h = top - v0, sw = o.w * 0.52;
    const off = st.surround === "none" ? 0.02 : 0.1;
    for (const [side, u0, u1, uv0, uv1] of [[-1, a - off - sw, a - off, 0, 0.5], [1, c + off, c + off + sw, 0.5, 1]] as const) {
      void side;
      const o2: FaceOpts = { layer: m.shutter, uvs: [[uv0, 1], [uv1, 1], [uv1, 0], [uv0, 0]] };
      mb.quad(P(u0, v0, 0.06), P(u1, v0, 0.06), P(u1, v0 + h, 0.06), P(u0, v0 + h, 0.06), o2);
      wbox(mb, P, u0, u1, v0, v0 + h, 0.01, 0.06, { layer: m.shutter, tint: [0.7, 0.7, 0.7] }, "tblr");
    }
  }
  if (o.box && o.kind === "win" && !s.mobile) {
    const bw = o.w + 0.16;
    wbox(mb, P, o.u - bw / 2, o.u + bw / 2, v0 - 0.26, v0 - 0.04, 0, 0.26, { layer: m.wood }, "ftblr");
    const mid = P(o.u, v0 - 0.08, 0.14), mid2 = P(o.u + 1, v0 - 0.08, 0.14);
    const yaw = Math.atan2(-(mid2[2] - mid[2]), mid2[0] - mid[0]) * 180 / Math.PI;
    mb.card(mid[0], v0 - 0.12, mid[2], bw + 0.1, 0.4, yaw, { layer: m.flowers, wind: true });
  }
  if (o.balcony) balcony(mb, s, o);
}

/** Fill the opening outline at depth t (pane / dark interior). */
function fill(mb: MeshBuilder, P: WallP, o: Op, y0: number, t: number, opts: FaceOpts, N: number, uv?: ((u: number, v: number) => [number, number]) | null) {
  const a = o.u - o.w / 2, c = o.u + o.w / 2, v0 = y0 + o.v0;
  const withUV = (pts: [number, number][]): FaceOpts => (uv ? { ...opts, uvs: pts.map(([u, v]) => uv(u, v)) } : opts);
  if (o.round) {
    const cv = y0 + (o.v0 + o.v1) / 2, r = o.w / 2, n = N * 2;
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI * 2, t1 = ((i + 1) / n) * Math.PI * 2;
      mb.tri(P(o.u, cv, t), P(o.u + Math.cos(t0) * r, cv + Math.sin(t0) * r, t), P(o.u + Math.cos(t1) * r, cv + Math.sin(t1) * r, t), opts);
    }
    return;
  }
  const sp = springAt(o, y0);
  mb.quad(P(a, v0, t), P(c, v0, t), P(c, sp, t), P(a, sp, t), withUV([[a, v0], [c, v0], [c, sp], [a, sp]]));
  if (o.head !== "flat") {
    const n = N;
    for (let i = 0; i < n; i++) {
      const ua = a + ((c - a) * i) / n, ub = a + ((c - a) * (i + 1)) / n;
      const ha = headAt(o, y0, ua), hb = headAt(o, y0, ub);
      mb.quad(P(ua, sp, t), P(ub, sp, t), P(ub, hb, t), P(ua, ha, t), withUV([[ua, sp], [ub, sp], [ub, hb], [ua, ha]]));
    }
  }
}

function mullions(mb: MeshBuilder, P: WallP, o: Op, y0: number, t: number, layer: number, kind: Style["mull"], N: number) {
  if (kind === "none") return;
  const a = o.u - o.w / 2, c = o.u + o.w / 2, v0 = y0 + o.v0, sp = springAt(o, y0), top = headAt(o, y0, o.u);
  const bar = (u0: number, u1: number, w0: number, w1: number) => wbox(mb, P, u0, u1, w0, w1, t - 0.02, t + 0.02, { layer }, "ftblr");
  const th = kind === "lead" ? 0.022 : 0.035;
  if (o.round) { bar(o.u - th, o.u + th, v0, top); bar(a, c, (v0 + top) / 2 - th, (v0 + top) / 2 + th); return; }
  if (kind === "cross" || kind === "vert" || kind === "lead") bar(o.u - th, o.u + th, v0, top);
  if (kind === "cross") { const hv = o.head === "flat" ? v0 + (sp - v0) * 0.62 : sp; bar(a, c, hv - th, hv + th); }
  if (kind === "vert") { const hv = v0 + (sp - v0) * 0.5; bar(a, c, hv - th * 1.4, hv + th * 1.4); }
  if (kind === "lead") for (const f of [0.33, 0.66]) { const hv = v0 + (sp - v0) * f; bar(a, c, hv - th, hv + th); bar(a + (c - a) * 0.25 - th, a + (c - a) * 0.25 + th, v0, sp); bar(a + (c - a) * 0.75 - th, a + (c - a) * 0.75 + th, v0, sp); }
  if (kind === "grid") {
    const nu = Math.max(2, Math.round(o.w / 0.45)), nv = Math.max(2, Math.round((sp - v0) / 0.45));
    for (let i = 1; i < nu; i++) { const u = a + ((c - a) * i) / nu; bar(u - th, u + th, v0, sp); }
    for (let j = 1; j < nv; j++) { const v = v0 + ((sp - v0) * j) / nv; bar(a, c, v - th, v + th); }
  }
  if (o.head !== "flat" && kind !== "grid") {
    // Fanlight bars radiating from the spring centre.
    for (const f of [-0.5, 0.5]) {
      const ue = o.u + f * o.w * 0.5, ve = headAt(o, y0, ue);
      const A = P(o.u, sp, t + 0.01), B = P(ue, ve, t + 0.01);
      mb.beam(A, B, th * 1.6, { layer });
    }
    if (kind !== "cross") bar(a, c, sp - th, sp + th);
  }
  void N;
}

/** Surround trim: jambs + head (following arches, with keystone) + sill. */
function surround(mb: MeshBuilder, s: WallSpec, o: Op, outline: [number, number][]) {
  const { P, mats: m, st } = s;
  const kind = o.kind === "shop" || o.kind === "arcade" ? (st.surround === "none" ? "none" : st.surround === "frame" ? "frame" : "stone") : st.surround;
  const layer = kind === "frame" ? m.trim : m.stone;
  const fw = kind === "frame" ? 0.08 : kind === "none" ? 0 : 0.13, ft = kind === "frame" ? 0.04 : 0.06;
  const a = o.u - o.w / 2, c = o.u + o.w / 2;
  if (kind !== "none") {
    if (o.round) {
      const cv = s.y0 + (o.v0 + o.v1) / 2, r = o.w / 2;
      for (let i = 0; i < outline.length; i++) {
        const p = outline[i]!, q = outline[(i + 1) % outline.length]!;
        const pa = Math.atan2(p[1] - cv, p[0] - o.u), qa = Math.atan2(q[1] - cv, q[0] - o.u);
        mb.quad(P(p[0], p[1], ft), P(o.u + Math.cos(pa) * (r + fw), cv + Math.sin(pa) * (r + fw), ft), P(o.u + Math.cos(qa) * (r + fw), cv + Math.sin(qa) * (r + fw), ft), P(q[0], q[1], ft), { layer });
      }
      void c;
    } else {
      // Jambs.
      const v0 = s.y0 + o.v0 - (o.kind === "win" ? 0 : 0), sp = springAt(o, s.y0);
      wbox(mb, P, a - fw, a, v0, sp, 0, ft, { layer }, "ftlr");
      wbox(mb, P, c, c + fw, v0, sp, 0, ft, { layer }, "ftlr");
      if (o.head === "flat") {
        const lintel = kind === "frame" ? fw : fw * 1.5;
        wbox(mb, P, a - fw * (kind === "frame" ? 1 : 1.5), c + fw * (kind === "frame" ? 1 : 1.5), sp, sp + lintel, 0, ft * (kind === "frame" ? 1.2 : 1.4), { layer }, "ftblr");
        if (kind === "keystone") wbox(mb, P, o.u - 0.09, o.u + 0.09, sp - 0.02, sp + lintel + 0.06, 0, ft * 2, { layer }, "ftblr");
      } else {
        // Arch voussoir band following the head curve.
        const pts = outline.filter((p) => p[1] >= sp - 1e-4);
        for (let i = 0; i < pts.length - 1; i++) {
          const p = pts[i]!, q = pts[i + 1]!;
          const nx = (q[1] - p[1]), ny = -(q[0] - p[0]), nl = Math.hypot(nx, ny) || 1;
          const ox = (nx / nl) * fw * -1, oy = (ny / nl) * fw * -1;
          mb.quad(P(p[0], p[1], ft), P(q[0], q[1], ft), P(q[0] + ox, q[1] + oy, ft), P(p[0] + ox, p[1] + oy, ft), { layer });
          mb.quad(P(q[0] + ox, q[1] + oy, ft), P(q[0] + ox, q[1] + oy, 0), P(p[0] + ox, p[1] + oy, 0), P(p[0] + ox, p[1] + oy, ft), { layer });
        }
        if (kind === "keystone" || kind === "stone") {
          const top = headAt(o, s.y0, o.u);
          wbox(mb, P, o.u - 0.1, o.u + 0.1, top - 0.04, top + fw + 0.08, 0, ft * 1.8, { layer }, "ftblr");
        }
      }
    }
  }
  // Sill.
  if ((o.kind === "win" || o.kind === "shop") && !o.round) {
    const v0 = s.y0 + o.v0;
    const sw = kind === "frame" || kind === "none" ? 0.06 : 0.12;
    wbox(mb, P, a - sw - 0.02, c + sw + 0.02, v0 - 0.07, v0, -0.02, kind === "none" ? 0.08 : 0.12, { layer: kind === "none" ? m.stone : layer }, "ftblr");
    if (kind === "stone" || kind === "keystone") for (const u of [a + 0.02, c - 0.1]) wbox(mb, P, u, u + 0.08, v0 - 0.2, v0 - 0.07, 0, 0.07, { layer }, "ftlr");
  }
}

/** Door leaves by kind; open doors show a dark interior with the leaf swung inward. */
function door(mb: MeshBuilder, s: WallSpec, o: Op, R: number) {
  const { P, y0, mats: m } = s;
  const a = o.u - o.w / 2, c = o.u + o.w / 2, v0 = y0 + o.v0, sp = springAt(o, y0), top = headAt(o, y0, o.u);
  const back = -R + 0.03, N = s.mobile ? 4 : 7;
  const kind = o.door ?? "plank";
  // Fanlight / transom.
  let leafTop = sp;
  if (o.head !== "flat") {
    if (kind === "double" || kind === "glass") {
      const fan: Op = { ...o, v0: sp - y0 };
      fill(mb, P, fan, y0, back, { layer: o.lit ? m.lit : m.glass, emissive: o.lit ? 1 : 0, noAO: true }, N);
      mullions(mb, P, fan, y0, back + 0.03, m.frame, "vert", N);
      wbox(mb, P, a, c, sp - 0.05, sp + 0.03, back, back + 0.05, { layer: m.frame }, "ftb");
      leafTop = sp - 0.05;
    } else fill(mb, P, { ...o, v0: sp - y0 }, y0, back, { layer: m.door, tint: [0.85, 0.8, 0.78] }, N);
  } else if (o.transom) {
    const tv = sp - 0.36;
    wq(mb, P, a, c, tv + 0.05, sp, back, { layer: o.lit ? m.lit : m.glass, emissive: o.lit ? 1 : 0, noAO: true });
    wbox(mb, P, a, c, tv, tv + 0.06, back, back + 0.06, { layer: m.frame }, "ftb");
    leafTop = tv;
  }
  if (o.open) {
    fill(mb, P, { ...o, head: "flat", v1: leafTop - y0 }, y0, -R - 0.05, { layer: m.dark, tint: [0.12, 0.1, 0.09], noAO: true }, N);
    // Leaf swung open inward against the left reveal.
    const lw = Math.min(o.w, 1.0);
    mb.quad(P(a + 0.04, v0, -R), P(a + 0.04, v0, -R - lw * 0.9), P(a + 0.04, leafTop - 0.03, -R - lw * 0.9), P(a + 0.04, leafTop - 0.03, -R), { layer: m.door, doubleSided: true });
    return;
  }
  const leaf = (u0: number, u1: number) => {
    switch (kind) {
      case "glass": {
        wq(mb, P, u0, u1, v0, leafTop, back, { layer: o.lit ? m.lit : m.glass, emissive: o.lit ? 0.8 : 0, noAO: true });
        for (const [x0, x1, w0, w1] of [[u0, u0 + 0.06, v0, leafTop], [u1 - 0.06, u1, v0, leafTop], [u0, u1, v0, v0 + 0.12], [u0, u1, leafTop - 0.08, leafTop]] as const) wbox(mb, P, x0, x1, w0, w1, back, back + 0.05, { layer: m.metal }, "ftblr");
        wbox(mb, P, u0 + 0.1, u1 - 0.1, v0 + 1.0, v0 + 1.05, back + 0.05, back + 0.1, { layer: m.metal }, "ftb");
        break;
      }
      case "rollup": {
        wq(mb, P, u0, u1, v0, leafTop, back, { layer: m.corr, uvs: [[0, (leafTop - v0) * 0.8], [(u1 - u0) * 0.5, (leafTop - v0) * 0.8], [(u1 - u0) * 0.5, 0], [0, 0]] });
        wbox(mb, P, u0 - 0.05, u1 + 0.05, leafTop - 0.02, leafTop + 0.3, back, back + 0.25, { layer: m.metal }, "ftb");
        wbox(mb, P, u0, u1, v0 + 0.02, v0 + 0.08, back, back + 0.06, { layer: m.metal }, "ft");
        break;
      }
      case "sliding": {
        const n = Math.max(2, Math.round((u1 - u0) / 0.45));
        for (let i = 0; i < n; i++) {
          const x0 = u0 + ((u1 - u0) * i) / n, x1 = u0 + ((u1 - u0) * (i + 1)) / n;
          const tt = back + (i % 2) * 0.04;
          mb.quad(P(x0, v0, tt), P(x1, v0, tt), P(x1, leafTop, tt), P(x0, leafTop, tt), { layer: m.lattice, emissive: o.lit ? 0.9 : 0, uvs: [[0, 1], [0.5, 1], [0.5, 0], [0, 0]], noAO: true });
          wbox(mb, P, x0, x0 + 0.05, v0, leafTop, tt, tt + 0.04, { layer: m.frame }, "f");
          wbox(mb, P, x0, x1, v0, v0 + 0.3, tt, tt + 0.03, { layer: m.frame }, "ft");
        }
        break;
      }
      case "saloon": {
        fill(mb, P, { ...o, head: "flat", v1: leafTop - y0 }, y0, -R - 0.05, { layer: m.dark, tint: [0.12, 0.1, 0.09], noAO: true }, N);
        const mid = (u0 + u1) / 2;
        for (const [x0, x1] of [[u0 + 0.02, mid - 0.02], [mid + 0.02, u1 - 0.02]] as const) wbox(mb, P, x0, x1, v0 + 0.55, v0 + 1.55, back + 0.1, back + 0.14, { layer: m.door }, "ftblr");
        break;
      }
      case "hide": {
        const mid = (u0 + u1) / 2;
        mb.quad(P(u0, v0, back + 0.1), P(mid, v0 + 0.1, back), P(mid, leafTop, back + 0.05), P(u0, leafTop, back + 0.1), { layer: m.cloth, doubleSided: true });
        mb.quad(P(mid, v0 + 0.1, back), P(u1, v0, back + 0.1), P(u1, leafTop, back + 0.1), P(mid, leafTop, back + 0.05), { layer: m.cloth, doubleSided: true, tint: [0.85, 0.85, 0.85] });
        break;
      }
      default: {
        // Plank / panel door with iron straps and a ring pull.
        wq(mb, P, u0, u1, v0, leafTop, back, { layer: m.door, uvs: [[0, (leafTop - v0) * 0.5], [(u1 - u0) * 0.5, (leafTop - v0) * 0.5], [(u1 - u0) * 0.5, 0], [0, 0]] });
        if (kind === "double") {
          for (const [x0, x1] of [[u0 + 0.08, (u0 + u1) / 2 - 0.06], [(u0 + u1) / 2 + 0.06, u1 - 0.08]] as const) {
            wbox(mb, P, x0, x1, v0 + 0.2, v0 + 0.85, back, back + 0.03, { layer: m.door, tint: [0.88, 0.88, 0.88] }, "ftblr");
            wbox(mb, P, x0, x1, v0 + 1.0, leafTop - 0.15, back, back + 0.03, { layer: m.door, tint: [0.88, 0.88, 0.88] }, "ftblr");
          }
          wbox(mb, P, (u0 + u1) / 2 - 0.015, (u0 + u1) / 2 + 0.015, v0, leafTop, back, back + 0.02, { layer: m.dark, tint: [0.4, 0.35, 0.3] }, "f");
        } else if (!s.mobile) {
          for (const hv of [v0 + 0.35, leafTop - 0.4]) wbox(mb, P, u0 + 0.02, u1 - 0.25, hv, hv + 0.06, back, back + 0.025, { layer: m.metal }, "ftb");
        }
        const hx = kind === "double" ? (u0 + u1) / 2 + 0.12 : u1 - 0.14;
        wbox(mb, P, hx - 0.03, hx + 0.03, v0 + 0.95, v0 + 1.05, back, back + 0.06, { layer: m.brass }, "ftblr");
      }
    }
  };
  leaf(a, c);
  void top;
}

/** Shopfront: stall riser, big display window with mullions + transom bar, lit goods behind. */
function shopfront(mb: MeshBuilder, s: WallSpec, o: Op, R: number) {
  const { P, y0, mats: m } = s;
  const a = o.u - o.w / 2, c = o.u + o.w / 2, v0 = y0 + o.v0, v1 = y0 + o.v1;
  const back = -R + 0.02;
  wq(mb, P, a, c, v0, v1, back, { layer: o.lit ? m.lit : m.glass, emissive: o.lit ? 0.7 : 0, noAO: true });
  const n = Math.max(2, Math.round(o.w / 0.62));
  for (let i = 1; i < n; i++) { const u = a + ((c - a) * i) / n; wbox(mb, P, u - 0.03, u + 0.03, v0, v1, back, back + 0.05, { layer: m.frame }, "ftlr"); }
  const tv = v0 + (v1 - v0) * 0.76;
  wbox(mb, P, a, c, tv - 0.03, tv + 0.03, back, back + 0.05, { layer: m.frame }, "ftb");
  // Stall riser with two inset panels.
  const rs = y0 + 0.02;
  wbox(mb, P, a, c, rs, v0, -0.02, 0.03, { layer: m.frame }, "ft");
  if (!s.mobile) for (let i = 0; i < n; i++) {
    const u0 = a + ((c - a) * i) / n + 0.07, u1 = a + ((c - a) * (i + 1)) / n - 0.07;
    wbox(mb, P, u0, u1, rs + 0.08, v0 - 0.08, 0.03, 0.05, { layer: m.frame, tint: [0.85, 0.85, 0.85] }, "ftblr");
  }
}

/** Balcony slab with brackets and a railing (iron bars / stone balusters / wooden rails), pots. */
function balcony(mb: MeshBuilder, s: WallSpec, o: Op) {
  const { P, y0, mats: m } = s;
  const bw = o.w + 0.7, dep = 0.8, a = o.u - bw / 2, c = o.u + bw / 2, v = y0 + o.v0;
  const kind = o.balcony!;
  const slabL = kind === "wood" ? m.wood : m.stone;
  wbox(mb, P, a, c, v - 0.14, v, 0, dep, { layer: slabL }, "ftblr");
  // Brackets.
  for (const u of [a + 0.15, c - 0.15]) {
    mb.beam(P(u, v - 0.6, 0.02), P(u, v - 0.12, dep * 0.75), 0.1, { layer: slabL });
  }
  const top = v + 0.9;
  if (kind === "iron") {
    const n = Math.max(4, Math.round(bw / 0.13));
    for (let i = 0; i <= n; i++) { const u = a + 0.04 + ((bw - 0.08) * i) / n; wbox(mb, P, u - 0.012, u + 0.012, v, top, dep - 0.06, dep - 0.035, { layer: m.metal }, "flr"); }
    for (let side = 0; side < 2; side++) { const u = side ? c - 0.04 : a + 0.04; for (let j = 1; j < 5; j++) { const t = (dep * j) / 5; mb.box(...P(u, v, t) as [number, number, number], 0.025, top - v, 0.025, { layer: m.metal }); } }
    wbox(mb, P, a, c, top - 0.04, top, dep - 0.08, dep - 0.01, { layer: m.metal }, "ftb");
    wbox(mb, P, a, c, v + 0.05, v + 0.08, dep - 0.07, dep - 0.02, { layer: m.metal }, "ft");
    for (const side of [0, 1]) { const u = side ? c - 0.04 : a + 0.04; const A = P(u, top, 0), B = P(u, top, dep - 0.04); mb.beam([A[0], A[1] - 0.02, A[2]], [B[0], B[1] - 0.02, B[2]], 0.04, { layer: m.metal }); }
  } else if (kind === "stone") {
    const n = Math.max(3, Math.round(bw / 0.18));
    for (let i = 0; i <= n; i++) {
      const u = a + 0.06 + ((bw - 0.12) * i) / n;
      wbox(mb, P, u - 0.035, u + 0.035, v, v + 0.12, dep - 0.13, dep - 0.03, { layer: m.stone }, "flr");
      wbox(mb, P, u - 0.05, u + 0.05, v + 0.12, v + 0.45, dep - 0.14, dep - 0.02, { layer: m.stone }, "flr");
      wbox(mb, P, u - 0.03, u + 0.03, v + 0.45, top - 0.1, dep - 0.12, dep - 0.04, { layer: m.stone }, "flr");
    }
    wbox(mb, P, a, c, top - 0.1, top, dep - 0.17, dep, { layer: m.stone }, "ftb");
    for (const side of [0, 1]) { const u0 = side ? c - 0.12 : a; wbox(mb, P, u0, u0 + 0.12, v, top, 0, dep, { layer: m.stone }, "tlr"); }
  } else {
    wbox(mb, P, a, c, top - 0.08, top, dep - 0.08, dep, { layer: m.wood }, "ftb");
    const n = Math.max(3, Math.round(bw / 0.16));
    for (let i = 0; i <= n; i++) { const u = a + 0.04 + ((bw - 0.08) * i) / n; wbox(mb, P, u - 0.025, u + 0.025, v, top - 0.08, dep - 0.06, dep - 0.02, { layer: m.wood }, "flr"); }
    for (const side of [0, 1]) { const u0 = side ? c - 0.08 : a; wbox(mb, P, u0, u0 + 0.08, v, top, 0.05, dep, { layer: m.wood }, "tlr"); }
  }
  if (!s.mobile) for (const u of [a + 0.25, c - 0.25]) {
    const p = P(u, v, dep - 0.3);
    mb.cyl(p[0], v, p[2], 0.13, 0.17, 0.26, 8, { layer: m.stone, tint: [1.1, 0.8, 0.65] });
    mb.card(p[0], v + 0.2, p[2], 0.45, 0.4, 0, { layer: m.flowers, wind: true });
    mb.card(p[0], v + 0.2, p[2], 0.45, 0.4, 90, { layer: m.flowers, wind: true });
  }
}

/** Half-timber framing on a plaster wall: plates, posts beside openings, rails and braces in panels. */
export function timberFrame(mb: MeshBuilder, P: WallP, u0: number, u1: number, y0: number, y1: number, ops: Op[], layer: number, seed: number, mobile: boolean) {
  const t0 = 0, t1 = 0.045, bw = 0.13;
  const o: FaceOpts = { layer };
  wbox(mb, P, u0, u1, y0, y0 + bw * 1.3, t0, t1 + 0.01, o, "ftb");
  wbox(mb, P, u0, u1, y1 - bw, y1, t0, t1, o, "ftb");
  const posts: number[] = [u0 + bw / 2, u1 - bw / 2];
  const wins = ops.filter((p) => p.kind !== "arcade");
  for (const p of wins) { posts.push(p.u - p.w / 2 - bw / 2 - 0.1, p.u + p.w / 2 + bw / 2 + 0.1); }
  posts.sort((a, b) => a - b);
  const clean: number[] = [];
  for (const p of posts) if (!clean.length || p - clean[clean.length - 1]! > bw * 1.6) clean.push(Math.max(u0 + bw / 2, Math.min(u1 - bw / 2, p)));
  for (const p of clean) wbox(mb, P, p - bw / 2, p + bw / 2, y0 + bw * 1.3, y1 - bw, t0, t1, o, "flr");
  if (mobile) return;
  // Panels between posts: window panels get sill/head rails; solid panels get braces.
  for (let i = 0; i < clean.length - 1; i++) {
    const pa = clean[i]! + bw / 2, pb = clean[i + 1]! - bw / 2;
    if (pb - pa < 0.25) continue;
    const mid = (pa + pb) / 2;
    const win = wins.find((w) => Math.abs(w.u - mid) < w.w / 2 + 0.2);
    const yb = y0 + bw * 1.3, yt = y1 - bw;
    if (win) {
      const sv = y0 + win.v0 - 0.04, hv = y0 + win.v1;
      if (win.kind === "win") wbox(mb, P, pa, pb, sv - bw * 0.8, sv, t0, t1, o, "ftb");
      if (hv < yt - 0.1) wbox(mb, P, pa, pb, hv, hv + bw * 0.8, t0, t1, o, "ftb");
      // Small cross under the sill.
      if (win.kind === "win" && sv - bw - yb > 0.3) {
        const A = P(pa, yb, t1 * 0.5), B = P(pb, sv - bw * 0.8, t1 * 0.5), C = P(pa, sv - bw * 0.8, t1 * 0.5), D = P(pb, yb, t1 * 0.5);
        mb.beam(A, B, bw * 0.7, o); mb.beam(C, D, bw * 0.7, o);
      }
    } else {
      const pattern = hash3(seed + i * 17);
      const mv = (yb + yt) / 2;
      wbox(mb, P, pa, pb, mv - bw * 0.4, mv + bw * 0.4, t0, t1, o, "ftb");
      if (pattern < 0.5) { mb.beam(P(pa, yb, t1 * 0.5), P(pb, yt, t1 * 0.5), bw * 0.8, o); }
      else if (pattern < 0.8) { mb.beam(P(pa, yb, t1 * 0.5), P(mid, mv, t1 * 0.5), bw * 0.8, o); mb.beam(P(pb, yb, t1 * 0.5), P(mid, mv, t1 * 0.5), bw * 0.8, o); mb.beam(P(pa, yt, t1 * 0.5), P(mid, mv, t1 * 0.5), bw * 0.8, o); mb.beam(P(pb, yt, t1 * 0.5), P(mid, mv, t1 * 0.5), bw * 0.8, o); }
      else { mb.beam(P(pa, mv, t1 * 0.5), P(pb, yt, t1 * 0.5), bw * 0.8, o); mb.beam(P(pb, yb, t1 * 0.5), P(pa, mv, t1 * 0.5), bw * 0.8, o); }
    }
  }
}

/** Corner quoins: alternating long/short dressed stones up a corner. */
export function quoins(mb: MeshBuilder, P: WallP, u: number, dir: 1 | -1, y0: number, y1: number, layer: number) {
  const n = Math.max(2, Math.round((y1 - y0) / 0.46));
  const h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const big = i % 2 === 0, w = big ? 0.46 : 0.28;
    const a = dir > 0 ? u : u - w, c = dir > 0 ? u + w : u;
    wbox(mb, P, a, c, y0 + i * h + 0.02, y0 + (i + 1) * h - 0.02, 0, 0.05, { layer }, dir > 0 ? "ftbr" : "ftbl");
  }
}

export const V = (p: V3) => p;
