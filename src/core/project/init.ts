import fs from "node:fs/promises";
import path from "node:path";
import { writeConfig, DEFAULT_CONFIG } from "./config.js";

const TASKFLOW_DIR = ".taskflow";

export interface InitResult {
  created: boolean;
  alreadyExists: boolean;
  projectRoot: string;
}

export async function initProject(projectRoot: string, projectName?: string): Promise<InitResult> {
  const taskflowDir = path.join(projectRoot, TASKFLOW_DIR);

  let alreadyExists = false;
  try {
    await fs.access(taskflowDir);
    alreadyExists = true;
  } catch {
    // directory does not exist
  }

  if (alreadyExists) {
    return { created: false, alreadyExists: true, projectRoot };
  }

  await fs.mkdir(path.join(taskflowDir, "tasks"), { recursive: true });
  await fs.mkdir(path.join(taskflowDir, "index"), { recursive: true });
  await fs.mkdir(path.join(taskflowDir, "logs"), { recursive: true });
  await fs.mkdir(path.join(taskflowDir, "cache"), { recursive: true });

  const config = {
    ...DEFAULT_CONFIG,
    project: { ...DEFAULT_CONFIG.project, name: projectName ?? "" },
  };
  await writeConfig(projectRoot, config);

  return { created: true, alreadyExists: false, projectRoot };
}
