// P5 theme design table: 48 themes × 3 sub-scenes. Pure data; generation and rendering read it.
// Scene index = (depth-1)%3, matching THEMES[theme].scenes in content.ts.
import type { Archetype, Lighting } from "./types";

export type MaterialId =
  // ground / paths
  | "grass" | "drygrass" | "dirt" | "sand" | "snow" | "rubble" | "moss" | "salt" | "flesh" | "paper" | "ash"
  | "cobble" | "slab" | "flagstone" | "brickpave" | "planks" | "asphalt" | "gravel" | "tiles" | "grate" | "hexfloor"
  // walls
  | "plaster" | "stone" | "brick" | "timber" | "logs" | "boards" | "metal" | "corrugated" | "concrete" | "adobe"
  | "paperwall" | "fleshwall" | "coral" | "glass" | "wallpaper" | "panel" | "tilewall" | "velvet" | "wax" | "bookshelf"
  | "bamboo"
  // roofs
  | "terracotta" | "slate" | "glazed" | "thatch" | "shingle" | "roofmetal" | "copper" | "tent" | "shellroof"
  // trim / structure
  | "wood" | "darkwood" | "lacquer" | "sandstone" | "ironwork" | "brass" | "bone" | "crystal"
  // cliffs
  | "rock" | "redrock" | "basalt" | "ice" | "earth" | "pagestack" | "masonry"
  // interior floors
  | "woodfloor" | "carpet" | "marble" | "floortile" | "rockfloor"
  // misc
  | "leaves" | "pine" | "canvas" | "cloth" | "water" | "emissive" | "foliagecard" | "flowercard" | "grasscard" | "moquette";

export type Palette = {
  ground: string; path: string; wall: string; wall2: string; roof: string; trim: string; cliff: string;
  floor: string; inwall: string; foliage: string; accent: string; water: string; sky: string; sun: string; glow: string;
};
export type ThemeMaterials = {
  ground: MaterialId; path: MaterialId; wall: MaterialId; wall2: MaterialId; roof: MaterialId; trim: MaterialId;
  cliff: MaterialId; floor: MaterialId; inwall: MaterialId;
};
export type FloraKind = "broadleaf" | "pine" | "snowpine" | "bamboo" | "willow" | "dead" | "palm" | "cactus" | "crystal"
  | "coral" | "pencil" | "fleshy" | "paper" | "birch" | "maple" | "none";
export type BuildingStyle = "stucco" | "western" | "asian" | "keep" | "brick" | "industrial" | "modern" | "hut"
  | "organic" | "paper" | "crystal" | "tent" | "lodge" | "coral" | "pencil" | "salt" | "adobe";
export type LandmarkKind = "tower" | "gate" | "torii" | "dome" | "ring" | "book" | "wheel" | "statue" | "fountain"
  | "obelisk" | "lighthouse" | "crane" | "clocktower" | "totem" | "arch" | "waterwheel" | "tree" | "portal";
export type ThemeDesign = {
  id: string;
  scenes: [Archetype, Archetype, Archetype];
  tod: "day" | "dusk" | "night";
  style: BuildingStyle;
  mats: ThemeMaterials;
  pal: Palette;
  flora: FloraKind[];
  /** Theme-specific props (render kernel prop kinds). */
  props: string[];
  landmark: LandmarkKind;
  void?: boolean;
  snow?: boolean;
  desaturate?: number;
};

const M = (s: string): ThemeMaterials => {
  const [ground, path, wall, wall2, roof, trim, cliff, floor, inwall] = s.split(" ") as MaterialId[];
  return { ground: ground!, path: path!, wall: wall!, wall2: wall2!, roof: roof!, trim: trim!, cliff: cliff!, floor: floor!, inwall: inwall! };
};
const P = (s: string): Palette => {
  const [ground, path, wall, wall2, roof, trim, cliff, floor, inwall, foliage, accent, water, sky, sun, glow] = s.split(" ").map((c) => "#" + c);
  return { ground: ground!, path: path!, wall: wall!, wall2: wall2!, roof: roof!, trim: trim!, cliff: cliff!, floor: floor!, inwall: inwall!, foliage: foliage!, accent: accent!, water: water!, sky: sky!, sun: sun!, glow: glow! };
};

