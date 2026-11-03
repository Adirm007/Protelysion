/** 宿主侧接线：敌役图鉴存在当前聊天的聊天变量 booksea.bestiary 里（按聊天＝按存档），
 *  与补给员记忆同一做法：不写消息楼层快照，读档回退不会把已经见过的敌人“忘掉”。
 *  旧旅程留下的 unlockedIds（enemy:物种）只读合并，不改写。 */
import {BESTIARY_KEY,createBestiary,type BestiaryPort,type BestiaryService} from '../game/bestiary';

type Obj = Record<string, unknown>;
const rec = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
export function hostBestiaryPort(globals: any, progress?: () => Obj): BestiaryPort {
  const h = globals.TavernHelper ?? globals, c = () => globals.SillyTavern.getContext();
  const id = () => `${c().characterId}:${c().getCurrentChatId()}`, pinned = id();
  const assert = () => {if (id() !== pinned) throw Error('聊天已切换，图鉴没有写入');};
  const raw = () => rec(rec(h.getVariables({type: 'chat'})).booksea);
  return {
    contextId: pinned,
    read() {assert(); return raw()[BESTIARY_KEY];},
    legacy() {
      assert();
      let book: Obj = {};
      try {book = rec((progress?.() ?? {}).booksea);} catch {book = {};}
      const ids = [...(Array.isArray(raw().unlockedIds) ? raw().unlockedIds as unknown[] : []), ...(Array.isArray(book.unlockedIds) ? book.unlockedIds as unknown[] : [])];
      return ids;
    },
    async write(store) {
      assert();
      await h.updateVariablesWith((v: Obj) => {assert(); return {...v, booksea: {...rec(v.booksea), [BESTIARY_KEY]: store}};}, {type: 'chat'});
      assert(); await c().saveChat();
    },
  };
}
export function mountHostBestiary(globals: any, progress?: () => Obj): BestiaryService {
  return createBestiary(hostBestiaryPort(globals, progress));
}
