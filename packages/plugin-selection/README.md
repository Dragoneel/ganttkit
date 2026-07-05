# @ganttkit/plugin-selection

Task selection with a scene-drawn highlight, rubber-band, and a right-click
context menu. Combines an engine-side scene hook (renderer-agnostic highlight)
with a UI overlay for the rubber-band and menu.

```ts
import { createSelection } from '@ganttkit/plugin-selection'

const selection = createSelection({
  menu: [
    { label: 'Delete', action: ids => console.log('delete', ids) },
  ],
})
engine.use(selection.plugin)

selection.getSelected() // → string[]
selection.select(['a', 'b'])
selection.clear()
```

- **Click** a task to select; **ctrl/⌘/shift-click** to toggle (multi-select).
- **Shift-drag** on empty space for a rubber-band; **plain empty click** clears.
- **Right-click** for the context menu (when `menu` is provided).

Selected tasks get a `gantt-selected` outline drawn in the scene, so the
highlight works in every renderer. Shift-drag is reserved by the renderers
(panning ignores it), so rubber-band and pan don't conflict.

## Options

- `multi`  allow multi-select. Default `true`.
- `rubberBand`  enable shift-drag selection. Default `true`.
- `menu`  `{ label, action(selectedIds) }[]` for the context menu.

## API

`createSelection(options?) → { plugin, getSelected, select, toggle, clear }`

## License

MIT
