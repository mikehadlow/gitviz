# Git Repo Parser — Subplan for Phase 1

## Context

First implementation phase of gitvis: extract raw git data from a repository by shelling out to `git` via `Bun.$`, parsing the output into structured TypeScript data. This feeds into Phase 2 (tree building) which assembles the parsed data into a nested directory tree.

## Files to Create

| File | Purpose |
|---|---|
| `src/types.ts` | Shared TypeScript interfaces |
| `src/git.ts` | Git command runners + output parsers |
| `src/git.test.ts` | Unit tests for all parsers |

## 1. Types (`src/types.ts`)

```typescript
// Used by git.ts (raw extraction output)
export interface RawCommitEntry {
  hash: string;
  date: string;           // ISO 8601
  author: string;
  files: Array<{
    path: string;
    linesAdded: number;   // -1 = binary
    linesRemoved: number; // -1 = binary
  }>;
}
export type FileSizeMap = Map<string, number>;   // path → bytes
export type DeletionMap = Map<string, string>;   // path → ISO date

// Used by tree.ts and server.ts (later phases)
export interface FileCommit {
  hash: string;
  date: string;
  author: string;
  linesAdded: number;
  linesRemoved: number;
}
export interface FileNode {
  name: string;
  path: string;
  type: "file" | "binfile";
  createdAt: string;
  deletedAt: string | null;
  size: number;
  commits: FileCommit[];
}
export interface DirNode {
  name: string;
  path: string;
  type: "directory";
  children: Array<FileNode | DirNode>;
}
export interface RepoData {
  repoName: string;
  firstCommitDate: string;
  lastCommitDate: string;
  tree: DirNode;
  authors: string[];
}
```

## 2. Git Parser (`src/git.ts`)

### Exported functions

| Function | Signature | Description |
|---|---|---|
| `parseCommitLog` | `(output: string) => RawCommitEntry[]` | Parse `git log --numstat` output |
| `parseFileSizes` | `(output: string) => FileSizeMap` | Parse `git ls-tree` output |
| `parseDeletions` | `(output: string) => DeletionMap` | Parse deletion log output |
| `expandRename` | `(path: string) => string` | Normalize rename paths to destination |
| `extractGitData` | `(repoPath: string) => Promise<{...}>` | Orchestrator — runs all 4 git commands in parallel |

### Git commands (run in parallel via `Promise.all`)

1. **Commit log**: `git -C <path> log --all --format="COMMIT%x00%H%x00%aI%x00%an" --numstat`
2. **File sizes**: `git -C <path> ls-tree -r --long HEAD`
3. **Deletions**: `git -C <path> log --all --diff-filter=D --format="DELETE%x00%aI" --name-only`
4. **Repo name**: `git -C <path> rev-parse --show-toplevel` → `basename()`

### Parsing logic

**`parseCommitLog`** — Output has `COMMIT\0hash\0date\0author` header lines followed by blank line then `added\tremoved\tpath` numstat lines. Split by lines, accumulate entries per commit. Binary files have `-\t-\tpath`. Merge commits may have no numstat lines.

**`expandRename`** — Two formats:
- Curly brace: `src/{old => new}/file.ts` → replace `{old => new}` with `new` via regex `\{(.+?) => (.+?)\}`
- Full: `old.txt => new.txt` → take right side of ` => `
- Handle empty sides in curly braces (`{ => new}`, `{old => }`)

**`parseFileSizes`** — Lines are `mode type hash    size\tpath`. Split on `\t` to get path, split metadata on whitespace to get size. Skip entries where type is `commit` (submodules).

**`parseDeletions`** — `DELETE\0date` headers followed by file paths. Track most recent deletion per path (git log is newest-first, so first occurrence wins).

### Error handling

- `git ls-tree HEAD` fails on empty repos / detached HEAD → catch, return empty Map
- Non-git directory → let error propagate with descriptive message
- Unexpected lines in parser output → skip with `console.warn`, don't crash

## 3. Tests (`src/git.test.ts`)

All tests use mock output strings — no real git calls.

**`parseCommitLog` tests:**
- Single commit with two files
- Multiple commits
- Binary file (`-\t-\tpath`) → linesAdded/Removed = -1
- Merge commit with no files → `files: []`
- Empty input → `[]`

**`expandRename` tests:**
- No rename → passthrough
- Full rename `a.txt => b.txt` → `b.txt`
- Curly brace `{old => new}/file.ts` → `new/file.ts`
- Nested curly `src/{old => new}/file.ts` → `src/new/file.ts`
- Empty old `{ => new}/file.ts` → `new/file.ts`
- Empty new `{old => }/file.ts` → `file.ts`

**`parseFileSizes` tests:**
- Two files with different sizes
- Empty input → empty Map

**`parseDeletions` tests:**
- One deletion commit with two files
- Multiple commits — first (most recent) date wins per path
- Empty input → empty Map

## 4. Implementation Order

1. Create `src/types.ts`
2. Create `src/git.ts` — pure parser functions first (`expandRename`, `parseCommitLog`, `parseFileSizes`, `parseDeletions`)
3. Create `src/git.test.ts` — run tests, iterate until green
4. Add async `get*` functions and `extractGitData` orchestrator to `src/git.ts`
5. Smoke-test by temporarily wiring `extractGitData` in `index.ts` against this repo

## 5. Verification

- `bun test src/git.test.ts` — all parser unit tests pass
- Temporary `index.ts`: call `extractGitData(".")`, log output, verify commits/sizes/deletions look correct against this repo's actual git history
