# @ganttkit/vue

Vue 3 bindings for [GanttKit](https://www.npmjs.com/package/@ganttkit/core).

This is a binding, not a fourth renderer. The chart is painted by one of the
three base renderers - [`@ganttkit/html`](https://www.npmjs.com/package/@ganttkit/html)
by default - and this package only owns that renderer's lifetime and wires it to
Vue's reactivity. Every feature plugin (columns, tree, dependencies, markers,
tooltip, selection, i18n, ...) works unchanged, because none of them know a
framework is involved.

## Install

```bash
pnpm add @ganttkit/vue @ganttkit/html @ganttkit/core
```

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { GanttRow, ViewMode } from '@ganttkit/core'
import { GanttChart } from '@ganttkit/vue'
import { createTree } from '@ganttkit/plugin-tree'
import '@ganttkit/vue/styles.css'

const rows: GanttRow[] = [
  { id: 'design', name: 'Design', tasks: [{ id: 't1', name: 'Wireframes', start: '2026-06-15', end: '2026-07-08' }] },
]
const plugins = [createTree().plugin]
const viewMode = ref<ViewMode>('Week')
</script>

<template>
  <GanttChart
    v-model:view-mode="viewMode"
    :rows="rows"
    :plugins="plugins"
    style="height: 70vh"
    @task-click="({ task }) => console.log(task.name)"
  />
</template>
```

The root element needs a height. Attributes (`class`, `style`, `id`) fall
through to it, and the renderer adds its own `gantt` class on top.

## Choosing a renderer

The chart is painted by `@ganttkit/html` unless you say otherwise. Pass
`renderer` to paint with SVG or canvas instead, and import that package's
stylesheet rather than `@ganttkit/vue/styles.css`:

```vue
<script setup lang="ts">
import { GanttChart } from '@ganttkit/vue'
import { canvasRenderer } from '@ganttkit/canvas'
import '@ganttkit/canvas/styles.css'
</script>

<template>
  <GanttChart :renderer="canvasRenderer" :rows="rows" style="height: 70vh" />
</template>
```

| Renderer | Package | Stylesheet | Paints each primitive as |
| --- | --- | --- | --- |
| `htmlRenderer` (default) | `@ganttkit/html` | `@ganttkit/vue/styles.css` | a positioned `<div>` |
| `svgRenderer` | `@ganttkit/svg` | `@ganttkit/svg/styles.css` | an SVG element |
| `canvasRenderer` | `@ganttkit/canvas` | `@ganttkit/canvas/styles.css` | a draw call on one 2D canvas |

`@ganttkit/svg` and `@ganttkit/canvas` are optional peers - install the one you
use. `@ganttkit/vue/styles.css` re-exports the HTML sheet only, because it is
the only renderer this package depends on; for the other two, import the
stylesheet from the same package you import the renderer from.

Anything matching `RendererFactory` works, so a custom renderer drops in the
same way:

```ts
import type { GanttPlugin, RendererOptions } from '@ganttkit/core'

const myRenderer = (options: RendererOptions): GanttPlugin => ({ ... })
```

`renderer` is a rebuild prop: swapping it tears the engine down and builds a
fresh one with the new renderer.

## Props

Every [`GanttOptions`](https://www.npmjs.com/package/@ganttkit/core) field, plus
`renderer`, `theme`, `enable-zoom`, `enable-pan`, `chevron` and `plugins`.

They fall into three groups, which is the whole reactivity contract:

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

`scene:change` is deliberately not re-emitted - it fires on every scroll frame.
Subscribe to it on the engine itself when you need it:

```ts
const chart = useTemplateRef('chart')
chart.value?.engine?.events.on('scene:change', ({ reason }) => { /* ... */ })
```

## useGantt

For custom layouts, the composable behind the component is exported too. It owns
an engine for the lifetime of the current scope and applies the same three-group
contract:

```ts
const el = ref<HTMLElement | null>(null)
const { engine, rebuild } = useGantt(el, () => ({ rows: rows.value, viewMode: 'Week' }))
```

## Examples

- [`examples/basic`](examples/basic) - `pnpm --filter @ganttkit/example-vue dev`
- [`examples/stress`](examples/stress) - large-dataset benchmark with a live
  metrics panel: `pnpm --filter @ganttkit/example-vue-stress dev`
