# @ganttkit/plugin-tree

Hierarchical rows with expand/collapse. A rows-hook plugin: it relates rows by
`parentId`, hides descendants of collapsed rows, and annotates each row with
`level`, `hasChildren`, and `expanded`  the core fields the renderers' sidebar
reads to draw a chevron.

```ts
import { createTree } from '@ganttkit/plugin-tree'

const tree = createTree({ collapsed: ['build'] })
engine.use(tree.plugin)

// rows relate via parentId:
// [{ id: 'build', name: 'Build' },
//  { id: 'api', name: 'API', parentId: 'build', tasks: [...] }]

tree.collapse('build')
tree.expandAll()
```

Toggling works two ways, both **decoupled from the renderer**:

- The sidebar chevron emits the generic `row:toggle` engine event, which this
  plugin listens for. The renderer knows nothing about trees.
- Commands: `tree.toggle`, `tree.expand`, `tree.collapse`, `tree.expandAll`,
  `tree.collapseAll` (callable via `engine.commands.execute(...)`).

## API

- `createTree(options?) → GanttTree`
  - `options.collapsed`  row ids collapsed initially
- `GanttTree`: `{ plugin, toggle, expand, collapse, expandAll, collapseAll, isCollapsed }`

## License

MIT
