import chalk from "chalk";
import ora from "ora";
import { buildRefineConfig, RefineValidationError } from "./refine-config.js";
import { resolveInput, type RefineInput } from "./refine-input.js";
import { createRefineLogger, type RefineLogger } from "./refine-logger.js";
import type { RefineCliOptions, RefineConfig } from "./refine-types.js";
import { ensureRepo, listTasks } from "@/features/taskflow/lib/repository";
import { safeReadFile } from "@/features/taskflow/lib/fs-utils";
import { getIndexFilePath } from "@/features/taskflow/constants";
import { analyzeDiff, analyzeDiffFromChanged, type DiffReport } from "./refine-diff.js";
import { analyzeImpact, type ImpactResult } from "./refine-ai.js";
import { renderImpact } from "./refine-renderer.js";
import { buildPatchPlan, applyPlan, describePlan } from "./refine-patcher.js";
import { interactiveApply } from "./refine-interactive.js";
import { classifyError, formatRefineError } from "./refine-errors.js";

export interface RefineResult {
  config: RefineConfig;
  input: RefineInput;
  diff?: DiffReport;
  impact?: ImpactResult;
}

export async function runRefineFlow(
  opts: RefineCliOptions,
  projectRoot: string = process.cwd(),
): Promise<RefineResult> {
  // 1. Config merge & validation
  const config = await buildRefineConfig(opts, projectRoot);
  const logger = createRefineLogger(config.logLevel);
  const verbose = config.logLevel === "debug";

  logger.debug("Config loaded:", JSON.stringify(config, null, 2));

  // 2. Ensure .taskflow exists
  await ensureRepo(projectRoot);

  // 3. Resolve input
  const hasInput = config.base || config.changed || config.stdin;
  if (!hasInput) {
    printUsageGuide();
    return { config, input: { source: "file" } };
  }

  logger.info(`입력 소스: ${config.stdin ? "stdin" : "파일"}`);
  const input = await resolveInput(config);

  if (!input.changed) {
    console.log(chalk.yellow("변경된 내용이 없습니다."));
    return { config, input };
  }

  // 4. Diff analysis
  const spinnerDiff = ora("PRD 변경 분석 중...").start();
  let diff: DiffReport;
  try {
    if (input.base) {
      diff = analyzeDiff(input.base, input.changed);
    } else {
      // Try loading existing PRD as base
      const indexPath = getIndexFilePath(projectRoot);
      const existingBase = await safeReadFile(indexPath);
      diff = analyzeDiffFromChanged(input.changed, existingBase ?? undefined);
    }
    spinnerDiff.succeed(`변경 분석 완료: ${diff.sections.length}개 섹션 변경`);
  } catch (err) {
    spinnerDiff.fail("변경 분석 실패");
    const classified = classifyError(err);
    console.error(formatRefineError(classified, verbose));
    return { config, input };
  }

  if (diff.sections.length === 0) {
    console.log(chalk.green("변경된 섹션이 없습니다."));
    return { config, input, diff };
  }

  // 5. AI impact analysis
  const spinnerAi = ora("AI 영향 분석 중...").start();
  let impact: ImpactResult;
  try {
    const tasks = await listTasks(projectRoot);
    const indexContent = (await safeReadFile(getIndexFilePath(projectRoot))) ?? "";
    impact = await analyzeImpact(diff, indexContent, tasks, {
      timeoutMs: config.timeoutMs,
    });
    spinnerAi.succeed(`영향 분석 완료: ${impact.affectedTasks.length}개 태스크 영향`);
  } catch (err) {
    spinnerAi.fail("AI 영향 분석 실패");
    const classified = classifyError(err);
    console.error(formatRefineError(classified, verbose));
    return { config, input, diff };
  }

  // 6. Render output
  const output = renderImpact(impact, config.format, diff);
  console.log(output);

  // 7. Apply based on mode
  switch (config.applyMode) {
    case "preview":
      console.log(chalk.gray("\n미리보기 모드: 변경 사항을 적용하지 않습니다."));
      console.log(chalk.gray("적용하려면: --apply 또는 --interactive 옵션을 사용하세요."));
      break;

    case "dry-run": {
      const plan = buildPatchPlan(impact, projectRoot);
      console.log(chalk.yellow("\n드라이런 모드: 실제 파일을 변경하지 않습니다."));
      console.log(describePlan(plan));
      const result = await applyPlan(plan, projectRoot, {
        backupDir: config.backupDir,
        dryRun: true,
      });
      console.log(chalk.gray(`시뮬레이션 완료: ${result.applied}단계 실행 예정`));
      break;
    }

    case "apply": {
      const plan = buildPatchPlan(impact, projectRoot);
      console.log(chalk.cyan(`\n자동 적용 모드 (백업: ${config.backupDir})`));
      console.log(describePlan(plan));

      const spinnerApply = ora("변경 사항 적용 중...").start();
      try {
        const result = await applyPlan(plan, projectRoot, {
          backupDir: config.backupDir,
          dryRun: false,
        });

        if (result.success) {
          spinnerApply.succeed(`적용 완료: ${result.applied}단계 실행, ${result.skipped}단계 건너뜀`);
          if (result.snapshot) {
            console.log(chalk.gray(`백업 위치: ${result.snapshot.dir}`));
          }
        } else {
          spinnerApply.fail("적용 실패 — 롤백 완료");
          for (const e of result.errors) {
            console.error(chalk.red(`  • ${e}`));
          }
        }
      } catch (err) {
        spinnerApply.fail("적용 중 오류 발생");
        const classified = classifyError(err);
        console.error(formatRefineError(classified, verbose));
      }
      break;
    }

    case "interactive": {
      console.log(chalk.cyan("\n대화형 모드: 변경 사항을 확인 후 적용합니다."));

      const interactiveResult = await interactiveApply(impact, projectRoot);

      if (interactiveResult.action === "cancel") {
        console.log(chalk.yellow("작업이 취소되었습니다."));
        break;
      }

      if (interactiveResult.action === "reanalyze") {
        console.log(chalk.cyan("다시 분석을 요청했습니다. refine 명령을 다시 실행해주세요."));
        break;
      }

      if (interactiveResult.plan) {
        const spinnerApply = ora("선택한 변경 사항 적용 중...").start();
        try {
          const result = await applyPlan(interactiveResult.plan, projectRoot, {
            backupDir: config.backupDir,
            dryRun: false,
          });

          if (result.success) {
            spinnerApply.succeed(`적용 완료: ${result.applied}단계 실행`);
            if (result.snapshot) {
              console.log(chalk.gray(`백업 위치: ${result.snapshot.dir}`));
            }
          } else {
            spinnerApply.fail("적용 실패 — 롤백 완료");
            for (const e of result.errors) {
              console.error(chalk.red(`  • ${e}`));
            }
          }
        } catch (err) {
          spinnerApply.fail("적용 중 오류 발생");
          const classified = classifyError(err);
          console.error(formatRefineError(classified, verbose));
        }
      }
      break;
    }
  }

  return { config, input, diff, impact };
}

