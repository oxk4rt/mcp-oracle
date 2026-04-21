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

  const isSelect = /^SELECT\b/i.test(stripped);
  const isCte = /^WITH\b/i.test(stripped) && /\bSELECT\b/i.test(stripped);

  if (!isSelect && !isCte) {
    throw new Error(
      `Only SELECT statements are allowed. Got: "${stripped.slice(0, 60).trim()}..."`
    );
  }
}

function applyFetchLimit(sql: string, maxRows: number): string {
  const normalized = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").toUpperCase();
  const alreadyLimited = /\bFETCH\s+FIRST\b|\bROWNUM\b|\bOFFSET\b/.test(normalized);
  if (alreadyLimited) return sql;
  return `${sql.trimEnd()}\nFETCH FIRST ${maxRows} ROWS ONLY`;
}

export async function executeQuery(
  conn: ResolvedConnection,
  sql: string,
  maxRows = 500
): Promise<string> {
  assertSelectOnly(sql);
  const limitedSql = applyFetchLimit(sql, maxRows);
  const result = await query(conn, limitedSql);

  const truncated = result.rows.length >= maxRows;
  const rows = result.rows;

  return JSON.stringify(
    { columns: result.columns, rows, rowCount: rows.length, truncated },
    null,
    2
  );
}
