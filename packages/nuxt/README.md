# @ganttkit/nuxt

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Nuxt module for [GanttKit](https://www.npmjs.com/package/@ganttkit/core) - a
headless, framework-agnostic Gantt chart engine.

- [Release Notes](CHANGELOG.md)
- [Online playground](https://stackblitz.com/github/Dragoneel/ganttkit?file=packages%2Fnuxt%2Fexamples%2Fplayground%2Fapp%2Fapp.vue)
- [Documentation](https://ganttkit.org)

## Features

- `<GanttChart>` and `useGantt()` auto-imported, no imports, no plugin file
- Renderer picked in `nuxt.config`, so the two you don't use are never bundled
- Chart defaults set once, app-wide, and overridable per chart
- SSR-safe with no `<ClientOnly>` and no layout shift
- Every GanttKit feature plugin works unchanged

## Quick setup

```bash
npx nuxt module add @ganttkit/nuxt
```

That's it. `<GanttChart>` is available anywhere, the stylesheet is already
loaded, and the chart is painted by `@ganttkit/html`:

```vue
<script setup lang="ts">
import type { GanttRow } from '@ganttkit/core'

const rows: GanttRow[] = [
  { id: 'design', name: 'Design', tasks: [{ id: 't1', name: 'Wireframes', start: '2026-06-15', end: '2026-07-08' }] },
]
</script>

<template>
  <GanttChart :rows="rows" style="height: 70vh" />
</template>
```

The root element needs a height. Attributes (`class`, `style`, `id`) fall
through to it, and the renderer adds its own `gantt` class on top.

## Why a module

The chart itself is [`@ganttkit/vue`](https://www.npmjs.com/package/@ganttkit/vue),
and this module does not re-implement it. It answers the three questions a Nuxt
app would otherwise answer by hand:

| Without the module | With it |
| --- | --- |
| `import { GanttChart } from '@ganttkit/vue'` in every file | auto-imported, like any Nuxt component |
| `import '@ganttkit/html/styles.css'` somewhere global | added to `nuxt.options.css` for you |
| repeat `:day-width="36"` on every chart, or wrap the component | `ganttkit.defaults` in `nuxt.config` |

And one it answers *better* than hand-wiring: naming a renderer in
`nuxt.config` becomes a static import of that one package, so the renderers you
did not choose are dropped from both the client and the server bundle.

## Configuration

Everything lives under the `ganttkit` key:

```ts
export default defineNuxtConfig({
  modules: ['@ganttkit/nuxt'],

  ganttkit: {
    renderer: 'html',
    defaults: {
      viewMode: 'Week',
      dayWidth: 36,
      highlightToday: true,
    },
  },
})
```

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `renderer` | `'html' \| 'svg' \| 'canvas'` | `'html'` | Base renderer to paint with, and which stylesheet is injected |
| `css` | `boolean` | `true` | Add that renderer's stylesheet to `nuxt.options.css` |
| `defaults` | `GanttChartDefaults` | `{}` | Chart options applied to every chart in the app |
| `prefix` | `string` | `'Gantt'` | Names what the module injects: `<GanttChart>` and `useGantt()` |
| `autoImports` | `boolean` | `true` | Auto-import the composable |

### `defaults`

The serializable half of the component's props, set once for the whole app:
`viewMode`, `theme`, `startDate`, `endDate`, `rowHeight`, `dayWidth`,
`barPadding`, `highlightToday`, `draggable`, `virtualize`, `overscanRows`,
`overscanCols`, `enableZoom` and `enablePan`.

Each becomes that prop's default, so a prop you pass still wins and one you
omit falls back here instead of to the engine's built-in. Options that carry
functions - `rows`, `plugins`, `chevron`, `dateAdapter` - cannot live in
`nuxt.config` and stay per-chart. Dates are `string` or `number` here for the
same reason.

### `prefix`

Nuxt asks modules to prefix what they add to your app's namespace, so the
default is a real prefix rather than none: `<GanttChart>` and `useGantt()`. One
option renames both together, for when those names are already taken:

```ts
ganttkit: { prefix: 'GanttKit' } // <GanttKitChart> and useGanttKit()
```

## Choosing a renderer

```ts
ganttkit: { renderer: 'canvas' }
```

| Name | Package | Paints each primitive as | Suits |
| --- | --- | --- | --- |
| `'html'` (default) | `@ganttkit/html` | a positioned `<div>` | styling with plain CSS, DOM inspection, accessibility hooks |
| `'svg'` | `@ganttkit/svg` | an SVG element | crisp vector output, export to file, CSS-styled shapes |
| `'canvas'` | `@ganttkit/canvas` | a draw call on one 2D canvas | the largest datasets, where a node per primitive is the bottleneck |

`@ganttkit/svg` and `@ganttkit/canvas` are optional peers, install the one you
name, and the module says so plainly if you forget:

```bash
pnpm add @ganttkit/canvas
```

The name is resolved at build time into a static import, which is why it is a
name and not a factory: a function in `nuxt.config` could not reach the client
bundle. To override it for a single chart, pass `renderer` as a prop and import
that package's stylesheet yourself, anything matching `RendererFactory` works,
so a custom renderer drops in the same way.

## Props

Every prop `@ganttkit/vue` accepts, unchanged. They fall into three groups,
which is the whole reactivity contract:

| Group | Props | Behaviour on change |
| --- | --- | --- |
| Live | `rows`, `view-mode`, `theme`, `date-adapter` | pushed into the running engine |
| Rebuild | `renderer`, `row-height`, `day-width`, `bar-padding`, `highlight-today`, `draggable`, `virtualize`, `overscan-rows`, `overscan-cols`, `start-date`, `end-date`, `enable-zoom`, `enable-pan` | the engine is torn down and rebuilt |
| Read once | `plugins`, `chevron` | read when the engine is built |

Because `plugins` is read once, an inline array is safe: it never causes a
rebuild on its own.

## Events

`ready` (the live `GanttEngine`), `update:viewMode`, `task-click`,
`task-dblclick`, `task-hover`, `task-hoverend`, `task-dragstart`,
`task-dragmove`, `task-dragend`, `view-mode-change`, `date-range-change`,
`rows-change`, `selection-change` and `row-toggle`.

```vue
<template>
  <GanttChart
    v-model:view-mode="viewMode"
    :rows="rows"
    :plugins="plugins"
    @task-click="({ task }) => console.log(task.name)"
  />
</template>
```

`scene:change` is deliberately not re-emitted, it fires on every scroll frame.
Subscribe to it on the engine itself when you need it:

```ts
const chart = useTemplateRef('chart')
chart.value?.engine?.events.on('scene:change', ({ reason }) => { /* ... */ })
```

## Feature plugins

Plugins know nothing about Nuxt, Vue or the renderer, so they all work as-is.
Build them in `<script setup>` and pass them once:

```vue
<script setup lang="ts">
import { createTree } from '@ganttkit/plugin-tree'
import { toolbarPlugin } from '@ganttkit/plugin-toolbar'

const tree = createTree()
const plugins = [toolbarPlugin(), tree.plugin]
</script>

<template>
  <button @click="tree.collapseAll()">Collapse all</button>
  <GanttChart :rows="rows" :plugins="plugins" style="height: 70vh" />
</template>
```

## useGantt

For custom layouts, the composable behind the component is auto-imported too.
It owns an engine for the lifetime of the calling scope and applies the same
three-group contract, with `nuxt.config` layered underneath:

```ts
const el = useTemplateRef<HTMLElement>('el')
const { engine, rebuild } = useGantt(el, () => ({ rows: rows.value }))
```

An explicit `undefined` from the getter reads as "not set", so it falls through
to `ganttkit.defaults` rather than clearing it.

## Server-side rendering

Works with SSR on, and needs nothing wrapped in `<ClientOnly>`.

The chart is painted by a DOM renderer, so there is nothing to paint on the
server - but the component's root element still renders there. Give it a height
and the server sends a correctly sized empty box; the engine paints into that
same element after hydration, so the page does not shift. `engine` stays `null`
until then.

## Contribution

<details>
  <summary>Local development</summary>

  ```bash
  # Install dependencies
  pnpm install

  # Build the module and generate type stubs
  pnpm --filter @ganttkit/nuxt dev:prepare

  # Develop with the playground
  pnpm --filter @ganttkit/nuxt playground

  # Build the playground
  pnpm --filter @ganttkit/nuxt playground:build

  # Run Vitest
  pnpm --filter @ganttkit/nuxt test

  # Type checking
  pnpm --filter @ganttkit/nuxt typecheck
  ```

</details>

## License

[MIT](https://github.com/Dragoneel/ganttkit/blob/main/LICENSE)

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@ganttkit/nuxt/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/@ganttkit/nuxt

[npm-downloads-src]: https://img.shields.io/npm/dm/@ganttkit/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/@ganttkit/nuxt

[license-src]: https://img.shields.io/npm/l/@ganttkit/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/@ganttkit/nuxt

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt
[nuxt-href]: https://nuxt.com
