import fs from "node:fs/promises";
import crypto from "node:crypto";
import {
  getTasksDir,
  getTaskflowRoot,
  getTaskFilePath,
  extractTaskId,
  TASK_FILE_PREFIX,
  TASK_FILE_EXT,
} from "../constants";
import type { Task, TaskCreateInput, TaskFilter, TaskSortKey, TaskSortOrder, TaskUpdateInput } from "../types";
import { atomicWrite, ensureDir, safeReadFile, safeRemove } from "./fs-utils";
import { parseTask, serializeTask } from "./serializer";
import { rebuildIndex } from "./index-builder";
import { filterTasks, sortTasks } from "./filter";

function generateId(): string {
  const num = crypto.randomInt(0, 1000).toString().padStart(3, "0");
  return num;
}

async function findNextId(projectRoot: string): Promise<string> {
  const tasksDir = getTasksDir(projectRoot);
  const files = await listTaskFiles(tasksDir);
  const existingIds = files
    .map(extractTaskId)
    .filter(Boolean)
    .map((id) => parseInt(id!, 10))
    .filter((n) => !Number.isNaN(n));

  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  return String(maxId + 1).padStart(3, "0");
}

async function listTaskFiles(tasksDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(tasksDir);
    return entries.filter(
      (f) => f.startsWith(TASK_FILE_PREFIX) && f.endsWith(TASK_FILE_EXT),
    );
  } catch {
    return [];
  }
}

export async function ensureRepo(projectRoot: string): Promise<void> {
  const root = getTaskflowRoot(projectRoot);
  await ensureDir(root);
  await ensureDir(getTasksDir(projectRoot));
  await ensureDir(`${root}/index`);
  await ensureDir(`${root}/logs`);
  await ensureDir(`${root}/cache`);
}

export async function readTask(projectRoot: string, id: string): Promise<Task | null> {
  const filePath = getTaskFilePath(projectRoot, id);
  const content = await safeReadFile(filePath);
  if (!content) return null;
  return parseTask(content);
}

export async function listTasks(
  projectRoot: string,
  options?: {
    filter?: TaskFilter;
    sortKey?: TaskSortKey;
    sortOrder?: TaskSortOrder;
  },
): Promise<Task[]> {
  const tasksDir = getTasksDir(projectRoot);
  const files = await listTaskFiles(tasksDir);

  const tasks: Task[] = [];
  for (const file of files) {
    const content = await safeReadFile(`${tasksDir}/${file}`);
    if (!content) continue;

    try {
      tasks.push(parseTask(content));
    } catch {
      // skip malformed task files
    }
  }

  const filtered = options?.filter ? filterTasks(tasks, options.filter) : tasks;
  return sortTasks(filtered, options?.sortKey, options?.sortOrder);
}

export async function createTask(
  projectRoot: string,
  input: TaskCreateInput,
): Promise<Task> {
  await ensureRepo(projectRoot);
  const id = await findNextId(projectRoot);
  const now = new Date().toISOString();

  const task: Task = {
    id,
    title: input.title,
    status: input.status ?? "Todo",
    priority: input.priority ?? 0,
    dependencies: input.dependencies ?? [],
    parentId: input.parentId,
    createdAt: now,
    updatedAt: now,
    description: input.description ?? "",
  };

  const filePath = getTaskFilePath(projectRoot, id);
  await atomicWrite(filePath, serializeTask(task));

  const allTasks = await listTasks(projectRoot);
  await rebuildIndex(projectRoot, allTasks);

  return task;
}

export async function updateTask(
  projectRoot: string,
  id: string,
  patch: TaskUpdateInput,
): Promise<Task> {
  const existing = await readTask(projectRoot, id);
  if (!existing) {
    throw new Error(`Task not found: ${id}`);
  }

  const updated: Task = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const filePath = getTaskFilePath(projectRoot, id);
  await atomicWrite(filePath, serializeTask(updated));

  const allTasks = await listTasks(projectRoot);
  await rebuildIndex(projectRoot, allTasks);

  return updated;
}

export async function deleteTask(projectRoot: string, id: string): Promise<boolean> {
  const filePath = getTaskFilePath(projectRoot, id);
  const removed = await safeRemove(filePath);

  if (removed) {
    const allTasks = await listTasks(projectRoot);
    await rebuildIndex(projectRoot, allTasks);
  }

  return removed;
}

export async function searchTasks(projectRoot: string, query: string): Promise<Task[]> {
  const allTasks = await listTasks(projectRoot);
  const lowerQuery = query.toLowerCase();

  return allTasks.filter(
    (task) =>
      task.title.toLowerCase().includes(lowerQuery) ||
      task.description.toLowerCase().includes(lowerQuery) ||
      task.id.includes(lowerQuery),
  );
}
