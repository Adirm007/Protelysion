/** 0.44 图鉴立绘：怪物立绘打包在 Godot 资源包里，只在战斗中交给页面显示。
 *  图鉴在那一刻顺手存一张缩略图（这台设备的 IndexedDB），之后在书间也能看到——正好对应“遭遇即解锁”。
 *  存不下、浏览器不给存，都只是退回纹章占位，不影响游戏。 */
export type DexArtCache = {
  get(designId: string): string | undefined;
  capture(designId: string, dataUrl: string): void;
  ready(): Promise<void>;
  subscribe(fn: () => void): () => void;
  size(): number;
};
const DB = 'booksea-bestiary', STORE = 'art', MAX_EDGE = 360;
type Row = {id: string; url: string; at: number};

function openDb(idb: IDBFactory | undefined): Promise<IDBDatabase | undefined> {
  return new Promise(resolve => {
    if (!idb) {resolve(undefined); return;}
    try {
      const req = idb.open(DB, 1);
      req.onupgradeneeded = () => {if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, {keyPath: 'id'});};
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
      req.onblocked = () => resolve(undefined);
    } catch {resolve(undefined);}
  });
}
/** 缩到最长边 360px 的 webp（不支持时 png）；任何一步失败都返回 undefined。 */
export function shrinkArt(win: Window, dataUrl: string, maxEdge = MAX_EDGE): Promise<string | undefined> {
  return new Promise(resolve => {
    try {
      const doc = win.document, img = new (win as unknown as {Image: typeof Image}).Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale)), h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
          const canvas = doc.createElement('canvas'); canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d'); if (!ctx) {resolve(undefined); return;}
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, w, h);
          let out = canvas.toDataURL('image/webp', .86);
          if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png');
          resolve(out.length < 1_500_000 ? out : undefined);
        } catch {resolve(undefined);}
      };
      img.onerror = () => resolve(undefined);
      img.src = dataUrl;
    } catch {resolve(undefined);}
  });
}
export function bestiaryArtCache(win: Window | undefined): DexArtCache {
  const memory = new Map<string, string>(), listeners = new Set<() => void>(), pending = new Set<string>();
  const notify = () => {for (const fn of [...listeners]) {try {fn();} catch {/* 界面刷新失败不影响缓存 */}}};
  let idb: IDBFactory | undefined;
  try {idb = (win as unknown as {indexedDB?: IDBFactory} | undefined)?.indexedDB;} catch {idb = undefined;}
  const db = openDb(idb);
  const ready = db.then(d => new Promise<void>(resolve => {
    if (!d) {resolve(); return;}
    try {
      const req = d.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => {for (const row of (req.result ?? []) as Row[]) if (row && typeof row.id === 'string' && typeof row.url === 'string' && !memory.has(row.id)) memory.set(row.id, row.url); notify(); resolve();};
      req.onerror = () => resolve();
    } catch {resolve();}
  }));
  return {
    get: id => memory.get(id),
    ready: () => ready,
    size: () => memory.size,
    subscribe(fn) {listeners.add(fn); return () => {listeners.delete(fn);};},
    capture(id, dataUrl) {
      if (!win || !id || memory.has(id) || pending.has(id) || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return;
      pending.add(id);
      void shrinkArt(win, dataUrl).then(async url => {
        if (!url) return;
        memory.set(id, url); notify();
        const d = await db; if (!d) return;
        try {d.transaction(STORE, 'readwrite').objectStore(STORE).put({id, url, at: Date.now()} satisfies Row);} catch {/* 存不下就只留在本次 */}
      }).finally(() => pending.delete(id));
    },
  };
}