//                 ground   path      wall      wall2    roof      trim     cliff    floor     inwall
export const THEME_DESIGN: Record<string, ThemeDesign> = {
  T01: { id: "T01", scenes: ["town", "hall", "works"], tod: "dusk", style: "brick",
    mats: M("rubble asphalt stone brick slate ironwork masonry concrete concrete"),
    pal: P("7d7466 5f5c58 9a9486 8a5a48 55585a 7a5a44 7a756b 8a877d 9c988c 6e7a48 a8723f 4b5a52 899281 e9c49a ffcf8a"),
    flora: ["dead", "broadleaf"], props: ["fence", "pump", "crates", "barrel", "cone", "rubble"], landmark: "tower" },
  T02: { id: "T02", scenes: ["cliff", "cave", "isles"], tod: "day", style: "asian",
    mats: M("grass slab plaster lacquer glazed lacquer rock woodfloor plaster"),
    pal: P("6f9a58 a9a497 e6dfcc 9c3b2e 5e7d74 a8412f 8a8f86 9b6b43 d9cfb6 5d8f4f c9a54a 5f8f8c a9c1b5 f4efcd ffd08a"),
    flora: ["pine", "bamboo"], props: ["altar", "basin", "bell", "lantern", "incense"], landmark: "torii" },
  T03: { id: "T03", scenes: ["grove", "canal", "cave"], tod: "dusk", style: "hut",
    mats: M("drygrass dirt logs boards thatch wood earth dirt logs"),
    pal: P("9c8f58 a07e56 8a6440 c2a27a b0914f 6b4a2e 9a7552 8f6c4a 7d5a3a 7c8a44 b8452e 5b6b4a c9a680 f2c27e ffb866"),
    flora: ["dead", "broadleaf"], props: ["totem", "loom", "well", "brazier", "hide"], landmark: "totem" },
  T04: { id: "T04", scenes: ["town", "corridor", "hall"], tod: "day", style: "keep",
    mats: M("grass cobble stone plaster slate sandstone masonry flagstone stone"),
    pal: P("7a9150 8f8a80 a8a193 d8ccb2 5d6572 c2a67c 8c877c 8a8479 9b958a 5f8446 3f5a9c 557a86 a7b8c2 f5dcb4 ffd08a"),
    flora: ["broadleaf", "pine"], props: ["cart", "rack", "well", "banner", "barrel"], landmark: "gate" },
  T05: { id: "T05", scenes: ["corridor", "foundry", "tiered"], tod: "night", style: "industrial",
    mats: M("grate grate metal panel roofmetal ironwork metal grate panel"),
    pal: P("6d747a 7c848a 8d98a0 4f5a63 6b757c 3f4a53 5a6168 707a82 9aa5ad 5f8a7a e0a13a 3c5a6e 1c2330 9fdcff 8ddaff"),
    flora: ["none"], props: ["console", "pipes", "antenna", "locker", "crates"], landmark: "ring" },
  T06: { id: "T06", scenes: ["grove", "hall", "town"], tod: "night", style: "asian",
    mats: M("dirt slab plaster darkwood glazed darkwood earth woodfloor paperwall"),
    pal: P("6c6a58 6f7266 a79f86 4e3d31 3f4441 3a2c24 6d6452 6a4c36 cfc3a2 4e6248 b0302a 3c4a44 2a3438 9ab8e3 ffb05e"),
    flora: ["willow", "dead"], props: ["mailboxes", "well", "signpost", "lantern", "paperdoll"], landmark: "arch" },
  T07: { id: "T07", scenes: ["canal", "grove", "foundry"], tod: "day", style: "asian",
    mats: M("grass slab plaster wood glazed darkwood rock woodfloor plaster"),
    pal: P("6f8f58 8e918a e3ddd0 7a5436 3e4546 4b3a2c 858a82 8c6440 d8d0bf 587f48 8c2f2a 587c78 9fb2a8 eadbc0 ffd08a"),
    flora: ["bamboo", "willow"], props: ["rack", "cart", "altar", "lantern", "kiln"], landmark: "tower" },
  T08: { id: "T08", scenes: ["cliff", "canyon", "tiered"], tod: "night", style: "keep",
    mats: M("grass slab stone plaster slate brass rock woodfloor plaster"),
    pal: P("55705a 7d8284 c9c2b2 d8d2c2 3f5566 a0824a 5e6468 7a5a40 c7bfae 4f6b55 c49a4a 2e4a5a 1e2c3a 9ab8e3 ffd08a"),
    flora: ["pine"], props: ["telescope", "globe", "books", "barrel", "crates"], landmark: "dome" },
  T09: { id: "T09", scenes: ["platform", "town", "hall"], tod: "night", style: "modern",
    mats: M("asphalt asphalt brick concrete roofmetal ironwork concrete floortile concrete"),
    pal: P("5c5a66 4a4852 7a5048 8a8792 4f5058 3a3d45 5e5c66 9a96a4 8f8b96 4f6b5a f49adb 2c3a4a 1f1a2e 7fa0ff f49adb"),
    flora: ["none", "broadleaf"], props: ["vending", "bench", "cone", "signpost", "bollard"], landmark: "portal" },
  T10: { id: "T10", scenes: ["corridor", "pool", "stacks"], tod: "night", style: "stucco",
    mats: M("carpet carpet wallpaper wood slate wood masonry carpet wallpaper"),
    pal: P("8a3f3a 8a3f3a c8b27a 6b4630 55504a 5a3a26 7a6a5a 8a3f3a c8b27a 5f7a4a c9a54a 5aa2b0 1a1612 ffd49a ffd08a"),
    flora: ["none"], props: ["luggage", "clock", "chair", "plant", "lamp"], landmark: "portal" },
  T11: { id: "T11", scenes: ["foundry", "isles", "town"], tod: "dusk", style: "brick",
    mats: M("dirt brickpave brick plaster copper brass masonry woodfloor brick"),
    pal: P("7f6e58 9a6a4e 9a5c44 d2bc98 5f8a78 b08d4a 8a7a66 8a6a48 8e5a42 6f7a48 c8783a 4f6a6a c2a27a f3b874 ffc070"),
    flora: ["maple", "broadleaf"], props: ["gearpress", "pipes", "cart", "clock", "barrel"], landmark: "clocktower" },
  T12: { id: "T12", scenes: ["grove", "cloister", "cliff"], tod: "day", style: "keep", snow: true,
    mats: M("snow slab stone timber slate wood ice flagstone stone"),
    pal: P("e6ecf0 9aa0a6 b8b4aa d9d0bf 4e5866 5a4636 9aa8b4 9a958c b0aa9e 4d6b5a 8a2f3a 7a98a8 c3d0da f6e2c0 ffd08a"),
    flora: ["snowpine"], props: ["bell", "sarcophagus", "altar", "woodpile", "candles"], landmark: "tower" },
  T13: { id: "T13", scenes: ["stacks", "cave", "hall"], tod: "night", style: "organic",
    mats: M("flesh bone fleshwall bone glass bone flesh flesh fleshwall"),
    pal: P("9a4a4a c9b8a0 8a3a40 d8ccb4 9fc6a8 e0d4bc 7a3a3c a05a55 8f4045 8fbf5a b2ef8c 7a2a30 1a0e10 efb0a7 b2ef8c"),
    flora: ["fleshy"], props: ["vat", "rack", "pump", "pod", "plant"], landmark: "dome" },
  T14: { id: "T14", scenes: ["canal", "canyon", "pool"], tod: "day", style: "coral",
    mats: M("sand slab coral plaster shellroof sandstone rock marble coral"),
    pal: P("d8c9a0 c9b39a e0c0b0 d8d0c0 c98a78 e8e0d0 7a8a86 d0c8b8 d8b8a8 5f9a8a 4f9ab0 3a8a96 6aa0a4 c1eff0 a6ebff"),
    flora: ["coral", "palm"], props: ["basin", "boat", "crystal", "shell", "barrel"], landmark: "arch" },
  T15: { id: "T15", scenes: ["isles", "town", "foundry"], tod: "day", style: "paper", void: true,
    mats: M("paper planks paperwall bookshelf shingle wood pagestack woodfloor bookshelf"),
    pal: P("e8dcc0 b89a6a f0e6d0 8a5a3a c8b890 6a4a30 d8cca8 9a6a44 7a4a2e 8a9a5a 9a3a3a 8aa0b0 d8d0bc fff1ce ffd08a"),
    flora: ["paper", "broadleaf"], props: ["lectern", "books", "cart", "scroll", "lamp"], landmark: "book" },
  T16: { id: "T16", scenes: ["isles", "cloister", "hall"], tod: "night", style: "crystal", void: true,
    mats: M("ash slab stone crystal slate crystal basalt marble stone"),
    pal: P("4a4860 5f5c78 5a5670 9a8ad8 3a3850 c2caff 3e3c52 4e4a66 555070 6a6aa0 c2caff 2a2848 12101e bfb7fa c2caff"),
    flora: ["crystal"], props: ["telescope", "antenna", "crystal", "obelisk", "globe"], landmark: "ring" },
  T17: { id: "T17", scenes: ["hall", "corridor", "canal"], tod: "day", style: "modern",
    mats: M("tiles tiles concrete glass roofmetal ironwork concrete floortile concrete"),
    pal: P("c8ccd0 bfc3c6 d0d4d6 8ab0c0 a0a8b0 6a7278 9aa0a4 c8ccd0 c4c8cc 5f8a6a e0b040 5a8a9a 7f8e96 e9d7ad a3dded"),
    flora: ["none", "broadleaf"], props: ["counter", "turnstile", "bench", "luggage", "signpost"], landmark: "portal" },
  T18: { id: "T18", scenes: ["works", "hall", "canyon"], tod: "dusk", style: "western",
    mats: M("sand asphalt concrete boards roofmetal ironwork redrock floortile plaster"),
    pal: P("b8a47c 5c5a56 c8bfa8 8a8a86 9a4a3a 5a5a58 b07a52 d0c8b4 d8cfb8 8a8a4a e08a3a 5a7a86 c8a07a f5c58a ffd08a"),
    flora: ["cactus", "dead"], props: ["pump", "fence", "crates", "vending", "cone"], landmark: "tower" },
  T19: { id: "T19", scenes: ["works", "foundry", "canal"], tod: "dusk", style: "industrial",
    mats: M("concrete concrete corrugated metal roofmetal ironwork concrete concrete corrugated"),
    pal: P("8a8a86 7a7a76 7a8a8a 9a4a3a 5a6468 4a4e52 6a6a66 8a8680 8a948f 5f7a5a d8a03a 3f5a64 b89478 edba77 ffd08a"),
    flora: ["none", "broadleaf"], props: ["cart", "boat", "rack", "container", "crates"], landmark: "crane" },
  T20: { id: "T20", scenes: ["hall", "corridor", "cliff"], tod: "day", style: "lodge", snow: true,
    mats: M("snow planks logs plaster shingle wood ice woodfloor logs"),
    pal: P("eef2f4 9a7a5a 9a6e48 e8e0d0 5a4a3e 5a3e2a b8c8d4 a07a50 9a6a44 4d6b5a b83a3a 9ab8c8 d6e2ea fff2bc ffd08a"),
    flora: ["snowpine"], props: ["bench", "well", "kiln", "woodpile", "sled"], landmark: "dome" },
  T21: { id: "T21", scenes: ["isles", "town", "corridor"], tod: "dusk", style: "stucco", void: true,
    mats: M("grass brickpave plaster brick terracotta wood earth woodfloor wallpaper"),
    pal: P("7a8a6a a07a64 d0c4b0 a0685a a85a44 5a4a3e 7a6a5a 8a6a4a b8a890 6a8a5a 5a7ab0 7a8aa0 9aa0a8 e8c0a8 ffd08a"),
    flora: ["broadleaf"], props: ["mailboxes", "swing", "signpost", "laundry", "plant"], landmark: "arch" },
  T22: { id: "T22", scenes: ["canyon", "grove", "cave"], tod: "day", style: "pencil", desaturate: 0.55,
    mats: M("grass planks timber stone slate wood earth woodfloor stone"),
    pal: P("8a9a5a c8a878 d8b070 4a4a4e 5a5a60 c89a5a b8a078 b08a58 6a6a70 7a9a58 e0c040 8aa0a8 e0d4b0 fff0be ffd08a"),
    flora: ["pencil", "broadleaf"], props: ["rack", "vat", "bench", "eraser", "books"], landmark: "tree" },
  T23: { id: "T23", scenes: ["hall", "corridor", "stacks"], tod: "night", style: "organic",
    mats: M("flesh floortile fleshwall bone slate bone flesh floortile wallpaper"),
    pal: P("a86a60 b89a8a 9a5a54 e0d0b8 6a4a44 e0d0b8 7a4a44 a86a60 b07a6a 8a9a5a c9b88a 7a3a3a 2a1a18 dfb995 ffd08a"),
    flora: ["fleshy"], props: ["counter", "cabinet", "bench", "desk", "files"], landmark: "arch" },
  T24: { id: "T24", scenes: ["pool", "tiered", "corridor"], tod: "night", style: "stucco",
    mats: M("carpet carpet velvet wood slate brass masonry carpet velvet"),
    pal: P("6a2a34 6a2a34 7a3a3a 5a3a2a 4a3a3a a88a4a 5a4a44 6a2a34 6a2e34 5a7a5a e0c060 3a6a78 101418 f7d692 a3def2"),
    flora: ["none"], props: ["ticket", "seats", "console", "poster", "lamp"], landmark: "portal" },
  T25: { id: "T25", scenes: ["tiered", "cloister", "hall"], tod: "night", style: "crystal",
    mats: M("ash marble stone brass slate brass basalt marble plaster"),
    pal: P("3a4052 4a5064 4a5064 8a7a4a 3a3e50 b09a5a 3a3e4e 3a4052 3e4458 5a7a8a 7ab0e0 2a3a5a 0a0e18 aecaf7 a3def2"),
    flora: ["crystal"], props: ["globe", "telescope", "organ", "orrery", "books"], landmark: "dome" },
  T26: { id: "T26", scenes: ["corridor", "hall", "foundry"], tod: "night", style: "organic",
    mats: M("hexfloor hexfloor wax wood slate darkwood earth hexfloor wax"),
    pal: P("c8a458 c09a50 d8b060 8a6a3a 6a5030 5a4020 8a6a40 c8a458 c89a48 8a9a4a e0c050 7a6a3a 2a1e10 f5d490 ffd08a"),
    flora: ["none"], props: ["mailboxes", "bench", "pump", "table", "honeypot"], landmark: "portal" },
  T27: { id: "T27", scenes: ["corridor", "cloister", "stacks"], tod: "day", style: "brick",
    mats: M("grass floortile plaster plaster slate wood masonry woodfloor plaster"),
    pal: P("7a9a5a c8c4b8 d8d8cc 7a9a8a 5a6068 7a5a3a 8a8a80 b08a60 d4d4c6 5a8a4a 3a6a4a 6a9aa8 8a9a8a f5e5bd ffe0a0"),
    flora: ["broadleaf"], props: ["bell", "cabinet", "bench", "desk", "locker"], landmark: "clocktower" },
  T28: { id: "T28", scenes: ["stacks", "corridor", "hall"], tod: "night", style: "modern",
    mats: M("floortile floortile plaster metal roofmetal ironwork concrete floortile plaster"),
    pal: P("e0e0d8 d8d8d0 e8e8e0 c0c4c0 8a9090 8a9090 9a9a94 e0e0d8 e8e8e0 6a9a6a d84a3a 6aa0b0 1a1c1c d9ecde e8f4ff"),
    flora: ["none"], props: ["rack", "turnstile", "cart", "fridge", "counter"], landmark: "portal" },
  T29: { id: "T29", scenes: ["canal", "foundry", "cliff"], tod: "dusk", style: "salt",
    mats: M("salt planks plaster wood shingle wood ice woodfloor plaster"),
    pal: P("e8ece8 a08a6a e0e4de 8a6a4a 6a6a64 5a4a3a c8d0cc 9a7a5a d8dcd6 7a9a8a 8ae0c8 1a2a2e 9dafaa d5ffde a3def2"),
    flora: ["crystal", "dead"], props: ["pump", "crystal", "cart", "saltpile", "barrel"], landmark: "tower" },
  T30: { id: "T30", scenes: ["foundry", "stacks", "isles"], tod: "day", style: "industrial", void: true,
    mats: M("grate grate corrugated tilewall roofmetal ironwork rock floortile tilewall"),
    pal: P("8a9098 8a9098 b8c0c4 d8dcdc 7a848a 5a6268 c8d0d4 d0d4d4 dce0e0 7a9a8a c85a4a 9ab0bc b8c8d0 e6c8a2 ffd08a"),
    flora: ["none"], props: ["pipes", "gearpress", "rack", "hook", "crates"], landmark: "crane" },
  T31: { id: "T31", scenes: ["canyon", "hall", "cliff"], tod: "day", style: "western",
    mats: M("sand dirt adobe boards shingle wood redrock planks adobe"),
    pal: P("d0a868 c09060 c88a5a 9a6a44 7a5236 6a4a30 c06a3e a07a50 c49a70 8a8a48 3a8aa0 5a8a9a e0c090 ffe0a6 ffc070"),
    flora: ["cactus", "dead"], props: ["umbrella", "well", "bench", "barrel", "cart"], landmark: "tower" },
  T32: { id: "T32", scenes: ["cliff", "tiered", "isles"], tod: "day", style: "stucco",
    mats: M("sand slab plaster stone terracotta wood rock floortile plaster"),
    pal: P("e0d0a8 d0c8b4 f0ece0 c8b89a b8603e 4a6a8a b8a888 d8d0c0 e8e0d0 6a9a5a 4a8ab0 4ab0b0 a8d0cc fff0b5 ffd08a"),
    flora: ["palm", "broadleaf"], props: ["boat", "pump", "rack", "bottle", "barrel"], landmark: "lighthouse" },
  T33: { id: "T33", scenes: ["town", "cliff", "hall"], tod: "dusk", style: "asian",
    mats: M("gravel slab plaster lacquer copper brass rock woodfloor wood"),
    pal: P("a09a8a a8a498 e8e0d0 a8402e 5a8a7a b08a4a 8a8a80 9a6a40 8a5a3a 5a8a4a c83a2a 5a8a8a 9aaaa8 f9bf8c ffc070"),
    flora: ["maple", "pine"], props: ["gearpress", "bell", "pipes", "lantern", "altar"], landmark: "torii" },
  T34: { id: "T34", scenes: ["town", "grove", "hall"], tod: "night", style: "tent",
    mats: M("dirt brickpave bone boards tent bone earth planks bone"),
    pal: P("6a6458 8a7a6a e0d8c8 b84a4a d8d0c0 d8ccb4 5e5a50 8a6a4a d0c8b8 4a5a48 e0b050 3a4a50 1e2630 9ab8e3 ffc070"),
    flora: ["dead"], props: ["swing", "ticket", "organ", "balloon", "bench"], landmark: "wheel" },
  T35: { id: "T35", scenes: ["corridor", "platform", "pool"], tod: "night", style: "coral",
    mats: M("floortile floortile tilewall glass shellroof ironwork rock floortile tilewall"),
    pal: P("6a9aa8 7aa6b2 8ab8c0 7ac0d0 5a8a96 c0c8c8 4a6a70 6a9aa8 9ac4cc 5a9a8a f0a060 3a8a9a 0c1a22 b5eff9 a3def2"),
    flora: ["coral"], props: ["tank", "console", "bench", "shell", "plant"], landmark: "arch" },
  T36: { id: "T36", scenes: ["grove", "canal", "stacks"], tod: "night", style: "western",
    mats: M("drygrass dirt boards plaster shingle wood earth planks boards"),
    pal: P("8a7a4a 7a6448 8a3a2e d0c0a0 5a4a40 d8d0c0 6a5a44 8a6a44 7a4a34 6a6a3a d8b050 3a4a48 2a2c26 f7cc7e ffc070"),
    flora: ["dead", "broadleaf"], props: ["cart", "well", "fence", "haybale", "scarecrow"], landmark: "waterwheel" },
  T37: { id: "T37", scenes: ["hall", "cave", "tiered"], tod: "night", style: "industrial",
    mats: M("rockfloor carpet panel wood roofmetal brass rock carpet wallpaper"),
    pal: P("6a5e54 7a4a3a 6a5a4e 7a5438 5a5048 a88a4a 6a5e54 7a4a3a 8a7048 6a7a5a e07a3a 7a3a2a 1a1410 ffb482 ffb482"),
    flora: ["crystal"], props: ["pipes", "gearpress", "console", "luggage", "lamp"], landmark: "tower" },
  T38: { id: "T38", scenes: ["canyon", "corridor", "town"], tod: "day", style: "keep",
    mats: M("dirt cobble stone plaster slate wood masonry flagstone stone"),
    pal: P("8a7a64 9a9284 b0a896 d0c4a8 5a5e66 6a4e36 9a9284 8a8478 a8a090 6a7a4a 9a4a3a 5a6a70 aaa59a edce9f ffd08a"),
    flora: ["broadleaf", "pine"], props: ["cabinet", "rack", "obelisk", "stall", "barrel"], landmark: "gate" },
  T39: { id: "T39", scenes: ["corridor", "platform", "cave"], tod: "night", style: "modern",
    mats: M("paper floortile tilewall metal roofmetal ironwork pagestack floortile tilewall"),
    pal: P("e8e0cc c8ccc8 e0e4e0 7a868a 5a6468 4a5458 d8d0bc c8ccc8 e0e4e0 5a8a7a 3ab0a0 3a5a6a 101418 a6e4e3 a3def2"),
    flora: ["none"], props: ["turnstile", "ticket", "bench", "vending", "signpost"], landmark: "portal" },
  T40: { id: "T40", scenes: ["stacks", "foundry", "pool"], tod: "night", style: "brick",
    mats: M("woodfloor woodfloor panel plaster slate brass masonry woodfloor wallpaper"),
    pal: P("7a5a3e 7a5a3e 6a4a34 d0c4a8 4a4e50 b09050 5a5a56 7a5a3e 4a6a5a 5a8a6a c8a050 3a7a7a 101816 fcd497 a3def2"),
    flora: ["none"], props: ["clock", "gearpress", "counter", "cabinet", "lamp"], landmark: "clocktower" },
  T41: { id: "T41", scenes: ["hall", "works", "town"], tod: "night", style: "brick", snow: true,
    mats: M("snow slab brick plaster slate wood rock woodfloor plaster"),
    pal: P("5a5e66 6a6e74 7a4a3e c8c0b0 3a3e46 4a3a2e 4e525a 7a5a40 c0b8a8 3e4a44 b83a3a 3a4a54 1e222a 9ab8e3 ffc070"),
    flora: ["snowpine", "dead"], props: ["mailboxes", "cart", "signpost", "sacks", "lamp"], landmark: "clocktower" },
  T42: { id: "T42", scenes: ["grove", "town", "cloister"], tod: "day", style: "crystal",
    mats: M("grass slab glass stone crystal stone rock marble stone"),
    pal: P("7a9a7a c8ccd0 b8d8e0 d8d8d0 9ac8d8 e0e0d8 a0a8a8 e0e0d8 d0d0c8 6a9a7a a8e0f0 7ab0c0 c8dce0 cdebf6 ffd08a"),
    flora: ["birch", "crystal"], props: ["sarcophagus", "crystal", "bench", "gravestone", "candles"], landmark: "obelisk" },
  T43: { id: "T43", scenes: ["grove", "hall", "canyon"], tod: "day", style: "asian",
    mats: M("grass planks plaster bamboo glazed copper rock woodfloor bamboo"),
    pal: P("6a8a5a 8a6a4a e0d8c8 b0a060 4a5450 b07a4a 7a8078 9a7048 a89a60 6a9a4a c8783a 6a9090 b8c8b0 ffdb9a ffd08a"),
    flora: ["bamboo"], props: ["bamboo", "pipes", "kiln", "teatable", "lantern"], landmark: "tower" },
  T44: { id: "T44", scenes: ["stacks", "hall", "foundry"], tod: "night", style: "industrial",
    mats: M("concrete concrete metal concrete roofmetal ironwork concrete concrete metal"),
    pal: P("8a9098 8a9098 9aa0a8 7a8088 6a7078 d0b040 6a7078 8a9098 9aa0a8 6a8a8a c8cbff 3a4a5a 101218 c8cbff c8cbff"),
    flora: ["none"], props: ["rack", "console", "turnstile", "crates", "cube"], landmark: "portal" },
  T45: { id: "T45", scenes: ["hall", "tiered", "corridor"], tod: "night", style: "stucco",
    mats: M("marble carpet wallpaper wood terracotta brass masonry marble wallpaper"),
    pal: P("e0d8cc a83a3a e8dcc4 8a5a3a a85a44 c8a458 8a8070 e0d8cc e8dcc4 6a8a5a b83a3a 6a9aa0 1a1410 ffd8a3 ffd8a3"),
    flora: ["none"], props: ["stage", "chair", "organ", "table", "flowers"], landmark: "arch" },
  T46: { id: "T46", scenes: ["cliff", "isles", "platform"], tod: "night", style: "crystal", void: true,
    mats: M("sand planks metal glass roofmetal ironwork rock grate metal"),
    pal: P("8a8898 6a6a7a 7a7e98 9aa0e0 5a5e78 4a4e68 5a5a70 6a6e80 7a7e98 6a8a8a c7c9ff 2a3050 161a2e c7c9ff a3def2"),
    flora: ["crystal"], props: ["antenna", "console", "globe", "buoy", "crystal"], landmark: "obelisk" },
  T47: { id: "T47", scenes: ["works", "isles", "foundry"], tod: "night", style: "industrial", void: true,
    mats: M("rubble grate metal panel roofmetal ironwork metal grate metal"),
    pal: P("6a6660 7a7a78 7a6a5a 8a9090 5a5a58 4a4a48 5a5650 6e6e6c 7a7068 5a6a5a ffb990 2a3040 14161e ffb990 a3def2"),
    flora: ["none", "dead"], props: ["crates", "gearpress", "buoy", "scrap", "container"], landmark: "ring" },
  T48: { id: "T48", scenes: ["corridor", "stacks", "tiered"], tod: "night", style: "brick",
    mats: M("planks planks boards velvet slate wood masonry planks brick"),
    pal: P("7a5236 7a5236 4a3a30 7a2a30 3e3a36 5a3e2a 5a4a40 7a5236 6a4a3a 5a7a4a e0c060 3a4a50 100c0a ffcca3 ffcca3"),
    flora: ["none"], props: ["stage", "rack", "organ", "curtain", "lamp"], landmark: "portal" },
};

