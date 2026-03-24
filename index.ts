/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */
import { initOracleClient, closeAllPools } from "./src/oracle.ts";
import { startServer } from "./src/server.ts";

initOracleClient();

process.on("SIGINT", async () => {
  await closeAllPools();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeAllPools();
  process.exit(0);
});

await startServer();
