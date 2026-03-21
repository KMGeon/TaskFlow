import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { savePrd } from "../../core/prd/generator.js";
import { scanFiles, sampleFiles, inferProjectName } from "../../core/prd/scanner.js";
import { resolveProjectRoot } from "../util.js";
import fs from "node:fs/promises";
import path from "node:path";

export function registerPrdTools(server: McpServer): void {
  server.tool(
    "scan_codebase",
    "코드베이스를 스캔하여 파일 목록과 시그니처를 반환합니다 (AI 분석 없음)",
    { projectRoot: z.string().optional() },
    async ({ projectRoot }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const files = await scanFiles(root);
        const samples = await sampleFiles(files, root);
        const projectName = inferProjectName(samples, root);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ files, samples, projectName }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "save_prd",
    "PRD 마크다운을 .taskflow/prd.md에 저장합니다",
    { projectRoot: z.string().optional(), markdown: z.string() },
    async ({ projectRoot, markdown }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const filePath = await savePrd(root, markdown);
        return { content: [{ type: "text" as const, text: `PRD 저장 완료: ${filePath}` }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "read_prd",
    ".taskflow/prd.md를 읽어서 반환합니다",
    { projectRoot: z.string().optional() },
    async ({ projectRoot }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const filePath = path.join(root, ".taskflow", "prd.md");
        const content = await fs.readFile(filePath, "utf-8");
        return { content: [{ type: "text" as const, text: content }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `오류: PRD 파일을 읽을 수 없습니다. ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
