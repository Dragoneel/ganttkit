# @ganttkit/angular

Angular bindings for [GanttKit](https://www.npmjs.com/package/@ganttkit/core).

This is a binding, not a fourth renderer. The chart is painted by one of the
three base renderers - [`@ganttkit/html`](https://www.npmjs.com/package/@ganttkit/html)
by default - and this package only owns that renderer's lifetime and wires it to
Angular's signals. Every feature plugin (columns, tree, dependencies, markers,
tooltip, selection, i18n, ...) works unchanged, because none of them know a
framework is involved.

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

## Choosing a renderer

The chart is painted by `@ganttkit/html` unless you say otherwise. Bind
`renderer` to paint with SVG or canvas instead, and import that package's
stylesheet rather than `@ganttkit/angular/styles.css`:

```ts
import { canvasRenderer } from '@ganttkit/canvas'

@Component({
  imports: [GanttChartComponent],
  template: `<gantt-chart [renderer]="renderer" [rows]="rows()" style="height: 70vh" />`,
})
export class AppComponent {
  readonly renderer = canvasRenderer
}
```

| Renderer | Package | Stylesheet | Paints each primitive as |
| --- | --- | --- | --- |
| `htmlRenderer` (default) | `@ganttkit/html` | `@ganttkit/angular/styles.css` | a positioned `<div>` |
| `svgRenderer` | `@ganttkit/svg` | `@ganttkit/svg/styles.css` | an SVG element |
| `canvasRenderer` | `@ganttkit/canvas` | `@ganttkit/canvas/styles.css` | a draw call on one 2D canvas |

`@ganttkit/svg` and `@ganttkit/canvas` are optional peers - install the one you
use. `@ganttkit/angular/styles.css` re-exports the HTML sheet only, because it
is the only renderer this package depends on; for the other two, import the
stylesheet from the same package you import the renderer from.

Anything matching `RendererFactory` works, so a custom renderer drops in the
same way:

```ts
import type { GanttPlugin, RendererOptions } from '@ganttkit/core'

const myRenderer = (options: RendererOptions): GanttPlugin => ({ ... })
```

Bind it to a stable field, not a template expression that produces a new
function each change detection: `renderer` is a rebuild input, so a new
identity tears the engine down and builds a fresh one.

## Inputs

Every [`GanttOptions`](https://www.npmjs.com/package/@ganttkit/core) field, plus
`renderer`, `theme`, `enableZoom`, `enablePan`, `chevron` and `plugins`.

They fall into three groups, which is the whole reactivity contract:

| Group | Inputs | Behaviour on change |
| --- | --- | --- |
| Live | `rows`, `viewMode`, `theme`, `dateAdapter` | pushed into the running engine |
| Rebuild | `renderer`, `rowHeight`, `dayWidth`, `barPadding`, `highlightToday`, `draggable`, `virtualize`, `overscanRows`, `overscanCols`, `startDate`, `endDate`, `enableZoom`, `enablePan` | the engine is torn down and rebuilt |
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
