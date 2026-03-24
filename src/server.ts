/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolveConnection, listProjects } from "./resolver.ts";
import { executeQuery } from "./tools/query.ts";
import { listTables, listSchemas } from "./tools/schema.ts";
import { describeTable } from "./tools/describe.ts";
import { getRelations } from "./tools/relations.ts";
import { getJoinPath } from "./tools/joinpath.ts";

const PROJECT_ENV_PROPS = {
  project: {
    type: "string",
    description: 'Project alias (e.g. "MCI", "informes")',
  },
  env: {
    type: "string",
    description: 'Environment alias (e.g. "dsv", "pre", "pro"). Defaults to integracion.',
  },
};

const SCHEMA_PROP = {
  schema: {
    type: "string",
    description: "Oracle schema/owner. Defaults to the connected user.",
  },
};

const TOOLS = [
  {
    name: "execute_query",
    description:
      "Execute a SELECT query against an Oracle database. INSERT/UPDATE/DELETE/DDL are rejected.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_ENV_PROPS,
        sql: { type: "string", description: "SELECT statement to execute" },
        max_rows: {
          type: "number",
          description: "Maximum rows to return (default: 500)",
        },
      },
      required: ["project", "sql"],
    },
  },
  {
    name: "list_tables",
    description: "List tables in an Oracle schema.",
    inputSchema: {
      type: "object",
      properties: { ...PROJECT_ENV_PROPS, ...SCHEMA_PROP },
      required: ["project"],
    },
  },
  {
    name: "describe_table",
    description:
      "Describe a table: columns, data types, primary key, and foreign keys.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_ENV_PROPS,
        ...SCHEMA_PROP,
        table_name: { type: "string", description: "Table name" },
      },
      required: ["project", "table_name"],
    },
  },
  {
    name: "list_schemas",
    description: "List available Oracle schemas/owners.",
    inputSchema: {
      type: "object",
      properties: { ...PROJECT_ENV_PROPS },
      required: ["project"],
    },
  },
  {
    name: "list_projects",
    description:
      "List configured projects and environments. No credentials are exposed.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_relations",
    description:
      "Get primary key and foreign key relationships for a table or an entire schema.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_ENV_PROPS,
        ...SCHEMA_PROP,
        table_name: {
          type: "string",
          description: "Table to inspect. Omit to get relations for the whole schema.",
        },
      },
      required: ["project"],
    },
  },
  {
    name: "get_join_path",
    description:
      "Find the FK-based JOIN path between two tables. Returns a ready-to-use SQL fragment.",
    inputSchema: {
      type: "object",
      properties: {
        ...PROJECT_ENV_PROPS,
        ...SCHEMA_PROP,
        from_table: { type: "string", description: "Source table" },
        to_table: { type: "string", description: "Target table" },
      },
      required: ["project", "from_table", "to_table"],
    },
  },
];

export async function startServer(): Promise<void> {
  const server = new Server(
    { name: "oracle", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      let text: string;

      if (name === "list_projects") {
        text = JSON.stringify(listProjects(), null, 2);
      } else {
        const conn = resolveConnection(
          args.project as string,
          args.env as string | undefined
        );
        const schema = args.schema as string | undefined;

        switch (name) {
          case "execute_query":
            text = await executeQuery(
              conn,
              args.sql as string,
              args.max_rows as number | undefined
            );
            break;
          case "list_tables":
            text = await listTables(conn, schema);
            break;
          case "describe_table":
            text = await describeTable(conn, args.table_name as string, schema);
            break;
          case "list_schemas":
            text = await listSchemas(conn);
            break;
          case "get_relations":
            text = await getRelations(conn, args.table_name as string | undefined, schema);
            break;
          case "get_join_path":
            text = await getJoinPath(
              conn,
              args.from_table as string,
              args.to_table as string,
              schema
            );
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      }

      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
