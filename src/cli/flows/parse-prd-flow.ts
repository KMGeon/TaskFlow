import { readFile } from "node:fs/promises";
import chalk from "chalk";
import { parsePrdResponseSchema, type TaskItem } from "./parse-prd-schema.js";
import { findDuplicates, type DuplicateMatch } from "./parse-prd-dedup.js";
import { withRetry } from "./auto.js";
import {
  createTask,
  listTasks,
  updateTask,
  ensureRepo,
} from "@/features/taskflow/lib/repository";
import { rebuildIndex } from "@/features/taskflow/lib/index-builder";
import type { Task, TaskCreateInput } from "@/features/taskflow/types";

// ── 설정 ──

const MAX_RETRIES = 2;

// ── PRD 입력 로딩 ──

export async function readPrdInput(pathOrStdin: string): Promise<string> {
  if (pathOrStdin === "-") {
    return readStdin();
  }
  const content = await readFile(pathOrStdin, "utf-8");
  if (!content.trim()) {
    throw new Error("PRD 파일이 비어있습니다.");
  }
  return content;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const content = Buffer.concat(chunks).toString("utf-8");
  if (!content.trim()) {
    throw new Error("표준 입력이 비어있습니다.");
  }
  return content;
}

// ── AI 호출 ──

export async function callAiForTasks(_prdContent: string): Promise<TaskItem[]> {
  throw new Error("AI 태스크 분해 기능은 Claude Code 스킬을 통해 제공됩니다. /parse-prd 명령어를 사용하세요.");
}

// ── 응답 검증 ──

export function extractJson(raw: string): string {
  // 마크다운 코드 블록 제거
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // JSON 객체 직접 추출
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return raw.trim();
}

export function validateAiResponse(raw: string): TaskItem[] {
  const jsonStr = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`AI 응답이 유효한 JSON이 아닙니다:\n${jsonStr.slice(0, 200)}`);
  }

  const result = parsePrdResponseSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`AI 응답이 스키마를 위반합니다:\n${issues}`);
  }

  return result.data.tasks;
}

// ── 태스크 변환 ──

export function toCreateInputs(items: TaskItem[]): TaskCreateInput[] {
  return items.map((item) => ({
    title: item.title,
    description: item.description,
    priority: item.priority,
    dependencies: item.dependencies,
    status: item.status,
  }));
}

// ── 의존성 매핑 (title → id) ──

function resolveDependencies(
  tasks: TaskCreateInput[],
  createdTasks: Task[],
): void {
  const titleToId = new Map<string, string>();
  for (const task of createdTasks) {
    titleToId.set(task.title, task.id);
  }

  for (const task of createdTasks) {
    if (task.dependencies.length > 0) {
      task.dependencies = task.dependencies
        .map((dep) => titleToId.get(dep) ?? dep)
        .filter(Boolean);
    }
  }
}

// ── 요약 표 출력 ──

export function printSummaryTable(tasks: Task[]): void {
  console.log("");
  console.log(chalk.bold("생성된 태스크 요약:"));
  console.log("─".repeat(80));
  console.log(
    chalk.gray(
      `${"ID".padEnd(6)} ${"제목".padEnd(40)} ${"우선순위".padEnd(10)} ${"상태"}`,
    ),
  );
  console.log("─".repeat(80));

  for (const task of tasks) {
    const priorityColor = task.priority >= 7 ? chalk.red : task.priority >= 4 ? chalk.yellow : chalk.gray;
    console.log(
      `${task.id.padEnd(6)} ${task.title.slice(0, 38).padEnd(40)} ${priorityColor(String(task.priority).padEnd(10))} ${task.status}`,
    );
  }

  console.log("─".repeat(80));
  console.log(chalk.green(`총 ${tasks.length}개 태스크 생성`));
  console.log("");
}

export function printDuplicateWarnings(duplicates: DuplicateMatch[]): void {
  if (duplicates.length === 0) return;

  console.log("");
  console.log(chalk.yellow(`⚠ 중복 감지: ${duplicates.length}건`));
  for (const dup of duplicates) {
    console.log(
      chalk.yellow(
        `  • "${dup.newTask.title}" ↔ 기존 "${dup.existingTask.title}" (유사도: ${Math.round(dup.score * 100)}%)`,
      ),
    );
  }
}

// ── 롤백 ──

