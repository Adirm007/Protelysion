import type {ActorRef} from '../core/actors';

/** Read the status bar's documented local format, only for the current character.
 * No writes, migrations, parent-frame scraping, or enumeration of other profiles. */
export type AvatarRecord = {source_type?: string; value?: unknown};
export function avatarKey(character: string, ref: ActorRef): string {
  return `status:${character}::${ref.kind}::${ref.kind === 'player' ? '主角' : ref.name}`;
}
export function safeAvatarUrl(value: unknown, base: string): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[\da-z+/=\s]+$/i.test(text)) return text;
  if (!text || text.includes('{{') || /^(?:javascript|file|data):/i.test(text)) return '';
  try {const url = new URL(text, base); return ['http:', 'https:'].includes(url.protocol) ? url.href : '';} catch {return '';}
}
export function resolveAvatar(record: AvatarRecord | undefined, fallback: unknown, base: string): string {
  if (record?.source_type === 'removed') return '';
  return safeAvatarUrl(record?.value, base) || safeAvatarUrl(fallback, base);
}
export async function readAvatarRecords(factory: IDBFactory | undefined, keys: string[]): Promise<Map<string, AvatarRecord>> {
  const empty = new Map<string, AvatarRecord>();
  if (!factory || !keys.length) return empty;
  return new Promise(resolve => {
    let db: IDBDatabase | undefined, done = false;
    const finish = (result = empty) => {if (done) return; done = true; clearTimeout(timer); db?.close(); resolve(result);};
    const timer = setTimeout(() => finish(), 1800);
    try {
      const request = factory.open('status-avatar-db');
      // Opening a missing database must not create or upgrade the host's database.
      request.onupgradeneeded = () => request.transaction?.abort();
      request.onerror = () => finish(); request.onblocked = () => finish();
      request.onsuccess = () => {
        db = request.result; if (done) {db.close(); return;}
        if (!db.objectStoreNames.contains('avatars')) {finish(); return;}
        const tx = db.transaction('avatars', 'readonly'), store = tx.objectStore('avatars'), records = new Map<string, AvatarRecord>();
        for (const key of keys) {const read = store.get(key); read.onsuccess = () => {if (read.result) records.set(key, read.result);};}
        tx.oncomplete = () => finish(records); tx.onabort = () => finish(); tx.onerror = () => finish();
      };
    } catch {finish();}
  });
}
export async function loadHostPortraits(globals: any, members: {id: string; ref?: ActorRef}[], win: Window = window): Promise<Record<string, string>> {
  const helper = globals.TavernHelper ?? globals;
  let character = '';
  try {character = (helper.getCurrentCharacterName ?? globals.getCurrentCharacterName)?.() ?? '';} catch {}
  const refs = members.filter((p): p is {id: string; ref: ActorRef} => !!p.ref);
  let factory: IDBFactory | undefined; try {factory = win.indexedDB;} catch {}
  const records = character ? await readAvatarRecords(factory, refs.map(p => avatarKey(character, p.ref))) : new Map<string, AvatarRecord>();
  let chat: any = {}, userAvatar = '';
  try {chat = helper.getVariables({type: 'chat'});} catch {}
  try {userAvatar = await globals.SillyTavern?.substituteParams?.('{{userAvatarPath}}') ?? '';} catch {}
  const output: Record<string, string> = {};
  for (const p of refs) {
    const fallback = p.ref.kind === 'player' ? userAvatar : chat?.status?.externalAvatars?.partners?.[p.ref.name]?.url;
    output[p.id] = resolveAvatar(records.get(avatarKey(character, p.ref)), fallback, win.document.baseURI);
  }
  return output;
}
