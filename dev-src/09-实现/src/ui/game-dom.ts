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
/** 每 50ms 一次的重绘里只在内容真的变了时才写：给 textContent 赋同样的字也会换掉文本节点、触发重新排版。 */
export const setText = (node: Node, text: string) => {if (node.textContent !== text) node.textContent = text;};
export const setAttr = (node: Element, name: string, value: string) => {if (node.getAttribute(name) !== value) node.setAttribute(name, value);};
export const setStyle = (node: HTMLElement, name: string, value: string) => {if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);};
export const resourceNumber = (n: number) => Math.max(0, Math.round(n)).toLocaleString('zh-CN');
/** 保留 3 位小数：浏览器回读样式时也是这个精度，setStyle 才能认出“没变”。 */
export const ratio = (n: number, max: number) => `${+Math.max(0, Math.min(100, n / Math.max(1, max) * 100)).toFixed(3)}%`;
