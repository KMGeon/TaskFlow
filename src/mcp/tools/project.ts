import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initProject } from "../../core/project/init.js";
import { generateClaudeMd, generateMcpJson, appendClaudeImport } from "../../core/project/claude-setup.js";
import { resolveProjectRoot } from "../util.js";

export function registerProjectTools(server: McpServer): void {
  server.tool(
    "initialize_project",
    "프로젝트를 초기화합니다 (.taskflow 디렉토리 + config.json 생성)",
    { projectRoot: z.string().optional(), projectName: z.string().optional() },
    async ({ projectRoot, projectName }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const result = await initProject(root, projectName);
        return { content: [{ type: "text" as const, text: result.created ? `프로젝트가 초기화되었습니다: ${root}/.taskflow` : `이미 초기화된 프로젝트입니다: ${root}/.taskflow` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    "generate_claude_md",
    "CLAUDE.md를 동적으로 생성/갱신합니다",
    { projectRoot: z.string().optional(), projectName: z.string(), summary: z.string().optional(), stack: z.array(z.string()).optional() },
    async ({ projectRoot, projectName, summary, stack }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        await generateClaudeMd(root, { projectName, summary, stack });
        await generateMcpJson(root);
        await appendClaudeImport(root);
        return { content: [{ type: "text" as const, text: "CLAUDE.md, .mcp.json 생성 완료" }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );
}