async function rollback(
  projectRoot: string,
  createdIds: string[],
): Promise<void> {
  const { deleteTask } = await import("@/features/taskflow/lib/repository");
  for (const id of createdIds) {
    await deleteTask(projectRoot, id);
  }
}

// ── 메인 플로우 ──

export type AiTaskParser = (prdContent: string) => Promise<TaskItem[]>;

export interface ParsePrdOptions {
  merge?: boolean;
  dryRun?: boolean;
  outDir?: string;
  /** 테스트용 AI 파서 주입 */
  aiParser?: AiTaskParser;
}

export async function runParsePrdFlow(
  prdPath: string,
  options: ParsePrdOptions = {},
): Promise<Task[]> {
  const projectRoot = options.outDir ?? process.cwd();
  const parseWithAi = options.aiParser ?? callAiForTasks;

  // 1. PRD 로딩
  console.log(chalk.cyan("📄 PRD 파일 로딩 중..."));
  const prdContent = await readPrdInput(prdPath);
  console.log(chalk.green(`✔ PRD 로딩 완료 (${prdContent.length}자)`));

  // 2. AI 호출 (재시도 포함)
  console.log(chalk.cyan("🤖 AI 태스크 분해 중..."));
  const taskItems = await withRetry(
    () => parseWithAi(prdContent),
    MAX_RETRIES,
  );
  console.log(chalk.green(`✔ ${taskItems.length}개 태스크 파싱 완료`));

  const inputs = toCreateInputs(taskItems);

  // 3. 중복 감지
  await ensureRepo(projectRoot);
  const existingTasks = await listTasks(projectRoot);
  const { unique, duplicates } = findDuplicates(inputs, existingTasks);

  printDuplicateWarnings(duplicates);

  const tasksToCreate = options.merge
    ? inputs // --merge: 중복 포함 전부 생성
    : unique; // 기본: 중복 제외

  if (duplicates.length > 0 && !options.merge) {
    console.log(
      chalk.gray(`  → 중복 ${duplicates.length}건 제외. --merge 옵션으로 강제 생성 가능`),
    );
  }

  // 4. dry-run 처리
  if (options.dryRun) {
    console.log(chalk.yellow("\n🔍 Dry-run 모드: 파일을 생성하지 않습니다."));
    const fakeTasks: Task[] = tasksToCreate.map((input, i) => ({
      id: String(existingTasks.length + i + 1).padStart(3, "0"),
      title: input.title ?? "",
      status: input.status ?? "Todo",
      priority: input.priority ?? 0,
      dependencies: input.dependencies ?? [],
      parentId: input.parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: input.description ?? "",
    }));
    printSummaryTable(fakeTasks);
    return fakeTasks;
  }

  // 5. 태스크 생성 (롤백 지원)
  if (tasksToCreate.length === 0) {
    console.log(chalk.yellow("생성할 새 태스크가 없습니다."));
    return [];
  }

  console.log(chalk.cyan(`📝 ${tasksToCreate.length}개 태스크 저장 중...`));
  const createdIds: string[] = [];
  const createdTasks: Task[] = [];

  try {
    for (const input of tasksToCreate) {
      const task = await createTask(projectRoot, input);
      createdIds.push(task.id);
      createdTasks.push(task);
    }

    // 6. 의존성 title → id 매핑 업데이트
    const allCreated = [...existingTasks, ...createdTasks];
    const titleToId = new Map(allCreated.map((t) => [t.title, t.id]));

    for (const task of createdTasks) {
      const resolvedDeps = task.dependencies
        .map((dep) => titleToId.get(dep) ?? dep)
        .filter(Boolean);

      if (resolvedDeps.join(",") !== task.dependencies.join(",")) {
        await updateTask(projectRoot, task.id, { dependencies: resolvedDeps });
        task.dependencies = resolvedDeps;
      }
    }

    // 7. 인덱스 갱신
    const finalTasks = await listTasks(projectRoot);
    await rebuildIndex(projectRoot, finalTasks);

    printSummaryTable(createdTasks);
    return createdTasks;
  } catch (error) {
    console.error(chalk.red("\n✖ 태스크 생성 중 오류 발생. 롤백 중..."));
    await rollback(projectRoot, createdIds);
    console.log(chalk.yellow(`  → ${createdIds.length}개 태스크 롤백 완료`));
    throw error;
  }
}
