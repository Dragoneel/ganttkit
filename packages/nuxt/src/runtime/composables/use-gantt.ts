import type { Ref } from 'vue'
import type { GanttChartOptions, UseGanttHooks, UseGanttReturn } from '@ganttkit/vue'
import { useGantt as baseUseGantt } from '@ganttkit/vue'
import { defaults, renderer } from '#ganttkit-options'
import { mergeChartOptions } from '../defaults'

/**
 * The auto-imported composable behind the chart component - `useGantt()`
 * unless `ganttkit.prefix` renames it - with the module's `nuxt.config`
 * layered in.
 *
 * Reach for it instead of the component when the chart shares an element with
 * a custom layout, or when you want the engine without a wrapper div. It owns
 * one engine for the lifetime of the calling scope and applies the same
 * three-group reactivity contract as the component: `rows`, `viewMode`,
 * `theme` and `dateAdapter` are pushed into the live engine, other options
 * rebuild it, and `plugins`/`chevron` are read once per engine.
 *
 * `ganttkit.defaults` sits under whatever the getter returns, and `renderer`
 * comes from `ganttkit.renderer` unless the getter names another one. An
 * explicit `undefined` from the getter reads as "not set", so it falls through
 * to the config rather than clearing it.
 *
 * ```ts
 * const el = useTemplateRef<HTMLElement>('el')
 * const { engine, rebuild } = useGantt(el, () => ({ rows: rows.value }))
 * ```
 *
 * The engine is only built once `target` holds an element, so on the server
 * this is inert and `engine` stays `null` until the client has hydrated.
 */
export function useGantt(
  target: Ref<HTMLElement | null | undefined>,
  options: () => GanttChartOptions = () => ({}),
  hooks?: UseGanttHooks,
): UseGanttReturn {
  // `renderer` first, so a getter that names its own still wins: the merge
  // drops undefined keys, which leaves the module's choice in place when the
  // caller is silent.
  return baseUseGantt(target, () => ({ renderer, ...mergeChartOptions(defaults, options()) }), hooks)
}
