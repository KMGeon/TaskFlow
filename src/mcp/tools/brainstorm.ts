import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTask } from "../../core/task/index.js";
import { resolveProjectRoot } from "../util.js";

export function registerBrainstormTools(server: McpServer): void {
  server.tool(
    "expand_subtasks",
    "브레인스토밍 결과를 실제 태스크 파일로 생성합니다",
    {
      projectRoot: z.string().optional(),
      parentTaskId: z.string(),
      subtasks: z.array(z.object({
        title: z.string(),
        description: z.string(),
        priority: z.number().optional(),
        dependencies: z.array(z.string()).optional(),
      })),
    },
    async ({ projectRoot, parentTaskId, subtasks }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const created = [];
        for (const sub of subtasks) {
          const task = await createTask(root, {
            title: sub.title,
            description: sub.description,
            priority: sub.priority ?? 0,
            parentId: parentTaskId,
            dependencies: sub.dependencies,
          });
          created.push(task);
        }
        return {
          content: [{
            type: "text" as const,
            text: `${created.length}개 서브태스크 생성 완료\n${JSON.stringify(created, null, 2)}`,
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
}
