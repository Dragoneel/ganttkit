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
  beginDrag,
  resolveDraggedDates,
  updateDrag,
  wheelToViewMode,
} from '@ganttkit/core'
import { h } from './dom'
import { type Palette, drawScene, readPalette } from './draw'

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
  /** Key of the column that hosts the tree chevron. Optional for back-compat. */
  getTreeColumnKey?: () => string | undefined
  /** Whether a column may be resized. Optional for back-compat. */
  isColumnResizable?: (key: string) => boolean
  /** Minimum column width in px. Optional for back-compat. */
  getMinColumnWidth?: () => number
  /** Commit a resized column width. Optional for back-compat. */
  setColumnWidth?: (key: string, width: number) => void
}

/**
 * Content for a tree chevron: a markup string (plain text/emoji, an inline
 * `<svg>…</svg>`, or an `<img src>`), or a DOM node built by the caller. Nodes
 * are cloned per row, so a single node may be reused across rows.
 */
export type ChevronContent = string | Node

/**
 * Customize the tree chevron. Either fixed content for the two states, or a
 * function invoked per tree row (e.g. to vary the icon by level or row data).
 */
export type ChevronOption =
  | { collapsed: ChevronContent, expanded: ChevronContent }
  | ((state: { expanded: boolean, row: GanttRow }) => ChevronContent)

/** Default chevron: unicode triangles, matching the shipped stylesheet. */
const DEFAULT_CHEVRON = { collapsed: '▸', expanded: '▾' }

export interface CanvasRendererOptions {
  /** Element (or selector) to render into. */
  target: HTMLElement | string
  /** Initial theme. Toggle later via the `data-theme` attribute. */
  theme?: 'light' | 'dark'
  /** Enable ctrl/⌘ + wheel to change view mode. Default `true`. */
  enableZoom?: boolean
  /** Enable click-drag panning of the chart body. Default `true`. */
  enablePan?: boolean
  /**
   * Custom tree expand/collapse chevron. Accepts a markup string (text, emoji,
   * inline SVG or an `<img>`) or a DOM node, either as fixed collapsed/expanded
   * content or a per-row function. Defaults to `▸`/`▾`.
   */
  chevron?: ChevronOption
}

/**
 * Imperative `<canvas>` renderer for a GanttKit engine.
 *
 * The third sibling of `@ganttkit/svg` and `@ganttkit/html`: it consumes the
 * exact same renderer-agnostic scene of vector primitives, but draws each one
 * into a single 2D canvas context instead of producing DOM nodes.
 *
 * Because a canvas can't be sized to a huge dataset (a 200k-row chart is
 * millions of pixels tall), the canvas is kept the size of the *viewport* and
 * pinned to it; a full-size spacer drives the scrollbars, and on every scroll
 * the engine re-windows the scene and we redraw with the scroll offset applied.
 * Colours are resolved from the theme's `--gk-*` CSS variables, and pointer
 * gestures are resolved through `engine.hitTest(x, y)`  the renderer never
 * re-implements hit geometry; it only maps the pointer into scene coordinates.
 */
export class CanvasRenderer {
  private readonly ctx: GanttContext
  private readonly opts: Required<Omit<CanvasRendererOptions, 'target' | 'theme'>>
  private readonly root: HTMLElement

  private timelineHeader!: HTMLElement
  private bodyEl!: HTMLElement
  private sidebarHeadEl!: HTMLElement
  private sidebarBodyEl!: HTMLElement
  private sidebarInner!: HTMLElement
  private chartEl!: HTMLElement
  private spacerEl!: HTMLElement
  private canvasEl!: HTMLCanvasElement
  private c2d!: CanvasRenderingContext2D
  private toolbarEl!: HTMLElement
  private overlayEl!: HTMLElement

  private palette!: Palette
  private disposers: Array<() => void> = []
  private viewportRaf: number | null = null
  /** Set when a drag/resize moved, so the trailing browser `click` is ignored. */
  private suppressClick = false
  /** Last task the pointer was over, so we emit `task:hoverend` once on exit. */
  private lastHoverId: string | null = null
  private readonly slotDisposers = new Map<string, Array<() => void>>()

