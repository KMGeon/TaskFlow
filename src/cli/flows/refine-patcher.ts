import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { ImpactItem, ImpactResult } from "./refine-ai.js";
import { readTask, updateTask, listTasks, createTask, deleteTask } from "@/features/taskflow/lib/repository";
import { rebuildIndex } from "@/features/taskflow/lib/index-builder";
import { ensureDir, atomicWrite } from "@/features/taskflow/lib/fs-utils";
import { getTaskFilePath } from "@/features/taskflow/constants";
import type { Task, TaskUpdateInput, TaskCreateInput } from "@/features/taskflow/types";

// ── Types ──

export type PatchOp = "updateFrontmatter" | "upsertSection" | "createTask" | "removeTask" | "syncIndex";

export interface PatchStep {
  file: string;
  op: PatchOp;
  taskId: string;
  data: Record<string, unknown>;
}

export interface PatchPlan {
  steps: PatchStep[];
  affectedTaskIds: string[];
}

export interface SnapshotEntry {
  filePath: string;
  content: string | null; // null means file didn't exist
}

export interface Snapshot {
  dir: string;
  entries: SnapshotEntry[];
  timestamp: string;
}

export interface PatchResult {
  success: boolean;
  applied: number;
  skipped: number;
  snapshot?: Snapshot;
  errors: string[];
}

// ── Snapshot ──

async function createSnapshot(
  projectRoot: string,
  plan: PatchPlan,
  backupDir: string,
): Promise<Snapshot> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(projectRoot, backupDir, timestamp);
  await ensureDir(dir);

  const entries: SnapshotEntry[] = [];

  for (const taskId of plan.affectedTaskIds) {
    const filePath = getTaskFilePath(projectRoot, taskId);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      entries.push({ filePath, content });
      // Copy to backup
      const backupPath = path.join(dir, `task-${taskId}.md`);
      await atomicWrite(backupPath, content);
    } catch {
      entries.push({ filePath, content: null });
    }
  }

  return { dir, entries, timestamp };
}

export async function restoreSnapshot(snapshot: Snapshot): Promise<void> {
  for (const entry of snapshot.entries) {
    if (entry.content === null) {
      // File didn't exist before — remove it
      try {
        await fs.unlink(entry.filePath);
      } catch {
        // already gone
      }
    } else {
      await atomicWrite(entry.filePath, entry.content);
    }
  }
}

async function cleanOldBackups(projectRoot: string, backupDir: string, maxKeep = 10): Promise<void> {
  const fullDir = path.join(projectRoot, backupDir);
  try {
    const entries = await fs.readdir(fullDir);
    if (entries.length <= maxKeep) return;
    const sorted = entries.sort();
    const toDelete = sorted.slice(0, sorted.length - maxKeep);
    for (const d of toDelete) {
      await fs.rm(path.join(fullDir, d), { recursive: true, force: true });
    }
  } catch {
    // backup dir doesn't exist yet
  }
}

// ── Plan builder ──

export function buildPatchPlan(
  impacts: ImpactResult,
  projectRoot: string,
): PatchPlan {
  const steps: PatchStep[] = [];
  const affectedTaskIds: string[] = [];

  for (const item of impacts.affectedTasks) {
    affectedTaskIds.push(item.id);

    switch (item.changeType) {
      case "update":
        steps.push({
          file: getTaskFilePath(projectRoot, item.id),
          op: "updateFrontmatter",
          taskId: item.id,
          data: {
            suggestions: item.suggestions,
            rationale: item.rationale,
          },
        });
        steps.push({
          file: getTaskFilePath(projectRoot, item.id),
          op: "upsertSection",
          taskId: item.id,
          data: {
            anchor: "변경 제안",
            content: formatSuggestionSection(item),
          },
        });
        break;

      case "add":
        steps.push({
          file: "",
          op: "createTask",
          taskId: item.id,
          data: {
            title: item.title,
            description: formatSuggestionSection(item),
            suggestions: item.suggestions,
          },
        });
        break;

      case "remove":
        steps.push({
          file: getTaskFilePath(projectRoot, item.id),
          op: "updateFrontmatter",
          taskId: item.id,
          data: {
            markedForRemoval: true,
            rationale: item.rationale,
          },
        });
        break;

      case "split":
        steps.push({
          file: getTaskFilePath(projectRoot, item.id),
          op: "upsertSection",
          taskId: item.id,
          data: {
            anchor: "분할 제안",
            content: formatSuggestionSection(item),
          },
        });
        break;
    }
  }

  // Sync index at the end
  steps.push({
    file: "",
    op: "syncIndex",
    taskId: "",
    data: {},
  });

  return { steps, affectedTaskIds };
}

