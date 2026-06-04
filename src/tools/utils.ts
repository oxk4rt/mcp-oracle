/**
 * @project    MCP_Oracle
 * @author     oxk4rt <oxkarteg@gmail.com>
 * @assistant  Claude (Anthropic) — arquitectura y desarrollo conjunto
 * @license    MIT (ver LICENSE)
 */

export function truncationNote(
  shown: number,
  total: number,
  noun: string,
  hint = "Pass a higher limit to see more."
): string {
  return total > shown ? `\n(Showing ${shown} of ${total} ${noun}. ${hint})` : "";
}
