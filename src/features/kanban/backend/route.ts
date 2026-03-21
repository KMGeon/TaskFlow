import type { Hono } from "hono";
import { z } from "zod";
import {
  listTasks,
  readTask,
  updateTask,
  ensureRepo,
} from "@/features/taskflow/lib/repository";
import { TASK_STATUSES } from "@/features/taskflow/types";

const statusBodySchema = z.object({
  to: z.enum(TASK_STATUSES),
});

export const registerTaskRoutes = (app: Hono<any>) => {
  const projectRoot = process.cwd();

  app.get("/api/tasks", async (c) => {
    await ensureRepo(projectRoot);
    const tasks = await listTasks(projectRoot);
    return c.json(tasks);
  });

  app.get("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const task = await readTask(projectRoot, id);

    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: `Task ${id} not found` } }, 404);
    }

    return c.json(task);
  });

  app.post("/api/tasks/:id/status", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = statusBodySchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_BODY", message: "Invalid status", details: parsed.error.format() } },
        400,
      );
    }

    try {
      const updated = await updateTask(projectRoot, id, { status: parsed.data.to });
      return c.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: { code: "UPDATE_FAILED", message } }, 404);
    }
  });
};
