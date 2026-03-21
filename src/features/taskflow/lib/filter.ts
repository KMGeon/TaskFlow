import type { Task, TaskFilter, TaskSortKey, TaskSortOrder, TaskStatus } from "../types";
import { TASK_STATUSES } from "../types";

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  return tasks.filter((task) => {
    if (filter.status) {
      const statuses: TaskStatus[] = Array.isArray(filter.status)
        ? filter.status
        : [filter.status];
      if (!statuses.includes(task.status)) return false;
    }

    if (filter.priority !== undefined && task.priority !== filter.priority) {
      return false;
    }

    if (filter.parentId !== undefined && task.parentId !== filter.parentId) {
      return false;
    }

    if (filter.updatedSince && task.updatedAt < filter.updatedSince) {
      return false;
    }

    if (filter.hasDependency && !task.dependencies.includes(filter.hasDependency)) {
      return false;
    }

    return true;
  });
}

export function sortTasks(
  tasks: Task[],
  key: TaskSortKey = "priority",
  order: TaskSortOrder = "desc",
): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    if (key === "status") {
      return TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status);
    }

    const valA = a[key];
    const valB = b[key];

    if (typeof valA === "number" && typeof valB === "number") {
      return valA - valB;
    }

    return String(valA).localeCompare(String(valB));
  });

  return order === "desc" ? sorted.reverse() : sorted;
}
