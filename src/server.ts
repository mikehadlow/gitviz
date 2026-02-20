import type { RepoData } from "./types";
import path from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
};

const PUBLIC_DIR = path.join(import.meta.dir, "..", "public");
const DIST_DIR = path.join(import.meta.dir, "..", "dist");

export function startServer(
  repoData: RepoData,
  port: number,
): ReturnType<typeof Bun.serve> {
  // Serialize and compress once at startup instead of on every request
  const cachedJson = JSON.stringify(repoData);
  const cachedGzip = Bun.gzipSync(Buffer.from(cachedJson));

  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/data") {
        // Check if client accepts gzip
        const acceptEncoding = req.headers.get("accept-encoding") ?? "";
        if (acceptEncoding.includes("gzip")) {
          return new Response(cachedGzip, {
            headers: {
              "content-type": "application/json",
              "content-encoding": "gzip",
              "cache-control": "no-store",
            },
          });
        }
        return new Response(cachedJson, {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        });
      }

      // Serve static files from dist/ (built JS) and public/ (HTML, CSS)
      const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
      for (const dir of [DIST_DIR, PUBLIC_DIR]) {
        const resolved = path.normalize(path.join(dir, filePath));
        if (!resolved.startsWith(dir)) continue;
        const file = Bun.file(resolved);
        if (await file.exists()) {
          const ext = path.extname(filePath);
          const contentType = MIME[ext] ?? "application/octet-stream";
          return new Response(file, {
            headers: {
              "content-type": contentType,
              "cache-control": "public, max-age=300",
            },
          });
        }
      }

      return new Response("Not Found", { status: 404 });
    },
  });
}
