# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

gitvis is a git visualization tool built with Bun and TypeScript.

Read `docs/plan.md` and `docs/status.md` to view the current status of the project, and outstanding tasks to complete.

## Commands

- `bun install` — install dependencies
- `bun run start <path to Git repo>` — run the app
- `bun run dev <path to Git repo>` — run with hot reload
- `bun test` — run tests
- `bun test path/to/file.test.ts` — run a single test file

Use the "rodney" skill for browser automation. You should check
that the application is behaving as expected before completing
each task.

## Bun Conventions

Default to using Bun instead of Node.js for all tooling.

- `Bun.serve()` for HTTP/WebSocket servers (not express)
- `bun:sqlite` for SQLite (not better-sqlite3)
- `Bun.file` over `node:fs` readFile/writeFile
- `Bun.$\`cmd\`` instead of execa
- Bun automatically loads .env — don't use dotenv
- HTML imports with `Bun.serve()` for frontend (not vite)
- `bun test` with `import { test, expect } from "bun:test"` for testing

## TypeScript

Strict mode enabled.
