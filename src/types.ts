// Raw extraction output (used by git.ts)
export interface RawCommitEntry {
  hash: string;
  date: string; // ISO 8601
  author: string;
  files: Array<{
    path: string;
    linesAdded: number; // -1 = binary
    linesRemoved: number; // -1 = binary
  }>;
}
export type FileSizeMap = Map<string, number>; // path → bytes
export type DeletionMap = Map<string, string>; // path → ISO date

// Tree structures (used by tree.ts and server.ts)
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
