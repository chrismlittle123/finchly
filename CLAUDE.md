# Agent Instructions

## Project Overview

finchly is a monorepo application with API, web frontend, and shared packages. Built with TypeScript.

- **Tier:** internal
- **Package:** `finchly` (monorepo root)

## Quick Reference

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Build | `pnpm build` |
| Test | `pnpm test` |

## Architecture

```
apps/
  api/         # Backend API
  web/         # Web frontend
packages/
  db/          # Database package
  typescript-config/  # Shared TS config
```

See `docs/` for detailed architecture documentation.

## Standards & Guidelines

This project uses [@standards-kit/conform](https://github.com/chrismlittle123/standards-kit) for coding standards.

- **Config:** `standards.toml` (extends `typescript-internal` from the standards registry)
- **Guidelines:** https://chrismlittle123.github.io/standards/

Use the MCP tools to query standards at any time:

| Tool | Purpose |
|------|---------|
| `get_standards` | Get guidelines matching a context (e.g., `typescript react`) |
| `list_guidelines` | List all available guidelines |
| `get_guideline` | Get a specific guideline by ID |
| `get_ruleset` | Get a tool configuration ruleset (e.g., `typescript-internal`) |

## Workflow

- **Branch:** Create feature branches from `main`
- **CI:** GitHub Actions runs build and test on PRs
- **Deploy:** CI deploy on push to `main`
- **Commits:** Use conventional commits (`feat:`, `fix:`, `chore:`, etc.)

## Project-Specific Notes

- Root-level code checks (lint, typecheck) are disabled — these run at the package level
- Uses Docker for local development (`docker-compose.yml`)
