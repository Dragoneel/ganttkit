import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { GanttEngine } from '@ganttkit/core'
import type { GanttChartOptions } from './engine'
import { createEngine, rebuildKey, syncRows, syncTheme, syncViewMode } from './engine'

export interface UseGanttHooks {
  /**
   * Called right after an engine is built, before it is returned. Wire
   * `engine.events` here - the subscriptions die with the engine.
   */
  onCreated?: (engine: GanttEngine) => void
}

/**
 * Own a GanttKit engine for the lifetime of the component, painting into
 * `target` with the HTML renderer.
 *
 * `rows`, `viewMode`, `theme` and `dateAdapter` are pushed into the live
 * engine; a change to any construction-time option rebuilds it. `plugins` and
 * `chevron` are read once per engine, so inline arrays are safe.
 *
 * ```tsx
 * const host = useRef<HTMLDivElement>(null)
 * const engine = useGantt(host, { rows, viewMode: 'Week' })
 * return <div ref={host} style={{ height: '70vh' }} />
 * ```
 */
export function useGantt(
  target: RefObject<HTMLElement | null>,
  options: GanttChartOptions,
  hooks: UseGanttHooks = {},
): GanttEngine | null {
  const engineRef = useRef<GanttEngine | null>(null)
  const [engine, setEngine] = useState<GanttEngine | null>(null)
  // Latest values, so the build effect can read them without depending on them.
  const latest = useRef({ options, hooks })
  latest.current = { options, hooks }

  // Only the construction-time options rebuild the engine; the rest sync below.
  const key = rebuildKey(options)
  useEffect(() => {
    const el = target.current
    if (!el)
      return
    const created = createEngine(el, latest.current.options)
    engineRef.current = created
    latest.current.hooks.onCreated?.(created)
    setEngine(created)
    // `destroy()` tears down the plugins, so the renderer empties the target
    // and the engine's event bus is cleared - nothing else to unsubscribe.
    return () => {
      created.destroy()
      engineRef.current = null
      setEngine(null)
    }
  }, [target, key])

  useEffect(() => {
    if (engineRef.current)
      syncRows(engineRef.current, options.rows)
  }, [options.rows])

  useEffect(() => {
    if (engineRef.current)
      syncViewMode(engineRef.current, options.viewMode)
  }, [options.viewMode])

  useEffect(() => {
    if (target.current)
      syncTheme(target.current, options.theme)
  }, [target, options.theme])

  useEffect(() => {
    if (options.dateAdapter && engineRef.current)
      engineRef.current.setDateAdapter(options.dateAdapter)
  }, [options.dateAdapter])

  return engine
}
