# GitVis Implementation Plan

## Context

Build a Git repository visualization tool that takes a repo path as a CLI argument, analyses the full commit history, and serves an interactive force-directed graph in the browser. The goal is to let someone quickly understand a repo's structure, size, contributor distribution, and evolution over time.

## Architecture

```
CLI arg (repo path)
  → git commands (extract commits, file sizes, deletions)
  → build tree data structure
  → Bun.serve() serves HTML + JSON API
  → D3.js force-directed graph with timeline slider
```

## File Structure

```
index.ts                 -- Entry point: CLI arg, orchestrate analysis, start server
src/
  types.ts               -- Shared TypeScript interfaces
  git.ts                 -- Git data extraction (shell out to git, parse output)
  tree.ts                -- Build tree from raw git data
  server.ts              -- Bun.serve() with routes
public/
  index.html             -- Single page app shell
  app.ts                 -- D3 visualization + timeline (bundled by Bun automatically)
  style.css              -- UI styles
```

## Phase 1: Data Extraction (`src/types.ts`, `src/git.ts`)

**Types:**
- `FileCommit` — hash, date (ISO), author, linesAdded, linesRemoved
- `FileNode` — name, path, type:"file"|"binfile", createdAt, deletedAt, size, commits[]
- `DirNode` — name, path, type:"directory", children[]
- `RepoData` — repoName, firstCommitDate, lastCommitDate, tree (root DirNode), authors[]

**Git commands** (using `Bun.$`):
1. `git log --all --format="COMMIT%x00%H%x00%aI%x00%an" --numstat` — full history with per-file line stats
2. `git ls-tree -r --long HEAD` — current file sizes in bytes
3. `git log --all --diff-filter=D --format="DELETE%x00%aI" --name-only` — deletion dates
4. `git rev-parse --show-toplevel` — repo name

**Parsing notes:**
- Binary files show `-\t-` in numstat → set type as "binfile"
- Renames show `{old => new}` syntax → regex `/\{(.+?) => (.+?)\}/` to expand
- Run all 4 commands in parallel with `Promise.all`

## Phase 2: Tree Building (`src/tree.ts`)

- Build flat `Map<string, FileNode>` from all file paths across all commits
- Walk commits chronologically, appending `FileCommit` entries to each file
- Set `createdAt` = first commit date, `deletedAt` from deletion data
- Set `size` from ls-tree output (0 if deleted)
- Assemble into nested `DirNode` tree by splitting paths on `/`
- Collect unique authors list

## Phase 3: Server (`src/server.ts`, `index.ts`)

- `index.ts`: parse CLI arg, run extraction, build tree, start server
- `Bun.serve()` with routes:
  - `/` → HTML import of `public/index.html` (Bun auto-bundles app.ts + style.css)
  - `/api/data` → `Response.json(repoData)`

## Phase 4: Visualization (`public/app.ts`, `public/index.html`, `public/style.css`)

**Dependency:** `bun add d3 @types/d3`

**D3 force-directed graph:**
- Flatten tree into `nodes[]` and `links[]` (each node linked to parent dir)
- `d3.forceSimulation` with: forceLink, forceManyBody (repulsion), forceCenter, forceCollide
- Node radius: `d3.scaleSqrt` mapping file size → radius (3–30px range). Dirs get fixed small radius.
- Node color: `d3.scaleOrdinal` mapping dominant author → color from `d3.schemeTableau10`. Dirs are gray.
- SVG with `d3.zoom()` for pan/zoom
- `d3.drag()` on nodes
- Hover tooltip showing: file path, size, created date, commit count, top contributors

## Phase 5: Timeline Slider

- Slider min/max mapped to sorted unique commit dates
- On input: filter visible nodes (created before cutoff, not yet deleted)
- Recompute size-at-time as cumulative (linesAdded - linesRemoved) up to cutoff date
- Recompute dominant author up to cutoff
- D3 enter/exit/update pattern with transitions
- Restart simulation with filtered data

## Implementation Order

1. `src/types.ts` — interfaces
2. `src/git.ts` — extraction + parsing (test by logging output)
3. `src/tree.ts` — tree builder (write unit tests for this first `src/tree.tests.ts`)
4. `src/server.ts` + `index.ts` — wire up CLI → analysis → serve JSON
5. `public/index.html` + `public/style.css` — page shell
6. `public/app.ts` — D3 graph (static HEAD view first, no timeline)
7. Timeline slider integration
8. Polish: tooltips, legend, edge cases

## Verification

1. `bun run index.ts /path/to/any/git/repo` — should print analysis summary and start server
2. Open `http://localhost:3000` — should show force-directed graph
3. Hover nodes — tooltip with file details
4. Zoom/pan — smooth interaction
5. Drag timeline slider — nodes appear/disappear, sizes change
6. Test against this repo itself and a larger repo (e.g. a well-known OSS project)
