// Lighting & grading presets shared by the three.js preview and the Godot presentation.
import { hex, shade, mixc, type RGB } from "./color";
import type { ThemeDesign } from "../themes";
import type { Lighting } from "../types";

export type LightingPreset = {
  name: Lighting;
  night: boolean;
  /** Unit vector pointing from the scene toward the sun / moon. */
  sunDir: [number, number, number];
  sunColor: RGB;
  sunIntensity: number;
  skyColor: RGB;
  groundColor: RGB;
  ambient: number;
  fogColor: RGB;
  fogDensity: number;
  bgTop: RGB;
  bgBottom: RGB;
  exposure: number;
  bloom: { strength: number; threshold: number; radius: number };
  vignette: number;
  grain: number;
  saturation: number;
  splitShadow: RGB;
  splitHighlight: RGB;
  /** Multiplier for baked lamp light in vertex colours. */
  lamp: number;
  lampColor: RGB;
  /** Emissive strength of lit windows / signs (0 = daytime glass). */
  windowGlow: number;
  flicker: number;
  motes: RGB;
};

const dir = (azimuthDeg: number, elevationDeg: number): [number, number, number] => {
  // Azimuth 0 = toward +z (south, the camera side), 90 = toward +x (east).
  const a = (azimuthDeg * Math.PI) / 180, e = (elevationDeg * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
};

export function lightingFor(design: ThemeDesign, lighting: Lighting): LightingPreset {
  const sun = hex(design.pal.sun), sky = hex(design.pal.sky), glow = hex(design.pal.glow);
  const warm: RGB = [255, 214, 160];
  switch (lighting) {
    case "day":
      return {
        name: lighting, night: false, sunDir: dir(-42, 38), sunColor: mixc(sun, [255, 224, 176], 0.45), sunIntensity: 2.65,
        skyColor: mixc(sky, [128, 162, 222], 0.6), groundColor: mixc(hex(design.pal.ground), [130, 98, 76], 0.5), ambient: 0.45,
        fogColor: mixc(sky, [220, 212, 190], 0.35), fogDensity: 0.006, bgTop: shade(mixc(sky, [120, 160, 210], 0.4), 0.1), bgBottom: mixc(sky, [236, 226, 200], 0.5),
        exposure: 0.93, bloom: { strength: 0.42, threshold: 0.92, radius: 0.62 }, vignette: 0.48, grain: 0.03, saturation: 1.05,
        splitShadow: [58, 80, 138], splitHighlight: [255, 214, 160], lamp: 0.32, lampColor: mixc(glow, warm, 0.5), windowGlow: 0.12, flicker: 0,
        motes: [255, 240, 200],
      };
    case "dusk":
      return {
        name: lighting, night: false, sunDir: dir(-68, 24), sunColor: mixc(sun, [255, 165, 90], 0.55), sunIntensity: 2.5,
        skyColor: mixc(sky, [110, 100, 170], 0.6), groundColor: [110, 74, 64], ambient: 0.42,
        fogColor: mixc(sky, [200, 130, 110], 0.45), fogDensity: 0.008, bgTop: mixc(sky, [70, 70, 120], 0.55), bgBottom: mixc(sun, [240, 150, 100], 0.5),
        exposure: 1.0, bloom: { strength: 0.55, threshold: 0.85, radius: 0.7 }, vignette: 0.5, grain: 0.035, saturation: 1.14,
        splitShadow: [70, 70, 140], splitHighlight: [255, 190, 120], lamp: 0.95, lampColor: mixc(glow, warm, 0.4), windowGlow: 0.9, flicker: 0.04,
        motes: [255, 200, 150],
      };
    case "night":
      return {
        name: lighting, night: true, sunDir: dir(-25, 42), sunColor: [140, 165, 235], sunIntensity: 0.7,
        skyColor: [58, 74, 128], groundColor: [34, 30, 40], ambient: 0.36,
        fogColor: mixc(sky, [30, 40, 70], 0.6), fogDensity: 0.01, bgTop: [10, 14, 30], bgBottom: mixc(sky, [40, 50, 80], 0.5),
        exposure: 1.1, bloom: { strength: 0.75, threshold: 0.7, radius: 0.8 }, vignette: 0.55, grain: 0.04, saturation: 1.08,
        splitShadow: [40, 60, 130], splitHighlight: [255, 190, 120], lamp: 1.85, lampColor: mixc(glow, warm, 0.3), windowGlow: 1.6, flicker: 0.06,
        motes: [255, 210, 150],
      };
    case "interior":
      return {
        name: lighting, night: design.tod === "night", sunDir: dir(-30, 55), sunColor: mixc(sun, [255, 230, 200], 0.5), sunIntensity: design.tod === "night" ? 0.25 : 0.7,
        skyColor: mixc(hex(design.pal.inwall), [120, 110, 100], 0.5), groundColor: [60, 45, 36], ambient: 0.42,
        fogColor: shade(hex(design.pal.inwall), -0.6), fogDensity: 0.004, bgTop: [8, 7, 8], bgBottom: [18, 14, 14],
        exposure: 1.05, bloom: { strength: 0.6, threshold: 0.8, radius: 0.75 }, vignette: 0.55, grain: 0.035, saturation: 1.1,
        splitShadow: [50, 55, 110], splitHighlight: [255, 200, 140], lamp: 1.55, lampColor: mixc(glow, warm, 0.35), windowGlow: 1.2, flicker: 0.03,
        motes: [255, 220, 170],
      };
    case "void":
      return {
        name: lighting, night: true, sunDir: dir(20, 30), sunColor: mixc(sun, [180, 170, 255], 0.5), sunIntensity: 0.9,
        skyColor: [80, 70, 140], groundColor: [30, 24, 50], ambient: 0.6,
        fogColor: mixc(sky, [40, 30, 80], 0.5), fogDensity: 0.014, bgTop: [6, 6, 20], bgBottom: mixc(sky, [60, 40, 110], 0.5),
        exposure: 1.1, bloom: { strength: 0.85, threshold: 0.5, radius: 0.85 }, vignette: 0.5, grain: 0.05, saturation: 1.08,
        splitShadow: [60, 40, 140], splitHighlight: [200, 200, 255], lamp: 1.5, lampColor: mixc(glow, [200, 210, 255], 0.3), windowGlow: 1.3, flicker: 0.05,
        motes: [200, 200, 255],
      };
    case "fluorescent":
    default:
      return {
        name: "fluorescent", night: false, sunDir: dir(-10, 75), sunColor: [255, 250, 220], sunIntensity: 0.45,
        skyColor: [215, 205, 150], groundColor: [150, 130, 80], ambient: 0.62,
        fogColor: [120, 112, 70], fogDensity: 0.01, bgTop: [30, 28, 16], bgBottom: [60, 56, 30],
        exposure: 1.0, bloom: { strength: 0.5, threshold: 0.9, radius: 0.7 }, vignette: 0.6, grain: 0.07, saturation: 0.95,
        splitShadow: [110, 110, 70], splitHighlight: [255, 250, 200], lamp: 1.0, lampColor: [250, 250, 225], windowGlow: 0.6, flicker: 0.12,
        motes: [255, 255, 220],
      };
  }
}
