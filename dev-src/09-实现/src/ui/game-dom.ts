export type SendGameInput = (type: string, payload?: Record<string, unknown>) => void;
export function gameDom(doc: Document) {
  function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag); node.className = className; node.textContent = text; return node;
  }
  const button = (text: string, fn: () => void, className = '', disabled = false) => {
    const b = el('button', className, text); b.type = 'button'; b.disabled = disabled; b.onclick = fn; return b;
  };
  return {el, button};
}
export const resourceNumber = (n: number) => Math.max(0, Math.round(n)).toLocaleString('zh-CN');
export const ratio = (n: number, max: number) => `${Math.max(0, Math.min(100, n / Math.max(1, max) * 100))}%`;
