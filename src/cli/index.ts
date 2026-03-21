#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { registerInitCommand } from "./commands/init.js";
import { registerFprdCommand } from "./commands/fprd.js";
import { registerParsePrdCommand } from "./commands/parse-prd.js";
import { registerListCommand } from "./commands/list.js";
import { registerBoardCommand } from "./commands/board.js";
import { registerTreeCommand } from "./commands/tree.js";
import { registerShowCommand } from "./commands/show.js";
import { registerSetStatusCommand } from "./commands/set-status.js";
import { registerBrainstormCommand } from "./commands/brainstorm.js";
import { registerExpandCommand } from "./commands/expand.js";
import { registerNextCommand } from "./commands/next.js";
import { registerRefineCommand } from "./commands/refine.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerAskCommand } from "./commands/ask.js";
import { registerAdvisorCommand } from "./commands/advisor.js";

// CTRL+C 안전 종료
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\n👋 작업을 취소했습니다. 언제든 다시 시도해주세요!"));
  process.exit(0);
});

const program = new Command();

program
  .name("task")
  .description("TaskFlow — AI-powered task manager for developers")
  .version("0.1.0");

registerInitCommand(program);
registerFprdCommand(program);
registerParsePrdCommand(program);
registerListCommand(program);
registerBoardCommand(program);
registerTreeCommand(program);
registerShowCommand(program);
registerSetStatusCommand(program);
registerBrainstormCommand(program);
registerExpandCommand(program);
registerNextCommand(program);
registerRefineCommand(program);
registerStatusCommand(program);
registerAskCommand(program);
registerAdvisorCommand(program);

program.parse();
