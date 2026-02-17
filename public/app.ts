import * as d3 from "d3";

// -- Types --

interface FileCommit {
  hash: string;
  date: string;
  author: string;
  linesAdded: number;
  linesRemoved: number;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "binfile";
  createdAt: string;
  deletedAt: string | null;
  size: number;
  commits: FileCommit[];
}

interface DirNode {
  name: string;
  path: string;
  type: "directory";
  children: Array<FileNode | DirNode>;
}

interface RepoData {
  repoName: string;
  firstCommitDate: string;
  lastCommitDate: string;
  tree: DirNode;
  authors: string[];
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: "file" | "binfile" | "directory";
  size: number;
  author: string;
  commitCount: number;
  createdAt: string;
  deletedAt: string | null;
  topContributors: { name: string; count: number }[];
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

// -- Helpers --

function getDominantAuthor(commits: FileCommit[]): {
  author: string;
  topContributors: { name: string; count: number }[];
} {
  const counts = new Map<string, number>();
  for (const c of commits) {
    counts.set(c.author, (counts.get(c.author) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    author: sorted[0]?.[0] ?? "",
    topContributors: sorted.slice(0, 3).map(([name, count]) => ({ name, count })),
  };
}

function flattenTree(tree: DirNode): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  function walk(node: DirNode | FileNode, parentPath: string | null) {
    if (node.type === "directory") {
      const dir = node as DirNode;
      const gn: GraphNode = {
        id: dir.path || "(root)",
        name: dir.name || tree.name || "(root)",
        type: "directory",
        size: dir.children.length,
        author: "",
        commitCount: 0,
        createdAt: "",
        deletedAt: null,
        topContributors: [],
      };
      nodes.push(gn);
      if (parentPath !== null) {
        links.push({ source: gn.id, target: parentPath || "(root)" });
      }
      for (const child of dir.children) {
        walk(child, dir.path);
      }
    } else {
      const file = node as FileNode;
      // Skip deleted files for now (Phase 5 timeline will handle them)
      if (file.deletedAt !== null) return;

      const { author, topContributors } = getDominantAuthor(file.commits);
      const gn: GraphNode = {
        id: file.path,
        name: file.name,
        type: file.type,
        size: file.size,
        author,
        commitCount: file.commits.length,
        createdAt: file.createdAt,
        deletedAt: file.deletedAt,
        topContributors,
      };
      nodes.push(gn);
      if (parentPath !== null) {
        links.push({ source: gn.id, target: parentPath || "(root)" });
      }
    }
  }

  walk(tree, null);
  return { nodes, links };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function buildLegend(
  authors: string[],
  colorScale: d3.ScaleOrdinal<string, string>,
  authorCommitCounts: Map<string, number>,
) {
  const legend = document.getElementById("legend")!;
  legend.innerHTML = "";

  const title = document.createElement("div");
  title.className = "legend-title";
  title.textContent = "Authors";
  legend.appendChild(title);

  // Sort by commit count, limit to top 10
  const sorted = [...authors].sort(
    (a, b) => (authorCommitCounts.get(b) ?? 0) - (authorCommitCounts.get(a) ?? 0),
  );
  const top = sorted.slice(0, 10);

  for (const author of top) {
    const item = document.createElement("div");
    item.className = "legend-item";

    const swatch = document.createElement("div");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = colorScale(author);

    const label = document.createElement("div");
    label.className = "legend-label";
    label.textContent = author;

    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  }
}

// -- Main --

const app = document.getElementById("app")!;
const tooltip = document.getElementById("tooltip")!;

try {
  const res = await fetch("/api/data");
  if (!res.ok) {
    app.textContent = `Error: server returned ${res.status}`;
    throw new Error(`fetch failed: ${res.status}`);
  }
  const data: RepoData = await res.json();

  const { nodes, links } = flattenTree(data.tree);

  if (nodes.length === 0) {
    app.textContent = "No files to visualize.";
    throw new Error("empty repo");
  }

  // Compute author commit counts for legend sorting
  const authorCommitCounts = new Map<string, number>();
  for (const n of nodes) {
    if (n.type !== "directory" && n.author) {
      for (const tc of n.topContributors) {
        authorCommitCounts.set(tc.name, (authorCommitCounts.get(tc.name) ?? 0) + tc.count);
      }
    }
  }

  // Scales
  const maxSize = d3.max(nodes, (d) => (d.type !== "directory" ? d.size : 0)) ?? 1;
  const sizeScale = d3.scaleSqrt().domain([0, maxSize]).range([3, 30]);

  const colorScale = d3.scaleOrdinal<string>().domain(data.authors).range(d3.schemeTableau10);

  const width = window.innerWidth;
  const height = window.innerHeight;

  // SVG
  const svg = d3
    .select(app)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const container = svg.append("g");

  // Zoom
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 10])
    .on("zoom", (event) => container.attr("transform", event.transform));
  svg.call(zoom);

  // Links
  const linkSelection = container
    .append("g")
    .selectAll<SVGLineElement, GraphLink>("line")
    .data(links)
    .join("line")
    .attr("class", "link");

  // Nodes
  const nodeSelection = container
    .append("g")
    .selectAll<SVGCircleElement, GraphNode>("circle")
    .data(nodes)
    .join("circle")
    .attr("class", "node")
    .attr("r", (d) => (d.type === "directory" ? 5 : sizeScale(d.size)))
    .attr("fill", (d) => (d.type === "directory" ? "#6e7681" : colorScale(d.author)));

  // Drag
  const drag = d3
    .drag<SVGCircleElement, GraphNode>()
    .on("start", (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
  nodeSelection.call(drag);

  // Tooltip
  nodeSelection
    .on("mouseover", (event: MouseEvent, d: GraphNode) => {
      tooltip.style.opacity = "1";
      const isDir = d.type === "directory";
      const contribs = d.topContributors
        .map((c) => `${c.name} (${c.count})`)
        .join(", ");
      tooltip.innerHTML = `
        <div class="tip-path">${d.id}</div>
        <div class="tip-meta">
          ${isDir ? `${d.size} children` : formatBytes(d.size)}<br>
          ${d.createdAt ? `Created: ${d.createdAt.slice(0, 10)}` : ""}
          ${!isDir ? `<br>Commits: ${d.commitCount}` : ""}
          ${contribs ? `<br>Contributors: ${contribs}` : ""}
        </div>
      `;
    })
    .on("mousemove", (event: MouseEvent) => {
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top = `${event.clientY - 12}px`;
    })
    .on("mouseout", () => {
      tooltip.style.opacity = "0";
    });

  // Simulation
  const simulation = d3
    .forceSimulation<GraphNode>(nodes)
    .force(
      "link",
      d3
        .forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance(30),
    )
    .force("charge", d3.forceManyBody().strength(-50))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force(
      "collide",
      d3.forceCollide<GraphNode>((d) => (d.type === "directory" ? 7 : sizeScale(d.size) + 2)),
    )
    .on("tick", () => {
      linkSelection
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);

      nodeSelection.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
    });

  // Legend
  buildLegend(data.authors, colorScale, authorCommitCounts);
} catch (err) {
  console.error("Failed to load repo data:", err);
  if (!app.textContent) {
    app.textContent = "Failed to load repository data.";
  }
}