  constructor(ctx: GanttContext, options: CanvasRendererOptions) {
    this.ctx = ctx
    this.opts = {
      enableZoom: options.enableZoom ?? true,
      enablePan: options.enablePan ?? true,
      chevron: options.chevron ?? DEFAULT_CHEVRON,
    }
    const target = typeof options.target === 'string'
      ? document.querySelector<HTMLElement>(options.target)
      : options.target
    if (!target)
      throw new Error('GanttKit/canvas: render target not found')
    this.root = target
    this.root.classList.add('gantt')
    this.root.setAttribute('data-theme', options.theme ?? 'light')

    this.buildSkeleton()
    this.wireEvents()
    // Publish client→scene mapping so coordinate plugins (rubber-band select)
    // don't reach into renderer DOM. Canvas maps via its rect plus scroll offset.
    this.disposers.push(this.ctx.engine.provide(GANTT_VIEWPORT_SERVICE, {
      clientToScene: (clientX: number, clientY: number) => this.clientToScene(clientX, clientY),
    }))
    // Set the viewport before the first paint so the engine windows the scene.
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

    // Theme changes are pure CSS for the DOM renderers, but the canvas resolves
    // colours itself, so repaint when `data-theme` flips on the root.
    if (typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(() => this.paintChart())
      mo.observe(this.root, { attributes: true, attributeFilter: ['data-theme'] })
      this.disposers.push(() => mo.disconnect())
    }

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
    this.sidebarInner = h('div', 'gantt__sidebar-inner')
    this.sidebarBodyEl.appendChild(this.sidebarInner)

    this.chartEl = h('div', 'gantt__chart')
    // The spacer is sized to the full scene so the body scrollbars are correct;
    // the canvas is kept viewport-sized and repositioned over it on scroll.
    this.spacerEl = h('div', 'gantt__canvas-spacer')
    this.canvasEl = document.createElement('canvas')
    this.canvasEl.className = 'gantt__canvas'
    const c2d = this.canvasEl.getContext('2d')
    if (!c2d)
      throw new Error('GanttKit/canvas: 2D context unavailable')
    this.c2d = c2d
    this.chartEl.append(this.spacerEl, this.canvasEl)
    this.bodyEl.append(this.sidebarBodyEl, this.chartEl)

    this.overlayEl = h('div', 'gantt__overlay')

    this.root.append(this.toolbarEl, header, this.bodyEl, this.overlayEl)
  }

  // --- Rendering ----------------------------------------------------------

  private renderAll(): void {
    this.palette = readPalette(this.root)
    this.renderHeader()
    this.renderSidebar()
    this.paintChart()
    this.scheduleViewport()
  }

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

    if (sidebar) {
      this.sidebarHeadEl.style.display = ''
      this.sidebarHeadEl.style.width = `${sidebar.getSidebarWidth()}px`
      const headRow = h('div', 'gantt__sidebar-head')
      sidebar.getColumns().forEach((col, ci) => {
        const cell = h('div', 'gantt__head-cell')
        cell.style.width = `${col.width}px`
        const label = h('span', 'gantt__head-label')
        label.textContent = col.label
        cell.appendChild(label)
        // Draggable edge to resize the column (when the model allows it).
        if (sidebar.isColumnResizable?.(col.key) && sidebar.setColumnWidth) {
          const handle = h('div', 'gantt__col-resize')
          handle.addEventListener('mousedown', e => this.onColumnResizeStart(e, ci))
          cell.appendChild(handle)
        }
        headRow.appendChild(cell)
      })
      this.sidebarHeadEl.replaceChildren(headRow)
    }
    else {
      this.sidebarHeadEl.style.display = 'none'
      this.sidebarHeadEl.replaceChildren()
    }

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
      name.textContent = day.weekday
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
    // Which column carries the tree chevron/indentation. Falls back to the
    // first column when the provider doesn't specify one.
    const treeKey = sidebar.getTreeColumnKey?.() ?? columns[0]?.key
    const { rowHeight } = engine.getOptions()
    const win = engine.getWindow()
    const start = win ? win.rowStart : 0
    const end = win ? win.rowEnd : rows.length

