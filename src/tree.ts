import type {
  RawCommitEntry,
  FileSizeMap,
  DeletionMap,
  FileNode,
  DirNode,
  RepoData,
} from "./types";

function sortCommitsChronologically(commits: RawCommitEntry[]): RawCommitEntry[] {
  return [...commits].sort((a, b) => a.date.localeCompare(b.date));
}

function buildFileMap(commits: RawCommitEntry[]): Map<string, FileNode> {
  const map = new Map<string, FileNode>();
  for (const commit of commits) {
    for (const file of commit.files) {
      let node = map.get(file.path);
      if (!node) {
        node = {
          name: file.path.split("/").pop()!,
          path: file.path,
          type: "file",
          createdAt: commit.date,
          deletedAt: null,
          size: 0,
          commits: [],
        };
        map.set(file.path, node);
      }

      node.commits.push({
        hash: commit.hash,
        date: commit.date,
        author: commit.author,
        linesAdded: file.linesAdded,
        linesRemoved: file.linesRemoved,
      });

      if (file.linesAdded === -1) {
        node.type = "binfile";
      }
    }
  }
  return map;
}

function applyMetadata(
  fileMap: Map<string, FileNode>,
  fileSizes: FileSizeMap,
  deletions: DeletionMap,
): void {
  for (const [path, node] of fileMap) {
    node.size = fileSizes.get(path) ?? 0;
    node.deletedAt = deletions.get(path) ?? null;
  }
}

function assembleTree(fileMap: Map<string, FileNode>): DirNode {
  const root: DirNode = { name: "", path: "", type: "directory", children: [] };
  const dirCache = new Map<string, DirNode>([["", root]]);

  function getOrCreateDir(dirPath: string): DirNode {
    const cached = dirCache.get(dirPath);
    if (cached) return cached;

    const segments = dirPath.split("/");
    const parentPath = segments.slice(0, -1).join("/");
    const parent = getOrCreateDir(parentPath);

    const dir: DirNode = {
      name: segments[segments.length - 1],
      path: dirPath,
      type: "directory",
      children: [],
    };
    parent.children.push(dir);
    dirCache.set(dirPath, dir);
    return dir;
  }

  for (const [filePath, fileNode] of fileMap) {
    const lastSlash = filePath.lastIndexOf("/");
    const parentPath = lastSlash === -1 ? "" : filePath.slice(0, lastSlash);
    const parent = getOrCreateDir(parentPath);
    parent.children.push(fileNode);
  }

  return root;
}

function sortTreeChildren(root: DirNode): void {
  const stack: DirNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    node.children.sort((a, b) => {
      const aIsDir = a.type === "directory" ? 0 : 1;
      const bIsDir = b.type === "directory" ? 0 : 1;
      if (aIsDir !== bIsDir) return aIsDir - bIsDir;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      if (child.type === "directory") {
        stack.push(child);
      }
    }
  }
}

function collectAuthors(commits: RawCommitEntry[]): string[] {
  const authors = new Set<string>();
  for (const commit of commits) {
    authors.add(commit.author);
  }
  return [...authors].sort();
}

export function buildTree(data: {
  commits: RawCommitEntry[];
  fileSizes: FileSizeMap;
  deletions: DeletionMap;
  repoName: string;
}): RepoData {
  const sortedCommits = sortCommitsChronologically(data.commits);

  const fileMap = buildFileMap(sortedCommits);
  applyMetadata(fileMap, data.fileSizes, data.deletions);

  const tree = assembleTree(fileMap);
  sortTreeChildren(tree);

  const authors = collectAuthors(sortedCommits);

  const firstCommitDate = sortedCommits.length > 0 ? sortedCommits[0].date : "";
  const lastCommitDate =
    sortedCommits.length > 0 ? sortedCommits[sortedCommits.length - 1].date : "";

  return {
    repoName: data.repoName,
    firstCommitDate,
    lastCommitDate,
    tree,
    authors,
  };
}
