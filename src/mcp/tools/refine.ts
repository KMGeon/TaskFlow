import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerRefineTools(server: McpServer): void {
  server.tool(
    "refine_tasks",
    "요구사항 변경에 따른 태스크 영향도를 분석합니다",
    { projectRoot: z.string().optional(), changes: z.string() },
    async () => {
      return { content: [{ type: "text" as const, text: "refine 기능은 아직 MCP에서 미구현입니다. CLI에서 task refine을 사용하세요." }] };
    },
  );
}
