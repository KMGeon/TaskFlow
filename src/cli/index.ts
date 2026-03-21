#!/usr/bin/env node

import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";

const program = new Command();

program
  .name("task")
  .description("TaskFlow — AI-powered task manager for developers")
  .version("0.1.0");

registerInitCommand(program);

program.parse();
