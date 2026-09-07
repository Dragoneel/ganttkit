import { createRequire } from 'node:module'
import {
  addComponent,
  addImports,
  addTemplate,
  addTypeTemplate,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import type { GanttChartDefaults, RendererName } from './types'
import { RENDERERS, optionsModuleSource, optionsTypeSource, resolvePrefix } from './template'

export type { GanttChartDefaults, GanttKitRuntimeOptions, RendererName } from './types'

export interface ModuleOptions {
  /**
   * Base renderer to paint with. Default `'html'`.
   *
   * A name, not a factory: `nuxt.config` is read at build time, so the module
   * turns the name into a static import and the two renderers you did not
   * choose never reach the bundle. `'svg'` and `'canvas'` are optional peers -
   * install the one you name.
   *
   * | Name | Package | Paints each primitive as |
   * | --- | --- | --- |
   * | `'html'` | `@ganttkit/html` | a positioned `<div>` |
   * | `'svg'` | `@ganttkit/svg` | an SVG element |
   * | `'canvas'` | `@ganttkit/canvas` | a draw call on one 2D canvas |
   */
  renderer?: RendererName
  /**
   * Add the chosen renderer's stylesheet to `nuxt.options.css`. Default `true`.
   *
   * Turn it off to import the sheet yourself, or to replace it: the bundled
   * ones set the chart's custom properties and layout, so they are a starting
   * point rather than a requirement.
   */
  css?: boolean
  /**
   * Chart options applied to every `<GanttChart>` and every `useGantt` call
   * that does not override them.
   *
   * The serializable options only - `rows`, `plugins`, `chevron` and
   * `dateAdapter` carry functions, so they stay per-chart.
   */
  defaults?: GanttChartDefaults
  /**
   * Prefix for everything this module adds to your app's namespace. Default
   * `'Gantt'`, giving `<GanttChart>` and `useGantt()`.
   *
   * Nuxt asks modules to prefix what they inject so nothing collides with
   * another module, Nuxt internals or your own code, so this is a rename
   * rather than an opt-out: `prefix: 'GanttKit'` gives `<GanttKitChart>` and
   * `useGanttKit()`. Reach for it when the defaults are already taken - your
   * own `components/GanttChart.vue`, say.
   */
  prefix?: string
  /**
   * Auto-import the composable. Default `true`.
   *
   * The component is registered either way. Turn this off to import
   * `useGantt` from `@ganttkit/vue` yourself - you then lose the `nuxt.config`
   * defaults, which is the only thing this module's copy adds.
   */
  autoImports?: boolean
}

/**
 * Annotated rather than inferred, and exported on its own line below.
 *
 * `defineNuxtModule`'s return type is spelled in `@nuxt/schema`, which under
 * pnpm sits at a store path this package cannot name (TS2742). Naming the type
 * here puts a bare `@nuxt/schema` specifier in the emitted `.d.mts` instead,
 * which resolves for consumers - every Nuxt app has it.
 */
const ganttkitModule: NuxtModule<ModuleOptions, ModuleOptions, false> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@ganttkit/nuxt',
    configKey: 'ganttkit',
    compatibility: {
      nuxt: '>=3.0.0',
    },
  },
  defaults: {
    renderer: 'html',
    css: true,
    defaults: {},
    prefix: 'Gantt',
    autoImports: true,
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const name = options.renderer ?? 'html'
    const target = RENDERERS[name]
    if (!target) {
      throw new Error(
        `[@ganttkit/nuxt] Unknown renderer ${JSON.stringify(name)}. `
        + `Expected one of: ${Object.keys(RENDERERS).map(r => `'${r}'`).join(', ')}.`,
      )
    }

    // `svg` and `canvas` are optional peers, so a config can name one the app
    // never installed. Caught here it reads as one line with the fix in it;
    // left to the bundler it surfaces as an unresolved import from a generated
    // file the user never wrote.
    if (!isInstalled(target.pkg, nuxt.options.modulesDir)) {
      throw new Error(
        `[@ganttkit/nuxt] renderer: '${name}' needs ${target.pkg}, which is not installed.\n`
        + `  Install it:  pnpm add ${target.pkg}\n`
        + `  Or switch:   ganttkit: { renderer: 'html' }`,
      )
    }

    // One prefix names both `<GanttChart>` and `useGantt()`, so a rename moves
    // them together rather than leaving half the surface on the old name.
    const prefix = resolvePrefix(options.prefix)

    // Everything above only reads and validates; the wiring starts here, so a
    // bad config fails before it has half-registered itself.
    if (options.css)
      nuxt.options.css.push(`${target.pkg}/styles.css`)

    // One generated module carries both build-time answers into the runtime:
    // which renderer to paint with, and the app-wide defaults.
    const template = addTemplate({
      filename: 'ganttkit-options.mjs',
      // Written to disk because the server build resolves this alias off the
      // filesystem, unlike Vite's in-memory virtual modules.
      write: true,
      getContents: () => optionsModuleSource(target, options.defaults ?? {}),
    })

    // One alias covers both bundles: the Nitro builder spreads
    // `nuxt.options.alias` into its own, so the server build sees it too.
    nuxt.options.alias['#ganttkit-options'] = template.dst

    addTypeTemplate({
      filename: 'ganttkit-options.d.ts',
      getContents: () => optionsTypeSource(),
    })

    addComponent({
      name: `${prefix}Chart`,
      filePath: resolver.resolve('./runtime/components/GanttChart'),
    })

    if (options.autoImports) {
      addImports({
        // Exported as `useGantt` to match `@ganttkit/vue`; auto-imported under
        // the prefix so a rename covers it too.
        name: 'useGantt',
        as: `use${prefix}`,
        from: resolver.resolve('./runtime/composables/use-gantt'),
      })
    }
  },
})

export default ganttkitModule

/**
 * Is `pkg` resolvable from the app?
 *
 * Resolved against `modulesDir` - the app's own `node_modules` chain - rather
 * than from this file, so a copy hoisted next to the module does not stand in
 * for one the app never asked for. Every renderer package ships a `require`
 * condition, so CJS resolution answers the question.
 */
function isInstalled(pkg: string, modulesDir: string[]): boolean {
  try {
    createRequire(import.meta.url).resolve(pkg, { paths: modulesDir })
    return true
  }
  catch {
    return false
  }
}
