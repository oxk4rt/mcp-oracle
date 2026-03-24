# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP_Oracle is a **Model Context Protocol (MCP) server** for Oracle DB, built with **Bun + TypeScript**. It exposes 7 tools for querying and exploring Oracle databases, and is compatible with Claude Code, Codex CLI, and any standard MCP client.

## Commands

```bash
# Install dependencies
bun install

# Run the MCP server
bun run index.ts
```

No test runner is configured. Manual testing is done by running `claude` from the project root with the MCP registered.

## Architecture

### Source Layout

```
index.ts              # Entry point — init Oracle client, SIGINT/SIGTERM, startServer()
src/
  server.ts           # MCP server definition, registers all 7 tools, StdioServerTransport
  oracle.ts           # Oracle Instant Client init, connection pool management
  resolver.ts         # Resolves project/env aliases → Oracle connection config
  tools/
    query.ts          # execute_query (SELECT only)
    schema.ts         # list_tables, list_schemas
    describe.ts       # describe_table
    relations.ts      # get_relations
    joinpath.ts       # get_join_path (BFS over FK graph)
projects.json         # Project config (no credentials) — committed to Git
```

### Resolver Logic (`src/resolver.ts`)

Translates user-facing project/environment names into Oracle connection configs:

1. Input like `"TEST"` → looks up `aliases` in `projects.json` → resolves `code: "TEST_LOCAL"`
2. Input like `"dsv"` → looks up `env_aliases` → resolves canonical env `"integracion"`
3. If no env specified → uses `default_env` from the project (always `"integracion"`)
4. Reads env vars `TEST_LOCAL__INTEGRACION__USER` and `TEST_LOCAL__INTEGRACION__PASS`
5. Combines with `host`/`port`/`service` from `projects.json`
6. Returns `ResolvedConnection` with `defaultSchema` (from `default_schema` in project, falls back to connection user)

### Credential Pattern

Credentials live **only** in `~/.claude.json` (via `claude mcp add`) — never in `projects.json` or Git.

Pattern: `{CODE}__{ENTORNO}__{USER|PASS}` (double underscore separators, uppercase)

Example env vars:
- `TEST_LOCAL__INTEGRACION__USER`
- `TEST_LOCAL__PRODUCCION__PASS`

The resolver scans all env vars matching this pattern automatically — one MCP entry handles all apps and environments.

### `projects.json` Structure

```json
{
  "env_aliases": {
    "integracion":   ["dsv", "dev", "desarrollo", "local"],
    "preproduccion": ["pre", "preprod"],
    "produccion":    ["pro", "prod"]
  },
  "projects": [
    {
      "code":           "TEST_LOCAL",
      "aliases":        ["TEST", "test"],
      "default_env":    "integracion",
      "default_schema": "OSCAR",
      "environments": {
        "integracion":   { "host": "localhost", "port": 1521, "service": "FREEPDB1" },
        "preproduccion": { "host": "host-pre.example.com", "port": 1521, "service": "service_pre" },
        "produccion":    { "host": "host-pro.example.com", "port": 1521, "service": "service_pro" }
      }
    }
  ]
}
```

### MCP Tools (7 total)

| Tool | Description |
|---|---|
| `execute_query` | SELECT-only queries — write operations are rejected |
| `list_tables` | Tables in a schema (defaults to `default_schema`) |
| `describe_table` | Columns, types, PK, FK constraints for a table |
| `list_schemas` | Available schemas/owners |
| `list_projects` | Projects and environments (no credentials exposed) |
| `get_relations` | PK/FK map via `ALL_CONSTRAINTS` + `ALL_CONS_COLUMNS` |
| `get_join_path` | Bidirectional FK-graph BFS to find JOIN path between two tables |

### Oracle Instant Client

Path configured via `ORACLE_CLIENT_PATH` env var. Default location:
`C:\Users\oscar\Dev\Oracle\instantclient\instantclient_23_0`

### MCP Registration

```bash
claude mcp add \
  -e MCP_ORACLE_PROJECTS_PATH='C:\Users\oscar\Dev\MCP\MCP_Oracle\projects.json' \
  -e ORACLE_CLIENT_PATH='C:\Users\oscar\Dev\Oracle\instantclient\instantclient_23_0' \
  -e CODE__INTEGRACION__USER=usuario \
  -e CODE__INTEGRACION__PASS=password \
  --scope user \
  -- oracle bun run 'C:\Users\oscar\Dev\MCP\MCP_Oracle\index.ts'
```

## Key Constraints

- `execute_query` must reject any non-SELECT statement (no INSERT/UPDATE/DELETE/DDL)
- `projects.json` is committed to Git — it must never contain credentials
- Adding a new project = one block in `projects.json` + env vars via `claude mcp add`
- `default_env` is always `integracion` — if no environment is specified, connect to development
- Oracle bind variable names must not use reserved words (e.g. use `:tname` not `:table`)
