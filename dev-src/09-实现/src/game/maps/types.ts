// P5 map layout contract (p5-hd2d-2). The layout is the saved, authoritative gameplay record.
// Rendering detail is derived deterministically from it by maps/render/* and never saved.
export type Point = { x: number; z: number };
export type Rect = { x: number; z: number; w: number; d: number };
export type AssetBounds = {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
};
export type ThemeProfile = {
  id: string;
  name: string;
  mood: string;
  family: string;
  indoor: boolean;
  terrain: number;
  path: number;
};
export type OutdoorArchetype = "town" | "canal" | "cliff" | "canyon" | "grove" | "isles" | "works";
export type InteriorArchetype =
  | "hall"
  | "corridor"
  | "cave"
  | "tiered"
  | "stacks"
  | "platform"
  | "cloister"
  | "foundry"
  | "pool";
export type AnomalyKind = "backrooms" | "poolrooms" | "collage" | "misregistered";
export type Archetype = OutdoorArchetype | InteriorArchetype;
/** Kept under its historical name: the generated floor structure. */
export type Scheme = Archetype | AnomalyKind;
export type Facing = "n" | "s" | "e" | "w";
export type Road = {
  id: string;
  kind: "main" | "branch" | "loop" | "bridge" | "approach" | "stair" | "corridor";
  width: number;
  points: Point[];
};
export type Plaza = {
  id: string;
  center: Point;
  radius: number;
  kind: "entry" | "civic" | "junction" | "landing" | "hall" | "room";
};
/** A straight flight. Cells x..x+w-1, z..z+d-1. `dir` is the ascending direction. */
export type Stair = {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  dir: Facing;
  h0: number;
  h1: number;
  kind: "masonry" | "wood" | "rock" | "metal" | "ramp" | "tier";
};
export type RoofForm =
  | "gable"
  | "hip"
  | "flat"
  | "eaves"
  | "dome"
  | "saw"
  | "barrel"
  | "cone"
  | "mansard"
  | "tent";
export type Building = {
  id: string;
  role: "house" | "shop" | "hut" | "tower" | "gate" | "backdrop" | "landmark" | "intrusion";
  theme: string;
  /** Footprint cells x..x+w-1, z..z+d-1 (non-walkable unless enterable interior). */
  x: number;
  z: number;
  w: number;
  d: number;
  baseY: number;
  facing: Facing;
  door: Point;
  floors: number;
  style: string;
  /** Building kind from the theme kit (townhouse, cottage, shop … or a signature form: windmill, pagoda …). */
  kind: string;
  roof: RoofForm;
  seed: number;
  enterable: boolean;
  /** Height of the terrace behind the back wall, when the building is split-level. */
  backY: number | null;
  /** Anomaly-only presentation offsets (degrees / metres). Always 0 on ordinary floors. */
  yaw: number;
  lift: number;
};
export type Room = {
  id: string;
  kind: string;
  x: number;
  z: number;
  w: number;
  d: number;
  y: number;
  building: string | null;
};
/** Compact prop record: [kind, x, z, y, rotationDeg, variant, scale]. */
export type PropTuple = [string, number, number, number, number, number, number];
export type Intrusion = { kind: string; x: number; z: number; source: string };
export type POI = {
  kind: "entry" | "down" | "supplier" | "chest" | "encounter";
  id: string;
  x: number;
  z: number;
};
export type Lighting = "day" | "dusk" | "night" | "interior" | "void" | "fluorescent";
export type LayoutStats = {
  buildings: number;
  enterable: number;
  rooms: number;
  stairs: number;
  props: number;
  blockingProps: number;
  lights: number;
  levels: number;
  heightRange: number;
  wallLength: number;
  walkableCells: number;
  reachableCells: number;
  entryExitSteps: number;
  attempts: number;
  loops: number;
  roadLength: number;
  districts: number;
};
export type FloorLayout = {
  version: "p5-hd2d-2";
  id: string;
  seed: number;
  regionSeed: number;
  depth: number;
  visit: number;
  theme: string;
  themeName: string;
  sceneName: string;
  scheme: Scheme;
  archetype: Archetype;
  interior: boolean;
  width: number;
  height: number;
  landMode: "solid" | "canal" | "islands" | "coast" | "chasm" | "interior";
  lighting: Lighting;
  anomaly: {
    active: boolean;
    chance: number;
    roll: number;
    forced: boolean;
    kind: string;
    intrusions: Intrusion[];
  };
  levels: number[];
  roads: Road[];
  plazas: Plaza[];
  landmasses: Rect[];
  buildings: Building[];
  rooms: Room[];
  stairs: Stair[];
  /** Props (historical field name). See PropTuple. */
  decorations: PropTuple[];
  /** Per-cell surface codes, see SURFACE in grid.ts. */
  surface: string[];
  /** Historical land code per cell: L land, W water, V void. */
  terrain: string[];
  /** Authoritative navigation: '.' walkable, '#' blocked; 4-neighbour steps. */
  tiles: string[];
  roadMask: string[];
  /** Walking-surface / top height per cell (metres), row-major. */
  heights: number[];
  spawn: Point;
  down: Point;
  pois: POI[];
  stats: LayoutStats;
  fingerprint: string;
};
export type GenerateOptions = {
  seed: number;
  depth: number;
  visit: number;
  theme: string;
  anomalyChance?: number;
  anomalyMode?: "auto" | "normal" | "forced";
  /** Development override of the floor structure (tests / preview). */
  scheme?: Archetype;
  /** Development override of the anomaly variety when an anomaly is active. */
  anomalyKind?: AnomalyKind;
};
export type LayoutIssue = { rule: string; ids: string[]; detail: string };
