/** 补给员事件账本：游戏规则在发生的那一刻记下“事实”（见面、选择、购买、成交/没谈成、杀害），
 *  由宿主的记忆服务取走并清空。这是确定性的事件来源，不经 LLM，所以不会记错价格和东西。
 *  编号带时间与随机后缀：读档回退后重新发生的事件不会和已经取走的编号撞车。 */
import type {TalkLine, TalkSession} from './supplier-agent';
export type SupplierLedgerKind = 'open' | 'choice' | 'buy' | 'deal' | 'nodeal' | 'kill';
export type SupplierLedgerEntry = {
  id: string; t: SupplierLedgerKind; thing: string; run: string; depth: number; place: string; theme: string; at: number;
  choice?: string; label?: string; price?: number; kind?: string; reason?: string;
};
export const SUPPLIER_LEDGER_LIMIT = 40;
type LedgerHost = {supplierLedger?: SupplierLedgerEntry[]; run: {id: string}; depth: number; region: {name: string}};
export function recordSupplier(s: LedgerHost, theme: string, thing: string, t: SupplierLedgerKind, extra: Partial<Pick<SupplierLedgerEntry, 'choice' | 'label' | 'price' | 'kind' | 'reason'>> = {}) {
  const at = Date.now(), list = s.supplierLedger ??= [];
  list.push({id: at.toString(36) + '-' + Math.random().toString(36).slice(2, 8), t, thing, run: s.run.id, depth: s.depth, place: s.region.name, theme, at, ...extra});
  if (list.length > SUPPLIER_LEDGER_LIMIT) list.splice(0, list.length - SUPPLIER_LEDGER_LIMIT);
}
/** 交出这位补给员对话里还没交给长期记忆的那几行（只交一次；关掉再打开同一位补给员接着交新的）。 */
export function takeSupplierTalk(s: {supplierTalks?: Record<string, TalkSession>}, thing: string): TalkLine[] {
  const talk = s.supplierTalks?.[thing]; if (!talk) return [];
  const total = talk.total ?? talk.log.length, fresh = Math.max(0, Math.min(talk.log.length, total - (talk.memo ?? 0)));
  talk.total = total; talk.memo = total;
  return fresh ? talk.log.slice(-fresh).map(l => ({...l})) : [];
}
/** 取走全部未处理的事件（宿主记忆服务专用）。 */
export function drainSupplierLedger(s: {supplierLedger?: SupplierLedgerEntry[]}): SupplierLedgerEntry[] {
  const out = s.supplierLedger ?? []; if (out.length) s.supplierLedger = []; return out;
}
