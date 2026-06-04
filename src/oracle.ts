/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import oracledb from "oracledb";
import type { ResolvedConnection } from "./resolver.ts";

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

type BindParams = oracledb.BindParameters;

const pools = new Map<string, oracledb.Pool>();
let clientInitialized = false;

export function initOracleClient(): void {
  if (clientInitialized) return;
  const libDir = process.env.ORACLE_CLIENT_PATH;
  if (!libDir) throw new Error("ORACLE_CLIENT_PATH env var not set");
  oracledb.initOracleClient({ libDir });
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  clientInitialized = true;
}

async function getPool(conn: ResolvedConnection): Promise<oracledb.Pool> {
  const existing = pools.get(conn.poolKey);
  if (existing) return existing;

  const pool = await oracledb.createPool({
    user: conn.user,
    password: conn.password,
    connectString: conn.connectString,
    poolMin: 1,
    poolMax: 5,
    poolIncrement: 1,
    poolPingInterval: 60,
  });

  pools.set(conn.poolKey, pool);
  return pool;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatOracleDate(value: Date): string {
  const year = value.getFullYear();
  const month = pad2(value.getMonth() + 1);
  const day = pad2(value.getDate());
  const hours = pad2(value.getHours());
  const minutes = pad2(value.getMinutes());
  const seconds = pad2(value.getSeconds());
  const hasTime = hours !== "00" || minutes !== "00" || seconds !== "00";

  return hasTime
    ? `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    : `${year}-${month}-${day}`;
}

function formatDates(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      out[k] = formatOracleDate(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function query(
  conn: ResolvedConnection,
  sql: string,
  binds: BindParams = {}
): Promise<QueryResult> {
  const pool = await getPool(conn);
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchArraySize: 200,
    });

    const rawRows = (result.rows ?? []) as Record<string, unknown>[];
    const columns = result.metaData?.map((m) => m.name) ?? Object.keys(rawRows[0] ?? {});

    return { columns, rows: rawRows.map(formatDates) };
  } finally {
    await connection.close();
  }
}

export async function closeAllPools(): Promise<void> {
  await Promise.all([...pools.values()].map((p) => p.close(0)));
  pools.clear();
}