    this.sidebarBodyEl.style.width = `${sidebar.getSidebarWidth()}px`
    this.sidebarInner.style.height = `${rows.length * rowHeight}px`

    const frag = document.createDocumentFragment()
    for (let i = start; i < end; i++) {
      const row = rows[i]
      if (!row)
        continue
      const rowEl = h('div', 'gantt__row gantt__row--abs')
      rowEl.style.top = `${i * rowHeight}px`
      rowEl.style.height = `${rowHeight}px`
      columns.forEach((col) => {
        const cell = h('div', 'gantt__cell')
        cell.style.width = `${col.width}px`
        const value = sidebar.getCellValue(row, col.key)
        if (col.key === treeKey) {
          // Indent is added on top of the cell's base padding (see CSS), so
          // level-0 rows still align with the other columns.
          cell.classList.add('gantt__cell--tree')
          cell.style.setProperty('--gk-indent', `${sidebar.getRowIndent(row)}px`)
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

  private buildToggle(row: GanttRow): HTMLElement {
    if (row.hasChildren !== true)
      return h('span', 'gantt__toggle gantt__toggle--spacer')
    const toggle = h('span', 'gantt__toggle')
    this.fillChevron(toggle, row)
    toggle.addEventListener('click', (event) => {
      event.stopPropagation()
      this.ctx.events.emit('row:toggle', { rowId: row.id })
    })
    return toggle
  }

  /** Render the configured chevron content into `el` for a tree row. */
  private fillChevron(el: HTMLElement, row: GanttRow): void {
    const expanded = row.expanded !== false
    const opt = this.opts.chevron
    let content = typeof opt === 'function'
      ? opt({ expanded, row })
      : (expanded ? opt.expanded : opt.collapsed)
    // Defensive: a config/function that yields no usable content falls back to
    // the default glyph instead of throwing.
    if (typeof content !== 'string' && !(content instanceof Node))
      content = expanded ? DEFAULT_CHEVRON.expanded : DEFAULT_CHEVRON.collapsed
    if (typeof content === 'string')
      el.innerHTML = content
    else
      el.appendChild(content.cloneNode(true))
  }

  /** Begin a header-edge drag to resize the column at `index`. */
  private onColumnResizeStart(event: MouseEvent, index: number): void {
    const sidebar = this.sidebar
    if (!sidebar?.setColumnWidth)
      return
    const cols = sidebar.getColumns()
    const col = cols[index]
    if (!col)
      return
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = col.width
    const min = sidebar.getMinColumnWidth?.() ?? 48
    // Width of every other column stays fixed during the drag; only this one moves.
    const others = cols.reduce((sum, c, i) => (i === index ? sum : sum + c.width), 0)
    let width = startWidth
    this.root.classList.add('is-col-resizing')

    const onMove = (e: MouseEvent) => {
      width = Math.max(min, startWidth + (e.clientX - startX))
      this.previewColumnWidth(index, width, others + width)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      this.root.classList.remove('is-col-resizing')
      // Commit once: updates the model, persists, and triggers a single repaint.
      sidebar.setColumnWidth!(col.key, width)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  /** Live width update during a resize drag  pure DOM writes, no recompute. */
  private previewColumnWidth(index: number, width: number, total: number): void {
    const headCell = this.sidebarHeadEl.querySelectorAll<HTMLElement>('.gantt__head-cell')[index]
    if (headCell)
      headCell.style.width = `${width}px`
    this.sidebarHeadEl.style.width = `${total}px`
    this.sidebarBodyEl.style.width = `${total}px`
    for (const row of this.sidebarInner.children) {
      const cell = (row as HTMLElement).children[index] as HTMLElement | undefined
      if (cell)
        cell.style.width = `${width}px`
    }
  }

  private paint(scene: Scene): void {
    this.spacerEl.style.width = `${scene.width}px`
    this.spacerEl.style.height = `${scene.height}px`
    // Re-read the palette so a runtime `data-theme` toggle is reflected.
    this.palette = readPalette(this.root)

    const sidebarWidth = this.sidebar?.getSidebarWidth() ?? 0
    const vw = Math.max(0, this.bodyEl.clientWidth - sidebarWidth)
    const vh = this.bodyEl.clientHeight
    const sl = this.bodyEl.scrollLeft
    const st = this.bodyEl.scrollTop
    const dpr = window.devicePixelRatio || 1

    // Pin the canvas over the visible chart region.
    this.canvasEl.style.left = `${sl}px`
    this.canvasEl.style.top = `${st}px`
    this.canvasEl.style.width = `${vw}px`
    this.canvasEl.style.height = `${vh}px`
    // Sizing the backing store resets the context state, so do it first.
    this.canvasEl.width = Math.max(1, Math.round(vw * dpr))
    this.canvasEl.height = Math.max(1, Math.round(vh * dpr))

    const ctx = this.c2d
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vw, vh)
    // Scene primitives are in full-chart coordinates; offset by the scroll.
    ctx.translate(-sl, -st)
    drawScene(ctx, scene, this.palette)
  }

  // --- Interactions -------------------------------------------------------

  private wireEvents(): void {
    const onBodyScroll = () => {
      this.timelineHeader.scrollLeft = this.bodyEl.scrollLeft
      this.scheduleViewport()
    }
    this.bodyEl.addEventListener('scroll', onBodyScroll, { passive: true })
    this.disposers.push(() => this.bodyEl.removeEventListener('scroll', onBodyScroll))

    this.canvasEl.addEventListener('mousedown', this.onTaskMouseDown)
    this.disposers.push(() => this.canvasEl.removeEventListener('mousedown', this.onTaskMouseDown))

    this.canvasEl.addEventListener('click', this.onTaskClick)
    this.disposers.push(() => this.canvasEl.removeEventListener('click', this.onTaskClick))

    // Canvas has no per-shape DOM, so hover hit-testing drives the resize cursor
    // and emits semantic `task:hover`/`task:hoverend` events  the same events the
    // DOM renderers emit, so plugins (tooltip, selection) stay renderer-agnostic.
    this.canvasEl.addEventListener('mousemove', this.onHover)
    this.disposers.push(() => this.canvasEl.removeEventListener('mousemove', this.onHover))
    this.canvasEl.addEventListener('mouseleave', this.onHoverLeave)
    this.disposers.push(() => this.canvasEl.removeEventListener('mouseleave', this.onHoverLeave))

    if (this.opts.enableZoom) {
      this.root.addEventListener('wheel', this.onWheel, { passive: false })
      this.disposers.push(() => this.root.removeEventListener('wheel', this.onWheel))
    }
    if (this.opts.enablePan) {
      this.bodyEl.addEventListener('mousedown', this.onPanStart)
      this.disposers.push(() => this.bodyEl.removeEventListener('mousedown', this.onPanStart))
    }
  }

  /** Map client (screen) coordinates to scene (full-chart) coordinates. */
  private clientToScene(clientX: number, clientY: number): { x: number, y: number } {
    const rect = this.canvasEl.getBoundingClientRect()
    return {
      x: clientX - rect.left + this.bodyEl.scrollLeft,
      y: clientY - rect.top + this.bodyEl.scrollTop,
    }
  }

  /** Map a pointer event to scene (full-chart) coordinates. */
  private pointerScene(event: MouseEvent): { x: number, y: number } {
    return this.clientToScene(event.clientX, event.clientY)
  }

  private findTask(taskId: string): { task: GanttTask, row: GanttRow } | null {
    for (const row of this.ctx.engine.getRows()) {
      const task = row.tasks.find(t => t.id === taskId)
      if (task)
        return { task, row }
    }
    return null
  }

  private onHover = (event: MouseEvent): void => {
    const { x, y } = this.pointerScene(event)
    const hit = this.ctx.engine.hitTest(x, y)
    // Show the resize affordance near a bar's edges, a pointer over a task body.
    this.canvasEl.style.cursor = hit ? (hit.handle ? 'col-resize' : 'pointer') : ''
    const found = hit ? this.findTask(hit.taskId) : null
    if (found && hit) {
      this.lastHoverId = hit.taskId
      this.ctx.events.emit('task:hover', {
        ...found,
        handle: hit.handle,
        clientX: event.clientX,
        clientY: event.clientY,
      })
    }
    else {
      this.onTaskHoverEnd()
    }
  }

  private onHoverLeave = (): void => {
    this.canvasEl.style.cursor = ''
    this.onTaskHoverEnd()
  }

  private onTaskHoverEnd(): void {
    if (this.lastHoverId == null)
      return
    this.lastHoverId = null
    this.ctx.events.emit('task:hoverend', {})
  }

  private onTaskClick = (event: MouseEvent): void => {
    // A drag/resize ends with a `mouseup` that the browser follows with a
    // `click`  swallow it so moving a bar doesn't also select/emit a click.
    if (this.suppressClick) {
      this.suppressClick = false
      return
    }
    const { x, y } = this.pointerScene(event)
    const hit = this.ctx.engine.hitTest(x, y)
    if (!hit)
      return
    const found = this.findTask(hit.taskId)
    if (!found)
      return
    this.ctx.engine.selectTask(hit.taskId)
    this.ctx.events.emit('task:click', { ...found, originalEvent: event })
  }

  private onTaskMouseDown = (event: MouseEvent): void => {
    this.suppressClick = false
    const { x, y } = this.pointerScene(event)
    const hit = this.ctx.engine.hitTest(x, y)
    if (!hit)
      return
    const found = this.findTask(hit.taskId)
    if (!found)
      return
    const { task, row } = found
    if ((task.draggable ?? this.ctx.engine.getOptions().draggable) === false)
      return

    event.preventDefault()
    const mode: DragMode = hit.handle === 'left' ? 'resize-left' : hit.handle === 'right' ? 'resize-right' : 'move'
    const scale = this.ctx.engine.getTimeScale()
    let drag = beginDrag({ taskId: hit.taskId, rowId: row.id, mode, startX: event.clientX, dayWidth: scale.dayWidth })

    this.ctx.events.emit('task:dragstart', { task, row, mode })

    const adapter = this.ctx.engine.getOptions().dateAdapter
    const onMove = (e: MouseEvent) => {
      drag = updateDrag(drag, e.clientX)
      const { start, end } = resolveDraggedDates(task, drag, adapter)
      this.ctx.engine.setDragPreview(hit.taskId, start, end)
      this.ctx.events.emit('task:dragmove', { task, row, mode, start, end, changed: true })
    }
    const onUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      drag = updateDrag(drag, e.clientX)
      const { start, end } = resolveDraggedDates(task, drag, adapter)
      const changed = drag.offsetDays !== 0
      // A real drag/resize (pointer actually moved) must not count as a click;
      // a stationary press-release still selects. 4px matches the rubber-band.
      if (Math.abs(e.clientX - event.clientX) + Math.abs(e.clientY - event.clientY) >= 4)
        this.suppressClick = true
      this.ctx.engine.clearDragPreview()
      if (changed)
        this.ctx.engine.updateTaskDates(hit.taskId, start, end)
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
    if (target.closest('.gantt__sidebar'))
      return
    // No per-shape DOM, so hit-test the scene: don't pan when starting on a task.
    if (target === this.canvasEl) {
      const { x, y } = this.pointerScene(event)
      if (this.ctx.engine.hitTest(x, y))
        return
    }
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
