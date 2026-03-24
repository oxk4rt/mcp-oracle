/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { query } from "../oracle.ts";
import type { ResolvedConnection } from "../resolver.ts";

interface Edge {
  toTable: string;
  fromCol: string;
  toCol: string;
}

interface JoinStep {
  toTable: string;
  condition: string;
}

async function buildFkGraph(
  conn: ResolvedConnection,
  owner: string
): Promise<Map<string, Edge[]>> {
  const result = await query(
    conn,
    `SELECT c.table_name AS from_table, cc.column_name AS from_col,
            rc.table_name AS to_table, rcc.column_name AS to_col
     FROM all_constraints c
     JOIN all_cons_columns cc
       ON c.constraint_name = cc.constraint_name AND c.owner = cc.owner
     JOIN all_constraints rc
       ON c.r_constraint_name = rc.constraint_name AND c.r_owner = rc.owner
     JOIN all_cons_columns rcc
       ON rc.constraint_name = rcc.constraint_name AND rc.owner = rcc.owner
      AND cc.position = rcc.position
     WHERE c.owner = :owner AND c.constraint_type = 'R'
     ORDER BY c.table_name, cc.position`,
    { owner }
  );

  const graph = new Map<string, Edge[]>();
  const addEdge = (from: string, edge: Edge) => {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from)!.push(edge);
  };

  for (const r of result.rows) {
    const fromTable = r.FROM_TABLE as string;
    const toTable = r.TO_TABLE as string;
    const fromCol = r.FROM_COL as string;
    const toCol = r.TO_COL as string;
    // Both directions so we can traverse FK in reverse too
    addEdge(fromTable, { toTable, fromCol, toCol });
    addEdge(toTable, { toTable: fromTable, fromCol: toCol, toCol: fromCol });
  }

  return graph;
}

function bfs(
  graph: Map<string, Edge[]>,
  start: string,
  end: string
): JoinStep[] | null {
  const visited = new Set<string>([start]);
  const queue: Array<{ table: string; path: JoinStep[] }> = [
    { table: start, path: [] },
  ];

  while (queue.length > 0) {
    const { table, path } = queue.shift()!;
    if (table === end) return path;

    for (const edge of graph.get(table) ?? []) {
      if (visited.has(edge.toTable)) continue;
      visited.add(edge.toTable);
      const step: JoinStep = {
        toTable: edge.toTable,
        condition: `${table}.${edge.fromCol} = ${edge.toTable}.${edge.toCol}`,
      };
      queue.push({ table: edge.toTable, path: [...path, step] });
    }
  }

  return null;
}

export async function getJoinPath(
  conn: ResolvedConnection,
  fromTable: string,
  toTable: string,
  schema?: string
): Promise<string> {
  const owner = (schema ?? conn.defaultSchema).toUpperCase();
  const from = fromTable.toUpperCase();
  const to = toTable.toUpperCase();

  if (from === to) return `Tables are the same: ${from}`;

  const graph = await buildFkGraph(conn, owner);

  if (!graph.has(from) && !graph.has(to)) {
    throw new Error(
      `Neither ${from} nor ${to} participates in any FK relationship in schema ${owner}`
    );
  }

  const path = bfs(graph, from, to);

  if (!path) {
    return `No FK-based join path found between ${from} and ${to} in schema ${owner}`;
  }

  const hops = path.length;
  const joinLines = path.map((s) => `JOIN ${s.toTable} ON ${s.condition}`);

  return [
    `Join path: ${from} → ${to} (${hops} hop${hops !== 1 ? "s" : ""})`,
    "",
    "SELECT *",
    `FROM ${from}`,
    ...joinLines,
  ].join("\n");
}
