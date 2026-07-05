/**
 * @ganttkit/plugin-i18n  localization for GanttKit.
 *
 * Two things in one plugin:
 * 1. **Locale dates**  swaps in an `Intl` date adapter so the timeline's
 *    weekday/month/week labels follow the locale (toggleable).
 * 2. **Translatable strings**  publishes an `i18n` service (under
 *    {@link I18N_SERVICE}) that other plugins read via `t(key)`. The built-in
 *    `toolbar`/`tooltip` plugins consume it, falling back to English.
 *
 * Switching locale at runtime recomputes dates and notifies subscribers so the
 * UI re-renders  no reload.
 *
 * ```ts
 * import { createI18n } from '@ganttkit/plugin-i18n'
 * const i18n = createI18n({
 *   locale: 'fr',
 *   messages: { fr: { 'toolbar.today': "Aujourd'hui", 'view.Day': 'Jour' } },
 * })
 * engine.use(i18n.plugin)
 * i18n.setLocale('fr')
 * ```
 */
import type { GanttEngineApi, GanttPlugin } from '@ganttkit/core'
import { createIntlAdapter } from '@ganttkit/core'
import type { IntlAdapterOptions } from '@ganttkit/core'

/** Well-known service key consumers look up. */
export const I18N_SERVICE = 'gantt:i18n'

/** Locale → key → template. Templates may contain `{param}` placeholders. */
export type Messages = Record<string, Record<string, string>>

/** The contract published under {@link I18N_SERVICE}. */
export interface I18nService {
  /** Translate a key, interpolating `{param}` placeholders. */
  t: (key: string, params?: Record<string, string | number>) => string
  /** Current locale (live getter). */
  readonly locale: string
  /** Subscribe to locale changes. Returns a disposer. */
  subscribe: (listener: () => void) => () => void
}

export interface I18nOptions {
  /** Initial locale, e.g. `'en'`, `'fr-FR'`. */
  locale: string
  /** Locale → key → string. Merged over the built-in English defaults. */
  messages?: Messages
  /** Locale used when a key is missing in the active locale. Default `'en'`. */
  fallbackLocale?: string
  /** Swap in an `Intl` date adapter on the engine. Default `true`. */
  localizeDates?: boolean
  /** Options forwarded to `createIntlAdapter`. */
  dateOptions?: IntlAdapterOptions
}

export interface GanttI18n extends I18nService {
  readonly plugin: GanttPlugin
  /** Change the active locale (recomputes dates + notifies subscribers). */
  setLocale: (locale: string) => void
}

/** Default English strings for the built-in plugins. */
export const DEFAULT_MESSAGES: Messages = {
  en: {
    'view.Day': 'Day',
    'view.Week': 'Week',
    'view.Month': 'Month',
    'toolbar.today': 'Today',
    'toolbar.zoomIn': 'Zoom in',
    'toolbar.zoomOut': 'Zoom out',
    'toolbar.expandAll': 'Expand all',
    'toolbar.collapseAll': 'Collapse all',
    'toolbar.captureBaseline': 'Capture baseline',
    'toolbar.clearBaseline': 'Clear baseline',
    'tooltip.complete': '{percent}% complete',
  },
}

export function createI18n(options: I18nOptions): GanttI18n {
  let locale = options.locale
  const fallback = options.fallbackLocale ?? 'en'
  const messages = options.messages ?? {}
  const localizeDates = options.localizeDates !== false
  const dateOptions = options.dateOptions
  const listeners = new Set<() => void>()
  let engine: GanttEngineApi | null = null

  // Candidate locales in priority order, including the primary subtag
  // (so `'fr-FR'` resolves `'fr'` messages) and the fallback locale.
  function candidates(): string[] {
    const expand = (loc: string) => {
      const base = loc.split('-')[0]!
      return base !== loc ? [loc, base] : [loc]
    }
    return [...new Set([...expand(locale), ...expand(fallback)])]
  }

  function lookup(key: string): string | undefined {
    const locales = candidates()
    for (const loc of locales) {
      const value = messages[loc]?.[key]
      if (value != null)
        return value
    }
    for (const loc of locales) {
      const value = DEFAULT_MESSAGES[loc]?.[key]
      if (value != null)
        return value
    }
    return undefined
  }

  function t(key: string, params?: Record<string, string | number>): string {
    const template = lookup(key) ?? key
    if (!params)
      return template
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
      (name in params ? String(params[name]) : `{${name}}`))
  }

  const notify = () => {
    for (const listener of [...listeners])
      listener()
  }

  const controller: GanttI18n = {
    t,
    get locale() {
      return locale
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setLocale(next) {
      if (next === locale)
        return
      locale = next
      if (localizeDates && engine)
        engine.setDateAdapter(createIntlAdapter(locale, dateOptions))
      notify()
    },
    plugin: {
      name: 'i18n',
      install(ctx) {
        engine = ctx.engine
        const off = ctx.services.provide<I18nService>(I18N_SERVICE, controller)
        if (localizeDates)
          ctx.engine.setDateAdapter(createIntlAdapter(locale, dateOptions))
        return () => {
          off()
          engine = null
        }
      },
    },
  }

  return controller
}
