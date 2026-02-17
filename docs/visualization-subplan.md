# Visualization — Subplan for Phase 4

## Context

Phases 1-3 are complete. The server serves `RepoData` JSON at `/api/data` and static files from `public/` (HTML, CSS) and `dist/` (built JS). `public/app.ts` is a placeholder that fetches data and displays the repo name. This phase replaces it with a D3 force-directed graph.

## Dependency

```sh
bun add d3 @types/d3
```

## Files to Modify

| File | Change |
|---|---|
| `package.json` | Add `d3` + `@types/d3` dependencies |
| `public/app.ts` | Rewrite — D3 force-directed graph |
| `public/style.css` | Add graph container, tooltip, and legend styles |
| `public/index.html` | Add tooltip div and legend container |

## 1. HTML Updates (`public/index.html`)

- Replace `<div id="app">` content concept — it becomes the SVG container
- Add `<div id="tooltip">` for hover info (hidden by default)
- Add `<div id="legend">` for author color legend

```html
<body>
  <div id="app"></div>
  <div id="tooltip"></div>
  <div id="legend"></div>
  <script type="module" src="app.js"></script>
</body>
```

## 2. CSS Updates (`public/style.css`)

### Container
- `#app` — full viewport, no padding, `overflow: hidden`
- `svg` — `width: 100vw; height: 100vh; display: block`

### Tooltip
- `#tooltip` — `position: fixed`, hidden by default (`opacity: 0`), dark background with border, rounded corners, pointer-events none, z-index above SVG
- Content: file path (bold), size, created date, commit count, top contributors list

### Legend
- `#legend` — `position: fixed`, bottom-right corner, semi-transparent background, small font
- Color swatches with author names

### Graph elements
- `.link` — stroke `#30363d`, low opacity
- `.node` — cursor pointer
- `.node-label` — small white text, pointer-events none (only shown for large nodes)

## 3. Frontend Logic (`public/app.ts`)

### 3.1 Data Fetching & Flattening

Fetch `/api/data`, then flatten the `RepoData` tree into flat arrays for D3:

```typescript
interface GraphNode extends d3.SimulationNodeDatum {
  id: string;        // path
  name: string;
  type: "file" | "binfile" | "directory";
  size: number;      // bytes (files) or child count (dirs)
  author: string;    // dominant author (most commits)
  commitCount: number;
  createdAt: string;
  deletedAt: string | null;
  depth: number;     // tree depth for initial positioning
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string;    // child path
  target: string;    // parent dir path
}
```

**`flattenTree(tree: DirNode): { nodes: GraphNode[], links: GraphLink[] }`**

- Recursive walk of `DirNode.children`
- For each `FileNode`: compute dominant author (author with most commits), set `commitCount`
- For each `DirNode`: set `size` = number of direct children, `author` = "" (no dominant author)
- Create a link from each node to its parent directory (skip root)
- Filter out deleted files (`deletedAt !== null`) — they'll be relevant in Phase 5

### 3.2 Scales

| Scale | Domain | Range |
|---|---|---|
| `sizeScale` | `d3.scaleSqrt` | File size (bytes) → radius 3–30px |
| `colorScale` | `d3.scaleOrdinal` | Author name → `d3.schemeTableau10` |

- Directories get a fixed radius of 5px and gray fill (`#6e7681`)
- `sizeScale` domain: `[0, maxFileSize]` from the node data

### 3.3 Force Simulation

```typescript
d3.forceSimulation<GraphNode>(nodes)
  .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(30))
  .force("charge", d3.forceManyBody().strength(-50))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collide", d3.forceCollide<GraphNode>(d => sizeScale(d.size) + 2))
```

- `forceLink` — connects parent-child with short distance
- `forceManyBody` — repulsion keeps nodes apart
- `forceCenter` — keeps graph centered in viewport
- `forceCollide` — prevents node overlap using radius + padding

### 3.4 SVG Rendering

```
svg
  └─ g.container (zoom/pan target)
      ├─ g.links
      │   └─ line.link (one per link)
      └─ g.nodes
          └─ circle.node (one per node)
```

- SVG fills the `#app` div, `viewBox` set to viewport dimensions
- All visual elements inside a `<g>` container that receives zoom transforms
- Links rendered as `<line>` elements
- Nodes rendered as `<circle>` elements with `r` from sizeScale and `fill` from colorScale

### 3.5 Zoom & Pan

```typescript
const zoom = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.1, 10])
  .on("zoom", (event) => container.attr("transform", event.transform));
svg.call(zoom);
```

### 3.6 Drag

```typescript
d3.drag<SVGCircleElement, GraphNode>()
  .on("start", (event, d) => {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  })
  .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
  .on("end", (event, d) => {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
  });
```

### 3.7 Tooltip

On `mouseover` of a node:
- Position `#tooltip` near cursor (`event.clientX + 12`, `event.clientY - 12`)
- Show: file path, formatted size, created date, commit count, top 3 contributors
- On `mouseout`: hide tooltip

### 3.8 Legend

After computing `colorScale`, populate `#legend` with a swatch + label for each author. Limit to top 10 authors (by total commits across all files) to avoid overflow.

## 4. Helper Functions

| Function | Purpose |
|---|---|
| `flattenTree` | Recursive tree → flat nodes + links arrays |
| `getDominantAuthor` | Count commits per author for a file, return most frequent |
| `formatBytes` | Human-readable file size (B, KB, MB) |
| `buildLegend` | Populate `#legend` div with color swatches |

## 5. Edge Cases

- **Empty repo**: no nodes → show "No files to visualize" message
- **Single file**: one node, no links — simulation still works
- **Very large repos** (1000+ files): `forceCollide` + `forceManyBody` handle density; zoom lets user explore
- **Binary files**: same as regular files but can be styled differently (dashed stroke) if desired
- **Long file paths**: tooltip wraps text, node label truncated or hidden for small nodes
- **No commits on a file**: shouldn't happen given tree building logic, but handle gracefully (commitCount=0)

## 6. Implementation Order

1. `bun add d3 @types/d3`
2. Update `public/index.html` — add tooltip + legend divs
3. Update `public/style.css` — full viewport SVG, tooltip, legend, graph element styles
4. Rewrite `public/app.ts`:
   a. Data fetching + `flattenTree` helper
   b. Scales (size, color)
   c. SVG + force simulation setup
   d. Node + link rendering in tick handler
   e. Zoom + pan
   f. Drag behavior
   g. Tooltip on hover
   h. Legend
5. `bun run build` — verify no TypeScript errors
6. `bun run dev .` — test against this repo in browser

## 7. Verification

- `bun run build` compiles without errors
- `bun run dev .` starts server, open `http://localhost:3000`
- Force-directed graph renders with nodes and links
- Node sizes vary based on file size
- Node colors correspond to dominant author
- Zoom and pan work smoothly
- Dragging a node repositions it, simulation adjusts
- Hovering shows tooltip with file details
- Legend displays author colors in bottom-right
- Test against a second, larger repo to verify scaling
