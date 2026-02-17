import { existsSync } from "node:fs";
import { extractGitData } from "./src/git";
import { buildTree } from "./src/tree";
import { startServer } from "./src/server";
import type { DirNode, FileNode } from "./src/types";

const args = process.argv.slice(2);
let repoPath: string | undefined;
let maxCommits = 10000;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--max-commits" && args[i + 1]) {
    maxCommits = parseInt(args[i + 1], 10);
    i++;
  } else if (!args[i].startsWith("--")) {
    repoPath = args[i];
  }
}

if (!repoPath) {
  console.error("Usage: bun run index.ts <repo-path> [--max-commits N]");
  process.exit(1);
}

if (!existsSync(repoPath)) {
  console.error(`Error: path "${repoPath}" does not exist`);
  process.exit(1);
}

const raw = await extractGitData(repoPath, maxCommits);
const repoData = buildTree(raw);

const port = parseInt(process.env.PORT ?? "3000", 10);
const server = startServer(repoData, port);

function countFiles(node: DirNode | FileNode): number {
  if (node.type !== "directory") return 1;
  return node.children.reduce((sum, child) => sum + countFiles(child), 0);
}

const fileCount = countFiles(repoData.tree);
const first = repoData.firstCommitDate.slice(0, 10);
const last = repoData.lastCommitDate.slice(0, 10);

console.log(`${repoData.repoName}`);
console.log(`  ${fileCount} files, ${repoData.authors.length} authors`);
console.log(`  ${first} .. ${last}`);
console.log(`  ${server.url}`);