function formatSuggestionSection(item: ImpactItem): string {
  const lines: string[] = [
    `> 변경 유형: ${item.changeType} | 확신도: ${Math.round(item.confidence * 100)}%`,
    `> 근거: ${item.rationale}`,
    "",
  ];

  if (item.suggestions.length > 0) {
    for (const s of item.suggestions) {
      lines.push(`- [ ] ${s}`);
    }
  }

  return lines.join("\n");
}

// ── Patch execution ──

async function execStep(
  step: PatchStep,
  projectRoot: string,
  dryRun: boolean,
): Promise<boolean> {
  if (dryRun) return true;

  switch (step.op) {
    case "updateFrontmatter": {
      const task = await readTask(projectRoot, step.taskId);
      if (!task) return false;

      // Append suggestion info to description
      const suggestions = step.data.suggestions as string[] | undefined;
      const rationale = step.data.rationale as string | undefined;
      let newDesc = task.description;

      if (rationale && !newDesc.includes(rationale)) {
        newDesc += `\n\n## 변경 분석\n> ${rationale}`;
      }

      const patch: TaskUpdateInput = {
        description: newDesc,
      };

      await updateTask(projectRoot, step.taskId, patch);
      return true;
    }

    case "upsertSection": {
      const task = await readTask(projectRoot, step.taskId);
      if (!task) return false;

      const anchor = step.data.anchor as string;
      const content = step.data.content as string;
      const sectionHeader = `## ${anchor}`;

      let newDesc: string;
      if (task.description.includes(sectionHeader)) {
        // Replace existing section up to next heading or EOF
        const regex = new RegExp(
          `(## ${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\n[\\s\\S]*?(?=\\n## |$)`,
        );
        newDesc = task.description.replace(regex, `${sectionHeader}\n${content}`);
      } else {
        newDesc = task.description + `\n\n${sectionHeader}\n${content}`;
      }

      await updateTask(projectRoot, step.taskId, { description: newDesc });
      return true;
    }

    case "createTask": {
      const input: TaskCreateInput = {
        title: step.data.title as string,
        description: step.data.description as string,
        priority: 5,
        status: "Todo",
      };
      await createTask(projectRoot, input);
      return true;
    }

    case "removeTask": {
      // We don't actually delete — mark as "Done" with removal note
      const task = await readTask(projectRoot, step.taskId);
      if (!task) return false;
      await updateTask(projectRoot, step.taskId, {
        description: task.description + "\n\n> ⚠️ PRD 변경으로 인해 불필요 판정됨",
      });
      return true;
    }

    case "syncIndex": {
      const allTasks = await listTasks(projectRoot);
      await rebuildIndex(projectRoot, allTasks);
      return true;
    }

    default:
      return false;
  }
}

// ── Public API ──

export async function applyPlan(
  plan: PatchPlan,
  projectRoot: string,
  options: {
    backupDir: string;
    dryRun: boolean;
  },
): Promise<PatchResult> {
  const errors: string[] = [];
  let applied = 0;
  let skipped = 0;

  // Create backup snapshot
  const snapshot = await createSnapshot(projectRoot, plan, options.backupDir);

  try {
    for (const step of plan.steps) {
      try {
        const ok = await execStep(step, projectRoot, options.dryRun);
        if (ok) applied++;
        else skipped++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${step.op}:${step.taskId}] ${msg}`);
        skipped++;
      }
    }

    if (errors.length > 0 && !options.dryRun) {
      // Rollback on partial failure
      await restoreSnapshot(snapshot);
      return { success: false, applied: 0, skipped: plan.steps.length, snapshot, errors };
    }

    // Clean old backups
    await cleanOldBackups(projectRoot, options.backupDir);

    return { success: true, applied, skipped, snapshot, errors };
  } catch (err) {
    // Critical failure — rollback
    if (!options.dryRun) {
      await restoreSnapshot(snapshot);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      applied: 0,
      skipped: plan.steps.length,
      snapshot,
      errors: [...errors, `Critical: ${msg}`],
    };
  }
}

/**
 * Preview the plan without executing
 */
export function describePlan(plan: PatchPlan): string {
  const lines: string[] = [
    `패치 계획: ${plan.steps.length}단계, 영향 태스크 ${plan.affectedTaskIds.length}개`,
    "",
  ];

  for (const step of plan.steps) {
    if (step.op === "syncIndex") {
      lines.push(`  📋 인덱스 동기화`);
      continue;
    }
    const label = {
      updateFrontmatter: "📝 프론트매터 수정",
      upsertSection: "📄 섹션 업서트",
      createTask: "➕ 새 태스크 생성",
      removeTask: "🗑️  태스크 제거 표시",
    }[step.op] || step.op;

    lines.push(`  ${label}: ${step.taskId}`);
  }

  return lines.join("\n");
}
