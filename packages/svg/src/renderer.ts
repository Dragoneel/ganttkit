import type {
  DragMode,
  GanttContext,
  GanttRow,
  GanttTask,
  Scene,
  Viewport,
} from '@ganttkit/core'
import {
  GANTT_VIEWPORT_SERVICE,
  SCENE_MARKERS,
  beginDrag,
  resolveDraggedDates,
  updateDrag,
  wheelToViewMode,
} from '@ganttkit/core'
import { createPrimitive, h, svg } from './dom'

/** Well-known key a sidebar/columns plugin publishes its model under. */
const SIDEBAR_SERVICE = 'gantt:sidebar'

/**
 * Minimal structural contract the renderer consumes for an optional sidebar.
 * Satisfied by `@ganttkit/plugin-columns`; the renderer never imports it, so a
 * chart-only setup needs no columns package at all.
 */
interface SidebarProvider {
  getColumns: () => Array<{ key: string, label: string, width: number }>
  getSidebarWidth: () => number
  getCellValue: (row: GanttRow, columnKey: string) => string
  getRowIndent: (row: GanttRow) => number
}

export interface SvgRendererOptions {
  /** Element (or selector) to render into. */
  target: HTMLElement | string
  /** Initial theme. Toggle later via the `data-theme` attribute. */
  theme?: 'light' | 'dark'
  /** Enable ctrl/⌘ + wheel to change view mode. Default `true`. */
  enableZoom?: boolean
  /** Enable click-drag panning of the chart body. Default `true`. */
  enablePan?: boolean
}

/**
 * Imperative DOM/SVG renderer for a GanttKit engine.
 *
 * Built as a plugin: it subscribes to `scene:change`, paints the scene as SVG,
 * renders the sidebar/header from engine accessors, and forwards pointer
 * gestures (click, drag/resize, pan, zoom) back to the engine. It owns no
 * geometry  that all comes from `@ganttkit/core`.
 */
export class SvgRenderer {
  private readonly ctx: GanttContext
  private readonly opts: Required<Omit<SvgRendererOptions, 'target' | 'theme'>>
  private readonly root: HTMLElement

  private timelineHeader!: HTMLElement
  private bodyEl!: HTMLElement
  private sidebarHeadEl!: HTMLElement
  private sidebarBodyEl!: HTMLElement
  private sidebarInner!: HTMLElement
  private chartSvg!: SVGSVGElement
  private toolbarEl!: HTMLElement
  private overlayEl!: HTMLElement

  private disposers: Array<() => void> = []
  private viewportRaf: number | null = null
  /** Last task the pointer was over, so we emit `task:hoverend` once on exit. */
  private lastHoverId: string | null = null
  private readonly slotDisposers = new Map<string, Array<() => void>>()

