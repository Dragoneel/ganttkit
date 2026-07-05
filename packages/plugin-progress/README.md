# @ganttkit/plugin-progress

Draws task completion inside the bars. A scene-hook plugin  pure engine-side,
so it works with every renderer (svg, html, canvas, vue, nuxt).

```ts
import { progressPlugin } from '@ganttkit/plugin-progress'

engine.use(progressPlugin())
// give tasks a progress value in [0, 1]:
// { id: 't1', name: 'API', start: '2026-07-01', end: '2026-07-10', progress: 0.6 }
```

For each task with a `progress` value it overlays a fill rect (class
`gantt-progress`) spanning that fraction of the bar, above the bar and below the
label. Milestones and tasks without `progress` are skipped.

## Options

- `className`  extra class added to each progress rect (for custom styling).

## Styling

The default theme styles `.gantt-progress` via the `--gk-progress` CSS variable.

## License

MIT