export const INTERIOR_ARCHETYPES: readonly Archetype[] = ["hall", "corridor", "cave", "tiered", "stacks", "platform", "cloister", "foundry", "pool"];
export const OUTDOOR_ARCHETYPES: readonly Archetype[] = ["town", "canal", "cliff", "canyon", "grove", "isles", "works"];
export const isInterior = (a: string) => (INTERIOR_ARCHETYPES as readonly string[]).includes(a);

export function sceneLighting(design: ThemeDesign, archetype: Archetype): Lighting {
  if (isInterior(archetype)) return "interior";
  if (archetype === "isles" && design.void) return design.tod === "night" ? "void" : design.tod;
  return design.tod;
}

/** Material/palette sets for the two whole-floor anomaly varieties (not themes; never in the theme stream). */
export const ANOMALY_DESIGN: Record<"backrooms" | "poolrooms", ThemeDesign> = {
  backrooms: { id: "AB", scenes: ["hall", "hall", "hall"], tod: "day", style: "modern",
    mats: M("moquette moquette wallpaper wallpaper roofmetal wood masonry moquette wallpaper"),
    pal: P("b9a46a b9a46a d9c77a c9b366 8a8a7a 9a8a60 8a8466 c2ab6c d8c67c 8a8a50 e8dc9a 7a8a70 3a3620 fff6d0 fff4c8"),
    flora: ["none"], props: [], landmark: "portal", desaturate: 0.1 },
  poolrooms: { id: "AP", scenes: ["pool", "pool", "pool"], tod: "day", style: "modern",
    mats: M("floortile floortile tilewall tilewall roofmetal wood masonry floortile tilewall"),
    pal: P("e6eeee e6eeee eef4f4 d8e6e8 9aa8aa c8d4d4 c0cccc e0eaea eaf2f2 7aa0a0 7ad0e0 6ac8d8 2a3a3e f4ffff e8ffff"),
    flora: ["none"], props: [], landmark: "portal" },
};

