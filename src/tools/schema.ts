/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { query } from "../oracle.ts";
import type { ResolvedConnection } from "../resolver.ts";
import { truncationNote } from "./utils.ts";

export async function listTables(
  conn: ResolvedConnection,
  schema?: string,
  limit = 100
): Promise<string> {
  const owner = (schema ?? conn.defaultSchema).toUpperCase();
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;

  const [countResult, result] = await Promise.all([
    query(conn, `SELECT COUNT(*) AS CNT FROM all_tables WHERE owner = :owner`, { owner }),
    query(conn,
      `SELECT table_name, num_rows FROM all_tables WHERE owner = :owner ORDER BY table_name FETCH FIRST ${safeLimit} ROWS ONLY`,
      { owner }
    ),
  ]);

  if (result.rows.length === 0) {
    return `No tables found in schema ${owner}`;
  }

  const total = Number(countResult.rows[0].CNT);
  const lines = result.rows.map((r) => {
    const rows = r.NUM_ROWS != null ? ` (~${r.NUM_ROWS} rows)` : "";
    return `  ${r.TABLE_NAME}${rows}`;
  });
  const truncNote = truncationNote(safeLimit, total, "tables", "Pass a higher limit or filter by schema to see more.");

  return `Tables in ${owner} (${total}):\n${lines.join("\n")}${truncNote}`;
}

export async function listSchemas(
  conn: ResolvedConnection,
  limit = 100
): Promise<string> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;

  const [countResult, result] = await Promise.all([
    query(conn, `SELECT COUNT(DISTINCT owner) AS CNT FROM all_tables`),
    query(conn, `SELECT DISTINCT owner FROM all_tables ORDER BY owner FETCH FIRST ${safeLimit} ROWS ONLY`),
  ]);

  const total = Number(countResult.rows[0].CNT);
  const schemas = result.rows.map((r) => `  ${r.OWNER}`);
  const truncNote = truncationNote(safeLimit, total, "schemas");

  return `Available schemas (${total}):\n${schemas.join("\n")}${truncNote}`;
}
