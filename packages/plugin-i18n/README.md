# @ganttkit/plugin-i18n

Localization for GanttKit  **locale-aware dates** + **translatable strings**,
with runtime language switching.

```ts
import { createI18n } from '@ganttkit/plugin-i18n'

const i18n = createI18n({
  locale: 'fr',
  messages: {
    fr: { 'view.Day': 'Jour', 'view.Week': 'Semaine', 'view.Month': 'Mois', 'toolbar.today': "Aujourd'hui" },
  },
})
engine.use(i18n.plugin)      

i18n.setLocale('de')         // recomputes dates + re-renders UI strings, no reload
i18n.t('toolbar.today')      // → translated string (English fallback)
```

## What it does

1. **Dates**  swaps in an `Intl` date adapter (`createIntlAdapter`) so the
   timeline's weekday/month/week labels follow the locale, including first day of
   week and weekend days. Toggle with `localizeDates: false`.
2. **Strings**  publishes an `i18n` service under `'gantt:i18n'`. Built-in
   plugins (`@ganttkit/plugin-toolbar`, `@ganttkit/plugin-tooltip`) read it via
   `t(key)` and fall back to English when it's absent  so installing this is
   purely additive.

Install it **before** the UI plugins so the service is present when they mount.

## Messages

Locale → key → template (`{param}` placeholders). Merged over the built-in
English defaults; unknown locales fall back to the primary subtag then to `en`.

Built-in keys: `view.Day` / `view.Week` / `view.Month`, `toolbar.today`,
`toolbar.zoomIn`, `toolbar.zoomOut`, `tooltip.complete` (`{percent}`).

## API

- `createI18n(options) → GanttI18n`
  - `locale`, `messages?`, `fallbackLocale?` (default `'en'`),
    `localizeDates?` (default `true`), `dateOptions?` (forwarded to `createIntlAdapter`)
- `GanttI18n`: `{ plugin, t, locale, setLocale, subscribe }`

Date-only localization needs nothing from this package  pass
`createIntlAdapter(locale)` (from `@ganttkit/core`) as the engine's `dateAdapter`.

## License

MIT
