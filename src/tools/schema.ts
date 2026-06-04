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
  schema?: string,
  limit = 100
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

  const total = result.rows.length;
  const limited = result.rows.slice(0, limit);
  const lines = limited.map((r) => {
    const rows = r.NUM_ROWS != null ? ` (~${r.NUM_ROWS} rows)` : "";
    return `  ${r.TABLE_NAME}${rows}`;
  });
  const truncNote =
    total > limit
      ? `\n(Showing ${limit} of ${total} tables. Pass a higher limit or filter by schema to see more.)`
      : "";

  return `Tables in ${owner} (${total}):\n${lines.join("\n")}${truncNote}`;
}

export async function listSchemas(
  conn: ResolvedConnection,
  limit = 100
): Promise<string> {
  const result = await query(
    conn,
    `SELECT DISTINCT owner FROM all_tables ORDER BY owner`
  );

  const total = result.rows.length;
  const limited = result.rows.slice(0, limit);
  const schemas = limited.map((r) => `  ${r.OWNER}`);
  const truncNote =
    total > limit
      ? `\n(Showing ${limit} of ${total} schemas. Pass a higher limit to see more.)`
      : "";

  return `Available schemas (${total}):\n${schemas.join("\n")}${truncNote}`;
}
