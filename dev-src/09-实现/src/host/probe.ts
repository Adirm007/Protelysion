import { actorAt, eligibility, listActors, object, type Obj } from '../core/actors';
export type Check = { id: string; label: string; status: 'pass' | 'fail' | 'pending'; detail: string };
export type ProbeReport = {
  schemaVersion: 1; build: string; timestamp: string; mode: 'host' | 'offline'; checks: Check[];
  versions: { sillyTavern: string; helper: string; mvu: string; ejs: string; source: 'user-entered-unverified' };
  counts?: { actors: number; eligible: number; bagEntries: number; npcGrowthRecords: number };
  liveAcceptance: 'pending'; hostMutationEnabled: false;
};
export type HostApi = {
  getVariables?: (option: Obj) => Obj;
  updateVariablesWith?: (updater: (variables: Obj) => Obj, option: Obj) => Obj | Promise<Obj>;
  waitGlobalInitialized?: (name: string) => Promise<unknown>;
  getLastMessageId?: () => number;
  Mvu?: { getMvuData?: unknown; replaceMvuData?: unknown; parseMessage?: unknown; events?: Obj };
  generateRaw?: (config: Obj) => Promise<unknown>;
  stopGenerationById?: (id: string) => boolean;
  createChatMessages?: (messages: { role: 'user'; message: string }[]) => Promise<unknown>;
  triggerSlash?: (command: string) => Promise<unknown>;
};
export const REQUIRED_API = ['getVariables', 'updateVariablesWith', 'waitGlobalInitialized', 'generateRaw', 'createChatMessages', 'triggerSlash'] as const;
export function emptyReport(mode: ProbeReport['mode'] = 'host'): ProbeReport {
  return { schemaVersion: 1, build: '0.1.0-stage0', timestamp: new Date().toISOString(), mode, checks: [], versions: { sillyTavern: '', helper: '', mvu: '', ejs: '', source: 'user-entered-unverified' }, liveAcceptance: 'pending', hostMutationEnabled: false };
}
export async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => { try { onTimeout?.(); } finally { reject(new Error('接口等待超时；未认定成功')); } }, ms); })]); }
  finally { if (timer) clearTimeout(timer); }
}
export function summarizeMvu(mvu: unknown): NonNullable<ProbeReport['counts']> {
  const refs = listActors(mvu), date = object(mvu).date;
  return { actors: refs.length, eligible: refs.filter(r => eligibility(mvu, r).allowed).length,
    bagEntries: Object.keys(object(actorAt(mvu, { kind: 'player' }).背包, '背包')).length,
    npcGrowthRecords: date && object(date).npcs ? Object.keys(object(object(date).npcs)).length : 0 };
}
export async function probeReadOnly(api: HostApi): Promise<{ report: ProbeReport; mvu?: Obj }> {
  const report = emptyReport();
  for (const name of REQUIRED_API) report.checks.push({ id: name, label: name, status: typeof api[name] === 'function' ? 'pass' : 'fail', detail: '仅函数存在性，不代表调用或事件链已通过' });
  if (api.waitGlobalInitialized) {
    try { await withTimeout(api.waitGlobalInitialized('Mvu'), 5000); report.checks.push({ id: 'mvu-ready', label: 'MVU初始化', status: 'pass', detail: 'waitGlobalInitialized 已返回' }); }
    catch { report.checks.push({ id: 'mvu-ready', label: 'MVU初始化', status: 'fail', detail: '5秒内未确认初始化；请检查MVU脚本' }); }
  }
  for (const method of ['getMvuData', 'replaceMvuData', 'parseMessage'] as const) report.checks.push({ id: `Mvu.${method}`, label: `Mvu.${method}`, status: typeof api.Mvu?.[method] === 'function' ? 'pass' : 'pending', detail: '只探测存在性，未调用写入/解析接口' });
  let mvu: Obj | undefined;
  try {
    if (!api.getVariables) throw new Error('无读取接口');
    const messageId = api.getLastMessageId?.();
    mvu = structuredClone(api.getVariables({ type: 'message', message_id: messageId ?? 'latest' }));
    report.counts = summarizeMvu(mvu);
    report.checks.push({ id: 'read-mvu', label: '读取消息MVU', status: 'pass', detail: `读取${messageId ?? 'latest'}楼层；报告仅数量，不含角色名和原文` });
    report.checks.push({ id: 'npc-data', label: '伙伴成长记录', status: report.counts.npcGrowthRecords ? 'pass' : 'pending', detail: '仅统计date.npcs，不创建或重置经验' });
  } catch { report.checks.push({ id: 'read-mvu', label: '读取消息MVU', status: 'fail', detail: '缺少可读取MVU或必要结构，未创建默认角色' }); mvu = undefined; }
  for (const [id, label] of [['growth', '独立成长与广播隔离'], ['revival', '全伙伴队失败与原复活机制'], ['ejs', '入出EJS触发'], ['avatar', '状态栏头像数据库'], ['mobile', '真实手机横屏与音频']] as const) report.checks.push({ id, label, status: 'pending', detail: '需真实环境专项验证，本页不自动判定通过' });
  return { report, mvu };
}
/** Only a unique ephemeral chat key; never writes stat_data/date/booksea. */
export async function probeChatRoundTrip(api: HostApi, token: string = crypto.randomUUID()): Promise<void> {
  if (!api.getVariables || !api.updateVariablesWith) throw new Error('聊天变量API不可用');
  const key = `bookseaStage0Probe_${token}`;
  if (Object.hasOwn(api.getVariables({ type: 'chat' }), key)) throw new Error('探测键冲突，未覆盖');
  try {
    await api.updateVariablesWith(v => ({ ...v, [key]: token }), { type: 'chat' });
    if (api.getVariables({ type: 'chat' })[key] !== token) throw new Error('探测写入未读回');
  } finally {
    await api.updateVariablesWith(v => { const next = { ...v }; if (next[key] === token) delete next[key]; return next; }, { type: 'chat' });
  }
  if (Object.hasOwn(api.getVariables({ type: 'chat' }), key)) throw new Error('探测键未清理，请人工核对');
}
export async function probeModel(api: HostApi): Promise<void> {
  if (!api.generateRaw) throw new Error('generateRaw不可用');
  const generationId = `booksea-probe-${crypto.randomUUID()}`;
  const result = await withTimeout(api.generateRaw({ generation_id: generationId, should_stream: false, should_silence: false, max_chat_history: 0,
    ordered_prompts: [{ role: 'user', content: '这是结构化接口探测。只返回JSON对象，booksea_probe字段值为ok。不执行任何操作。' }],
    json_schema: { name: 'booksea_probe', strict: true, value: { type: 'object', properties: { booksea_probe: { type: 'string', enum: ['ok'] } }, required: ['booksea_probe'], additionalProperties: false } },
  }), 90000, () => api.stopGenerationById?.(generationId));
  if (typeof result !== 'string') throw new Error('模型未返回文本JSON');
  const data = object(JSON.parse(result));
  if (data.booksea_probe !== 'ok' || Object.keys(data).length !== 1) throw new Error('模型输出未通过约束');
}
export const PROBE_MESSAGE = '【书海·接口验证】这是一条用户确认发送的技术验证消息，不是书海入场指令。不要开始冒险、战斗、奖励或经验结算，也不要推进世界时间。';
export async function sendProbeMessage(api: HostApi): Promise<void> {
  if (!api.createChatMessages) throw new Error('消息API不可用');
  await api.createChatMessages([{ role: 'user', message: PROBE_MESSAGE }]);
  // /trigger is intentionally NOT automatic.
}
