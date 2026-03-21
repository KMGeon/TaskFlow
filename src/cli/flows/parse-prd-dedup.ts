import type { Task, TaskCreateInput } from "@/features/taskflow/types";

function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function similarity(a: string, b: string): number {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);

  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;

  // Longest Common Subsequence 기반 유사도
  const lenA = normA.length;
  const lenB = normB.length;
  const dp: number[][] = Array.from({ length: lenA + 1 }, () =>
    Array(lenB + 1).fill(0),
  );

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      dp[i][j] =
        normA[i - 1] === normB[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const lcsLen = dp[lenA][lenB];
  return (2 * lcsLen) / (lenA + lenB);
}

const SIMILARITY_THRESHOLD = 0.7;

export interface DuplicateMatch {
  newTask: TaskCreateInput;
  existingTask: Task;
  score: number;
}

export function findDuplicates(
  newTasks: TaskCreateInput[],
  existingTasks: Task[],
): { unique: TaskCreateInput[]; duplicates: DuplicateMatch[] } {
  const unique: TaskCreateInput[] = [];
  const duplicates: DuplicateMatch[] = [];

  for (const newTask of newTasks) {
    let bestMatch: { task: Task; score: number } | null = null;

    for (const existing of existingTasks) {
      const score = similarity(newTask.title, existing.title);
      if (score >= SIMILARITY_THRESHOLD) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { task: existing, score };
        }
      }
    }

    if (bestMatch) {
      duplicates.push({
        newTask,
        existingTask: bestMatch.task,
        score: bestMatch.score,
      });
    } else {
      unique.push(newTask);
    }
  }

  return { unique, duplicates };
}
