/**
 * @ganttkit/plugin-tooltip  a hover card for tasks.
 *
 * A UI-slot plugin: it renders into the renderer's `overlay` slot and tracks the
 * pointer over the chart. Works across svg, html, canvas, vue and nuxt.
 *
 * ```ts
 * import { tooltipPlugin } from '@ganttkit/plugin-tooltip'
 * engine.use(tooltipPlugin())
 * // or a custom card:
 * engine.use(tooltipPlugin({ content: (task) => `${task.name} (${task.progress ?? 0})` }))
 * ```
 */
import type { GanttRow, GanttTask } from '@ganttkit/core'
import type { GanttPlugin } from '@ganttkit/core'
import { UI_SLOTS } from '@ganttkit/core'

export interface TooltipOptions {
  /** Custom card content. Return a string (HTML-escaped) or an element. */
  content?: (task: GanttTask, row: GanttRow) => string | HTMLElement
  /** Sort order within the overlay slot. */
  order?: number
}

/** Optional i18n service (provided by @ganttkit/plugin-i18n). */
const I18N_SERVICE = 'gantt:i18n'
interface I18nLike {
  t: (key: string, params?: Record<string, string | number>) => string
  readonly locale: string
}

function defaultContent(task: GanttTask, i18n?: I18nLike): HTMLElement {
  const fmt = new Intl.DateTimeFormat(i18n?.locale, { dateStyle: 'medium' })
  const wrap = document.createElement('div')
  const title = document.createElement('div')
  title.className = 'gantt__tooltip-title'
  title.textContent = task.name
  wrap.appendChild(title)
  const dates = document.createElement('div')
  dates.textContent = `${fmt.format(new Date(task.start))} → ${fmt.format(new Date(task.end))}`
  wrap.appendChild(dates)
  if (task.progress != null) {
    const percent = Math.round(task.progress * 100)
    const p = document.createElement('div')
    p.textContent = i18n ? i18n.t('tooltip.complete', { percent }) : `${percent}% complete`
    wrap.appendChild(p)
  }
  return wrap
}

export function tooltipPlugin(options: TooltipOptions = {}): GanttPlugin {
  return {
    name: 'tooltip',
    install(ctx) {
      return ctx.ui.register({
        slot: UI_SLOTS.overlay,
        order: options.order ?? 0,
        id: 'tooltip',
        mount({ element, engine, events }) {
          const i18n = engine.consume<I18nLike>(I18N_SERVICE)
          const render = options.content ?? ((task: GanttTask) => defaultContent(task, i18n))
          const card = document.createElement('div')
          card.className = 'gantt__tooltip'
          card.style.display = 'none'
          element.appendChild(card)

          // Renderer-agnostic: the renderer resolves the task under the pointer
          // and emits `task:hover`/`task:hoverend`; we just position the card.
          const offHover = events.on('task:hover', ({ task, row, clientX, clientY }) => {
            const out = render(task, row)
            if (typeof out === 'string')
              card.innerHTML = out
            else
              card.replaceChildren(out)
            const rect = element.getBoundingClientRect()
            card.style.display = 'block'
            card.style.left = `${clientX - rect.left + 14}px`
            card.style.top = `${clientY - rect.top + 14}px`
          })
          const offEnd = events.on('task:hoverend', () => {
            card.style.display = 'none'
          })
          return () => {
            offHover()
            offEnd()
          }
        },
      })
    },
  }
}
