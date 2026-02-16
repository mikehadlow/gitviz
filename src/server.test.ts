import { test, expect, afterAll } from "bun:test";
import { startServer } from "./server";
import type { RepoData } from "./types";

const mockData: RepoData = {
  repoName: "test-repo",
  firstCommitDate: "2024-01-01T00:00:00Z",
  lastCommitDate: "2024-06-01T00:00:00Z",
  tree: { name: "", path: "", type: "directory", children: [] },
  authors: ["Alice", "Bob"],
};

const server = startServer(mockData, 0);

afterAll(() => {
  server.stop();
});

test("GET /api/data returns JSON with correct shape", async () => {
  const res = await fetch(`${server.url}api/data`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("application/json");

  const body = await res.json();
  expect(body.repoName).toBe("test-repo");
  expect(body.authors).toEqual(["Alice", "Bob"]);
  expect(body.tree.type).toBe("directory");
  expect(body.firstCommitDate).toBe("2024-01-01T00:00:00Z");
  expect(body.lastCommitDate).toBe("2024-06-01T00:00:00Z");
});

test("GET / returns HTML", async () => {
  const res = await fetch(`${server.url}`);
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text).toContain("<!DOCTYPE html>");
});

test("GET /unknown returns 404", async () => {
  const res = await fetch(`${server.url}unknown`);
  expect(res.status).toBe(404);
});
