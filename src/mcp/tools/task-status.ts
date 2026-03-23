import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { updateTask, listTasks, recommend } from "../../core/task/index.js";
import { resolveProjectRoot } from "../util.js";

export function registerTaskStatusTools(server: McpServer): void {
  server.tool(
    "set_task_status",
    "태스크 상태를 변경합니다",
    { projectRoot: z.string().optional(), taskId: z.string(), status: z.string() },
    async ({ projectRoot, taskId, status }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const task = await updateTask(root, taskId, { status: status as any });
        return { content: [{ type: "text" as const, text: `태스크 ${taskId} 상태 → ${task.status}` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    "get_next_task",
    "의존성과 우선순위 기반으로 다음 작업할 태스크를 추천합니다",
    { projectRoot: z.string().optional(), count: z.number().optional(), group: z.string().optional() },
    async ({ projectRoot, count, group }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        let tasks = await listTasks(root);
        if (group) {
          tasks = tasks.filter((t) => t.group === group);
        }
        const recommendations = recommend(tasks, { limit: count ?? 3 });
        return { content: [{ type: "text" as const, text: JSON.stringify(recommendations, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );
}
