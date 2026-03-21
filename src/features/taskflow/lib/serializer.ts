import matter from "gray-matter";
import type { Task, TaskStatus } from "../types";
import { TASK_STATUSES } from "../types";

interface TaskFrontmatter {
  id: string;
  title: string;
  status: string;
  priority?: number;
  dependencies?: string[];
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

function isValidStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export function parseTask(raw: string): Task {
  const { data, content } = matter(raw);
  const fm = data as TaskFrontmatter;

  if (!fm.id || !fm.title) {
    throw new Error(`Invalid task: missing required fields (id, title)`);
  }

  const status = isValidStatus(fm.status) ? fm.status : "Todo";

  return {
    id: fm.id,
    title: fm.title,
    status,
    priority: fm.priority ?? 0,
    dependencies: fm.dependencies ?? [],
    parentId: fm.parentId,
    createdAt: fm.createdAt ?? new Date().toISOString(),
    updatedAt: fm.updatedAt ?? new Date().toISOString(),
    description: content.trim(),
  };
}

export function serializeTask(task: Task): string {
  const frontmatter: Record<string, unknown> = {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };

  if (task.dependencies.length > 0) {
    frontmatter.dependencies = task.dependencies;
  }

  if (task.parentId) {
    frontmatter.parentId = task.parentId;
  }

  return matter.stringify(task.description || "", frontmatter);
}
