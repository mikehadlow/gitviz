import { existsSync } from "node:fs";
import { extractGitData } from "./src/git";
import { buildTree } from "./src/tree";
import { startServer } from "./src/server";

const repoPath = process.argv[2];
if (!repoPath) {
  console.error("Usage: bun run index.ts <repo-path>");
  process.exit(1);
}

if (!existsSync(repoPath)) {
  console.error(`Error: path "${repoPath}" does not exist`);
  process.exit(1);
}

const raw = await extractGitData(repoPath);
const repoData = buildTree(raw);

const port = parseInt(process.env.PORT ?? "3000", 10);
const server = startServer(repoData, port);

// Count files in tree
function countFiles(node: { type: string; children?: unknown[] }): number {
  if (node.type !== "directory") return 1;
  return (node.children as { type: string; children?: unknown[] }[]).reduce(
    (sum, child) => sum + countFiles(child),
    0,
  );
}

const fileCount = countFiles(repoData.tree);
const first = repoData.firstCommitDate.slice(0, 10);
const last = repoData.lastCommitDate.slice(0, 10);

console.log(`${repoData.repoName}`);
console.log(`  ${fileCount} files, ${repoData.authors.length} authors`);
console.log(`  ${first} .. ${last}`);
console.log(`  ${server.url}`);
