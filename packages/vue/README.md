# @ganttkit/vue

Vue 3 bindings for [GanttKit](https://www.npmjs.com/package/@ganttkit/core).

This is a binding, not a fourth renderer. The chart is painted by
[`@ganttkit/html`](https://www.npmjs.com/package/@ganttkit/html), which maps the
engine's scene of vector primitives onto positioned `<div>`s; this package only
owns that renderer's lifetime and wires it to Vue's reactivity. Every feature
plugin (columns, tree, dependencies, markers, tooltip, selection, i18n, ...)
works unchanged, because none of them know a framework is involved.

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

## Props

Every [`GanttOptions`](https://www.npmjs.com/package/@ganttkit/core) field, plus
`theme`, `enable-zoom`, `enable-pan`, `chevron` and `plugins`.

They fall into three groups, which is the whole reactivity contract:

| Group | Props | Behaviour on change |
| --- | --- | --- |
| Live | `rows`, `view-mode`, `theme`, `date-adapter` | pushed into the running engine |
| Rebuild | `row-height`, `day-width`, `bar-padding`, `highlight-today`, `draggable`, `virtualize`, `overscan-rows`, `overscan-cols`, `start-date`, `end-date`, `enable-zoom`, `enable-pan` | the engine is torn down and rebuilt |
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
