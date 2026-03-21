import fs from "node:fs/promises";
import path from "node:path";
import type { TaskFlowConfig } from "../types.js";

const CONFIG_FILE = "config.json";
const TASKFLOW_DIR = ".taskflow";

export const DEFAULT_CONFIG: TaskFlowConfig = {
  version: "1.0",
  project: {
    name: "",
  },
  tasks: {
    statusFlow: ["pending", "in-progress", "blocked", "done"],
  },
};

export async function readConfig(projectRoot: string): Promise<TaskFlowConfig> {
  const configPath = path.join(projectRoot, TASKFLOW_DIR, CONFIG_FILE);
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    return JSON.parse(raw) as TaskFlowConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeConfig(
  projectRoot: string,
  config: TaskFlowConfig,
): Promise<void> {
  const configPath = path.join(projectRoot, TASKFLOW_DIR, CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
