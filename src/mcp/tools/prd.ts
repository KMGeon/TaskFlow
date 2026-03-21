import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startBrainstorm, continueBrainstorm, savePrd } from "../../core/prd/generator.js";
import { runAutoAnalysis } from "../../core/prd/auto-analyzer.js";
import { resolveProjectRoot } from "../util.js";

export function registerPrdTools(server: McpServer): void {
  server.tool(
    "generate_prd",
    "PRD를 생성합니다 (모드 선택: brainstorm 또는 auto)",
    { projectRoot: z.string().optional(), mode: z.enum(["brainstorm", "auto"]), projectContext: z.string().optional() },
    async ({ projectRoot, mode, projectContext }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        if (mode === "auto") {
          const result = await runAutoAnalysis(root);
          await savePrd(root, result.markdown);
          return { content: [{ type: "text" as const, text: result.markdown }] };
        }
        const turn = await startBrainstorm(root, projectContext);
        return { content: [{ type: "text" as const, text: JSON.stringify({ aiMessage: turn.aiMessage, session: turn.session, isComplete: turn.isComplete }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    "brainstorm_prd",
    "AI와 대화하며 PRD를 생성합니다. session 없이 호출하면 새 세션, session과 userMessage를 전달하면 대화 계속",
    { projectRoot: z.string().optional(), session: z.any().optional(), userMessage: z.string().optional(), projectContext: z.string().optional() },
    async ({ projectRoot, session, userMessage, projectContext }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const turn = session && userMessage ? await continueBrainstorm(session, userMessage) : await startBrainstorm(root, projectContext);
        if (turn.isComplete && turn.prdMarkdown) await savePrd(root, turn.prdMarkdown);
        return { content: [{ type: "text" as const, text: JSON.stringify({ aiMessage: turn.aiMessage, isComplete: turn.isComplete, session: turn.session, prdSaved: turn.isComplete && !!turn.prdMarkdown }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    "auto_analyze_prd",
    "코드베이스를 스캔하여 PRD를 자동 생성합니다",
    { projectRoot: z.string().optional() },
    async ({ projectRoot }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const result = await runAutoAnalysis(root);
        await savePrd(root, result.markdown);
        return { content: [{ type: "text" as const, text: `PRD 생성 완료 (${result.meta.filesScanned}개 파일 스캔)\n\n${result.markdown}` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    "generate_feature_prd",
    "기능별 PRD를 생성합니다",
    { projectRoot: z.string().optional(), featureName: z.string(), goal: z.string(), parentPrd: z.string().optional() },
    async () => {
      return { content: [{ type: "text" as const, text: "기능 PRD 생성은 아직 MCP에서 미구현입니다. CLI에서 task fprd를 사용하세요." }] };
    },
  );
}
