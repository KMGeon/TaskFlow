import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { initProject } from "../../core/project/init.js";
import { readConfig } from "../../core/project/config.js";
import { generateClaudeMd, generateMcpJson, appendClaudeImport } from "../../core/project/claude-setup.js";
import { installSkills } from "../../core/project/skill-setup.js";

export function registerInitCommand(program: Command) {
  program
    .command("init")
    .description("Initialize a new TaskFlow project (setup + Claude Code integration)")
    .action(
      withCliErrorBoundary(async () => {
        const cwd = process.cwd();
        const taskflowDir = join(cwd, ".taskflow");
        const alreadyExists = existsSync(taskflowDir);

        if (alreadyExists) {
          await handleReinit(cwd);
        } else {
          await handleNewInit(cwd);
        }
      }),
    );
}

async function handleNewInit(cwd: string): Promise<void> {
  console.log(chalk.bold("\n🚀 TaskFlow 프로젝트를 초기화합니다.\n"));

  // Step 1: Create directory + config
  const spinner = ora("프로젝트 구조 생성 중...").start();
  await initProject(cwd);
  spinner.succeed("프로젝트 구조 생성 완료");

  // Step 2: .mcp.json
  const mcpSpinner = ora("Claude Code 연동 설정 중...").start();
  await generateMcpJson(cwd);
  mcpSpinner.succeed("Claude Code 연동 설정 완료 (.mcp.json)");

  // Step 3: Generate CLAUDE.md
  const config = await readConfig(cwd);
  const claudeSpinner = ora("CLAUDE.md 생성 중...").start();
  await generateClaudeMd(cwd, { projectName: config.project.name || basename(cwd) });
  claudeSpinner.succeed("CLAUDE.md 생성 완료");

  // Step 4: Append import to root CLAUDE.md
  await appendClaudeImport(cwd);
  console.log(chalk.green("✔ 루트 CLAUDE.md에 TaskFlow import 추가 완료"));

  // Step 5: Install skills + symlinks
  const skillSpinner = ora("Claude Code 스킬 설치 중...").start();
  await installSkills(cwd);
  skillSpinner.succeed("Claude Code 스킬 설치 완료");

  console.log(chalk.bold.green("\n✅ TaskFlow 초기화가 완료되었습니다!\n"));
  console.log(chalk.gray("  다음 단계 (Claude Code에서):"));
  console.log(chalk.gray("  /prd              PRD 대화형 생성"));
  console.log(chalk.gray("  /parse-prd        PRD → 태스크 분해"));
  console.log(chalk.gray("  /next             다음 태스크 추천\n"));
}

async function handleReinit(cwd: string): Promise<void> {
  console.log(chalk.yellow("\n⚠ TaskFlow 프로젝트가 이미 초기화되어 있습니다."));
  console.log(chalk.gray("  Claude Code에서 /prd 명령어로 PRD를 생성/재생성할 수 있습니다.\n"));
}
