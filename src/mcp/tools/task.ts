import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listTasks, readTask, createTask, updateTask, deleteTask } from "../../core/task/index.js";
import { resolveProjectRoot } from "../util.js";

export function registerTaskTools(server: McpServer): void {
  server.tool(
    "list_tasks",
    "태스크 목록을 조회합니다",
    { projectRoot: z.string().optional(), status: z.string().optional(), sortBy: z.string().optional(), sortOrder: z.string().optional() },
    async ({ projectRoot, status, sortBy, sortOrder }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const tasks = await listTasks(root, { filter: status ? { status: status as any } : undefined, sortKey: sortBy as any, sortOrder: sortOrder as any });
        return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    "read_task",
    "태스크 상세 정보를 조회합니다",
    { projectRoot: z.string().optional(), taskId: z.string() },
    async ({ projectRoot, taskId }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const task = await readTask(root, taskId);
        if (!task) return { content: [{ type: "text" as const, text: `태스크를 찾을 수 없습니다: ${taskId}` }], isError: true };
        return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    "create_task",
    "새 태스크를 생성합니다",
    { projectRoot: z.string().optional(), title: z.string(), description: z.string().optional(), priority: z.number().optional(), status: z.string().optional(), parentId: z.string().optional(), dependencies: z.array(z.string()).optional() },
    async ({ projectRoot, title, description, priority, status, parentId, dependencies }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const task = await createTask(root, { title, description, priority, status: status as any, parentId, dependencies });
        return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    "update_task",
    "태스크를 수정합니다",
    { projectRoot: z.string().optional(), taskId: z.string(), title: z.string().optional(), description: z.string().optional(), priority: z.number().optional(), status: z.string().optional(), dependencies: z.array(z.string()).optional() },
    async ({ projectRoot, taskId, ...patch }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const task = await updateTask(root, taskId, patch as any);
        return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    "delete_task",
    "태스크를 삭제합니다",
    { projectRoot: z.string().optional(), taskId: z.string() },
    async ({ projectRoot, taskId }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const removed = await deleteTask(root, taskId);
        return { content: [{ type: "text" as const, text: removed ? `태스크 ${taskId} 삭제 완료` : `태스크를 찾을 수 없습니다: ${taskId}` }], isError: !removed };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );
}
