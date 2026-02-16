import { test, expect, describe } from "bun:test";
import {
  expandRename,
  parseCommitLog,
  parseFileSizes,
  parseDeletions,
} from "./git";

describe("expandRename", () => {
  test("no rename — passthrough", () => {
    expect(expandRename("src/file.ts")).toBe("src/file.ts");
  });

  test("full rename a.txt => b.txt", () => {
    expect(expandRename("a.txt => b.txt")).toBe("b.txt");
  });

  test("curly brace rename", () => {
    expect(expandRename("src/{old => new}/file.ts")).toBe("src/new/file.ts");
  });

  test("nested curly brace", () => {
    expect(expandRename("a/b/{old => new}/c.ts")).toBe("a/b/new/c.ts");
  });

  test("empty old side { => new}/file.ts", () => {
    expect(expandRename("{ => new}/file.ts")).toBe("new/file.ts");
  });

  test("empty new side {old => }/file.ts", () => {
    expect(expandRename("{old => }/file.ts")).toBe("file.ts");
  });
});

describe("parseCommitLog", () => {
  test("single commit with two files", () => {
    const output = [
      "COMMIT\0abc123\0" + "2024-01-15T10:00:00Z\0Alice",
      "",
      "10\t2\tsrc/a.ts",
      "5\t0\tsrc/b.ts",
    ].join("\n");

    const result = parseCommitLog(output);
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe("abc123");
    expect(result[0].date).toBe("2024-01-15T10:00:00Z");
    expect(result[0].author).toBe("Alice");
    expect(result[0].files).toEqual([
      { path: "src/a.ts", linesAdded: 10, linesRemoved: 2 },
      { path: "src/b.ts", linesAdded: 5, linesRemoved: 0 },
    ]);
  });

  test("multiple commits", () => {
    const output = [
      "COMMIT\0aaa\0" + "2024-01-15T10:00:00Z\0Alice",
      "",
      "10\t2\tfile.ts",
      "COMMIT\0bbb\0" + "2024-01-14T09:00:00Z\0Bob",
      "",
      "3\t1\tother.ts",
    ].join("\n");

    const result = parseCommitLog(output);
    expect(result).toHaveLength(2);
    expect(result[0].hash).toBe("aaa");
    expect(result[1].hash).toBe("bbb");
  });

  test("binary file", () => {
    const output = [
      "COMMIT\0abc\0" + "2024-01-15T10:00:00Z\0Alice",
      "",
      "-\t-\timage.png",
    ].join("\n");

    const result = parseCommitLog(output);
    expect(result[0].files[0]).toEqual({
      path: "image.png",
      linesAdded: -1,
      linesRemoved: -1,
    });
  });

  test("merge commit with no files", () => {
    const output = [
      "COMMIT\0merge1\0" + "2024-01-15T10:00:00Z\0Alice",
      "",
      "COMMIT\0abc\0" + "2024-01-14T09:00:00Z\0Bob",
      "",
      "1\t0\tfile.ts",
    ].join("\n");

    const result = parseCommitLog(output);
    expect(result).toHaveLength(2);
    expect(result[0].files).toEqual([]);
    expect(result[1].files).toHaveLength(1);
  });

  test("empty input", () => {
    expect(parseCommitLog("")).toEqual([]);
    expect(parseCommitLog("  ")).toEqual([]);
  });

  test("rename in numstat is expanded", () => {
    const output = [
      "COMMIT\0abc\0" + "2024-01-15T10:00:00Z\0Alice",
      "",
      "5\t3\tsrc/{old => new}/file.ts",
    ].join("\n");

    const result = parseCommitLog(output);
    expect(result[0].files[0].path).toBe("src/new/file.ts");
  });
});

describe("parseFileSizes", () => {
  test("two files with different sizes", () => {
    const output = [
      "100644 blob abc1234     1234\tsrc/a.ts",
      "100644 blob def5678     5678\tsrc/b.ts",
    ].join("\n");

    const result = parseFileSizes(output);
    expect(result.size).toBe(2);
    expect(result.get("src/a.ts")).toBe(1234);
    expect(result.get("src/b.ts")).toBe(5678);
  });

  test("empty input", () => {
    expect(parseFileSizes("").size).toBe(0);
  });

  test("skips submodules (type=commit)", () => {
    const output = [
      "160000 commit abc1234       0\tvendor/sub",
      "100644 blob def5678     100\tsrc/a.ts",
    ].join("\n");

    const result = parseFileSizes(output);
    expect(result.size).toBe(1);
    expect(result.has("vendor/sub")).toBe(false);
  });
});

describe("parseDeletions", () => {
  test("one deletion commit with two files", () => {
    const output = [
      "DELETE\0" + "2024-03-01T12:00:00Z",
      "old/file1.ts",
      "old/file2.ts",
    ].join("\n");

    const result = parseDeletions(output);
    expect(result.size).toBe(2);
    expect(result.get("old/file1.ts")).toBe("2024-03-01T12:00:00Z");
    expect(result.get("old/file2.ts")).toBe("2024-03-01T12:00:00Z");
  });

  test("multiple commits — first (most recent) date wins", () => {
    const output = [
      "DELETE\0" + "2024-03-15T12:00:00Z",
      "file.ts",
      "",
      "DELETE\0" + "2024-01-01T12:00:00Z",
      "file.ts",
    ].join("\n");

    const result = parseDeletions(output);
    expect(result.get("file.ts")).toBe("2024-03-15T12:00:00Z");
  });

  test("empty input", () => {
    expect(parseDeletions("").size).toBe(0);
  });
});