function printUsageGuide(): void {
  console.log("");
  console.log(chalk.bold("task refine — 태스크 변경 분석 및 정제"));
  console.log("");
  console.log(chalk.gray("사용법:"));
  console.log(`  ${chalk.cyan("task refine --base old.md --changed new.md")}       파일 비교`);
  console.log(`  ${chalk.cyan("task refine --changed updated.md --apply")}          변경 적용`);
  console.log(`  ${chalk.cyan("cat changes.md | task refine --stdin")}              표준 입력`);
  console.log(`  ${chalk.cyan("task refine --changed new.md --format json")}        JSON 출력`);
  console.log(`  ${chalk.cyan("task refine --changed new.md --interactive")}        대화형 모드`);
  console.log("");
  console.log(chalk.gray("옵션:"));
  console.log("  --base <file>         기준 파일 경로");
  console.log("  --changed <file>      변경 파일 경로");
  console.log("  --stdin               표준 입력으로 읽기");
  console.log("  --format <fmt>        출력 포맷 (table, json, md)");
  console.log("  --apply               자동 적용");
  console.log("  --interactive         대화형 적용");
  console.log("  --dry-run             실행 시뮬레이션");
  console.log("  --backup-dir <dir>    백업 경로");
  console.log("  --log-level <level>   로그 레벨 (debug, info, warn, error, silent)");
  console.log("  --timeout-ms <n>      타임아웃 (기본 120000)");
  console.log("  --no-color            색상 비활성화");
  console.log("  --verbose             상세 로그 출력 (--log-level debug)");
  console.log("");
}
