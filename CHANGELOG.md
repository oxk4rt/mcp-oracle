# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-04-21

### Changed

- **`execute_query` SELECT guard**: now accepts CTEs (`WITH ... SELECT`) in addition to plain `SELECT` statements
- **Date formatting**: Oracle `DATE` values are now returned as `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS` instead of raw ISO UTC strings
- **FETCH FIRST limit**: `execute_query` now injects `FETCH FIRST N ROWS ONLY` into queries that lack a row limiter, reducing Oracle-side load on large datasets; queries that already include `FETCH FIRST`, `ROWNUM` or `OFFSET` are left untouched

---

## [1.0.0] - 2026-03-24

### Added

- **7 MCP tools**: `execute_query`, `list_tables`, `describe_table`, `list_schemas`, `list_projects`, `get_relations`, `get_join_path`
- **Resolver** (`src/resolver.ts`): resolves project and environment aliases to Oracle connection config; reads credentials from env vars following the `CODE__ENTORNO__USER/PASS` pattern (double underscore separators); supports `default_schema` per project
- **Connection pool** (`src/oracle.ts`): Oracle Instant Client initialization, one connection pool per project+environment, graceful shutdown on SIGINT/SIGTERM
- **SELECT guard** in `execute_query`: strips SQL comments before validation, rejects any non-SELECT statement (INSERT, UPDATE, DELETE, DDL)
- **FK graph BFS** in `get_join_path`: bidirectional traversal finds JOIN paths between tables through any number of intermediate tables
- **`default_schema`** in `projects.json`: each project declares its default Oracle schema, decoupling the connection user from the queried schema
- **Multi-project, multi-environment**: a single MCP registration handles all configured projects and all environments automatically
- **Environment aliases**: canonical names (`integracion`, `preproduccion`, `produccion`) with flexible aliases (`dsv`, `dev`, `pre`, `pro`, etc.)
- Compatible with Claude Code, Codex CLI, and any standard MCP client (stdio transport)
