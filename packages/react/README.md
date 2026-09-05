# @ganttkit/react

React 19 bindings for [GanttKit](https://www.npmjs.com/package/@ganttkit/core).

This is a binding, not a fourth renderer. The chart is painted by
[`@ganttkit/html`](https://www.npmjs.com/package/@ganttkit/html), which maps the
engine's scene of vector primitives onto positioned `<div>`s; this package only
owns that renderer's lifetime and wires it to React's. Every feature plugin
(columns, tree, dependencies, markers, tooltip, selection, i18n, ...) works
unchanged, because none of them know a framework is involved.

## Install

```bash
pnpm add @ganttkit/react @ganttkit/html @ganttkit/core
```

## Usage

```tsx
import { useState } from 'react'
import type { GanttRow, ViewMode } from '@ganttkit/core'
import { GanttChart } from '@ganttkit/react'
import { createTree } from '@ganttkit/plugin-tree'
import '@ganttkit/react/styles.css'

const ROWS: GanttRow[] = [
  { id: 'design', name: 'Design', tasks: [{ id: 't1', name: 'Wireframes', start: '2026-06-15', end: '2026-07-08' }] },
]
const PLUGINS = [createTree().plugin]

export function Chart() {
  const [viewMode, setViewMode] = useState<ViewMode>('Week')
  return (
    <GanttChart
      rows={ROWS}
      plugins={PLUGINS}
      viewMode={viewMode}
      onViewModeChange={({ viewMode }) => setViewMode(viewMode)}
      onTaskClick={({ task }) => console.log(task.name)}
      style={{ height: '70vh' }}
    />
  )
}
```

The root element needs a height. `className` and `style` are passed to it, and
the renderer adds its own `gantt` class on top.

## Props

Every [`GanttOptions`](https://www.npmjs.com/package/@ganttkit/core) field, plus
`theme`, `enableZoom`, `enablePan`, `chevron` and `plugins`.

They fall into three groups, which is the whole reactivity contract:

| Group | Props | Behaviour on change |
| --- | --- | --- |
| Live | `rows`, `viewMode`, `theme`, `dateAdapter` | pushed into the running engine |
| Rebuild | `rowHeight`, `dayWidth`, `barPadding`, `highlightToday`, `draggable`, `virtualize`, `overscanRows`, `overscanCols`, `startDate`, `endDate`, `enableZoom`, `enablePan` | the engine is torn down and rebuilt |
| Read once | `plugins`, `chevron` | read when the engine is built |

Rebuilds key off the option *values*, not object identity, so a re-render with
the same numbers never rebuilds. `plugins` is read once, so an inline array is
safe too - but keep the plugin instances stable if you want their state (a
tree's collapsed set, a filter's predicate) to survive a rebuild.

## Callbacks

`onReady` (the live `GanttEngine`), `onTaskClick`, `onTaskDblClick`,
`onTaskHover`, `onTaskHoverEnd`, `onTaskDragStart`, `onTaskDragMove`,
`onTaskDragEnd`, `onViewModeChange`, `onDateRangeChange`, `onRowsChange`,
`onSelectionChange` and `onRowToggle`.

They are read through a ref at call time, so they never need memoizing and never
cause a rebuild.

`scene:change` is deliberately not forwarded - it fires on every scroll frame.
Subscribe to it on the engine itself when you need it, via `onReady` or the
`ref` handle:

```tsx
const chart = useRef<GanttChartHandle>(null)
chart.current?.engine?.events.on('scene:change', ({ reason }) => { /* ... */ })
```

## useGantt

For custom layouts, the hook behind the component is exported too. It owns an
engine for the lifetime of the component and applies the same three-group
contract:

```tsx
const host = useRef<HTMLDivElement>(null)
const engine = useGantt(host, { rows, viewMode: 'Week' })
return <div ref={host} style={{ height: '70vh' }} />
```

## Examples

- [`examples/basic`](examples/basic) - `pnpm --filter @ganttkit/example-react dev`
- [`examples/stress`](examples/stress) - large-dataset benchmark with a live
  metrics panel: `pnpm --filter @ganttkit/example-react-stress dev`
