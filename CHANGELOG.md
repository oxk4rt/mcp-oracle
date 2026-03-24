# Changelog

All notable changes to this project will be documented in this file.

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
