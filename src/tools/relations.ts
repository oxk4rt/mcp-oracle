/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { query } from "../oracle.ts";
import type { ResolvedConnection } from "../resolver.ts";
import { truncationNote } from "./utils.ts";

interface FKEntry {
  columns: string[];
  refTable: string;
  refColumns: string[];
}

export async function getRelations(
  conn: ResolvedConnection,
  tableName?: string,
  schema?: string,
  limit = 100
): Promise<string> {
  const owner = (schema ?? conn.defaultSchema).toUpperCase();
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;
  const binds: Record<string, string> = { owner };
  if (tableName) binds.tname = tableName.toUpperCase();

  // When filtering a single table: simple equality. For full schema: push limit to SQL
  // so Oracle never sends more than safeLimit tables' worth of constraint rows.
  const tableFilter = tableName
    ? "AND c.table_name = :tname"
    : `AND c.table_name IN (
         SELECT DISTINCT table_name FROM all_constraints
         WHERE owner = :owner AND constraint_type IN ('P', 'R')
         ORDER BY table_name FETCH FIRST ${safeLimit} ROWS ONLY
       )`;

  const totalProm = tableName
    ? Promise.resolve(0)
    : query(conn,
        `SELECT COUNT(DISTINCT table_name) AS cnt FROM all_constraints
         WHERE owner = :owner AND constraint_type IN ('P', 'R')`,
        { owner }
      ).then((r) => Number(r.rows[0]?.CNT ?? 0));

  const [totalTables, pkResult, fkResult] = await Promise.all([
    totalProm,
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

  const sortedTables = [...tables].sort();
  const truncNote = !tableName
    ? truncationNote(safeLimit, totalTables, "tables", "Pass a higher limit or specify table_name to see more.")
    : "";

  const lines: string[] = [];
  for (const t of sortedTables) {
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
  return `Relations in ${owner}${scope}:${lines.join("\n")}${truncNote}`;
}
