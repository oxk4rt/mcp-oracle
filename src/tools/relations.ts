/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { query } from "../oracle.ts";
import type { ResolvedConnection } from "../resolver.ts";

interface FKEntry {
  columns: string[];
  refTable: string;
  refColumns: string[];
}

export async function getRelations(
  conn: ResolvedConnection,
  tableName?: string,
  schema?: string
): Promise<string> {
  const owner = (schema ?? conn.defaultSchema).toUpperCase();
  const tableFilter = tableName ? "AND c.table_name = :tname" : "";
  const binds: Record<string, string> = { owner };
  if (tableName) binds.tname = tableName.toUpperCase();

  const [pkResult, fkResult] = await Promise.all([
    query(
      conn,
      `SELECT c.table_name, cc.column_name
       FROM all_constraints c
       JOIN all_cons_columns cc
         ON c.constraint_name = cc.constraint_name AND c.owner = cc.owner
       WHERE c.owner = :owner ${tableFilter} AND c.constraint_type = 'P'
       ORDER BY c.table_name, cc.position`,
      binds
    ),
    query(
      conn,
      `SELECT c.table_name, cc.column_name, rc.table_name AS ref_table,
              rcc.column_name AS ref_column, c.constraint_name
       FROM all_constraints c
       JOIN all_cons_columns cc
         ON c.constraint_name = cc.constraint_name AND c.owner = cc.owner
       JOIN all_constraints rc
         ON c.r_constraint_name = rc.constraint_name AND c.r_owner = rc.owner
       JOIN all_cons_columns rcc
         ON rc.constraint_name = rcc.constraint_name AND rc.owner = rcc.owner
        AND cc.position = rcc.position
       WHERE c.owner = :owner ${tableFilter} AND c.constraint_type = 'R'
       ORDER BY c.table_name, c.constraint_name, cc.position`,
      binds
    ),
  ]);

  // PKs by table
  const pksByTable = new Map<string, string[]>();
  for (const r of pkResult.rows) {
    const t = r.TABLE_NAME as string;
    if (!pksByTable.has(t)) pksByTable.set(t, []);
    pksByTable.get(t)!.push(r.COLUMN_NAME as string);
  }

  // FKs by table, grouped by constraint
  const fksByTable = new Map<string, FKEntry[]>();
  const fkTemp = new Map<string, FKEntry>();
  for (const r of fkResult.rows) {
    const t = r.TABLE_NAME as string;
    const key = `${t}__${r.CONSTRAINT_NAME as string}`;
    if (!fkTemp.has(key)) {
      const entry: FKEntry = { columns: [], refTable: r.REF_TABLE as string, refColumns: [] };
      fkTemp.set(key, entry);
      if (!fksByTable.has(t)) fksByTable.set(t, []);
      fksByTable.get(t)!.push(entry);
    }
    const entry = fkTemp.get(key)!;
    entry.columns.push(r.COLUMN_NAME as string);
    entry.refColumns.push(r.REF_COLUMN as string);
  }

  const tables = new Set([...pksByTable.keys(), ...fksByTable.keys()]);
  if (tables.size === 0) {
    return `No relations found in ${owner}${tableName ? `.${tableName.toUpperCase()}` : ""}`;
  }

  const lines: string[] = [];
  for (const t of [...tables].sort()) {
    lines.push(`\n${t}:`);
    const pks = pksByTable.get(t);
    if (pks) lines.push(`  PK: (${pks.join(", ")})`);
    for (const fk of fksByTable.get(t) ?? []) {
      lines.push(
        `  FK: (${fk.columns.join(", ")}) → ${fk.refTable}(${fk.refColumns.join(", ")})`
      );
    }
  }

  const scope = tableName ? `.${tableName.toUpperCase()}` : "";
  return `Relations in ${owner}${scope}:${lines.join("\n")}`;
}
