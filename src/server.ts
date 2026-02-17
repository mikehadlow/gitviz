import type { RepoData } from "./types";
import path from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".ts": "text/javascript", // Bun transpiles .ts on the fly
};

const PUBLIC_DIR = path.join(import.meta.dir, "..", "public");

export function startServer(
  repoData: RepoData,
  port: number,
): ReturnType<typeof Bun.serve> {
  // Serialize once at startup instead of on every request
  const cachedJson = JSON.stringify(repoData);

  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/data") {
        // Check if client accepts gzip
        const acceptEncoding = req.headers.get("accept-encoding") ?? "";
        if (acceptEncoding.includes("gzip")) {
          const compressed = Bun.gzipSync(Buffer.from(cachedJson));
          return new Response(compressed, {
            headers: {
              "content-type": "application/json",
              "content-encoding": "gzip",
            },
          });
        }
        return new Response(cachedJson, {
          headers: { "content-type": "application/json" },
        });
      }

      // Serve static files from public/
      const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
      const resolved = path.normalize(path.join(PUBLIC_DIR, filePath));
      if (!resolved.startsWith(PUBLIC_DIR)) {
        return new Response("Forbidden", { status: 403 });
      }
      const file = Bun.file(resolved);
      if (await file.exists()) {
        const ext = path.extname(filePath);
        const contentType = MIME[ext] ?? "application/octet-stream";
        return new Response(file, {
          headers: { "content-type": contentType },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });
}
