/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { query } from "../oracle.ts";
import type { ResolvedConnection } from "../resolver.ts";

const MAX_ROWS_HARD_LIMIT = 1000;

const WRITE_OR_DDL_KEYWORDS = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
  "ALTER",
  "CREATE",
  "DROP",
  "TRUNCATE",
  "BEGIN",
  "DECLARE",
  "CALL",
];

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

function stripTerminalSemicolon(sql: string): string {
  return sql.replace(/;+\s*$/, "").trimEnd();
}

function isIdentifierChar(char: string | undefined): boolean {
  return !!char && /[A-Z0-9_$#]/.test(char);
}

function hasTopLevelSemicolon(sql: string): boolean {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (inSingleQuote) {
      if (char === "'" && sql[i + 1] === "'") {
        i++;
        continue;
      }
      if (char === "'") inSingleQuote = false;
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"' && sql[i + 1] === '"') {
        i++;
        continue;
      }
      if (char === '"') inDoubleQuote = false;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === "(") {
      depth++;
      continue;
    }

    if (char === ")") {
      if (depth > 0) depth--;
      continue;
    }

    if (depth === 0 && char === ";") return true;
  }

  return false;
}

function findFirstTopLevelKeyword(sql: string, keywords: string[]): string | null {
  const upper = sql.toUpperCase();
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < upper.length; i++) {
    const char = upper[i];

    if (inSingleQuote) {
      if (char === "'" && upper[i + 1] === "'") {
        i++;
        continue;
      }
      if (char === "'") inSingleQuote = false;
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"' && upper[i + 1] === '"') {
        i++;
        continue;
      }
      if (char === '"') inDoubleQuote = false;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === "(") {
      depth++;
      continue;
    }

    if (char === ")") {
      if (depth > 0) depth--;
      continue;
    }

    if (depth !== 0) continue;

    for (const keyword of keywords) {
      const prev = upper[i - 1];
      const next = upper[i + keyword.length];
      if (
        upper.startsWith(keyword, i) &&
        !isIdentifierChar(prev) &&
        !isIdentifierChar(next)
      ) {
        return keyword;
      }
    }
  }

  return null;
}

function assertSelectOnly(sql: string): void {
  const stripped = stripSqlComments(sql).trim();
  const normalized = stripTerminalSemicolon(stripped).trimStart();

  if (!normalized) {
    throw new Error("Only SELECT statements are allowed. Got an empty statement.");
  }

  if (hasTopLevelSemicolon(normalized)) {
    throw new Error("Only a single SELECT statement is allowed.");
  }

  if (/^SELECT\b/i.test(normalized)) return;

  if (/^WITH\b/i.test(normalized)) {
    const firstTopLevelKeyword = findFirstTopLevelKeyword(
      normalized.slice(4),
      WRITE_OR_DDL_KEYWORDS
    );
    if (firstTopLevelKeyword === "SELECT") return;
  }

  throw new Error(
    `Only SELECT statements are allowed. Got: "${normalized.slice(0, 60).trim()}..."`
  );
}

function applyFetchLimit(sql: string, maxRows: number): string {
  const baseSql = stripTerminalSemicolon(sql);
  const normalized = stripSqlComments(baseSql).toUpperCase();
  const alreadyLimited = /\bFETCH\s+FIRST\b|\bROWNUM\b|\bOFFSET\b/.test(normalized);
  if (alreadyLimited) return baseSql;
  return `${baseSql}\nFETCH FIRST ${maxRows + 1} ROWS ONLY`;
}

export async function executeQuery(
  conn: ResolvedConnection,
  sql: string,
  maxRows = 500
): Promise<string> {
  const effectiveMaxRows = Math.min(
    Number.isFinite(maxRows) && maxRows > 0 ? Math.floor(maxRows) : 500,
    MAX_ROWS_HARD_LIMIT
  );

  assertSelectOnly(sql);
  const limitedSql = applyFetchLimit(sql, effectiveMaxRows);
  const result = await query(conn, limitedSql);

  const truncated = result.rows.length > effectiveMaxRows;
  const rows = truncated ? result.rows.slice(0, effectiveMaxRows) : result.rows;

  return JSON.stringify(
    { columns: result.columns, rows, rowCount: rows.length, truncated },
    null,
    2
  );
}
