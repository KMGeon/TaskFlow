import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerParseTools(server: McpServer): void {
  server.tool(
    "parse_prd",
    "PRD를 태스크로 분해합니다",
    { projectRoot: z.string().optional(), prdPath: z.string().optional() },
    async () => {
      return { content: [{ type: "text" as const, text: "parse-prd 기능은 아직 MCP에서 미구현입니다. CLI에서 task parse-prd를 사용하세요." }] };
    },
  );
}
