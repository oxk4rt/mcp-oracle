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
  limit = 100,
  offset = 0
): Promise<string> {
  const owner = (schema ?? conn.defaultSchema).toUpperCase();
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;
  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const offsetClause = safeOffset > 0 ? ` OFFSET ${safeOffset} ROWS` : "";

  const [countResult, result] = await Promise.all([
    query(conn, `SELECT COUNT(*) AS CNT FROM all_tables WHERE owner = :owner`, { owner }),
    query(conn,
      `SELECT table_name, num_rows FROM all_tables WHERE owner = :owner ORDER BY table_name${offsetClause} FETCH FIRST ${safeLimit} ROWS ONLY`,
      { owner }
    ),
  ]);

  if (result.rows.length === 0) {
    return `No tables found in schema ${owner}${safeOffset > 0 ? ` at offset ${safeOffset}` : ""}`;
  }

  const total = Number(countResult.rows[0].CNT);
  const lines = result.rows.map((r) => {
    const rows = r.NUM_ROWS != null ? ` (~${r.NUM_ROWS} rows)` : "";
    return `  ${r.TABLE_NAME}${rows}`;
  });
  const offsetNote = safeOffset > 0 ? `\n(offset: ${safeOffset})` : "";
  const truncNote = truncationNote(safeLimit, total - safeOffset, "tables", "Pass a higher limit or increase offset to see more.");

  return `Tables in ${owner} (${total}):\n${lines.join("\n")}${truncNote}${offsetNote}`;
}

export async function listSchemas(
  conn: ResolvedConnection,
  limit = 100,
  offset = 0
): Promise<string> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;
  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const offsetClause = safeOffset > 0 ? ` OFFSET ${safeOffset} ROWS` : "";

  const [countResult, result] = await Promise.all([
    query(conn, `SELECT COUNT(DISTINCT owner) AS CNT FROM all_tables`),
    query(conn, `SELECT DISTINCT owner FROM all_tables ORDER BY owner${offsetClause} FETCH FIRST ${safeLimit} ROWS ONLY`),
  ]);

  const total = Number(countResult.rows[0].CNT);
  const schemas = result.rows.map((r) => `  ${r.OWNER}`);
  const offsetNote = safeOffset > 0 ? `\n(offset: ${safeOffset})` : "";
  const truncNote = truncationNote(safeLimit, total - safeOffset, "schemas");

  return `Available schemas (${total}):\n${schemas.join("\n")}${truncNote}${offsetNote}`;
}
