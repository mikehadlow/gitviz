import type { RepoData } from "./types";
import path from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".ts": "text/javascript",
};

const PUBLIC_DIR = path.join(import.meta.dir, "..", "public");

export function startServer(
  repoData: RepoData,
  port: number,
): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/data") {
        return Response.json(repoData);
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
