// Interface art that is not needed before the download page is a release file (site/ui/*), listed with size and
// SHA-256 in release-manifest.json. On the distribution page the ResourceStore reads it (cache first, verified);
// elsewhere (host test page) it is fetched from the asset base. Each file becomes one object URL shared by every
// view. Nothing here is required: a missing file leaves the CSS fallback in place and never shows a broken image.
export type UiReader = (name: string) => Promise<Uint8Array>;
let reader: UiReader | undefined, base: URL | undefined;
// Theme installation precedes async ResourceStore.open() in the real entry. Keep its first art/font requests
// pending until the store or host base is registered, instead of permanently consuming their once-only flags.
let assetsConfigured: (() => void) | undefined;
const assetsReady = new Promise<void>(resolve => {assetsConfigured = resolve;});
const urls = new Map<string, Promise<string | undefined>>();
const made: string[] = [];

/** UI release files (paths relative to the release root). */
export const UI_FILES = {
  lobbyWide: 'ui/lobby-wide.webp', lobbyTall: 'ui/lobby-tall.webp',
  cloth: 'ui/tex-cloth.webp', velvet: 'ui/tex-velvet.webp', marbleFairy: 'ui/tex-marble-fairy.webp', marbleTheater: 'ui/tex-marble-theater.webp',
  supplier: 'ui/supplier-portrait.webp',
  envelope: 'ui/obj-envelope.webp', specimen: 'ui/obj-specimen.webp', quill: 'ui/obj-quill.webp',
  fontDisplay: 'ui/fonts/booksea-display.woff2', fontLatin: 'ui/fonts/booksea-latin.woff2', fontLatinItalic: 'ui/fonts/booksea-latin-italic.woff2',
} as const;

/** Called by the distribution page (verified store) or the host page (plain asset base). The first reader wins. */
export function registerUiAssets(options: {read?: UiReader; base?: string | URL}) {
  if (options.read && !reader) reader = options.read;
  if (options.base && !base) {try {base = new URL(String(options.base));} catch {/* invalid base: art stays on fallbacks */}}
  if (reader || base) {assetsConfigured?.(); assetsConfigured = undefined;}
}
const urlApi = (win: Window): typeof URL => (win as unknown as {URL?: typeof URL}).URL ?? URL;
const mime = (name: string) => name.endsWith('.webp') ? 'image/webp' : name.endsWith('.woff2') ? 'font/woff2' : name.endsWith('.png') ? 'image/png' : 'application/octet-stream';

/** Object URL for a UI release file, or undefined when it cannot be read here. */
export function uiAssetUrl(name: string, win: Window = globalThis.window): Promise<string | undefined> {
  const prior = urls.get(name); if (prior) return prior;
  const pending = (async () => {
    try {
      if (!win || typeof urlApi(win).createObjectURL !== 'function' || typeof Blob !== 'function') return undefined;
      await assetsReady;
      let bytes: Uint8Array | undefined;
      if (reader) bytes = await reader(name);
      else if (base && typeof win.fetch === 'function') {const response = await win.fetch(new URL(name, base), {credentials: 'omit'}); if (!response.ok) return undefined; bytes = new Uint8Array(await response.arrayBuffer());}
      if (!bytes?.byteLength) return undefined;
      const url = urlApi(win).createObjectURL(new Blob([new Uint8Array(bytes)], {type: mime(name)})); made.push(url); return url;
    } catch {return undefined;}
  })();
  urls.set(name, pending);
  void pending.then(url => {if (!url) urls.delete(name);});
  return pending;
}

/** Set `--name: url(...)` on an element once each file is available (keeps the declared fallback until then). */
export function applyUiVars(node: HTMLElement | null | undefined, vars: Record<string, string>, win?: Window) {
  if (!node?.style) return;
  for (const [prop, name] of Object.entries(vars)) void uiAssetUrl(name, win).then(url => {if (url) node.style.setProperty(prop, `url("${url}")`);});
}
/** Fill <img data-ui-art="ui/…"> inside a subtree; images stay hidden until they decode. */
export function hydrateUiImages(root: ParentNode | null | undefined, win?: Window) {
  if (!root || typeof (root as Element).querySelectorAll !== 'function') return;
  for (const img of Array.from((root as Element).querySelectorAll<HTMLImageElement>('img[data-ui-art]'))) {
    const name = img.dataset.uiArt!; if (img.dataset.uiArtDone === name) continue; img.dataset.uiArtDone = name;
    if (!img.complete || !img.naturalWidth) img.style.opacity = '0';
    img.addEventListener('load', () => {img.style.opacity = '';}, {once: true});
    void uiAssetUrl(name, win).then(url => {if (url) img.src = url; else img.remove();});
  }
}

let fontsRequested = false;
/** Subset display faces (SIL OFL) for fixed interface text; dynamic text never uses them. */
export function loadBindingFonts(doc: Document) {
  const win = doc?.defaultView ?? undefined, FontFaceCtor = (win as any)?.FontFace as typeof FontFace | undefined;
  if (fontsRequested || !FontFaceCtor || !doc.fonts) return; fontsRequested = true;
  const faces: [string, string, FontFaceDescriptors][] = [
    ['Booksea Display', UI_FILES.fontDisplay, {weight: '900', display: 'swap'}],
    ['Booksea Latin', UI_FILES.fontLatin, {weight: '400', display: 'swap'}],
    ['Booksea Latin', UI_FILES.fontLatinItalic, {weight: '400', style: 'italic', display: 'swap'}],
  ];
  for (const [family, file, desc] of faces) void uiAssetUrl(file, win).then(async url => {
    if (!url) return;
    try {const face = new FontFaceCtor(family, `url("${url}") format("woff2")`, desc); await face.load(); (doc.fonts as unknown as {add(face: FontFace): void}).add(face);} catch {/* system serif stays */}
  });
}
/** Raster textures that only appear after download replace the procedural fallbacks document-wide. */
export function loadBindingTextures(doc: Document) {
  const rootEl = doc?.documentElement as HTMLElement | undefined;
  if (!rootEl?.style || rootEl.dataset.bkTextures) return; rootEl.dataset.bkTextures = '1';
  applyUiVars(rootEl, {'--bk-tex-cloth': UI_FILES.cloth, '--bk-tex-velvet': UI_FILES.velvet, '--bk-tex-marble-fairy': UI_FILES.marbleFairy, '--bk-tex-marble-theater': UI_FILES.marbleTheater}, doc.defaultView ?? undefined);
}
export function disposeUiAssets(win: Window = globalThis.window) {for (const url of made.splice(0)) try {urlApi(win).revokeObjectURL(url);} catch {} urls.clear();}
