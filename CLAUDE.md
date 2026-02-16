# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

gitvis is a git visualization tool built with Bun and TypeScript.

## Commands

- `bun install` — install dependencies
- `bun run index.ts` — run the app
- `bun --hot index.ts` — run with hot reload
- `bun test` — run tests
- `bun test path/to/file.test.ts` — run a single test file

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

Strict mode enabled. Uses bundler module resolution with `noEmit` (Bun handles execution directly). JSX configured as `react-jsx`.
