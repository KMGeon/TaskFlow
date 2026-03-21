import inquirer from "inquirer";
import chalk from "chalk";
import type { ImpactResult, ImpactItem } from "./refine-ai.js";
import type { PatchPlan } from "./refine-patcher.js";
import { buildPatchPlan } from "./refine-patcher.js";

// ── Types ──

type InteractiveAction = "approve" | "skip" | "edit" | "reanalyze";

export interface InteractiveResult {
  action: "apply" | "cancel" | "reanalyze";
  selectedItems: ImpactItem[];
  plan?: PatchPlan;
}

// ── Interactive flow ──

export async function interactiveApply(
  impacts: ImpactResult,
  projectRoot: string,
): Promise<InteractiveResult> {
  if (impacts.affectedTasks.length === 0) {
    console.log(chalk.green("영향받는 태스크가 없습니다."));
    return { action: "cancel", selectedItems: [] };
  }

  // Step 1: Select tasks to apply
  const { selectedIds } = await inquirer.prompt<{ selectedIds: string[] }>([
    {
      type: "checkbox",
      name: "selectedIds",
      message: "적용할 태스크를 선택하세요:",
      choices: impacts.affectedTasks.map((t) => ({
        name: `[${t.changeType.toUpperCase()}] ${t.id} - ${t.title} (${Math.round(t.confidence * 100)}%)`,
        value: t.id,
        checked: t.confidence >= 0.7,
      })),
    },
  ]);

  if (selectedIds.length === 0) {
    const { confirmCancel } = await inquirer.prompt<{ confirmCancel: boolean }>([
      {
        type: "confirm",
        name: "confirmCancel",
        message: "선택된 태스크가 없습니다. 취소할까요?",
        default: true,
      },
    ]);

    if (confirmCancel) return { action: "cancel", selectedItems: [] };
    return interactiveApply(impacts, projectRoot); // retry
  }

  // Step 2: Per-task action
  const selectedItems: ImpactItem[] = [];

  for (const id of selectedIds) {
    const item = impacts.affectedTasks.find((t) => t.id === id);
    if (!item) continue;

    console.log("");
    console.log(chalk.bold(`─── ${item.id}: ${item.title} ───`));
    console.log(`  유형: ${item.changeType} | 확신도: ${Math.round(item.confidence * 100)}%`);
    console.log(`  근거: ${item.rationale}`);
    if (item.suggestions.length > 0) {
      console.log("  제안:");
      for (const s of item.suggestions) {
        console.log(`    → ${s}`);
      }
    }

    const { action } = await inquirer.prompt<{ action: InteractiveAction }>([
      {
        type: "list",
        name: "action",
        message: `[${item.id}] 어떻게 처리할까요?`,
        choices: [
          { name: "✅ 승인 (제안 적용)", value: "approve" },
          { name: "⏭️  건너뛰기", value: "skip" },
          { name: "✏️  편집 (제안 수정)", value: "edit" },
        ],
      },
    ]);

    if (action === "skip") continue;

    if (action === "edit") {
      const { editedSuggestions } = await inquirer.prompt<{ editedSuggestions: string }>([
        {
          type: "editor",
          name: "editedSuggestions",
          message: `[${item.id}] 제안을 수정하세요:`,
          default: item.suggestions.join("\n"),
        },
      ]);

      item.suggestions = editedSuggestions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    selectedItems.push(item);
  }

  if (selectedItems.length === 0) {
    return { action: "cancel", selectedItems: [] };
  }

  // Step 3: Final confirmation
  console.log("");
  console.log(chalk.bold(`📋 적용 대상: ${selectedItems.length}개 태스크`));
  for (const item of selectedItems) {
    console.log(`  ${chalk.cyan(item.id)} ${item.title} → ${item.changeType}`);
  }

  const { finalAction } = await inquirer.prompt<{ finalAction: string }>([
    {
      type: "list",
      name: "finalAction",
      message: "최종 결정:",
      choices: [
        { name: "✅ 적용", value: "apply" },
        { name: "❌ 전체 취소", value: "cancel" },
        { name: "🔄 다시 분석", value: "reanalyze" },
      ],
    },
  ]);

  if (finalAction === "cancel") {
    return { action: "cancel", selectedItems: [] };
  }

  if (finalAction === "reanalyze") {
    return { action: "reanalyze", selectedItems: [] };
  }

  // Build plan from selected items only
  const filteredResult: ImpactResult = { affectedTasks: selectedItems };
  const plan = buildPatchPlan(filteredResult, projectRoot);

  return { action: "apply", selectedItems, plan };
}
