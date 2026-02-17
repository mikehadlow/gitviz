# GitVis — Visualize your Git repository

An interactive visualization of your Git repository. Explore the structure,
see where the hotspots are, and who has contributed to which parts of the
codebase.

![GitVis visualization](docs/screenshot.png)

## Getting Started

Install dependencies:

```bash
bun install
```

Run against any Git repository:

```bash
bun run start <path-to-git-repo>
```

Then open http://localhost:3000 in your browser.

## Development

Build the frontend bundle:

```bash
bun run build
```

Run with hot reload:

```bash
bun run dev <path-to-git-repo>
```

Run tests:

```bash
bun test
```
