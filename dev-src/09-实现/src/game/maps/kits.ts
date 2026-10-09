// P5 building kits (hd2d-architecture-3). Pure data shared by the rules layer (which kinds exist on a
// theme, what footprint each needs, which may be entered) and the render kernel (how each kind is built).
// A kind is either a generic house type rendered in the theme's architectural language, or a signature
// form with its own builder (water tower, windmill, pagoda, circus tent, pencil tower …).
import type { Building, RoofForm } from "./types";
import type { MaterialId } from "./themes";

/** Architectural language: default facade / roof / ornament grammar for generic kinds. */
export type Lang =
  | "medieval" | "mediterranean" | "frontier" | "eastern" | "victorian" | "industrial" | "urban"
  | "tribal" | "nordic" | "organic" | "arcane" | "classical" | "whimsy";

export type KindSpec = {
  /** Footprint extent along the street (cells) and depth (cells). */
  a: [number, number];
  d: [number, number];
  floors: [number, number];
  /** May be the enterable shop / inn of the floor. */
  enter?: boolean;
  /** Signature form: at most one per floor, placed first, prefers plazas / open corners. */
  sig?: boolean;
  role?: Building["role"];
  /** Roof forms the rules layer may record (the kernel interprets them per language). */
  roofs?: RoofForm[];
  /** At most this many per floor. */
  max?: number;
};

const K = (a: [number, number], d: [number, number], floors: [number, number], extra: Partial<KindSpec> = {}): KindSpec => ({ a, d, floors, ...extra });

