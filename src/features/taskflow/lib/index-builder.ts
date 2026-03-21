import { getIndexFilePath } from "../constants";
import type { Task } from "../types";
import { atomicWrite, ensureDir } from "./fs-utils";
import path from "node:path";

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function buildMarkdownTable(tasks: Task[]): string {
  const lines: string[] = [
    "# TaskFlow Index",
    "",
    `> Auto-generated at ${new Date().toISOString()}`,
    "",
    "| ID | Title | Status | Priority | Dependencies | Updated |",
    "|----|-------|--------|----------|--------------|---------|",
  ];

  const sorted = [...tasks].sort((a, b) => b.priority - a.priority);

  for (const task of sorted) {
    const deps = task.dependencies.length > 0 ? task.dependencies.join(", ") : "-";
    lines.push(
      `| ${task.id} | ${task.title} | ${task.status} | ${task.priority} | ${deps} | ${formatDate(task.updatedAt)} |`,
    );
  }

  lines.push("");
  lines.push(`Total: ${tasks.length} tasks`);
  lines.push("");

  return lines.join("\n");
}

export async function rebuildIndex(projectRoot: string, tasks: Task[]): Promise<void> {
  const indexPath = getIndexFilePath(projectRoot);
  await ensureDir(path.dirname(indexPath));

  const content = buildMarkdownTable(tasks);
  await atomicWrite(indexPath, content);
}
