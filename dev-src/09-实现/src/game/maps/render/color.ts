// Colour helpers for pixel-art synthesis: hue-shifted ramps (shadows toward blue, lights toward gold).
export type RGB = [number, number, number];
export const hex = (s: string): RGB => {
  const v = s.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
export const toHex = (c: RGB) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
export function rgb2hsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hsl2rgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const lerpHue = (a: number, b: number, t: number) => { let d = ((b - a + 540) % 360) - 180; return a + d * t; };
/** Shade a colour: k<0 darker (hue → 245°, more saturated), k>0 lighter (hue → 50°, slightly less saturated). */
export function shade(c: RGB, k: number): RGB {
  const [h, s, l] = rgb2hsl(c);
  if (k < 0) {
    const t = Math.min(1, -k);
    return hsl2rgb(lerpHue(h, 245, t * 0.35), Math.min(1, s * (1 + t * 0.35) + t * 0.04), Math.max(0, l * (1 - t * 0.62)));
  }
  const t = Math.min(1, k);
  return hsl2rgb(lerpHue(h, 50, t * 0.3), s * (1 - t * 0.18), Math.min(1, l + (1 - l) * t * 0.55));
}
/** A 6-step ramp: 0 deepest shadow … 5 highlight; index 3 ≈ base. */
export function ramp(c: RGB): RGB[] {
  return [shade(c, -0.8), shade(c, -0.5), shade(c, -0.22), c, shade(c, 0.28), shade(c, 0.6)];
}
export const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mulc = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
export const lin = (c: RGB): [number, number, number] => c.map((v) => Math.pow(v / 255, 2.2)) as [number, number, number];
export function desaturate(c: RGB, t: number): RGB {
  const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  return [c[0] + (l - c[0]) * t, c[1] + (l - c[1]) * t, c[2] + (l - c[2]) * t];
}
