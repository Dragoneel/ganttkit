import { describe, expect, it } from 'vitest'
import { RENDERERS, optionsModuleSource, optionsTypeSource, resolvePrefix } from '../src/template'

describe('RENDERERS', () => {
  it('names a package and factory for every renderer the options accept', () => {
    expect(Object.keys(RENDERERS)).toEqual(['html', 'svg', 'canvas'])
    for (const target of Object.values(RENDERERS)) {
      expect(target.pkg).toMatch(/^@ganttkit\//)
      expect(target.factory).toMatch(/Renderer$/)
    }
  })
})

describe('optionsModuleSource', () => {
  it('re-exports the chosen factory as `renderer`', () => {
    const source = optionsModuleSource(RENDERERS.canvas, {})
    expect(source).toContain("export { canvasRenderer as renderer } from '@ganttkit/canvas'")
  })

  // The point of taking a renderer *name* rather than a factory: the generated
  // module names one package, so the bundler can see the other two are
  // unreachable and drop them. A runtime lookup table would ship all three.
  it('mentions only the chosen renderer, so the others can be tree-shaken', () => {
    const source = optionsModuleSource(RENDERERS.svg, {})
    expect(source).toContain('@ganttkit/svg')
    expect(source).not.toContain('@ganttkit/html')
    expect(source).not.toContain('@ganttkit/canvas')
  })

  it('inlines the defaults, frozen', () => {
    const source = optionsModuleSource(RENDERERS.html, { dayWidth: 36, theme: 'dark' })
    expect(source).toContain('Object.freeze(')
    expect(source).toContain('"dayWidth": 36')
    expect(source).toContain('"theme": "dark"')
  })

  // An option the config never mentions has to be absent, not present-and-empty:
  // the component turns each default into a Vue prop default, and `undefined`
  // there is what lets the engine's own default win.
  it('drops keys left undefined rather than emitting them', () => {
    const source = optionsModuleSource(RENDERERS.html, { dayWidth: 36, theme: undefined })
    expect(source).not.toContain('theme')
    expect(source).toContain('"dayWidth": 36')
  })

  it('emits something a JS parser accepts', () => {
    const source = optionsModuleSource(RENDERERS.html, { viewMode: 'Week' })
    // Strip the import, which `new Function` cannot host, and check the rest.
    const body = source.replace(/^export \{[^}]+\} from '[^']+'$/m, '')
    expect(() => new Function(body.replace(/^export /gm, ''))).not.toThrow()
  })
})

describe('optionsTypeSource', () => {
  it('declares the alias the runtime imports', () => {
    const source = optionsTypeSource()
    expect(source).toContain("declare module '#ganttkit-options'")
    expect(source).toContain('export const renderer')
    expect(source).toContain('export const defaults')
  })

  // Typed off the package entry, not a path inside `dist`, so it keeps
  // resolving however the build lays the runtime out.
  it('types itself off the published entry', () => {
    expect(optionsTypeSource()).toContain("import('@ganttkit/nuxt')")
  })
})

describe('resolvePrefix', () => {
  it('defaults to a real prefix, not the empty string', () => {
    expect(resolvePrefix(undefined)).toBe('Gantt')
  })

  it('accepts a PascalCase rename', () => {
    expect(resolvePrefix('GanttKit')).toBe('GanttKit')
    expect(resolvePrefix('Acme2')).toBe('Acme2')
  })

  it('tolerates stray whitespace', () => {
    expect(resolvePrefix('  GanttKit  ')).toBe('GanttKit')
  })

  // Each of these would register something Nuxt cannot resolve or JS cannot
  // name: `<Chart>` and `use()`, `<ganttChart>`, `use_My_App`.
  it.each(['', '   ', 'gantt', 'My_App', 'My App', '2Fast', 'Gantt-Kit'])(
    'rejects %o with the fix in the message',
    (prefix) => {
      expect(() => resolvePrefix(prefix)).toThrow(/PascalCase/)
    },
  )
})
