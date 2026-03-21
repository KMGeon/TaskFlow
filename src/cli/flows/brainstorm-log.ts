import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getLogsDir } from "@/features/taskflow/constants";
import { ensureDir, atomicWrite } from "@/features/taskflow/lib/fs-utils";
import type { BrainstormResponse } from "./brainstorm-schema";

export interface BrainstormLog {
  parentTaskId: string;
  parentTaskTitle: string;
  createdAt: string;
  response: BrainstormResponse;
}

function logFileName(taskId: string, ts: string): string {
  const date = ts.slice(0, 10);
  return `brainstorm-${taskId}-${date}.json`;
}

export async function saveBrainstormLog(
  projectRoot: string,
  log: BrainstormLog,
): Promise<string> {
  const logsDir = getLogsDir(projectRoot);
  await ensureDir(logsDir);

  const filename = logFileName(log.parentTaskId, log.createdAt);
  const filePath = path.join(logsDir, filename);
  const content = JSON.stringify(log, null, 2);

  await atomicWrite(filePath, content);
  return filePath;
}

export async function loadLatestBrainstormLog(
  projectRoot: string,
  taskId: string,
): Promise<BrainstormLog | null> {
  const logsDir = getLogsDir(projectRoot);

  let files: string[];
  try {
    files = await readdir(logsDir);
  } catch {
    return null;
  }

  const matching = files
    .filter((f) => f.startsWith(`brainstorm-${taskId}-`) && f.endsWith(".json"))
    .sort()
    .reverse();

  if (matching.length === 0) return null;

  const content = await readFile(path.join(logsDir, matching[0]), "utf-8");
  return JSON.parse(content) as BrainstormLog;
}