/** Sub-scene names per theme (same order as content THEMES[theme].scenes). */
export const SCENE_NAMES: Record<string, [string, string, string]> = {"T01": ["感染街区", "避难所", "污染实验区"], "T02": ["断山古道", "洞府", "倒悬丹宫"], "T03": ["图腾部落", "沼地", "祖灵祭坛"], "T04": ["边境堡垒", "王都地牢", "龙骨殿"], "T05": ["空间站", "机库", "引力反应堆"], "T06": ["荒村", "冥婚宅", "纸扎街"], "T07": ["雨巷", "竹林驿", "铸剑山庄"], "T08": ["海边观测所", "失真矿井", "星骸祭台"], "T09": ["空站", "便利店街", "金融高楼"], "T10": ["长廊", "泳池房", "办公夹层"], "T11": ["发条工坊", "空中车站", "时钟塔"], "T12": ["霜原", "埋雪修院", "冰封钟楼"], "T13": ["异植苗床", "血管廊", "母巢温室"], "T14": ["珊瑚街", "沉舰墓", "深水宫"], "T15": ["漂浮书架", "折纸庭", "倒序印厂"], "T16": ["破碎天体", "法则残廊", "无界门"], "T17": ["反向降雨的候机厅", "永远延误的登机廊", "水面停机坪"], "T18": ["空停车场", "通宵餐厅", "延伸到天边的加油岛"], "T19": ["集装箱峡谷", "起重机森林", "永不靠岸的码头"], "T20": ["玻璃暖房", "朝向太阳的客房", "埋雪观景台"], "T21": ["楼底天台", "垂直客厅街", "悬挂的地下室"], "T22": ["削屑山谷", "橡皮湿地", "石墨树冠"], "T23": ["胃袋大厅", "血管办公街", "骨髓档案室"], "T24": ["水下售票厅", "倒映银幕", "潮汐放映间"], "T25": ["黑暗穹顶", "伪造星图廊", "缩小银河展台"], "T26": ["六边形走廊", "共享厨房", "振翅电梯井"], "T27": ["无人教室", "封闭操场", "无尽考场"], "T28": ["空货架海", "冷柜长廊", "循环收银台"], "T29": ["结晶堤岸", "盐雾泵房", "黑水蒸发池"], "T30": ["云雾流水线", "悬空冷库", "羽毛卸货台"], "T31": ["伞骨沙丘", "无雨驿站", "逆风伞塔"], "T32": ["玻璃海岸", "瓶塞灯塔", "软木群礁"], "T33": ["伺服鸟居", "自动祈愿台", "芯片内殿"], "T34": ["停摆旋转木马", "骨质摩天轮", "售票坟场"], "T35": ["鱼缸卧室", "通往海底的电梯", "梦游展廊"], "T36": ["朝黑日生长的麦田", "倒流水车", "稻草谷仓"], "T37": ["钻头前台", "岩层套房", "地热宴会厅"], "T38": ["墙缝集市", "砖内牢房", "巨门背面"], "T39": ["交叉车厢", "站中站", "纸折隧道"], "T40": ["涨潮柜台", "摆轮海沟", "水下报时厅"], "T41": ["未投递大厅", "煤雪分拣场", "冻住的信箱街"], "T42": ["透明坟场", "棱镜碑林", "折光守墓屋"], "T43": ["铜节竹林", "沸泉茶棚", "蒸汽栈桥"], "T44": ["重复货架", "四向装卸门", "空间库存核"], "T45": ["永远热着的宴席", "空礼堂", "镜中新房"], "T46": ["失真沙滩", "信号浮岛", "白噪港湾"], "T47": ["轨道废物街", "破船拼接港", "磁吸回收场"], "T48": ["换景走廊", "提线仓库", "无观众舞台"]};
