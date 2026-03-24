/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { query } from "../oracle.ts";
import type { ResolvedConnection } from "../resolver.ts";

export async function listTables(
  conn: ResolvedConnection,
  schema?: string
): Promise<string> {
  const owner = (schema ?? conn.defaultSchema).toUpperCase();
  const result = await query(
    conn,
    `SELECT table_name, num_rows
     FROM all_tables
     WHERE owner = :owner
     ORDER BY table_name`,
    { owner }
  );

  if (result.rows.length === 0) {
    return `No tables found in schema ${owner}`;
  }

  const lines = result.rows.map((r) => {
    const rows = r.NUM_ROWS != null ? ` (~${r.NUM_ROWS} rows)` : "";
    return `  ${r.TABLE_NAME}${rows}`;
  });

  return `Tables in ${owner} (${lines.length}):\n${lines.join("\n")}`;
}

export async function listSchemas(conn: ResolvedConnection): Promise<string> {
  const result = await query(
    conn,
    `SELECT DISTINCT owner FROM all_tables ORDER BY owner`
  );

  const schemas = result.rows.map((r) => `  ${r.OWNER}`);
  return `Available schemas (${schemas.length}):\n${schemas.join("\n")}`;
}
