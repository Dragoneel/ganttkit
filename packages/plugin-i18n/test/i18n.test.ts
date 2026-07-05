import { describe, expect, it } from 'vitest'
import { GanttEngine } from '@ganttkit/core'
import type { GanttRow } from '@ganttkit/core'
import { I18N_SERVICE, createI18n } from '../src/index'
import type { I18nService } from '../src/index'

const rows: GanttRow[] = [{ id: 'r', name: 'r', tasks: [{ id: 't', name: 't', start: '2026-01-05', end: '2026-01-09' }] }]

describe('createI18n', () => {
  it('translates with params and falls back to English', () => {
    const i18n = createI18n({ locale: 'fr', messages: { fr: { 'toolbar.today': "Aujourd'hui" } } })
    expect(i18n.t('toolbar.today')).toBe("Aujourd'hui")
    expect(i18n.t('view.Day')).toBe('Day') // missing in fr → English default
    expect(i18n.t('tooltip.complete', { percent: 60 })).toBe('60% complete')
    expect(i18n.t('unknown.key')).toBe('unknown.key')
  })

  it('publishes a service and localizes dates on install', () => {
    const g = new GanttEngine({ rows, startDate: '2026-01-01', endDate: '2026-01-31' })
    const en = g.getTimeScale().months[0]!.label
    g.use(createI18n({ locale: 'fr-FR' }).plugin)
    expect(g.consume<I18nService>(I18N_SERVICE)).toBeDefined()
    expect(g.getTimeScale().months[0]!.label).not.toBe(en) // dates now French
  })

  it('switches locale at runtime, recomputing dates and notifying', () => {
    const g = new GanttEngine({ rows, startDate: '2026-01-01', endDate: '2026-01-31' })
    const i18n = createI18n({ locale: 'en', messages: { fr: { 'view.Day': 'Jour' } } })
    g.use(i18n.plugin)
    let notified = 0
    i18n.subscribe(() => { notified++ })
    const before = g.getTimeScale().months[0]!.label

    i18n.setLocale('fr-FR')
    expect(notified).toBe(1)
    expect(i18n.locale).toBe('fr-FR')
    expect(i18n.t('view.Day')).toBe('Jour')
    expect(g.getTimeScale().months[0]!.label).not.toBe(before)
  })

  it('can skip date localization', () => {
    const g = new GanttEngine({ rows, startDate: '2026-01-01', endDate: '2026-01-31' })
    const en = g.getTimeScale().months[0]!.label
    g.use(createI18n({ locale: 'fr-FR', localizeDates: false }).plugin)
    expect(g.getTimeScale().months[0]!.label).toBe(en) // dates unchanged
  })
})