export const KINDS: Record<string, KindSpec> = {
  // ---- generic house types (rendered in the theme language) ----
  townhouse: K([4, 6], [4, 5], [2, 3]),
  cottage: K([4, 5], [3, 4], [1, 2]),
  house: K([4, 6], [4, 5], [1, 2]),
  shop: K([5, 8], [5, 6], [1, 2], { enter: true, role: "shop" }),
  inn: K([6, 8], [5, 6], [2, 2], { enter: true, role: "shop" }),
  hall: K([6, 8], [4, 5], [1, 2]),
  workshop: K([5, 7], [4, 5], [1, 1]),
  tower: K([3, 4], [3, 4], [3, 4], { role: "tower", max: 2 }),
  // ---- signature and special forms ----
  watertower: K([3, 3], [3, 3], [1, 1], { sig: true, role: "landmark" }),
  windmill: K([4, 4], [4, 4], [1, 1], { sig: true, role: "landmark" }),
  silo: K([3, 3], [3, 3], [1, 1], { role: "tower", max: 2 }),
  barn: K([6, 7], [5, 6], [1, 1]),
  container: K([4, 6], [3, 4], [1, 2]),
  shelter: K([4, 6], [4, 5], [1, 2]),
  shed: K([5, 7], [4, 5], [1, 1]),
  gasstation: K([6, 7], [5, 5], [1, 1], { sig: true, role: "landmark" }),
  pagoda: K([4, 4], [4, 4], [3, 4], { sig: true, role: "landmark" }),
  pavilion: K([4, 5], [4, 4], [1, 1], { max: 2 }),
  stilthut: K([4, 5], [4, 4], [1, 1]),
  roundhut: K([4, 4], [4, 4], [1, 1]),
  hidetent: K([4, 4], [4, 4], [1, 1]),
  longhouse: K([6, 8], [4, 4], [1, 1]),
  watchtower: K([3, 3], [3, 3], [1, 1], { sig: true, role: "landmark" }),
  circustent: K([6, 7], [6, 6], [1, 1], { sig: true, role: "landmark" }),
  booth: K([3, 4], [3, 3], [1, 1], { max: 2 }),
  aframe: K([4, 5], [4, 5], [1, 1]),
  lodge: K([5, 7], [4, 5], [1, 2], { enter: true }),
  chapel: K([5, 6], [5, 6], [1, 1], { enter: true }),
  stavechurch: K([5, 5], [5, 5], [1, 1], { sig: true, role: "landmark" }),
  clocktower: K([4, 4], [4, 4], [3, 3], { sig: true, role: "landmark" }),
  observatory: K([5, 5], [5, 5], [1, 1], { sig: true, role: "landmark" }),
  lighthouse: K([4, 4], [4, 4], [1, 1], { sig: true, role: "landmark" }),
  minehead: K([4, 5], [4, 4], [1, 1], { sig: true, role: "landmark" }),
  domehouse: K([4, 5], [4, 5], [1, 1]),
  shellhouse: K([5, 5], [5, 5], [1, 1], { sig: true, role: "landmark", max: 1 }),
  wreckhouse: K([6, 7], [4, 4], [1, 1]),
  bookhouse: K([4, 6], [4, 5], [1, 2]),
  origami: K([4, 5], [4, 4], [1, 1]),
  bookstack: K([4, 4], [4, 4], [1, 1], { sig: true, role: "landmark" }),
  penciltower: K([3, 4], [3, 4], [2, 3]),
  shavingpavilion: K([4, 5], [4, 4], [1, 1], { max: 2 }),
  eraserhut: K([4, 5], [3, 4], [1, 1]),
  umbrellahouse: K([4, 5], [4, 5], [1, 1]),
  adobe: K([4, 6], [4, 5], [1, 2], { enter: true }),
  corkhouse: K([4, 4], [4, 4], [1, 2]),
  bottledome: K([4, 5], [4, 5], [1, 1]),
  driftshack: K([4, 5], [3, 4], [1, 1]),
  inverted: K([4, 6], [4, 5], [2, 2]),
  saltblock: K([4, 6], [4, 5], [1, 2]),
  obelisk: K([3, 4], [3, 4], [1, 1], { max: 2 }),
  ringtemple: K([5, 5], [5, 5], [1, 1], { sig: true, role: "landmark" }),
  shardhouse: K([4, 5], [4, 5], [1, 1]),
  hexhive: K([4, 5], [4, 5], [2, 3]),
  ribhouse: K([5, 7], [4, 5], [1, 1]),
  podtower: K([3, 4], [3, 4], [1, 1], { max: 2 }),
  crttower: K([4, 4], [4, 4], [1, 1], { sig: true, role: "landmark" }),
  scrapstilt: K([4, 5], [4, 4], [1, 2]),
  teahouse: K([5, 7], [4, 5], [1, 2], { enter: true }),
  paperhouse: K([4, 6], [4, 5], [1, 2]),
  stage: K([5, 6], [4, 5], [1, 1], { max: 1 }),
  shrine: K([5, 6], [5, 5], [1, 1], { sig: true, role: "landmark" }),
  motel: K([6, 8], [4, 5], [2, 2], { enter: true }),
  diner: K([5, 7], [4, 5], [1, 1], { enter: true }),
  mixeduse: K([4, 6], [4, 5], [2, 3]),
  konbini: K([5, 7], [5, 6], [1, 1], { enter: true, role: "shop" }),
  controltower: K([4, 4], [4, 4], [1, 1], { sig: true, role: "landmark" }),
  terminal: K([6, 8], [5, 6], [1, 1], { enter: true }),
  stationhall: K([6, 8], [5, 6], [1, 1], { sig: true, role: "landmark" }),
  gantry: K([5, 6], [4, 5], [1, 1], { sig: true, role: "landmark" }),
  postoffice: K([6, 8], [5, 6], [2, 2], { enter: true, sig: true }),
  prismchapel: K([4, 5], [4, 5], [1, 1], { sig: true, role: "landmark" }),
  colonnade: K([5, 7], [4, 4], [1, 1], { max: 1 }),
  rotunda: K([5, 5], [5, 5], [1, 1], { sig: true, role: "landmark" }),
  watermill: K([5, 6], [4, 5], [1, 2], { sig: true }),
  flytower: K([5, 6], [5, 5], [1, 1], { sig: true, role: "landmark" }),
  tesseract: K([4, 5], [4, 5], [1, 1], { sig: true, role: "landmark" }),
  subwaycar: K([6, 8], [3, 4], [1, 2]),
  theater: K([6, 7], [6, 6], [2, 2], { sig: true, role: "landmark" }),
  puppetbooth: K([4, 4], [4, 4], [1, 1], { max: 1 }),
  scenerystore: K([6, 8], [4, 5], [1, 1], { max: 2 }),
  carousel: K([6, 6], [6, 6], [1, 1], { sig: true, role: "landmark" }),
};

export type ThemeKit = {
  lang: Lang;
  /** Weighted ordinary kinds. */
  kinds: [string, number][];
  /** Signature kinds (one is chosen per floor when it fits). */
  sig: string[];
  /** Ornament / weathering vocabulary for generic kinds. */
  deco: string[];
  /** Wall colour variations applied per building (vertex tint multipliers). */
  tints?: [number, number, number][];
  /** Optional colour overrides for the architecture material slots (hex). */
  colors?: Partial<Record<"plaster" | "brick" | "siding" | "batten" | "lacquer" | "shutter" | "awning" | "paint" | "corr" | "roof2" | "log" | "concrete" | "timber" | "wood" | "velvet", string>>;
  roof2?: MaterialId;
};

const kit = (lang: Lang, kinds: [string, number][], sig: string[], deco: string[] = [], tints?: [number, number, number][], colors?: ThemeKit["colors"], roof2?: MaterialId): ThemeKit => ({ lang, kinds, sig, deco, tints, colors, roof2 });

