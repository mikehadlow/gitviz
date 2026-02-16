# Tree Builder — Subplan for Phase 2

## Context

Phase 1 (data extraction) is complete. `extractGitData()` returns raw commits, file sizes, deletions, and repo name. Phase 2 transforms this raw data into a nested tree structure (`RepoData`) that the server and visualization will consume.

## Files to Create

| File | Purpose |
|---|---|
| `src/tree.ts` | Tree builder — flat file map → nested DirNode tree |
| `src/tree.test.ts` | Unit tests for tree building |

## 1. Exported API

```typescript
export function buildTree(data: {
  commits: RawCommitEntry[];
  fileSizes: FileSizeMap;
  deletions: DeletionMap;
  repoName: string;
}): RepoData
```

Single function. Takes `extractGitData()` output directly, returns `RepoData`.

## 2. Algorithm

1. **Sort commits chronologically** — git log returns newest-first; sort by date ascending
2. **Build flat file map** — `Map<string, FileNode>` from all unique file paths across all commits, initialized with empty commits arrays
3. **Populate commits** — walk sorted commits, append `FileCommit` to each file's commits array. If any commit has `linesAdded === -1`, mark file as `"binfile"`. Set `createdAt` = date of first commit for that file.
4. **Apply metadata** — set `size` from `fileSizes` map (default 0), set `deletedAt` from `deletions` map (default null)
5. **Assemble tree** — split each file path on `/`, create `DirNode` hierarchy using a `Map<string, DirNode>` cache for O(1) directory lookups. Insert files into their parent directory.
6. **Sort children** — recursively sort: directories first (alphabetical), then files (alphabetical)
7. **Collect authors** — unique author names from all commits, sorted alphabetically
8. **Compute date range** — min/max dates from sorted commits array (first/last elements)
9. **Return `RepoData`**

## 3. Internal Helpers

| Function | Purpose |
|---|---|
| `sortCommitsChronologically` | Sort `RawCommitEntry[]` by date ascending |
| `buildFlatFileMap` | Create `FileNode` stubs for every unique path |
| `populateFileCommits` | Append `FileCommit` entries, set `createdAt` and `type` |
| `applyMetadata` | Set `size` and `deletedAt` from Phase 1 maps |
| `assembleTree` | Build nested `DirNode` structure with directory cache |
| `sortTreeChildren` | Recursive sort: dirs first, then alphabetical |
| `collectAuthors` | Deduplicated, sorted author list |

### `assembleTree` detail

```
create root DirNode (name="", path="")
create dirCache Map<string, DirNode> with "" → root

for each FileNode in fileMap:
  split path on "/"
  walk segments (excluding last = filename):
    build cumulative path
    if not in dirCache: create DirNode, add to parent, cache it
    advance to child dir
  add FileNode to current dir's children
```

## 4. Edge Cases

- **Empty repo**: no commits → empty tree, empty authors, `""` for dates
- **Deleted files**: in commits but not in `fileSizes` → size=0, `deletedAt` from deletion map
- **Binary files**: `linesAdded === -1` on any commit → `type: "binfile"`
- **Root-level files**: path has no `/` → goes directly into root DirNode children
- **Deep nesting**: handled naturally by iterative path splitting + dir cache

## 5. Tests (`src/tree.test.ts`)

All tests use mock data — no real git calls. Follow `git.test.ts` pattern with `describe`/`test` blocks.

**`buildTree` tests:**
1. Single file at root level — correct name, path, type, size, createdAt, commits
2. Nested directory structure — creates correct dir hierarchy
3. Binary file detection — type set to `"binfile"`
4. Deleted file — has `deletedAt`, size 0
5. Chronological ordering — commits sorted oldest-first, `createdAt` is earliest date
6. Author collection — unique, sorted alphabetically
7. First/last commit dates — correct min/max across all commits
8. Empty repository — empty tree, blank dates, no authors
9. Children sorting — directories first, then files, alphabetical within each group
10. Multiple commits on same file — all tracked with correct authors/stats

## 6. Implementation Order

1. Create `src/tree.ts` — all helper functions + `buildTree`
2. Create `src/tree.test.ts` — run tests, iterate until green
3. Smoke-test by wiring `buildTree(await extractGitData("."))` in `index.ts` against this repo

## 7. Verification

- `bun test src/tree.test.ts` — all unit tests pass
- `bun test` — no regressions in existing `git.test.ts`
- Temporary `index.ts`: call `buildTree(await extractGitData("."))`, log output, verify tree structure looks correct
