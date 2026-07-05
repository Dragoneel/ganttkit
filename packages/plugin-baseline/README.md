# @ganttkit/plugin-baseline

Planned-vs-actual comparison. Snapshot a **baseline** (the plan); the plugin
draws a ghost bar behind each task at its planned position, so any slip is
visible where the actual bar has moved off the ghost. Scene-hook plugin  works
with every renderer.

```ts
import { createBaseline } from '@ganttkit/plugin-baseline'

const baseline = createBaseline()
engine.use(baseline.plugin)

baseline.capture()  // snapshot the current dates as the plan
// …tasks get rescheduled / dragged; ghosts now show the variance…
baseline.setBaseline({ t1: { start: '2026-07-01', end: '2026-07-10' } }) // or set explicitly
baseline.clear()
```

## API

- `createBaseline(initial?) → { plugin, setBaseline, capture, clear, get }`
- `BaselineEntry`: `{ start, end }`; `BaselineMap`: `Record<taskId, BaselineEntry>`

Milestones are skipped. Styled via `.gantt-baseline` (CSS var `--gk-baseline`).

## License

MIT
