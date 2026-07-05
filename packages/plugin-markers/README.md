# @ganttkit/plugin-markers

Vertical date markers and shaded bands: a "today"/"now" line, deadlines, sprint
or release boundaries. A scene-hook plugin  works with every renderer.

```ts
import { createMarkers, todayMarker } from '@ganttkit/plugin-markers'

const markers = createMarkers([
  todayMarker({ label: 'Today' }),
  { id: 'ga', date: '2026-08-15', label: 'GA', className: 'is-deadline' },
  { id: 'sprint1', date: '2026-07-01', end: '2026-07-14', label: 'Sprint 1' }, // band
])
engine.use(markers.plugin)

markers.addMarker({ id: 'freeze', date: '2026-08-01', label: 'Code freeze' })
markers.removeMarker('freeze')
markers.clearMarkers()
```

A marker with a `date` only renders a line; with `date` + `end` it renders a
shaded band (inclusive). Optional `label` is drawn at the top.

## API

- `createMarkers(initial?) → { plugin, setMarkers, addMarker, removeMarker, clearMarkers }`
- `todayMarker(opts?)`  convenience marker for the current day
- `GanttMarker`: `{ id?, date, end?, label?, className? }`

## Styling

Themed via `.gantt-marker`, `.gantt-marker--today`, `.gantt-marker-band`,
`.gantt-marker-label` (CSS vars `--gk-marker`, `--gk-marker-band`).

## License

MIT
