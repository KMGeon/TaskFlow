// Phase 1: Re-export from existing feature module
// Phase 2: Move files here and update imports

export {
  ensureRepo,
  readTask,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  searchTasks,
} from "../../features/taskflow/lib/repository.js";

export { parseTask, serializeTask } from "../../features/taskflow/lib/serializer.js";
export { filterTasks, sortTasks } from "../../features/taskflow/lib/filter.js";
export { detectCycles, computeReadySet, recommend } from "../../features/taskflow/lib/graph.js";
