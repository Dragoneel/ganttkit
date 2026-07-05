/**
 * @ganttkit/plugin-toolbar  a view-mode / zoom / today toolbar.
 *
 * A UI-slot plugin: it renders plain DOM into the renderer's `toolbar` slot, so
 * one package works across svg, html, canvas, vue and nuxt. Requires a renderer that
 * hosts UI slots (the bundled ones do).
 *
 * ```ts
 * import { toolbarPlugin } from '@ganttkit/plugin-toolbar'
 * engine.use(toolbarPlugin())
 * ```
 */
import type { GanttPlugin, ViewMode } from '@ganttkit/core'
import { UI_SLOTS, stepViewMode } from '@ganttkit/core'

/** Optional i18n service (provided by @ganttkit/plugin-i18n). */
const I18N_SERVICE = 'gantt:i18n'
interface I18nLike {
  t: (key: string, params?: Record<string, string | number>) => string
  subscribe: (listener: () => void) => () => void
}

export interface ToolbarOptions {
  /** View modes to offer as a segmented control. Default `['Day','Week','Month']`. */
  viewModes?: ViewMode[]
  /** Show zoom in/out buttons. Default `true`. */
  zoom?: boolean
  /** Show a "Today" button that scrolls to the current day. Default `true`. */
  today?: boolean
  /**
   * Show "Expand all" / "Collapse all" buttons.
   * Requires `@ganttkit/plugin-tree` to be installed (uses `tree.expandAll` /
   * `tree.collapseAll` commands). Default `false`.
   */
  expandCollapse?: boolean
  /**
   * Show "Capture baseline" / "Clear baseline" buttons.
   * Requires `@ganttkit/plugin-baseline` to be installed (uses
   * `baseline.capture` / `baseline.clear` commands). Default `false`.
   */
  baseline?: boolean
  /** Sort order within the toolbar slot. */
  order?: number
}

function button(label: string, title: string): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'gantt__tb-btn'
  el.textContent = label
  el.title = title
  return el
}

export function toolbarPlugin(options: ToolbarOptions = {}): GanttPlugin {
  const viewModes = options.viewModes ?? ['Day', 'Week', 'Month']
  const showZoom = options.zoom ?? true
  const showToday = options.today ?? true
  const showExpandCollapse = options.expandCollapse ?? false
  const showBaseline = options.baseline ?? false

  return {
    name: 'toolbar',
    install(ctx) {
      const { commands } = ctx
      return ctx.ui.register({
        slot: UI_SLOTS.toolbar,
        order: options.order ?? 0,
        id: 'toolbar',
        mount({ element, viewport, engine, events }) {
          const cleanups: Array<() => void> = []
          // Optional i18n service (falls back to English when absent).
          const i18n = engine.consume<I18nLike>(I18N_SERVICE)
          const t = (key: string, fallback: string) => (i18n ? i18n.t(key) : fallback)

          const labellers: Array<() => void> = []

          // View-mode segmented control.
          const group = document.createElement('div')
          group.className = 'gantt__tb-group'
          const modeButtons = viewModes.map((mode) => {
            const btn = button(mode, mode)
            btn.dataset.mode = mode
            btn.addEventListener('click', () => engine.setViewMode(mode))
            group.appendChild(btn)
            labellers.push(() => { btn.textContent = t(`view.${mode}`, mode) })
            return btn
          })
          element.appendChild(group)

          const syncActive = () => {
            const current = engine.getState().viewMode
            for (const btn of modeButtons)
              btn.classList.toggle('is-active', btn.dataset.mode === current)
          }
          syncActive()
          cleanups.push(events.on('viewmode:change', syncActive))

          // Zoom out / in (coarser / finer view mode).
          if (showZoom) {
            const out = button('−', 'Zoom out')
            const inn = button('+', 'Zoom in')
            out.addEventListener('click', () => engine.setViewMode(stepViewMode(engine.getState().viewMode, 1)))
            inn.addEventListener('click', () => engine.setViewMode(stepViewMode(engine.getState().viewMode, -1)))
            element.append(out, inn)
            labellers.push(() => {
              out.title = t('toolbar.zoomOut', 'Zoom out')
              inn.title = t('toolbar.zoomIn', 'Zoom in')
            })
          }

          // Scroll to today.
          if (showToday) {
            const today = button('Today', 'Today')
            today.addEventListener('click', () => {
              const adapter = engine.getOptions().dateAdapter
              const x = engine.getTimeScale().dateToX(adapter.startOfDay(new Date()))
              viewport.scrollLeft = Math.max(0, x - 120)
            })
            element.appendChild(today)
            labellers.push(() => {
              today.textContent = t('toolbar.today', 'Today')
              today.title = t('toolbar.today', 'Today')
            })
          }

          // Expand all / Collapse all (requires plugin-tree).
          if (showExpandCollapse) {
            const expandBtn = button('Expand all', 'Expand all rows')
            const collapseBtn = button('Collapse all', 'Collapse all rows')
            expandBtn.addEventListener('click', () => {
              if (commands.has('tree.expandAll'))
                commands.execute('tree.expandAll')
            })
            collapseBtn.addEventListener('click', () => {
              if (commands.has('tree.collapseAll'))
                commands.execute('tree.collapseAll')
            })
            element.append(expandBtn, collapseBtn)
            labellers.push(() => {
              expandBtn.textContent = t('toolbar.expandAll', 'Expand all')
              expandBtn.title = t('toolbar.expandAll', 'Expand all')
              collapseBtn.textContent = t('toolbar.collapseAll', 'Collapse all')
              collapseBtn.title = t('toolbar.collapseAll', 'Collapse all')
            })
          }

          // Capture baseline / Clear baseline (requires plugin-baseline).
          if (showBaseline) {
            const captureBtn = button('Capture baseline', 'Capture baseline')
            const clearBtn = button('Clear baseline', 'Clear baseline')
            captureBtn.addEventListener('click', () => {
              if (commands.has('baseline.capture'))
                commands.execute('baseline.capture')
            })
            clearBtn.addEventListener('click', () => {
              if (commands.has('baseline.clear'))
                commands.execute('baseline.clear')
            })
            element.append(captureBtn, clearBtn)
            labellers.push(() => {
              captureBtn.textContent = t('toolbar.captureBaseline', 'Capture baseline')
              captureBtn.title = t('toolbar.captureBaseline', 'Capture baseline')
              clearBtn.textContent = t('toolbar.clearBaseline', 'Clear baseline')
              clearBtn.title = t('toolbar.clearBaseline', 'Clear baseline')
            })
          }

          const relabel = () => labellers.forEach(fn => fn())
          relabel()
          if (i18n)
            cleanups.push(i18n.subscribe(relabel)) // re-label on locale change

          return () => {
            for (const off of cleanups)
              off()
          }
        },
      })
    },
  }
}
