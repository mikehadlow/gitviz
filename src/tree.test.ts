import { test, expect, describe } from "bun:test";
import { buildTree } from "./tree";
import type { RawCommitEntry, FileSizeMap, DeletionMap, DirNode, FileNode } from "./types";

function makeCommit(
  overrides: Partial<RawCommitEntry> & { files: RawCommitEntry["files"] },
): RawCommitEntry {
  return {
    hash: overrides.hash ?? "abc123",
    date: overrides.date ?? "2024-01-15T10:00:00Z",
    author: overrides.author ?? "Alice",
    files: overrides.files,
  };
}

function emptyInput(overrides?: {
  commits?: RawCommitEntry[];
  fileSizes?: FileSizeMap;
  deletions?: DeletionMap;
  repoName?: string;
}) {
  return {
    commits: overrides?.commits ?? [],
    fileSizes: overrides?.fileSizes ?? new Map(),
    deletions: overrides?.deletions ?? new Map(),
    repoName: overrides?.repoName ?? "test-repo",
  };
}

describe("buildTree", () => {
  test("single file at root level", () => {
    const result = buildTree(
      emptyInput({
        commits: [
          makeCommit({
            files: [{ path: "readme.md", linesAdded: 10, linesRemoved: 0 }],
          }),
        ],
        fileSizes: new Map([["readme.md", 256]]),
      }),
    );

    expect(result.repoName).toBe("test-repo");
    expect(result.tree.children).toHaveLength(1);

    const file = result.tree.children[0] as FileNode;
    expect(file.name).toBe("readme.md");
    expect(file.path).toBe("readme.md");
    expect(file.type).toBe("file");
    expect(file.size).toBe(256);
    expect(file.createdAt).toBe("2024-01-15T10:00:00Z");
    expect(file.commits).toHaveLength(1);
    expect(file.deletedAt).toBeNull();
  });

  test("nested directory structure", () => {
    const result = buildTree(
      emptyInput({
        commits: [
          makeCommit({
            files: [
              { path: "src/lib/utils.ts", linesAdded: 20, linesRemoved: 0 },
              { path: "src/index.ts", linesAdded: 5, linesRemoved: 0 },
            ],
          }),
        ],
      }),
    );

    const src = result.tree.children[0] as DirNode;
    expect(src.type).toBe("directory");
    expect(src.name).toBe("src");
    expect(src.path).toBe("src");

    const lib = src.children[0] as DirNode;
    expect(lib.type).toBe("directory");
    expect(lib.name).toBe("lib");

    const utils = lib.children[0] as FileNode;
    expect(utils.name).toBe("utils.ts");
    expect(utils.path).toBe("src/lib/utils.ts");

    const index = src.children[1] as FileNode;
    expect(index.name).toBe("index.ts");
  });

  test("binary file detection", () => {
    const result = buildTree(
      emptyInput({
        commits: [
          makeCommit({
            files: [{ path: "image.png", linesAdded: -1, linesRemoved: -1 }],
          }),
        ],
      }),
    );

    const file = result.tree.children[0] as FileNode;
    expect(file.type).toBe("binfile");
  });

  test("deleted file", () => {
    const result = buildTree(
      emptyInput({
        commits: [
          makeCommit({
            files: [{ path: "old.ts", linesAdded: 10, linesRemoved: 0 }],
          }),
        ],
        deletions: new Map([["old.ts", "2024-02-01T12:00:00Z"]]),
      }),
    );

    const file = result.tree.children[0] as FileNode;
    expect(file.deletedAt).toBe("2024-02-01T12:00:00Z");
    expect(file.size).toBe(0);
  });

  test("chronological ordering — commits sorted oldest-first, createdAt is earliest", () => {
    const result = buildTree(
      emptyInput({
        commits: [
          makeCommit({
            hash: "newer",
            date: "2024-03-01T10:00:00Z",
            files: [{ path: "file.ts", linesAdded: 5, linesRemoved: 0 }],
          }),
          makeCommit({
            hash: "older",
            date: "2024-01-01T10:00:00Z",
            files: [{ path: "file.ts", linesAdded: 10, linesRemoved: 0 }],
          }),
        ],
      }),
    );

    const file = result.tree.children[0] as FileNode;
    expect(file.createdAt).toBe("2024-01-01T10:00:00Z");
    expect(file.commits[0].hash).toBe("older");
    expect(file.commits[1].hash).toBe("newer");
  });

  test("author collection — unique, sorted alphabetically", () => {
    const result = buildTree(
      emptyInput({
        commits: [
          makeCommit({
            author: "Charlie",
            files: [{ path: "a.ts", linesAdded: 1, linesRemoved: 0 }],
          }),
          makeCommit({
            author: "Alice",
            files: [{ path: "b.ts", linesAdded: 1, linesRemoved: 0 }],
          }),
          makeCommit({
            author: "Charlie",
            files: [{ path: "c.ts", linesAdded: 1, linesRemoved: 0 }],
          }),
          makeCommit({
            author: "Bob",
            files: [{ path: "d.ts", linesAdded: 1, linesRemoved: 0 }],
          }),
        ],
      }),
    );

    expect(result.authors).toEqual(["Alice", "Bob", "Charlie"]);
  });

  test("first/last commit dates", () => {
    const result = buildTree(
      emptyInput({
        commits: [
          makeCommit({
            date: "2024-06-15T10:00:00Z",
            files: [{ path: "a.ts", linesAdded: 1, linesRemoved: 0 }],
          }),
          makeCommit({
            date: "2024-01-01T10:00:00Z",
            files: [{ path: "b.ts", linesAdded: 1, linesRemoved: 0 }],
          }),
          makeCommit({
            date: "2024-12-25T10:00:00Z",
            files: [{ path: "c.ts", linesAdded: 1, linesRemoved: 0 }],
          }),
        ],
      }),
    );

    expect(result.firstCommitDate).toBe("2024-01-01T10:00:00Z");
    expect(result.lastCommitDate).toBe("2024-12-25T10:00:00Z");
  });

  test("empty repository", () => {
    const result = buildTree(emptyInput());

    expect(result.tree.children).toHaveLength(0);
    expect(result.firstCommitDate).toBe("");
    expect(result.lastCommitDate).toBe("");
    expect(result.authors).toEqual([]);
    expect(result.repoName).toBe("test-repo");
  });

  test("children sorting — directories first, then files, alphabetical", () => {
    const result = buildTree(
      emptyInput({
        commits: [
          makeCommit({
            files: [
              { path: "zebra.ts", linesAdded: 1, linesRemoved: 0 },
              { path: "alpha.ts", linesAdded: 1, linesRemoved: 0 },
              { path: "src/main.ts", linesAdded: 1, linesRemoved: 0 },
              { path: "docs/readme.md", linesAdded: 1, linesRemoved: 0 },
            ],
          }),
        ],
      }),
    );

    const names = result.tree.children.map((c) => c.name);
    // Dirs first (alphabetical), then files (alphabetical)
    expect(names).toEqual(["docs", "src", "alpha.ts", "zebra.ts"]);
  });

  test("multiple commits on same file", () => {
    const result = buildTree(
      emptyInput({
        commits: [
          makeCommit({
            hash: "aaa",
            date: "2024-01-01T10:00:00Z",
            author: "Alice",
            files: [{ path: "file.ts", linesAdded: 100, linesRemoved: 0 }],
          }),
          makeCommit({
            hash: "bbb",
            date: "2024-02-01T10:00:00Z",
            author: "Bob",
            files: [{ path: "file.ts", linesAdded: 20, linesRemoved: 5 }],
          }),
          makeCommit({
            hash: "ccc",
            date: "2024-03-01T10:00:00Z",
            author: "Alice",
            files: [{ path: "file.ts", linesAdded: 10, linesRemoved: 3 }],
          }),
        ],
        fileSizes: new Map([["file.ts", 500]]),
      }),
    );

    const file = result.tree.children[0] as FileNode;
    expect(file.commits).toHaveLength(3);
    expect(file.commits[0].author).toBe("Alice");
    expect(file.commits[1].author).toBe("Bob");
    expect(file.commits[2].author).toBe("Alice");
    expect(file.size).toBe(500);
    expect(file.createdAt).toBe("2024-01-01T10:00:00Z");
  });
});
