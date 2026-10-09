import {AVATAR_ART} from './art-avatar';
// 夜梦 avatar that follows the 读者 regex "眼中的她" selection. Mirrors getAvatarUrl() in
// 读者对话渲染0917 (new).json: custom persona avatarUrl first, then the 13 appearance avatars.
// These are the square avatars, not the full-length portraits. Read-only; nothing is written back.
export const HOST_AVATAR_URLS: Readonly<Record<string, string>> = {
  default: 'https://img.baibai.cv/f/WrevH4/%E9%BB%98%E8%AE%A4.png',
  classic: 'https://img.baibai.cv/f/OOd5Iy/%E7%BB%8F%E5%85%B8.png',
  victoria1: 'https://img.baibai.cv/f/PPQqHg/%E7%BB%B4%E5%A4%9A%E5%88%A9%E4%BA%9A%E4%B8%80.png',
  western_short: 'https://img.baibai.cv/f/RpdgSG/%E6%B4%8B%E8%A3%85%E7%9F%AD%E5%8F%91.png',
  victoria2: 'https://img.baibai.cv/f/bxmPhb/%E7%BB%B4%E5%A4%9A%E5%88%A9%E4%BA%9A%E4%BA%8C.png',
  black_knit: 'https://img.baibai.cv/f/k1r8IX/%E9%BB%91%E9%92%88%E7%BB%87%E5%BC%80%E8%A1%AB.png',
  knit_linen: 'https://img.baibai.cv/f/n7gzup/%E9%92%88%E7%BB%87%E6%A3%89%E9%BA%BB%E8%BF%9E%E8%A1%A3.png',
  white_mohair: 'https://img.baibai.cv/f/2og1HX/%E7%99%BD%E6%B5%B7%E9%A9%AC%E6%AF%9B.png',
  dino_pajama: 'https://img.baibai.cv/f/5Q51cz/%E6%81%90%E9%BE%99%E7%9D%A1%E8%A1%A3.png',
  cold_look: 'https://img.baibai.cv/f/VrNXs4/%E7%9C%8B%E4%B8%8A%E5%8E%BB%E6%80%95%E5%86%B7.png',
  white_hoodie: 'https://img.baibai.cv/f/WrenI4/%E7%99%BD%E5%8D%AB%E8%A1%A3%E5%8F%8C%E9%A9%AC%E5%B0%BE.png',
  jacket_work: 'https://img.baibai.cv/f/PPQoug/%E5%A4%B9%E5%85%8B%E5%B7%A5%E8%A3%85.png',
  nailong_pajama: 'https://img.baibai.cv/f/67oESA/%E5%A5%B6%E9%BE%99%E8%A3%85.png',
};
export const HOST_AVATAR_FALLBACK = AVATAR_ART;

type Vars = Record<string, unknown>;
function chatVariables(scope: any): Vars | undefined {
  const tries: Array<() => unknown> = [
    () => scope?.SillyTavern?.getContext?.()?.chatMetadata?.variables,
    () => scope?.parent !== scope ? scope?.parent?.SillyTavern?.getContext?.()?.chatMetadata?.variables : undefined,
    () => scope?.TavernHelper?.getVariables?.({type: 'chat'}),
  ];
  for (const t of tries) {
    try {const v = t(); if (v && typeof v === 'object') return v as Vars;} catch {/* cross-origin or missing host */}
  }
  return undefined;
}
function customAvatar(raw: unknown): string {
  let v: any = raw;
  if (typeof v === 'string') {try {v = JSON.parse(v);} catch {return '';}}
  const url = v && typeof v === 'object' && typeof v.avatarUrl === 'string' ? v.avatarUrl.trim() : '';
  return /^(https?:|data:image\/)/i.test(url) ? url : '';
}
/** Current 夜梦 avatar URL; the built-in square avatar outside the host. */
export function hostAvatarUrl(scope: any = globalThis): string {
  const vars = chatVariables(scope);
  if (!vars) return HOST_AVATAR_FALLBACK;
  if (vars.dream_persona === 'custom') {const url = customAvatar(vars.dream_custom_persona); if (url) return url;}
  const look = typeof vars.dream_appearance === 'string' ? vars.dream_appearance : 'default';
  return HOST_AVATAR_URLS[look] ?? HOST_AVATAR_URLS.default!;
}
/** Point an <img> at the current avatar, falling back to the built-in one if the link fails. */
export function applyHostAvatar(img: HTMLImageElement, scope: any = globalThis) {
  const url = hostAvatarUrl(scope);
  img.referrerPolicy = 'no-referrer';
  img.onerror = () => {img.onerror = null; img.src = HOST_AVATAR_FALLBACK;};
  img.src = url;
  return url;
}
