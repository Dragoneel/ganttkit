# @ganttkit/angular

Angular bindings for [GanttKit](https://www.npmjs.com/package/@ganttkit/core).

This is a binding, not a fourth renderer. The chart is painted by
[`@ganttkit/html`](https://www.npmjs.com/package/@ganttkit/html), which maps the
engine's scene of vector primitives onto positioned `<div>`s; this package only
owns that renderer's lifetime and wires it to Angular's signals. Every feature
plugin (columns, tree, dependencies, markers, tooltip, selection, i18n, ...)
works unchanged, because none of them know a framework is involved.

Published in the Angular Package Format: a partially-compiled `fesm2022` bundle
that your app's build links, so the package is not pinned to the Angular version
it was compiled with.

## Install

```bash
pnpm add @ganttkit/angular @ganttkit/html @ganttkit/core
```

## Usage

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import type { GanttRow, TaskPointerEvent } from '@ganttkit/core'
import { GanttChartComponent } from '@ganttkit/angular'
import { createTree } from '@ganttkit/plugin-tree'

@Component({
  selector: 'app-schedule',
  imports: [GanttChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <gantt-chart
      style="height: 70vh"
      [rows]="rows()"
      [plugins]="plugins"
      (taskClick)="onTaskClick($event)"
    />
  `,
})
export class ScheduleComponent {
  readonly rows = signal<GanttRow[]>([
    { id: 'design', name: 'Design', tasks: [{ id: 't1', name: 'Wireframes', start: '2026-06-15', end: '2026-07-08' }] },
  ])

  readonly plugins = [createTree().plugin]

  onTaskClick({ task }: TaskPointerEvent): void {
    console.log(task.name)
  }
}
```

Add the stylesheet once, either from a TypeScript entry point
(`import '@ganttkit/angular/styles.css'`) or through the `styles` array in
`angular.json`.

The host is `display: block` and needs a height. The renderer adds its own
`gantt` class to it.

## Inputs

Every [`GanttOptions`](https://www.npmjs.com/package/@ganttkit/core) field, plus
`theme`, `enableZoom`, `enablePan`, `chevron` and `plugins`.

They fall into three groups, which is the whole reactivity contract:

| Group | Inputs | Behaviour on change |
| --- | --- | --- |
| Live | `rows`, `viewMode`, `theme`, `dateAdapter` | pushed into the running engine |
| Rebuild | `rowHeight`, `dayWidth`, `barPadding`, `highlightToday`, `draggable`, `virtualize`, `overscanRows`, `overscanCols`, `startDate`, `endDate`, `enableZoom`, `enablePan` | the engine is torn down and rebuilt |
| Read once | `plugins`, `chevron` | read when the engine is built |

## Outputs

`ready` (the live `GanttEngine`), `taskClick`, `taskDblClick`, `taskHover`,
`taskHoverEnd`, `taskDragStart`, `taskDragMove`, `taskDragEnd`,
`viewModeChange`, `dateRangeChange`, `rowsChange`, `selectionChange` and
`rowToggle`.

`scene:change` is deliberately not forwarded - it fires on every scroll frame.
Subscribe to it on the engine itself when you need it. The component exposes the
engine as a signal:

```ts
readonly chart = viewChild.required(GanttChartComponent)
// this.chart().engine()?.events.on('scene:change', ({ reason }) => { ... })
```

## Examples

- [`examples/basic`](examples/basic) - `pnpm --filter @ganttkit/example-angular dev`
- [`examples/stress`](examples/stress) - large-dataset benchmark with a live
  metrics panel: `pnpm --filter @ganttkit/example-angular-stress dev`