  constructor(ctx: GanttContext, options: SvgRendererOptions) {
    this.ctx = ctx
    this.opts = {
      enableZoom: options.enableZoom ?? true,
      enablePan: options.enablePan ?? true,
    }
    const target = typeof options.target === 'string'
      ? document.querySelector<HTMLElement>(options.target)
      : options.target
    if (!target)
      throw new Error('GanttKit/svg: render target not found')
    this.root = target
    this.root.classList.add('gantt')
    this.root.setAttribute('data-theme', options.theme ?? 'light')

    this.buildSkeleton()
    this.wireEvents()
    // Publish client→scene mapping so coordinate plugins (rubber-band select)
    // don't reach into renderer DOM. The <svg> is the scene-coordinate surface.
    this.disposers.push(this.ctx.engine.provide(GANTT_VIEWPORT_SERVICE, {
      clientToScene: (clientX: number, clientY: number) => {
        const r = this.chartSvg.getBoundingClientRect()
        return { x: clientX - r.left, y: clientY - r.top }
      },
    }))
    // Set the viewport before the first paint so we never build the full scene
    // into the DOM  even initially only the visible window is rendered.
    if (this.bodyEl.clientHeight > 0)
      this.ctx.engine.setViewport(this.computeViewport())
    this.renderAll()

    // Repaint on engine updates. Scroll/preview skip the (full-width) header.
    this.disposers.push(
      ctx.events.on('scene:change', ({ reason }) => {
        if (reason === 'data')
          this.renderAll()
        else if (reason === 'viewport')
          this.renderViewport()
        else
          this.paintChart()
      }),
    )

    // Track the viewport so the engine can window the scene.
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.scheduleViewport())
      ro.observe(this.bodyEl)
      this.disposers.push(() => ro.disconnect())
    }
    this.scheduleViewport()

    // Mount plugin UI contributions and re-mount when they change.
    this.mountSlots()
    this.disposers.push(ctx.ui.subscribe(() => this.mountSlots()))
  }

  destroy(): void {
    if (this.viewportRaf != null)
      cancelAnimationFrame(this.viewportRaf)
    for (const [, disposers] of this.slotDisposers)
      disposers.forEach(d => d())
    this.slotDisposers.clear()
    for (const dispose of this.disposers.splice(0))
      dispose()
    this.root.replaceChildren()
    this.root.classList.remove('gantt')
  }

  // --- UI slots -----------------------------------------------------------

  private mountSlots(): void {
    this.mountSlot('toolbar', this.toolbarEl)
    this.mountSlot('overlay', this.overlayEl)
    this.toolbarEl.style.display = this.ctx.ui.list('toolbar').length > 0 ? '' : 'none'
  }

  private mountSlot(slot: string, host: HTMLElement): void {
    this.slotDisposers.get(slot)?.forEach(d => d())
    host.replaceChildren()
    const disposers: Array<() => void> = []
    for (const contribution of this.ctx.ui.list(slot)) {
      const el = h('div', `gantt__slot-item gantt__slot-item--${slot}`)
      host.appendChild(el)
      const dispose = contribution.mount({
        element: el,
        viewport: this.bodyEl,
        engine: this.ctx.engine,
        events: this.ctx.events,
      })
      if (dispose)
        disposers.push(dispose)
    }
    this.slotDisposers.set(slot, disposers)
  }

  // --- Viewport -----------------------------------------------------------

  private computeViewport(): Viewport {
    const sidebarWidth = this.sidebar?.getSidebarWidth() ?? 0
    return {
      scrollTop: this.bodyEl.scrollTop,
      scrollLeft: this.bodyEl.scrollLeft,
      width: Math.max(0, this.bodyEl.clientWidth - sidebarWidth),
      height: this.bodyEl.clientHeight,
    }
  }

  /** Coalesce scroll/resize bursts into one viewport update per frame. */
  private scheduleViewport(): void {
    if (this.viewportRaf != null)
      return
    this.viewportRaf = requestAnimationFrame(() => {
      this.viewportRaf = null
      if (this.bodyEl.clientHeight > 0)
        this.ctx.engine.setViewport(this.computeViewport())
    })
  }

  // --- Skeleton -----------------------------------------------------------

  private buildSkeleton(): void {
    this.toolbarEl = h('div', 'gantt__toolbar')
    this.toolbarEl.style.display = 'none'

    const header = h('div', 'gantt__header')
    this.sidebarHeadEl = h('div', 'gantt__sidebar gantt__sidebar--head')
    this.timelineHeader = h('div', 'gantt__timeline-header')
    header.append(this.sidebarHeadEl, this.timelineHeader)

    this.bodyEl = h('div', 'gantt__body')
    this.sidebarBodyEl = h('div', 'gantt__sidebar gantt__sidebar--body')
    // Inner wrapper holds the full content height; rows are absolutely placed
    // so we can render only the visible slice (virtualization).
    this.sidebarInner = h('div', 'gantt__sidebar-inner')
    this.sidebarBodyEl.appendChild(this.sidebarInner)
    const chart = h('div', 'gantt__chart')
    this.chartSvg = svg('svg', { class: 'gantt__svg' }) as SVGSVGElement
    chart.appendChild(this.chartSvg)
    this.bodyEl.append(this.sidebarBodyEl, chart)

    // Overlay layer for plugin UI (tooltips, menus, rubber-bands).
    this.overlayEl = h('div', 'gantt__overlay')

    this.root.append(this.toolbarEl, header, this.bodyEl, this.overlayEl)
  }

  // --- Rendering ----------------------------------------------------------

  /** Full render: header (full-width) + sidebar + chart. For data changes. */
  private renderAll(): void {
    this.renderHeader()
    this.renderSidebar()
    this.paintChart()
    // Sidebar width / content size may have changed → re-check the window.
    this.scheduleViewport()
  }

  /** Scroll/resize: only the windowed sidebar slice and chart need repainting. */
  private renderViewport(): void {
    this.renderSidebar()
    this.paintChart()
  }

  private paintChart(): void {
    this.paint(this.ctx.engine.getScene())
  }

  private get sidebar(): SidebarProvider | undefined {
    return this.ctx.engine.consume<SidebarProvider>(SIDEBAR_SERVICE)
  }

  private renderHeader(): void {
    const engine = this.ctx.engine
    const scale = engine.getTimeScale()
    const sidebar = this.sidebar
    const dayWidth = scale.dayWidth

    // Sidebar column headers (only when a columns plugin is installed).
    if (sidebar) {
      this.sidebarHeadEl.style.display = ''
      this.sidebarHeadEl.style.width = `${sidebar.getSidebarWidth()}px`
      const headRow = h('div', 'gantt__sidebar-head')
      for (const col of sidebar.getColumns()) {
        const cell = h('div', 'gantt__head-cell')
        cell.style.width = `${col.width}px`
        cell.textContent = col.label
        headRow.appendChild(cell)
      }
      this.sidebarHeadEl.replaceChildren(headRow)
    }
    else {
      this.sidebarHeadEl.style.display = 'none'
      this.sidebarHeadEl.replaceChildren()
    }

    // Timeline header: week or month band + day row.
    const bands = h('div', 'gantt__bands')
    const useMonths = scale.viewMode === 'Month'
    const cells = useMonths
      ? scale.months.map(m => ({ width: m.width, text: m.label }))
      : scale.weeks.map(w => ({ width: w.width, text: w.range }))
    for (const cell of cells) {
      const band = h('div', 'gantt__band')
      band.style.minWidth = `${cell.width}px`
      band.textContent = cell.text
      bands.appendChild(band)
    }

    const days = h('div', 'gantt__days')
    for (const day of scale.days) {
      const cell = h('div', `gantt__day${day.isWeekend ? ' is-weekend' : ''}${day.isToday ? ' is-today' : ''}`)
      cell.style.width = `${dayWidth}px`
      const name = h('span', 'gantt__day-name')
      name.textContent = useMonths ? day.weekday : day.weekday
      const num = h('span', 'gantt__day-num')
      num.textContent = String(day.dayOfMonth)
      cell.append(name, num)
      days.appendChild(cell)
    }

    this.timelineHeader.replaceChildren(bands, days)
  }

  private renderSidebar(): void {
    const engine = this.ctx.engine
    const sidebar = this.sidebar
    if (!sidebar) {
      this.sidebarBodyEl.style.display = 'none'
      this.sidebarInner.replaceChildren()
      return
    }
    this.sidebarBodyEl.style.display = ''

    const rows = engine.getRows()
    const columns = sidebar.getColumns()
    const { rowHeight } = engine.getOptions()
    const win = engine.getWindow()
    const start = win ? win.rowStart : 0
    const end = win ? win.rowEnd : rows.length

    this.sidebarBodyEl.style.width = `${sidebar.getSidebarWidth()}px`
    // Full height container so the scrollbar matches the chart; rows are
    // absolutely positioned, so we only build the visible slice.
    this.sidebarInner.style.height = `${rows.length * rowHeight}px`

    const frag = document.createDocumentFragment()
    for (let i = start; i < end; i++) {
      const row = rows[i]
      if (!row)
        continue
      const rowEl = h('div', 'gantt__row gantt__row--abs')
      rowEl.style.top = `${i * rowHeight}px`
      rowEl.style.height = `${rowHeight}px`
      columns.forEach((col, ci) => {
        const cell = h('div', 'gantt__cell')
        cell.style.width = `${col.width}px`
        const value = sidebar.getCellValue(row, col.key)
        if (ci === 0) {
          // First column: optional tree chevron + indentation, then the value.
          cell.style.paddingLeft = `${sidebar.getRowIndent(row)}px`
          const isTreeRow = row.hasChildren === true || (row.level ?? 0) > 0
          if (isTreeRow)
            cell.appendChild(this.buildToggle(row))
          const text = h('span', 'gantt__cell-text')
          text.textContent = value
          cell.appendChild(text)
        }
        else {
          cell.textContent = value
        }
        cell.title = value
        rowEl.appendChild(cell)
      })
      frag.appendChild(rowEl)
    }
    this.sidebarInner.replaceChildren(frag)
  }

  /** Tree chevron (or aligned spacer) for the first sidebar column. */
  private buildToggle(row: GanttRow): HTMLElement {
    if (row.hasChildren !== true) {
      const spacer = h('span', 'gantt__toggle gantt__toggle--spacer')
      return spacer
    }
    const toggle = h('span', 'gantt__toggle')
    toggle.textContent = row.expanded === false ? '▸' : '▾'
    toggle.addEventListener('click', (event) => {
      event.stopPropagation()
      this.ctx.events.emit('row:toggle', { rowId: row.id })
    })
    return toggle
  }

  private paint(scene: Scene): void {
    this.chartSvg.setAttribute('width', String(scene.width))
    this.chartSvg.setAttribute('height', String(scene.height))

    const frag = document.createDocumentFragment()
    frag.appendChild(this.buildDefs())
    for (const layer of scene.layers) {
      const g = svg('g', { class: `gantt__layer gantt__layer--${layer.name}` })
      for (const prim of layer.primitives)
        g.appendChild(createPrimitive(prim))
      frag.appendChild(g)
    }
    this.chartSvg.replaceChildren(frag)
  }

  private buildDefs(): SVGElement {
    const defs = svg('defs')
    const marker = svg('marker', {
      id: SCENE_MARKERS.arrow,
      markerWidth: 10,
      markerHeight: 10,
      refX: 8,
      refY: 3,
      orient: 'auto',
      markerUnits: 'strokeWidth',
    })
    const path = svg('path', { d: 'M0,0 L0,6 L9,3 z', class: 'gantt__arrow' })
    marker.appendChild(path)
    defs.appendChild(marker)
    return defs
  }

  // --- Interactions -------------------------------------------------------

  private wireEvents(): void {
    const onBodyScroll = () => {
      this.timelineHeader.scrollLeft = this.bodyEl.scrollLeft
      this.scheduleViewport()
    }
    this.bodyEl.addEventListener('scroll', onBodyScroll, { passive: true })
    this.disposers.push(() => this.bodyEl.removeEventListener('scroll', onBodyScroll))

    this.chartSvg.addEventListener('mousedown', this.onTaskMouseDown)
    this.disposers.push(() => this.chartSvg.removeEventListener('mousedown', this.onTaskMouseDown))

    this.chartSvg.addEventListener('click', this.onTaskClick)
    this.disposers.push(() => this.chartSvg.removeEventListener('click', this.onTaskClick))

    // Emit semantic hover events so plugins (e.g. tooltip) never hit-test the DOM.
    this.chartSvg.addEventListener('mousemove', this.onTaskHover)
    this.disposers.push(() => this.chartSvg.removeEventListener('mousemove', this.onTaskHover))
    this.chartSvg.addEventListener('mouseleave', this.onTaskHoverEnd)
    this.disposers.push(() => this.chartSvg.removeEventListener('mouseleave', this.onTaskHoverEnd))

    if (this.opts.enableZoom) {
      this.root.addEventListener('wheel', this.onWheel, { passive: false })
      this.disposers.push(() => this.root.removeEventListener('wheel', this.onWheel))
    }
    if (this.opts.enablePan) {
      this.bodyEl.addEventListener('mousedown', this.onPanStart)
      this.disposers.push(() => this.bodyEl.removeEventListener('mousedown', this.onPanStart))
    }
  }

  private findTask(taskId: string): { task: GanttTask, row: GanttRow } | null {
    for (const row of this.ctx.engine.getRows()) {
      const task = row.tasks.find(t => t.id === taskId)
      if (task)
        return { task, row }
    }
    return null
  }

  private onTaskClick = (event: MouseEvent): void => {
    const target = (event.target as Element).closest('[data-task-id]')
    const taskId = target?.getAttribute('data-task-id')
    if (!taskId)
      return
    const found = this.findTask(taskId)
    if (!found)
      return
    this.ctx.engine.selectTask(taskId)
    this.ctx.events.emit('task:click', { ...found, originalEvent: event })
  }

  private onTaskHover = (event: MouseEvent): void => {
    const target = (event.target as Element).closest('[data-task-id]')
    const taskId = target?.getAttribute('data-task-id') ?? null
    const found = taskId ? this.findTask(taskId) : null
    if (found) {
      const handle = target?.getAttribute('data-handle')
      this.lastHoverId = taskId
      this.ctx.events.emit('task:hover', {
        ...found,
        handle: handle === 'left' || handle === 'right' ? handle : null,
        clientX: event.clientX,
        clientY: event.clientY,
      })
    }
    else {
      this.onTaskHoverEnd()
    }
  }

  private onTaskHoverEnd = (): void => {
    if (this.lastHoverId == null)
      return
    this.lastHoverId = null
    this.ctx.events.emit('task:hoverend', {})
  }

  private onTaskMouseDown = (event: MouseEvent): void => {
    const target = (event.target as Element).closest('[data-task-id]') as Element | null
    const taskId = target?.getAttribute('data-task-id')
    if (!taskId)
      return
    const found = this.findTask(taskId)
    if (!found)
      return
    const { task, row } = found
    if ((task.draggable ?? this.ctx.engine.getOptions().draggable) === false)
      return

    event.preventDefault()
    const handle = target?.getAttribute('data-handle')
    const mode: DragMode = handle === 'left' ? 'resize-left' : handle === 'right' ? 'resize-right' : 'move'
    const scale = this.ctx.engine.getTimeScale()
    let drag = beginDrag({ taskId, rowId: row.id, mode, startX: event.clientX, dayWidth: scale.dayWidth })

    this.ctx.events.emit('task:dragstart', { task, row, mode })

    const adapter = this.ctx.engine.getOptions().dateAdapter
    const onMove = (e: MouseEvent) => {
      drag = updateDrag(drag, e.clientX)
      const { start, end } = resolveDraggedDates(task, drag, adapter)
      // Engine builds a windowed preview  pixel-accurate and O(visible).
      this.ctx.engine.setDragPreview(taskId, start, end)
      this.ctx.events.emit('task:dragmove', { task, row, mode, start, end, changed: true })
    }
    const onUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      drag = updateDrag(drag, e.clientX)
      const { start, end } = resolveDraggedDates(task, drag, adapter)
      const changed = drag.offsetDays !== 0
      this.ctx.engine.clearDragPreview()
      if (changed)
        this.ctx.engine.updateTaskDates(taskId, start, end)
      this.ctx.events.emit('task:dragend', { task, row, mode, start, end, changed })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  private onWheel = (event: WheelEvent): void => {
    if (!(event.ctrlKey || event.metaKey))
      return
    event.preventDefault()
    this.ctx.engine.setViewMode(wheelToViewMode(this.ctx.engine.getState().viewMode, event.deltaY))
  }

  private onPanStart = (event: MouseEvent): void => {
    if (event.shiftKey) // shift-drag reserved for plugins (e.g. rubber-band select)
      return
    const target = event.target as Element
    if (target.closest('[data-task-id]') || target.closest('.gantt__sidebar'))
      return
    const startX = event.clientX
    const startY = event.clientY
    const scrollLeft = this.bodyEl.scrollLeft
    const scrollTop = this.bodyEl.scrollTop
    this.bodyEl.classList.add('is-panning')

    const onMove = (e: MouseEvent) => {
      this.bodyEl.scrollLeft = scrollLeft - (e.clientX - startX)
      this.bodyEl.scrollTop = scrollTop - (e.clientY - startY)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      this.bodyEl.classList.remove('is-panning')
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
}
