/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { query } from "../oracle.ts";
import type { ResolvedConnection } from "../resolver.ts";

export async function describeTable(
  conn: ResolvedConnection,
  tableName: string,
  schema?: string
): Promise<string> {
  const owner = (schema ?? conn.defaultSchema).toUpperCase();
  const tname = tableName.toUpperCase();

  const [colResult, pkResult, fkResult] = await Promise.all([
    query(
      conn,
      `SELECT column_name, data_type, data_length, data_precision, data_scale,
              nullable, data_default
       FROM all_tab_columns
       WHERE owner = :owner AND table_name = :tname
       ORDER BY column_id`,
      { owner, tname }
    ),
    query(
      conn,
      `SELECT cc.column_name
       FROM all_constraints c
       JOIN all_cons_columns cc
         ON c.constraint_name = cc.constraint_name AND c.owner = cc.owner
       WHERE c.owner = :owner AND c.table_name = :tname AND c.constraint_type = 'P'
       ORDER BY cc.position`,
      { owner, tname }
    ),
    query(
      conn,
      `SELECT cc.column_name, rc.table_name AS ref_table, rcc.column_name AS ref_column,
              c.constraint_name
       FROM all_constraints c
       JOIN all_cons_columns cc
         ON c.constraint_name = cc.constraint_name AND c.owner = cc.owner
       JOIN all_constraints rc
         ON c.r_constraint_name = rc.constraint_name AND c.r_owner = rc.owner
       JOIN all_cons_columns rcc
         ON rc.constraint_name = rcc.constraint_name AND rc.owner = rcc.owner
        AND cc.position = rcc.position
       WHERE c.owner = :owner AND c.table_name = :tname AND c.constraint_type = 'R'
       ORDER BY c.constraint_name, cc.position`,
      { owner, tname }
    ),
  ]);

  if (colResult.rows.length === 0) {
    throw new Error(`Table ${owner}.${tname} not found`);
  }

  const pkCols = new Set(pkResult.rows.map((r) => r.COLUMN_NAME as string));

  const colLines = colResult.rows.map((r) => {
    const name = r.COLUMN_NAME as string;
    let type = r.DATA_TYPE as string;
    if (r.DATA_PRECISION != null) {
      type += `(${r.DATA_PRECISION}${r.DATA_SCALE ? `,${r.DATA_SCALE}` : ""})`;
    } else if (r.DATA_LENGTH != null && !["DATE", "CLOB", "BLOB", "NUMBER"].includes(type)) {
      type += `(${r.DATA_LENGTH})`;
    }
    const pk = pkCols.has(name) ? " [PK]" : "";
    const nullable = r.NULLABLE === "N" ? " NOT NULL" : "";
    const def = r.DATA_DEFAULT ? ` DEFAULT ${String(r.DATA_DEFAULT).trim()}` : "";
    return `  ${name} ${type}${pk}${nullable}${def}`;
  });

  // Group FKs by constraint name
  const fkMap = new Map<string, { columns: string[]; refTable: string; refColumns: string[] }>();
  for (const r of fkResult.rows) {
    const key = r.CONSTRAINT_NAME as string;
    if (!fkMap.has(key)) {
      fkMap.set(key, { columns: [], refTable: r.REF_TABLE as string, refColumns: [] });
    }
    const entry = fkMap.get(key)!;
    entry.columns.push(r.COLUMN_NAME as string);
    entry.refColumns.push(r.REF_COLUMN as string);
  }

  const parts: string[] = [`Table: ${owner}.${tname}`, `\nColumns:\n${colLines.join("\n")}`];

  if (pkResult.rows.length > 0) {
    parts.push(`\nPrimary Key: (${pkResult.rows.map((r) => r.COLUMN_NAME).join(", ")})`);
  }

  if (fkMap.size > 0) {
    const fkLines = [...fkMap.values()].map(
      (fk) => `  (${fk.columns.join(", ")}) → ${owner}.${fk.refTable}(${fk.refColumns.join(", ")})`
    );
    parts.push(`\nForeign Keys:\n${fkLines.join("\n")}`);
  }

  return parts.join("");
}
