import path from "node:path";

export const TASKFLOW_DIR = ".taskflow";
export const TASKS_DIR = "tasks";
export const INDEX_DIR = "index";
export const LOGS_DIR = "logs";
export const CACHE_DIR = "cache";
export const INDEX_FILE = "TASKS.md";
export const TASK_FILE_PREFIX = "task-";
export const TASK_FILE_EXT = ".md";

export function getTaskflowRoot(projectRoot: string): string {
  return path.join(projectRoot, TASKFLOW_DIR);
}

export function getTasksDir(projectRoot: string): string {
  return path.join(projectRoot, TASKFLOW_DIR, TASKS_DIR);
}

export function getIndexDir(projectRoot: string): string {
  return path.join(projectRoot, TASKFLOW_DIR, INDEX_DIR);
}

export function getLogsDir(projectRoot: string): string {
  return path.join(projectRoot, TASKFLOW_DIR, LOGS_DIR);
}

export function getCacheDir(projectRoot: string): string {
  return path.join(projectRoot, TASKFLOW_DIR, CACHE_DIR);
}

export function getIndexFilePath(projectRoot: string): string {
  return path.join(projectRoot, TASKFLOW_DIR, INDEX_DIR, INDEX_FILE);
}

export function getTaskFilePath(projectRoot: string, taskId: string): string {
  return path.join(
    projectRoot,
    TASKFLOW_DIR,
    TASKS_DIR,
    `${TASK_FILE_PREFIX}${taskId}${TASK_FILE_EXT}`,
  );
}

export function extractTaskId(filename: string): string | null {
  const match = filename.match(/^task-(.+)\.md$/);
  return match ? match[1] : null;
}

export const ADVISOR_DB_FILE = "advisor.db";

export function getAdvisorDbPath(projectRoot: string): string {
  return path.join(getTaskflowRoot(projectRoot), ADVISOR_DB_FILE);
}