const WARM: [number, number, number][] = [[1, 1, 1], [1.06, 0.97, 0.88], [0.94, 0.96, 1.02], [1.04, 0.92, 0.86], [0.96, 1.0, 0.94]];
const PASTEL: [number, number, number][] = [[1, 1, 1], [1.12, 0.9, 0.8], [0.86, 0.96, 1.1], [1.1, 1.02, 0.78], [0.94, 1.06, 0.92], [1.08, 0.88, 0.94]];
const GREY: [number, number, number][] = [[1, 1, 1], [0.94, 0.95, 0.98], [1.04, 1.01, 0.96]];
const PAINT: [number, number, number][] = [[1, 1, 1], [1.1, 0.96, 0.72], [0.8, 0.96, 1.0], [1.06, 0.74, 0.64], [0.94, 1.02, 0.84], [0.86, 0.86, 0.92]];

export const THEME_KITS: Record<string, ThemeKit> = {
  T01: kit("industrial", [["container", 3], ["shelter", 3], ["shed", 2], ["townhouse", 2], ["shop", 2]], ["watertower", "gasstation"], ["rust", "boarded", "hazard", "ruin"], GREY),
  T02: kit("eastern", [["pavilion", 3], ["hall", 2], ["house", 3], ["teahouse", 2], ["tower", 1]], ["pagoda"], ["lanterns", "talisman", "moss"], WARM),
  T03: kit("tribal", [["roundhut", 3], ["hidetent", 3], ["longhouse", 2], ["stilthut", 2]], ["watchtower"], ["bones", "hides", "feathers"]),
  T04: kit("medieval", [["townhouse", 4], ["cottage", 2], ["inn", 2], ["workshop", 2], ["tower", 1], ["shop", 2]], ["clocktower"], ["banners", "shields", "flowers", "halftimber"], WARM),
  T05: kit("industrial", [["shelter", 3], ["container", 2], ["shed", 2], ["podtower", 1]], ["controltower"], ["hazard", "panels", "beacons"], GREY),
  T06: kit("eastern", [["paperhouse", 3], ["house", 3], ["teahouse", 2], ["stage", 1]], ["pagoda"], ["whitelanterns", "tattered", "ruin", "paper"], GREY),
  T07: kit("eastern", [["house", 3], ["teahouse", 3], ["hall", 2], ["pavilion", 1]], ["watermill"], ["lanterns", "banners", "rainy"], WARM),
  T08: kit("victorian", [["house", 3], ["townhouse", 2], ["workshop", 2], ["tower", 1]], ["observatory", "minehead"], ["brass", "verdigris"], GREY),
  T09: kit("urban", [["mixeduse", 4], ["konbini", 2], ["townhouse", 2], ["shelter", 1]], ["watertower"], ["neon", "acunits", "wires"], GREY),
  T10: kit("victorian", [["townhouse", 3], ["inn", 2], ["tower", 1]], ["clocktower"], ["brass", "awnings"], WARM),
  T11: kit("victorian", [["townhouse", 3], ["workshop", 3], ["shop", 2], ["tower", 1]], ["clocktower", "stationhall"], ["gears", "pipes", "copper"], WARM),
  T12: kit("nordic", [["chapel", 2], ["cottage", 3], ["lodge", 2], ["house", 2]], ["stavechurch"], ["snowcap", "icicles"], GREY),
  T13: kit("organic", [["ribhouse", 3], ["podtower", 2], ["domehouse", 2]], ["shellhouse"], ["veins", "glow"]),
  T14: kit("mediterranean", [["domehouse", 3], ["house", 2], ["wreckhouse", 2], ["colonnade", 1]], ["shellhouse"], ["shells", "seaweed", "flowers"], PASTEL),
  T15: kit("whimsy", [["bookhouse", 4], ["origami", 2], ["house", 2]], ["bookstack"], ["pages", "ink"], WARM),
  T16: kit("arcane", [["obelisk", 3], ["shardhouse", 3], ["domehouse", 1]], ["ringtemple"], ["runes", "glow"]),
  T17: kit("urban", [["terminal", 2], ["shelter", 2], ["booth", 2], ["shed", 1]], ["controltower"], ["hazard", "signs"], GREY),
  T18: kit("frontier", [["motel", 2], ["diner", 2], ["shed", 2], ["house", 2], ["shop", 2]], ["gasstation", "watertower"], ["neon", "signs", "dust"], PAINT),
  T19: kit("industrial", [["container", 5], ["shed", 2], ["booth", 1]], ["gantry"], ["rust", "hazard", "stencil"], GREY),
  T20: kit("nordic", [["aframe", 3], ["lodge", 3], ["cottage", 2]], ["observatory"], ["snowcap", "icicles", "falun"], WARM),
  T21: kit("mediterranean", [["inverted", 3], ["house", 3], ["townhouse", 2]], ["clocktower"], ["flowers", "odd"], PASTEL),
  T22: kit("whimsy", [["penciltower", 4], ["shavingpavilion", 2], ["eraserhut", 2]], ["watchtower"], ["graphite", "shavings"]),
  T23: kit("organic", [["ribhouse", 3], ["podtower", 2], ["hall", 1]], ["shellhouse"], ["veins"]),
  T24: kit("urban", [["townhouse", 2], ["booth", 2], ["shelter", 1]], ["stationhall"], ["neon", "artdeco", "flood"], WARM),
  T25: kit("classical", [["colonnade", 2], ["tower", 2], ["domehouse", 1]], ["observatory"], ["brass", "stars"]),
  T26: kit("organic", [["hexhive", 4], ["podtower", 1]], ["hexhive"], ["wax", "glow"]),
  T27: kit("victorian", [["townhouse", 3], ["shed", 1], ["hall", 2]], ["clocktower"], ["school"], WARM),
  T28: kit("urban", [["shelter", 3], ["konbini", 2], ["booth", 1]], ["watertower"], ["signs", "hazard"], GREY),
  T29: kit("whimsy", [["saltblock", 3], ["driftshack", 2], ["cottage", 2]], ["windmill"], ["salt", "glow"]),
  T30: kit("industrial", [["shed", 4], ["shelter", 2], ["container", 1]], ["gantry"], ["hazard", "feathers"], GREY),
  T31: kit("frontier", [["umbrellahouse", 4], ["adobe", 3], ["house", 1]], ["watertower"], ["canvas", "dust"], WARM),
  T32: kit("mediterranean", [["corkhouse", 3], ["bottledome", 2], ["driftshack", 2], ["house", 2]], ["lighthouse"], ["rope", "flowers"], PASTEL),
  T33: kit("eastern", [["house", 3], ["teahouse", 2], ["stage", 1], ["hall", 2]], ["shrine"], ["neon", "cables", "lanterns"], GREY),
  T34: kit("whimsy", [["booth", 3], ["house", 2], ["stage", 1], ["hall", 1], ["puppetbooth", 1], ["scenerystore", 1]], ["carousel", "circustent"], ["bunting", "bones", "stripes"]),
  T35: kit("organic", [["domehouse", 3], ["podtower", 1]], ["shellhouse"], ["aquatic", "glow"]),
  T36: kit("frontier", [["barn", 3], ["house", 3], ["silo", 1], ["shed", 1], ["shop", 1]], ["windmill", "watermill"], ["hay", "dust"], PAINT),
  T37: kit("industrial", [["shelter", 3], ["container", 2], ["podtower", 1]], ["minehead"], ["hazard", "rust"], GREY),
  T38: kit("medieval", [["tower", 3], ["townhouse", 3], ["shop", 2], ["cottage", 1]], ["clocktower"], ["banners", "iron", "halftimber"], WARM),
  T39: kit("urban", [["subwaycar", 3], ["booth", 2], ["shelter", 1]], ["stationhall"], ["signs", "tiles"], GREY),
  T40: kit("nordic", [["townhouse", 3], ["workshop", 2], ["domehouse", 1]], ["clocktower"], ["brass", "gears"], WARM),
  T41: kit("victorian", [["townhouse", 3], ["booth", 2], ["shed", 2], ["shop", 1]], ["postoffice"], ["soot", "snowcap", "mail"], WARM),
  T42: kit("classical", [["colonnade", 2], ["chapel", 2], ["obelisk", 2], ["shardhouse", 1]], ["prismchapel"], ["candles", "glass"]),
  T43: kit("eastern", [["teahouse", 3], ["pavilion", 3], ["stilthut", 2], ["house", 1]], ["watermill"], ["copper", "steam", "lanterns"], WARM),
  T44: kit("industrial", [["shelter", 3], ["container", 2], ["shed", 1]], ["tesseract"], ["hazard"], GREY),
  T45: kit("classical", [["colonnade", 2], ["hall", 2], ["domehouse", 1]], ["rotunda"], ["lace", "flowers"]),
  T46: kit("industrial", [["driftshack", 3], ["shed", 2], ["booth", 1]], ["crttower"], ["foil", "static"], GREY),
  T47: kit("industrial", [["scrapstilt", 4], ["container", 2], ["shed", 1]], ["gantry"], ["rust", "patch", "hazard"], GREY),
  T48: kit("victorian", [["hall", 2], ["scenerystore", 2], ["puppetbooth", 1], ["booth", 1], ["shed", 1]], ["theater", "flytower"], ["velvet", "ropes"], WARM),
};

export const kitFor = (theme: string): ThemeKit => THEME_KITS[theme] ?? THEME_KITS.T04!;
export const kindSpec = (kind: string): KindSpec => KINDS[kind] ?? KINDS.house!;
