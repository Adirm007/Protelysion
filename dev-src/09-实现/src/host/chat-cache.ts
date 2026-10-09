import { object, type Obj } from '../core/actors';
import type { Cache, CacheStore } from '../core/cache';
import type { HostApi } from './probe';
/** Each instance operates only on the current chat's booksea.actorCache. */
export function chatCacheStore(api: HostApi): CacheStore {
  if (!api.getVariables || !api.updateVariablesWith) throw new Error('聊天缓存API不可用');
  const get = api.getVariables.bind(api), update = api.updateVariablesWith.bind(api);
  function mutate(variables: Obj, key: string, cache?: Cache): Obj {
    const booksea = variables.booksea === undefined ? {} : object(variables.booksea, 'booksea');
    const source = booksea.actorCache === undefined ? {} : object(booksea.actorCache, 'actorCache');
    const actorCache = { ...source };
    if (cache) actorCache[key] = structuredClone(cache); else delete actorCache[key];
    return { ...variables, booksea: { ...booksea, actorCache } };
  }
  return {
    async read(key) {
      const variables = get({ type: 'chat' });
      if (variables.booksea === undefined) return undefined;
      const booksea = object(variables.booksea);
      if (booksea.actorCache === undefined) return undefined;
      const cache = object(booksea.actorCache);
      return Object.hasOwn(cache, key) ? structuredClone(cache[key]) as Cache : undefined;
    },
    async write(key, cache) { await update(v => mutate(v, key, cache), { type: 'chat' }); },
    async remove(key) { await update(v => mutate(v, key), { type: 'chat' }); },
  };
}
