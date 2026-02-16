# Phase 3: Server — Subplan

## Context

Phases 1-2 are complete. `src/git.ts` exports `extractGitData()` and `src/tree.ts` exports `buildTree()`. `index.ts` is a placeholder. No `public/` directory or `src/server.ts` exist yet. This phase wires everything together into a running HTTP server.

## Files to Create/Modify

### 1. `public/index.html` — HTML shell
- Minimal HTML with `<script type="module" src="app.ts">` and `<link rel="stylesheet" href="style.css">`
- Bun's HTML imports auto-bundle the referenced TS/CSS

### 2. `public/app.ts` — Placeholder frontend
- Fetch `/api/data`, log it, display repo name + author count in `#app` div
- Phase 4 replaces this with D3 visualization

### 3. `public/style.css` — Minimal styles
- CSS reset, dark background (`#0d1117`), system font

### 4. `src/server.ts` — Server module
- `Bun.serve()` with `static` for HTML, `fetch` handler for `/api/data` and 404
- Returns server object

### 5. `src/server.test.ts` — Server tests
- Mock `RepoData`, start server on port 0
- Test: GET /api/data, GET /, GET /unknown → 404

### 6. `index.ts` — CLI entry point
- Parse repo path from argv, validate, extract → build → serve
- Print summary: repo name, file count, author count, date range, server URL
