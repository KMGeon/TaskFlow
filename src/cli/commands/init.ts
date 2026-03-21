import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import chalk from "chalk";

const TASKFLOW_DIR = ".taskflow";
const CONFIG_FILE = "config.json";

const defaultConfig = {
  version: "1.0",
  project: {
    name: "",
  },
  tasks: {
    statusFlow: ["pending", "in-progress", "blocked", "done"],
  },
};

export function registerInitCommand(program: Command) {
  program
    .command("init")
    .description("Initialize a new TaskFlow project in the current directory")
    .action(() => {
      const cwd = process.cwd();
      const taskflowDir = join(cwd, TASKFLOW_DIR);

      if (existsSync(taskflowDir)) {
        console.error(
          chalk.red("✖ TaskFlow project already initialized in this directory."),
        );
        process.exit(1);
      }

      mkdirSync(taskflowDir, { recursive: true });

      const configPath = join(taskflowDir, CONFIG_FILE);
      writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + "\n");

      console.log(chalk.green("✔ TaskFlow project initialized successfully!"));
      console.log(
        chalk.gray(`  Created ${TASKFLOW_DIR}/${CONFIG_FILE}`),
      );
    });
}
