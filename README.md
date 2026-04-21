# MCP Oracle

MCP (Model Context Protocol) server for Oracle databases built with **Bun + TypeScript**. Exposes 7 tools for querying and exploring Oracle schemas from Claude Code or any MCP-compatible client.

---

## Requirements

- [Bun](https://bun.sh) >= 1.3
- [Oracle Instant Client](https://www.oracle.com/database/technologies/instant-client/downloads.html) 21+ (23.0 recommended)
- Node.js >= 18 (required internally by the `oracledb` native driver)

---

## Installation

```bash
git clone https://github.com/oxk4rt/mcp-oracle
cd mcp-oracle
bun install
```

---

## Configuration

### 1. projects.json

Defines projects, environments, and connection parameters. **Never include credentials here** — this file is committed to Git.

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
        "integracion": {
          "host":    "localhost",
          "port":    1521,
          "service": "FREEPDB1"
        },
        "preproduccion": {
          "host":    "host-pre.example.com",
          "port":    1521,
          "service": "service_pre"
        },
        "produccion": {
          "host":    "host-pro.example.com",
          "port":    1521,
          "service": "service_pro"
        }
      }
    },
    {
      "code":           "TEST2_LOCAL",
      "aliases":        ["TEST2", "test2"],
      "default_env":    "integracion",
      "default_schema": "OSCAR2",
      "environments": {
        "integracion": {
          "host":    "localhost",
          "port":    1521,
          "service": "FREEPDB1"
        },
        "preproduccion": {
          "host":    "host-pre2.example.com",
          "port":    1521,
          "service": "service2_pre"
        },
        "produccion": {
          "host":    "host-pro2.example.com",
          "port":    1521,
          "service": "service2_pro"
        }
      }
    }
  ]
}
```

**Key concepts:**
- `env_aliases` — global map of canonical environment names → accepted aliases. Defined once for all projects.
- `default_env` — environment used when none is specified (always `integracion`).
- `default_schema` — Oracle schema queried by default when no `schema` parameter is passed to tools.
- Adding a new project = one block in the `projects` array + credentials in the MCP registration.

### 2. MCP Registration

Register the server via the Claude Code CLI. Credentials follow the pattern `CODE__ENTORNO__USER/PASS` (double underscore separators). A single registration handles **all projects and environments**.

```bash
claude mcp add \
  -e MCP_ORACLE_PROJECTS_PATH='C:\path\to\mcp-oracle\projects.json' \
  -e ORACLE_CLIENT_PATH='C:\path\to\instantclient_23_0' \
  -e TEST_LOCAL__INTEGRACION__USER=usuario \
  -e TEST_LOCAL__INTEGRACION__PASS=password \
  -e TEST_LOCAL__PREPRODUCCION__USER=usuario \
  -e TEST_LOCAL__PREPRODUCCION__PASS=password \
  -e TEST_LOCAL__PRODUCCION__USER=usuario \
  -e TEST_LOCAL__PRODUCCION__PASS=password \
  -e TEST2_LOCAL__INTEGRACION__USER=usuario \
  -e TEST2_LOCAL__INTEGRACION__PASS=password \
  --scope user \
  -- oracle bun run 'C:\path\to\mcp-oracle\index.ts'
```

The resolver automatically scans all env vars matching the `CODE__ENTORNO__USER/PASS` pattern and maps them to the corresponding project and environment defined in `projects.json`.

If you manage Claude MCP servers through `~/.claude.json`, the equivalent block looks like this:

```json
{
  "oracle": {
    "type": "stdio",
    "command": "bun",
    "args": [
      "run",
      "C:\\path\\to\\mcp-oracle\\index.ts"
    ],
    "env": {
      "MCP_ORACLE_PROJECTS_PATH": "C:\\path\\to\\mcp-oracle\\projects.json",
      "ORACLE_CLIENT_PATH": "C:\\path\\to\\instantclient_23_0",
      "TEST_LOCAL__INTEGRACION__USER": "usuario",
      "TEST_LOCAL__INTEGRACION__PASS": "password",
      "TEST_LOCAL__PREPRODUCCION__USER": "usuario",
      "TEST_LOCAL__PREPRODUCCION__PASS": "password"
    }
  }
}
```

This exact local example matches the Docker Oracle Free setup documented below. For non-local environments, keep the same shape but replace credentials and connection settings accordingly.

---

## Tools

| Tool | Description |
|---|---|
| `list_projects` | List configured projects and environments. No credentials exposed. |
| `list_schemas` | List available Oracle schemas/owners. |
| `list_tables` | List tables in a schema (defaults to `default_schema`). |
| `describe_table` | Show columns, types, PK, and FK constraints for a table. |
| `execute_query` | Execute a SELECT or CTE (WITH) query. INSERT/UPDATE/DELETE/DDL are rejected. |
| `get_relations` | PK/FK map for a table or an entire schema via `ALL_CONSTRAINTS`. |
| `get_join_path` | FK-graph BFS traversal to find the JOIN path between two tables. |

### Natural language examples

```
List the tables in project TEST
Describe the PEDIDOS table in TEST
Show me the tables in TEST preproduccion
Show relations in the TEST schema
What's the join path between CLIENTES and PRODUCTOS in TEST?
Run: SELECT COUNT(*) FROM PEDIDOS WHERE ESTADO = 'PENDIENTE' in TEST dev
```

---

## Local development with Docker Oracle Free

```bash
docker run -d \
  --name oracle-free \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=password \
  container-registry.oracle.com/database/free:latest
```

`projects.json` connection for the local container:

```json
{
  "code":           "TEST_LOCAL",
  "aliases":        ["TEST", "test"],
  "default_env":    "integracion",
  "default_schema": "MY_SCHEMA",
  "environments": {
    "integracion": {
      "host":    "localhost",
      "port":    1521,
      "service": "FREEPDB1"
    }
  }
}
```

---

## License

MIT — see [LICENSE](LICENSE).
