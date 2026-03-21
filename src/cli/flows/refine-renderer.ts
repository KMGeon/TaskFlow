import chalk from "chalk";
import Table from "cli-table3";
import type { ImpactResult, ImpactItem } from "./refine-ai.js";
import type { DiffReport } from "./refine-diff.js";
import type { OutputFormat } from "./refine-types.js";
import { truncate } from "../lib/formatter.js";

// ── Color/Icon maps ──

const TYPE_COLORS: Record<string, (text: string) => string> = {
  update: chalk.yellow,
  add: chalk.green,
  remove: chalk.red,
  split: chalk.magenta,
};

const TYPE_ICONS: Record<string, string> = {
  update: "✏️",
  add: "➕",
  remove: "🗑️",
  split: "✂️",
};

function colorizeType(type: string): string {
  const colorFn = TYPE_COLORS[type] ?? chalk.white;
  const icon = TYPE_ICONS[type] ?? "•";
  return `${icon} ${colorFn(type)}`;
}

function colorizeConfidence(confidence: number): string {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.8) return chalk.green(`${pct}%`);
  if (confidence >= 0.5) return chalk.yellow(`${pct}%`);
  return chalk.red(`${pct}%`);
}

function colorizeTaskId(id: string): string {
  return chalk.cyan(id);
}

// ── Summary ──

function buildSummary(result: ImpactResult, diff?: DiffReport): string {
  const total = result.affectedTasks.length;
  if (total === 0) return chalk.green("영향받는 태스크가 없습니다.");

  const byType: Record<string, number> = {};
  let confidenceSum = 0;

  for (const t of result.affectedTasks) {
    byType[t.changeType] = (byType[t.changeType] || 0) + 1;
    confidenceSum += t.confidence;
  }

  const avgConfidence = Math.round((confidenceSum / total) * 100);
  const typeSummary = Object.entries(byType)
    .map(([type, count]) => `${TYPE_ICONS[type] || "•"} ${type}: ${count}`)
    .join("  ");

  const lines: string[] = [
    "",
    chalk.bold(`📊 영향 분석 요약`),
    chalk.gray("─".repeat(60)),
    `  영향 태스크: ${chalk.bold(String(total))}개`,
    `  변경 유형: ${typeSummary}`,
    `  평균 확신도: ${colorizeConfidence(avgConfidence / 100)}`,
  ];

  if (diff) {
    lines.push(
      `  라인 변경: ${chalk.green(`+${diff.lineDiffSummary.added}`)} ${chalk.red(`-${diff.lineDiffSummary.removed}`)} ${chalk.gray(`=${diff.lineDiffSummary.unchanged}`)}`,
    );
  }

  // Top rationale
  const topItems = result.affectedTasks
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  if (topItems.length > 0) {
    lines.push("", chalk.bold("  주요 근거:"));
    for (const item of topItems) {
      lines.push(`  • [${item.id}] ${truncate(item.rationale, 60)}`);
    }
  }

  lines.push(chalk.gray("─".repeat(60)));
  return lines.join("\n");
}

// ── Table format ──

function renderTable(result: ImpactResult, diff?: DiffReport): string {
  const summary = buildSummary(result, diff);

  if (result.affectedTasks.length === 0) return summary;

  const table = new Table({
    head: [
      chalk.gray("Task"),
      chalk.gray("Type"),
      chalk.gray("Confidence"),
      chalk.gray("Reason"),
    ],
    colWidths: [8, 12, 12, 50],
    wordWrap: true,
    style: { head: [], border: ["gray"] },
  });

  for (const r of result.affectedTasks) {
    table.push([
      colorizeTaskId(r.id),
      colorizeType(r.changeType),
      colorizeConfidence(r.confidence),
      truncate(r.rationale, 80),
    ]);
  }

  // Suggestions section
  const suggestions: string[] = [];
  for (const r of result.affectedTasks) {
    if (r.suggestions.length > 0) {
      suggestions.push(`  ${chalk.cyan(r.id)} ${r.title}:`);
      for (const s of r.suggestions) {
        suggestions.push(`    → ${s}`);
      }
    }
  }

  const parts = [summary, "", table.toString()];
  if (suggestions.length > 0) {
    parts.push("", chalk.bold("💡 제안 사항:"), ...suggestions);
  }

  return parts.join("\n");
}

// ── Markdown format ──

function renderMarkdown(result: ImpactResult, diff?: DiffReport): string {
  const lines: string[] = ["# 영향 분석 리포트", ""];

  if (diff) {
    lines.push(
      `변경 요약: +${diff.lineDiffSummary.added} / -${diff.lineDiffSummary.removed} / =${diff.lineDiffSummary.unchanged}`,
      "",
    );
  }

  lines.push(`총 영향 태스크: **${result.affectedTasks.length}**개`, "");

  if (result.affectedTasks.length === 0) {
    lines.push("> 영향받는 태스크가 없습니다.");
    return lines.join("\n");
  }

  lines.push("| Task | Type | Confidence | Reason |");
  lines.push("|------|------|------------|--------|");

  for (const r of result.affectedTasks) {
    const pct = Math.round(r.confidence * 100);
    lines.push(`| ${r.id} | ${r.changeType} | ${pct}% | ${r.rationale} |`);
  }

  // Suggestions as checklist
  const hasSuggestions = result.affectedTasks.some((r) => r.suggestions.length > 0);
  if (hasSuggestions) {
    lines.push("", "## 제안 사항", "");
    for (const r of result.affectedTasks) {
      if (r.suggestions.length === 0) continue;
      lines.push(`### ${r.id} - ${r.title}`, "");
      for (const s of r.suggestions) {
        lines.push(`- [ ] ${s}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ── JSON format ──

function renderJson(result: ImpactResult, diff?: DiffReport): string {
  const output = {
    ...result,
    ...(diff ? { lineDiffSummary: diff.lineDiffSummary } : {}),
    generatedAt: new Date().toISOString(),
  };
  return JSON.stringify(output, null, 2);
}

// ── Public API ──

export function renderImpact(
  result: ImpactResult,
  format: OutputFormat,
  diff?: DiffReport,
): string {
  switch (format) {
    case "json":
      return renderJson(result, diff);
    case "md":
      return renderMarkdown(result, diff);
    case "table":
    default:
      return renderTable(result, diff);
  }
}
