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

    return { columns, rows: rawRows };
  } finally {
    await connection.close();
  }
}

export async function closeAllPools(): Promise<void> {
  await Promise.all([...pools.values()].map((p) => p.close(0)));
  pools.clear();
}
