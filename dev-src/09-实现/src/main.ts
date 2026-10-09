import { actorAt, actorKey, eligibility, listActors, RESOURCES, resourceMax, validateTeam, type ActorRef, type Obj } from './core/actors';
import { combatProjection, canonical, difference } from './core/cache';
import { emptyReport, probeReadOnly, probeChatRoundTrip, probeModel, sendProbeMessage, summarizeMvu, type HostApi, type ProbeReport } from './host/probe';
export function mount(root: HTMLElement, api: HostApi = globalThis as unknown as HostApi): void {
  let mvu: Obj | undefined, report: ProbeReport = emptyReport(), refs: ActorRef[] = [], selected = new Set<string>();
  const sourceSnapshots = new Map<string, Obj>();
  let busy = false;
  root.innerHTML = `<div class="shell">
  <header><a class="brand" href="#"><span class="sigil">海</span><span>书海 <small>BOOKSEA / DEVELOPMENT</small></span></a><span class="version">v0.12 计划 · 0.1.0 接入包</span></header>
  <section class="hero"><div><div class="eyebrow">PHASE 00 · HOST CONNECTION</div><h1>先接通世界，<br><em>再驶入书海。</em></h1><p>宿主接口验证工作台。读取真实角色，检查队伍资格与战斗字段。<br>这是阶段0交付，不是已完成的游戏。</p></div><div class="seal"><span>阶段</span><b>00</b><span>真实联通 · 待验收</span></div></section>
  <div class="safety"><span class="dot"></span><b>宿主写回未开放</b><span>不改经验、等级、资源、物品与世界时间；不自动发送消息或调用模型。</span></div>
  <nav><span class="active">01 接口与来源</span><span>02 队伍与快照</span><span>03 验证报告</span><span class="right" id="mode">未连接</span></nav>
  <section class="grid"><article class="panel"><div class="section-title"><span>01</span><h2>连接宿主</h2><span class="tag">只读优先</span></div><p>在酒馆助手的消息渲染 iframe 内打开，点击探测。普通浏览器没有宿主接口，会如实显示不可用。</p><div class="actions"><button id="probe" class="primary">探测真实酒馆 ↗</button><label class="button secondary">导入脱敏 MVU<input id="import" type="file" accept=".json,application/json" hidden></label></div><p class="fine">导入内容只在本页内存中分析，不上传、不写入宿主。必须包含 stat_data；这不等于真实联通。</p><div class="metrics"><div><b id="actors">—</b><span>角色节点</span></div><div><b id="eligible">—</b><span>符合资格</span></div><div><b id="items">—</b><span>背包条目</span></div></div><div id="checks" class="checks"><div class="empty">尚未探测。没有默认角色，也没有预设成功状态。</div></div></article>
  <article class="panel"><div class="section-title"><span>02</span><h2>队伍与战斗快照</h2><span class="tag">1–4 人</span></div><p>主角可不入场。伙伴须已命定契约且好感 ≥70，不要求在场或低于主角等级。</p><div id="roster" class="roster"><div class="empty">连接或导入数据后，真实角色将显示在这里。</div></div><div class="actions"><button id="team" class="secondary" disabled>验证所选队伍</button><button id="snapshot" class="secondary" disabled>记录 / 比较战斗快照</button></div><div class="note">快照仅用于检查配置变化，<b>不是已编译战斗卡</b>。不开放游戏入场，不把未映射技能降级成默认技能。</div><pre id="diff" class="diff">等待战斗来源。</pre></article></section>
  <section class="panel"><div class="section-title"><span>03</span><h2>受控接口验证</h2><span class="tag warning">每项单独确认</span></div><div class="probe-actions"><div><h3>聊天变量往返</h3><p>仅写唯一临时探测键，读回后清理。不覆盖 booksea 或其他变量。</p><button id="roundtrip" class="secondary">验证存储</button></div><div><h3>独立结构化请求</h3><p>调用当前模型，仅要求返回 ok。可能消耗额度；不发送角色、历史或世界书。</p><button id="model" class="secondary">验证模型接口</button></div><div><h3>用户消息发送</h3><p>向当前聊天追加一条技术验证消息。不自动触发模型回复。</p><button id="send" class="secondary">发送验证消息</button></div></div><div class="note">生成回复、真实升级、原复活副作用、头像库和手机测试仍需专项验收；本页不自动触发这些操作。</div></section>
  <section class="panel report"><div><div class="section-title"><span>04</span><h2>交回验证结果</h2></div><p>报告仅含接口状态与数量，<b>不含角色名、技能原文、MVU全文或密钥</b>。</p><div class="versions"><label>SillyTavern<input data-version="sillyTavern" placeholder="实际版本"></label><label>酒馆助手<input data-version="helper" placeholder="实际版本"></label><label>MVU<input data-version="mvu" placeholder="版本 / 提交号"></label><label>EJS 扩展<input data-version="ejs" placeholder="实际版本"></label></div></div><button id="export" class="primary">导出验证报告 ↓</button></section>
  <footer><span>完整目标 48 主题 / 144 子场景 / 384 敌人</span><span>原资料只读 · 正式美术尚未量产</span></footer>
  <div id="toast" role="status" aria-live="polite"></div></div>`;
  const el = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  function toast(text: string) { el('toast').textContent = text; }
  function drawChecks() {
    el('checks').replaceChildren();
    for (const check of report.checks) {
      const row = document.createElement('div'); row.className = `check ${check.status}`;
      const badge = document.createElement('span'); badge.textContent = { pass: '已检测', fail: '未通过', pending: '待验证' }[check.status];
      const label = document.createElement('strong'); label.textContent = check.label;
      const detail = document.createElement('small'); detail.textContent = check.detail;
      row.append(badge, label, detail); el('checks').append(row);
    }
    const c = report.counts;
    el('actors').textContent = String(c?.actors ?? '—'); el('eligible').textContent = String(c?.eligible ?? '—'); el('items').textContent = String(c?.bagEntries ?? '—');
    el('mode').textContent = report.mode === 'offline' ? '离线数据 · 非联通证明' : mvu ? '已读取 · 联调待完成' : '尚未读取宿主';
  }
  function drawRoster() {
    el('roster').replaceChildren(); refs = mvu ? listActors(mvu) : [];
    selected = new Set([...selected].filter(k => refs.some(r => actorKey(r) === k && eligibility(mvu, r).allowed)));
    for (const ref of refs) {
      const a = actorAt(mvu, ref), state = eligibility(mvu, ref), row = document.createElement('label'); row.className = 'actor';
      const input = document.createElement('input'); input.type = 'checkbox'; input.disabled = !state.allowed; input.checked = selected.has(actorKey(ref));
      input.onchange = () => { if (input.checked) selected.add(actorKey(ref)); else selected.delete(actorKey(ref)); };
      const body = document.createElement('div'), name = document.createElement('b'); name.textContent = ref.kind === 'player' ? '主角' : ref.name;
      const subtitle = document.createElement('small'); subtitle.textContent = `Lv${a.等级 ?? '?'} · ${state.reason}`;
      const resources = document.createElement('small');
      try { resources.textContent = RESOURCES.map(r => `${r} ${(a[r] as Obj).当前}/${resourceMax(a, r)}`).join(' · '); } catch { resources.textContent = '资源字段不完整'; }
      body.append(name, subtitle, resources); row.append(input, body); el('roster').append(row);
    }
    el<HTMLButtonElement>('team').disabled = !mvu; el<HTMLButtonElement>('snapshot').disabled = !mvu;
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return; busy = true; root.setAttribute('aria-busy', 'true');
    root.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.disabled = true); el<HTMLInputElement>('import').disabled = true;
    try { await fn(); } catch (e) { toast(`未完成：${(e as Error).message}`); }
    finally {
      busy = false; root.setAttribute('aria-busy', 'false'); root.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.disabled = false);
      el<HTMLInputElement>('import').disabled = false;
      el<HTMLButtonElement>('team').disabled = !mvu; el<HTMLButtonElement>('snapshot').disabled = !mvu; drawChecks();
    }
  }
  function guardedCheck(id: string, label: string, fn: () => Promise<void>) {
    if (report.mode !== 'host' || !mvu) { toast('请先成功探测真实酒馆；离线导入不能执行宿主验证操作。'); return; }
    if (!confirm(`${label}将在当前真实聊天执行。请先备份或使用测试聊天。是否继续？`)) return;
    void action(async () => {
      report.checks = report.checks.filter(c => c.id !== id);
      try { await fn(); report.checks.push({ id, label, status: 'pass', detail: '本页实际调用并完成本项校验，不代表其他接口通过' }); toast(`${label}已完成。`); }
      catch (e) { report.checks.push({ id, label, status: 'fail', detail: '调用未完成；报告不包含原始错误文本' }); throw e; }
    });
  }
  el('probe').onclick = () => void action(async () => {
    toast('正在探测，不写入宿主……');
    if (report.mode === 'offline') { selected.clear(); sourceSnapshots.clear(); }
    const result = await probeReadOnly(api), versions = report.versions;
    report = result.report; report.versions = versions; mvu = result.mvu; drawRoster(); toast('只读探测结束。待验项目保持待验。');
  });
  el<HTMLInputElement>('import').onchange = event => {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    void action(async () => {
      if (file.size > 8 * 1024 * 1024) throw new Error('请导入小于8MB的脱敏MVU');
      const data = JSON.parse((await file.text()).replace(/^\uFEFF/, '')) as Obj, counts = summarizeMvu(data), versions = report.versions;
      mvu = data; report = emptyReport('offline'); report.versions = versions; report.counts = counts;
      report.checks.push({ id: 'offline', label: '离线结构读取', status: 'pass', detail: '仅验证导入结构，不证明宿主接口' });
      selected.clear(); sourceSnapshots.clear(); drawRoster(); toast('离线数据已载入内存；没有上传。');
    });
  };
  el('team').onclick = () => {
    try { validateTeam(mvu, refs.filter(r => selected.has(actorKey(r)))); toast('队伍资格通过。编译与真实联通未验证，尚不可入场。'); }
    catch (e) { toast((e as Error).message); }
  };
  el('snapshot').onclick = () => {
    try {
      const team = refs.filter(r => selected.has(actorKey(r))); validateTeam(mvu, team); const rows: string[] = [];
      for (const ref of team) {
        const key = actorKey(ref), next = combatProjection(actorAt(mvu, ref)), previous = sourceSnapshots.get(key), changes = previous ? difference(previous, next) : [];
        rows.push(`${ref.kind === 'player' ? '主角' : ref.name}：${!previous ? '首次记录，仅内存' : changes.length ? `战斗字段变化\n${changes.join('\n')}` : '战斗字段未变化'}`);
        canonical(next); sourceSnapshots.set(key, next);
      }
      el('diff').textContent = `${rows.join('\n\n')}\n\n未调用模型或保存编译卡。重新探测后可比较当前来源。`;
    } catch (e) { toast((e as Error).message); }
  };
  el('roundtrip').onclick = () => guardedCheck('chat-roundtrip', '聊天变量往返验证', () => probeChatRoundTrip(api));
  el('model').onclick = () => guardedCheck('model-call', '模型结构化验证（可能消耗额度）', () => probeModel(api));
  el('send').onclick = () => guardedCheck('message-call', '发送技术验证消息（不触发回复）', () => sendProbeMessage(api));
  el('export').onclick = () => {
    root.querySelectorAll<HTMLInputElement>('[data-version]').forEach(input => { report.versions[input.dataset.version as keyof Omit<ProbeReport['versions'], 'source'>] = input.value.trim(); });
    report.timestamp = new Date().toISOString();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'booksea-stage0-report.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('报告已导出。不要发送密钥。');
  };
}
