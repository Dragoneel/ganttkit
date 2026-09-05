import type { Ref, ShallowRef } from 'vue'
import { onScopeDispose, shallowRef, watch } from 'vue'
import type { GanttEngine } from '@ganttkit/core'
import type { GanttChartOptions } from './engine'
import { createEngine, rebuildKey, syncRows, syncTheme, syncViewMode } from './engine'

export interface UseGanttHooks {
  /**
   * Called right after an engine is built, before it is exposed. Wire
   * `engine.events` here - the subscriptions die with the engine.
   */
  onCreated?: (engine: GanttEngine) => void
}

export interface UseGanttReturn {
  /** The live engine, or `null` before the target mounts / after teardown. */
  engine: ShallowRef<GanttEngine | null>
  /** Tear the engine down and build a fresh one from the current options. */
  rebuild: () => void
}

/**
 * Own a GanttKit engine for the lifetime of the current scope, painting into
 * `target` with the HTML renderer.
 *
 * `options` is a getter so every read is tracked: `rows`, `viewMode`, `theme`
 * and `dateAdapter` are pushed into the live engine, while a change to any
 * construction-time option rebuilds it. `plugins` and `chevron` are read once
 * per engine.
 *
 * ```ts
 * const el = ref<HTMLElement | null>(null)
 * const { engine } = useGantt(el, () => ({ rows: rows.value, viewMode: 'Week' }))
 * ```
 */
export function useGantt(
  target: Ref<HTMLElement | null | undefined>,
  options: () => GanttChartOptions,
  hooks: UseGanttHooks = {},
): UseGanttReturn {
  const engine = shallowRef<GanttEngine | null>(null)

  function build(): void {
    const el = target.value
    if (!el)
      return
    const created = createEngine(el, options())
    engine.value = created
    hooks.onCreated?.(created)
  }

  // `destroy()` tears down the plugins, so the renderer empties the target and
  // the engine's event bus is cleared - nothing else to unsubscribe.
  function teardown(): void {
    engine.value?.destroy()
    engine.value = null
  }

  function rebuild(): void {
    teardown()
    build()
  }

  // `post` so the target element exists by the time we paint into it.
  watch(target, el => (el ? rebuild() : teardown()), { immediate: true, flush: 'post' })

  watch(() => rebuildKey(options()), () => {
    if (engine.value)
      rebuild()
  })
  watch(() => options().rows, (rows) => {
    if (engine.value)
      syncRows(engine.value, rows)
  })
  watch(() => options().viewMode, (viewMode) => {
    if (engine.value)
      syncViewMode(engine.value, viewMode)
  })
  watch(() => options().theme, (theme) => {
    if (target.value)
      syncTheme(target.value, theme)
  })
  watch(() => options().dateAdapter, (adapter) => {
    if (adapter && engine.value)
      engine.value.setDateAdapter(adapter)
  })

  onScopeDispose(teardown)

  return { engine, rebuild }
}
