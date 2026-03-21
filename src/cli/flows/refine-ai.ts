import { z } from "zod";
import type { DiffReport } from "./refine-diff.js";
import type { Task } from "@/features/taskflow/types";
import { extractJson } from "./brainstorm-flow.js";

// ── Schema ──

export const impactItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  changeType: z.enum(["update", "add", "remove", "split"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  suggestions: z.array(z.string()),
});

export const impactResultSchema = z.object({
  affectedTasks: z.array(impactItemSchema),
});

export type ImpactItem = z.infer<typeof impactItemSchema>;
export type ImpactResult = z.infer<typeof impactResultSchema>;

// ── Fallback heuristic ──

function fallbackHeuristic(diff: DiffReport, tasks: Task[]): ImpactResult {
  const affected: ImpactItem[] = [];

  for (const section of diff.sections) {
    const keywords = section.title.toLowerCase().split(/\s+/);

    for (const task of tasks) {
      const titleLower = task.title.toLowerCase();
      const descLower = task.description.toLowerCase();
      const match = keywords.some(
        (kw) => kw.length > 2 && (titleLower.includes(kw) || descLower.includes(kw)),
      );

      if (match) {
        affected.push({
          id: task.id,
          title: task.title,
          changeType: section.changeType === "removed" ? "remove" : "update",
          confidence: 0.3,
          rationale: `키워드 매칭: "${section.title}" 섹션 변경이 태스크와 관련 가능`,
          suggestions: [`"${section.title}" 섹션 변경 내용 검토 필요`],
        });
      }
    }
  }

  // Deduplicate by task id
  const seen = new Set<string>();
  return {
    affectedTasks: affected.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    }),
  };
}

// ── AI call ──

export async function analyzeImpact(
  diff: DiffReport,
  _tasksIndex: string,
  tasks: Task[],
  _options: { timeoutMs?: number } = {},
): Promise<ImpactResult> {
  // AI 분석 기능은 제거됨 — 휴리스틱 폴백으로 직접 반환
  return fallbackHeuristic(diff, tasks);
}

// ── Response parsing ──

export function parseImpactResponse(raw: string): ImpactResult {
  const jsonStr = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`AI 응답이 유효한 JSON이 아닙니다:\n${jsonStr.slice(0, 200)}`);
  }

  const result = impactResultSchema.safeParse(parsed);
  if (!result.success) {
    // Try partial recovery — extract valid items
    if (parsed && typeof parsed === "object" && "affectedTasks" in parsed) {
      const partial = (parsed as { affectedTasks: unknown[] }).affectedTasks;
      const validItems: ImpactItem[] = [];
      for (const item of partial) {
        const itemResult = impactItemSchema.safeParse(item);
        if (itemResult.success) validItems.push(itemResult.data);
      }
      if (validItems.length > 0) {
        return { affectedTasks: validItems };
      }
    }

    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`AI 응답이 스키마를 위반합니다:\n${issues}`);
  }

  return result.data;
}
