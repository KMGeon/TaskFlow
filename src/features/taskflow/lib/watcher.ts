import { watch, type FSWatcher } from "chokidar";
import path from "node:path";
import { getTasksDir, extractTaskId } from "../constants";

export type WatchEvent = "created" | "updated" | "deleted";

export interface TaskFileEvent {
  event: WatchEvent;
  taskId: string;
  filePath: string;
}

export type TaskFileEventHandler = (event: TaskFileEvent) => void;

export function createTaskWatcher(
  projectRoot: string,
  onEvent: TaskFileEventHandler,
): FSWatcher {
  const tasksDir = getTasksDir(projectRoot);
  const glob = path.join(tasksDir, "task-*.md");

  const watcher = watch(glob, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  function handleEvent(event: WatchEvent) {
    return (filePath: string) => {
      const taskId = extractTaskId(path.basename(filePath));
      if (!taskId) return;
      onEvent({ event, taskId, filePath });
    };
  }

  watcher.on("add", handleEvent("created"));
  watcher.on("change", handleEvent("updated"));
  watcher.on("unlink", handleEvent("deleted"));

  return watcher;
}
