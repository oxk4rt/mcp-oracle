/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { query } from "../oracle.ts";
import type { ResolvedConnection } from "../resolver.ts";

function assertSelectOnly(sql: string): void {
  const stripped = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .trimStart();

  if (!/^SELECT\b/i.test(stripped)) {
    throw new Error(
      `Only SELECT statements are allowed. Got: "${stripped.slice(0, 60).trim()}..."`
    );
  }
}

export async function executeQuery(
  conn: ResolvedConnection,
  sql: string,
  maxRows = 500
): Promise<string> {
  assertSelectOnly(sql);
  const result = await query(conn, sql);

  const truncated = result.rows.length > maxRows;
  const rows = truncated ? result.rows.slice(0, maxRows) : result.rows;

  return JSON.stringify(
    { columns: result.columns, rows, rowCount: rows.length, truncated },
    null,
    2
  );
}
