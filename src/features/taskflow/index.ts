export type {
  Task,
  TaskStatus,
  TaskCreateInput,
  TaskUpdateInput,
  TaskFilter,
  TaskSortKey,
  TaskSortOrder,
} from "./types";
export { TASK_STATUSES } from "./types";

export {
  ensureRepo,
  readTask,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  searchTasks,
} from "./lib/repository";

export { rebuildIndex } from "./lib/index-builder";
export { filterTasks, sortTasks } from "./lib/filter";
export { createTaskWatcher } from "./lib/watcher";
export type { TaskFileEvent, WatchEvent } from "./lib/watcher";
export { detectCycles, computeReadySet, scoreTask, recommend } from "./lib/graph";
export type { ReadyResult, BlockedTask, Recommendation, RecommendOptions } from "./lib/graph";
