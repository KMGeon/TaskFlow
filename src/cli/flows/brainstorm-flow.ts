import chalk from "chalk";
import { brainstormResponseSchema, type SubtaskItem, type BrainstormResponse } from "./brainstorm-schema.js";
import { saveBrainstormLog, loadLatestBrainstormLog, type BrainstormLog } from "./brainstorm-log.js";
import { withRetry } from "./auto.js";
import {
  readTask,
  createTask,
  listTasks,
  ensureRepo,
} from "@/features/taskflow/lib/repository";
import { rebuildIndex } from "@/features/taskflow/lib/index-builder";
import type { Task, TaskCreateInput } from "@/features/taskflow/types";

// ── AI 호출 ──

export async function callAiForBrainstorm(_task: Task): Promise<BrainstormResponse> {
  throw new Error("AI 브레인스톰 기능은 Claude Code 스킬을 통해 제공됩니다. /brainstorm 명령어를 사용하세요.");
}

// ── 응답 검증 ──

export function extractJson(raw: string): string {
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return raw.trim();
}

export function validateBrainstormResponse(raw: string): BrainstormResponse {
  const jsonStr = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`AI 응답이 유효한 JSON이 아닙니다:\n${jsonStr.slice(0, 200)}`);
  }

  const result = brainstormResponseSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`AI 응답이 스키마를 위반합니다:\n${issues}`);
  }

  return result.data;
}

// ── 출력 ──

export function printSubtasks(subtasks: SubtaskItem[], parentTitle: string): void {
  console.log("");
  console.log(chalk.bold(`"${parentTitle}" 서브태스크 제안:`));
  console.log("─".repeat(70));

  for (const sub of subtasks) {
    const deps = sub.dependencies.length > 0 ? chalk.gray(` [dep: ${sub.dependencies.join(", ")}]`) : "";
    const est = sub.estimate ? chalk.cyan(` ~${sub.estimate}`) : "";
    const prio = sub.priority >= 7 ? chalk.red(`P${sub.priority}`) : chalk.yellow(`P${sub.priority}`);

    console.log(`  ${chalk.dim(sub.tempId)} ${prio} ${sub.title}${est}${deps}`);
    if (sub.description) {
      console.log(`       ${chalk.gray(sub.description.slice(0, 80))}`);
    }
  }

  console.log("─".repeat(70));
  console.log(chalk.gray(`총 ${subtasks.length}개 서브태스크`));
  console.log(chalk.gray(`적용하려면: task expand <id> --apply`));
  console.log("");
}

// ── 메인 brainstorm 플로우 ──

export type AiBrainstormer = (task: Task) => Promise<BrainstormResponse>;

export interface BrainstormOptions {
  outDir?: string;
  aiBrainstormer?: AiBrainstormer;
}

export async function runBrainstormFlow(
  taskId: string,
  options: BrainstormOptions = {},
): Promise<BrainstormResponse> {
  const projectRoot = options.outDir ?? process.cwd();
  const brainstorm = options.aiBrainstormer ?? callAiForBrainstorm;

  await ensureRepo(projectRoot);

  const task = await readTask(projectRoot, taskId);
  if (!task) {
    throw new Error(`태스크를 찾을 수 없습니다: ${taskId}`);
  }

  console.log(chalk.cyan(`🧠 [${task.id}] "${task.title}" 분석 중...`));

  const response = await withRetry(() => brainstorm(task), 2);

  console.log(chalk.green(`✔ ${response.subtasks.length}개 서브태스크 제안 완료`));

  if (response.rationale) {
    console.log(chalk.gray(`근거: ${response.rationale}`));
  }

  printSubtasks(response.subtasks, task.title);

  // 로그 저장
  const log: BrainstormLog = {
    parentTaskId: task.id,
    parentTaskTitle: task.title,
    createdAt: new Date().toISOString(),
    response,
  };

  const logPath = await saveBrainstormLog(projectRoot, log);
  console.log(chalk.gray(`로그 저장: ${logPath}`));

  return response;
}

// ── 메인 expand 플로우 ──

export interface ExpandOptions {
  apply?: boolean;
  outDir?: string;
}

export async function runExpandFlow(
  taskId: string,
  options: ExpandOptions = {},
): Promise<Task[]> {
  const projectRoot = options.outDir ?? process.cwd();

  await ensureRepo(projectRoot);

  const parentTask = await readTask(projectRoot, taskId);
  if (!parentTask) {
    throw new Error(`태스크를 찾을 수 없습니다: ${taskId}`);
  }

  const log = await loadLatestBrainstormLog(projectRoot, taskId);
  if (!log) {
    throw new Error(
      `[${taskId}]에 대한 브레인스톰 로그가 없습니다.\n먼저 task brainstorm ${taskId}을 실행하세요.`,
    );
  }

  console.log(chalk.cyan(`📋 [${taskId}] "${parentTask.title}" 서브태스크 로딩...`));
  console.log(chalk.gray(`로그 생성일: ${log.createdAt}`));

  printSubtasks(log.response.subtasks, parentTask.title);

  if (!options.apply) {
    console.log(chalk.yellow("미리보기 모드입니다. --apply 옵션으로 실제 생성하세요."));
    return [];
  }

  // 적용: 서브태스크 생성
  console.log(chalk.cyan(`📝 ${log.response.subtasks.length}개 서브태스크 생성 중...`));

  const tempIdToRealId = new Map<string, string>();
  const createdTasks: Task[] = [];

  // 우선순위 내림차순 정렬 후 생성
  const sorted = [...log.response.subtasks].sort((a, b) => b.priority - a.priority);

  for (const sub of sorted) {
    // tempId 의존성 → 실제 ID로 변환
    const resolvedDeps = sub.dependencies
      .map((dep) => tempIdToRealId.get(dep) ?? dep)
      .filter(Boolean);

    const input: TaskCreateInput = {
      title: sub.title,
      description: sub.description,
      priority: sub.priority,
      dependencies: resolvedDeps,
      parentId: taskId,
      status: "Todo",
    };

    const created = await createTask(projectRoot, input);
    tempIdToRealId.set(sub.tempId, created.id);
    createdTasks.push(created);
  }

  // 인덱스 갱신
  const allTasks = await listTasks(projectRoot);
  await rebuildIndex(projectRoot, allTasks);

  console.log("");
  console.log(chalk.green(`✔ ${createdTasks.length}개 서브태스크 생성 완료`));
  console.log("─".repeat(70));
  for (const t of createdTasks) {
    console.log(`  ${chalk.dim(`#${t.id}`)} ${t.title} ${chalk.gray(`(parentId: ${t.parentId})`)}`);
  }
  console.log("─".repeat(70));

  return createdTasks;
}
