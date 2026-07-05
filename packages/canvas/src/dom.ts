/** Create an HTML element with optional class and attributes. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string | number>,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (className)
    el.className = className
  if (attrs) {
    for (const [k, v] of Object.entries(attrs))
      el.setAttribute(k, String(v))
  }
  return el
}
