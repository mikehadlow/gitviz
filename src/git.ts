import type { RawCommitEntry, FileSizeMap, DeletionMap } from "./types";
import path from "node:path";

/**
 * Normalize rename paths to their destination.
 * Handles: "a.txt => b.txt", "src/{old => new}/file.ts", "{ => new}/file.ts"
 */
export function expandRename(filePath: string): string {
  // Curly brace format: src/{old => new}/file.ts
  const curly = filePath.replace(/\{(.*?) => (.*?)\}/g, (_match, _old, newPart) => newPart);
  if (curly !== filePath) {
    // Clean up double slashes from empty sides
    return curly.replace(/\/\//g, "/").replace(/^\//, "");
  }
  // Full rename format: old.txt => new.txt
  if (filePath.includes(" => ")) {
    return filePath.split(" => ")[1];
  }
  return filePath;
}

/**
 * Parse `git log --all --format="COMMIT%x00%H%x00%aI%x00%an" --numstat` output.
 */
export function parseCommitLog(output: string): RawCommitEntry[] {
  if (!output.trim()) return [];

  const lines = output.split("\n");
  const entries: RawCommitEntry[] = [];
  let current: RawCommitEntry | null = null;
  let unexpectedLines = 0;

  for (const line of lines) {
    if (line.startsWith("COMMIT\0")) {
      if (current) entries.push(current);
      const parts = line.split("\0");
      current = {
        hash: parts[1],
        date: parts[2],
        author: parts[3],
        files: [],
      };
      continue;
    }

    if (!current) continue;
    if (line === "") continue;

    // numstat line: added\tremoved\tpath
    const parts = line.split("\t");
    if (parts.length >= 3) {
      const rawPath = parts.slice(2).join("\t"); // handle paths with tabs (rare)
      const filePath = rawPath.includes("=>") ? expandRename(rawPath) : rawPath;
      const isBinary = parts[0] === "-";
      current.files.push({
        path: filePath,
        linesAdded: isBinary ? -1 : parseInt(parts[0], 10),
        linesRemoved: isBinary ? -1 : parseInt(parts[1], 10),
      });
    } else {
      unexpectedLines++;
    }
  }
  if (current) entries.push(current);

  if (unexpectedLines > 0) {
    console.warn(`[parseCommitLog] Skipped ${unexpectedLines} unexpected line(s)`);
  }

  return entries;
}

/**
 * Parse `git ls-tree -r --long HEAD` output.
 * Lines: "mode type hash    size\tpath"
 */
export function parseFileSizes(output: string): FileSizeMap {
  const map: FileSizeMap = new Map();
  if (!output.trim()) return map;

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const tabIdx = line.indexOf("\t");
    if (tabIdx === -1) continue;

    const meta = line.slice(0, tabIdx).trim();
    const filePath = line.slice(tabIdx + 1);
    const parts = meta.split(/\s+/);
    // parts: [mode, type, hash, size]
    if (parts[1] === "commit") continue; // skip submodules
    const size = parseInt(parts[3], 10);
    if (!isNaN(size)) {
      map.set(filePath, size);
    }
  }

  return map;
}

/**
 * Parse deletion log output.
 * Format: "DELETE\0date" headers followed by file paths.
 * git log is newest-first, so first occurrence per path wins.
 */
export function parseDeletions(output: string): DeletionMap {
  const map: DeletionMap = new Map();
  if (!output.trim()) return map;

  const lines = output.split("\n");
  let currentDate: string | null = null;

  for (const line of lines) {
    if (line.startsWith("DELETE\0")) {
      currentDate = line.split("\0")[1];
      continue;
    }
    if (!currentDate) continue;
    if (line === "") continue;

    // First occurrence wins (most recent deletion)
    if (!map.has(line)) {
      map.set(line, currentDate);
    }
  }

  return map;
}

/**
 * Run all git commands in parallel and return parsed data.
 */
export async function extractGitData(repoPath: string, maxCommits: number = 10000) {
  // Validate that the path is a git repository
  try {
    await Bun.$`git -C ${repoPath} rev-parse --git-dir`.quiet();
  } catch {
    throw new Error(`"${repoPath}" is not a git repository`);
  }

  const [commitLogResult, fileSizesResult, deletionsResult, repoNameResult] =
    await Promise.all([
      Bun.$`git -C ${repoPath} log --all -n ${maxCommits} --format=COMMIT%x00%H%x00%aI%x00%an --numstat`
        .text()
        .catch(() => ""), // empty repo with no commits
      Bun.$`git -C ${repoPath} ls-tree -r --long HEAD`
        .text()
        .catch(() => ""), // empty repo / detached HEAD
      Bun.$`git -C ${repoPath} log --all -n ${maxCommits} --diff-filter=D --format=DELETE%x00%aI --name-only`
        .text()
        .catch(() => ""), // no deletions or empty repo
      Bun.$`git -C ${repoPath} rev-parse --show-toplevel`
        .text(),
    ]);

  const commits = parseCommitLog(commitLogResult);
  const fileSizes = parseFileSizes(fileSizesResult);
  const deletions = parseDeletions(deletionsResult);
  const repoName = path.basename(repoNameResult.trim());

  return { commits, fileSizes, deletions, repoName };
}
