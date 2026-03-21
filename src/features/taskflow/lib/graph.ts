import type { Task } from "../types";

// ── Cycle Detection (DFS) ──

export function detectCycles(tasks: Task[]): string[][] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(id: string, path: string[]): void {
    if (inStack.has(id)) {
      const start = path.indexOf(id);
      cycles.push(path.slice(start).concat(id));
      return;
    }
    if (visited.has(id)) return;

    visited.add(id);
    inStack.add(id);

    const task = taskMap.get(id);
    if (task) {
      for (const dep of task.dependencies) {
        if (taskMap.has(dep)) {
          dfs(dep, [...path, id]);
        }
      }
    }

    inStack.delete(id);
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
    }
  }

  return cycles;
}

// ── Ready Set (all deps Done) ──

export interface ReadyResult {
  ready: Task[];
  blocked: BlockedTask[];
}

export interface BlockedTask {
  task: Task;
  pendingDeps: string[];
}

export function computeReadySet(tasks: Task[]): ReadyResult {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const ready: Task[] = [];
  const blocked: BlockedTask[] = [];

  for (const task of tasks) {
    if (task.status === "Done") continue;

    const pendingDeps = task.dependencies.filter((depId) => {
      const dep = taskMap.get(depId);
      return dep && dep.status !== "Done";
    });

    if (pendingDeps.length === 0) {
      ready.push(task);
    } else {
      blocked.push({ task, pendingDeps });
    }
  }

  return { ready, blocked };
}

// ── Scoring ──

const WEIGHTS = {
  priority: 10,
  recency: 3,
  inProgress: 5,
  blockedPenalty: -20,
};

const DAY_MS = 86_400_000;

export function scoreTask(task: Task): number {
  let score = 0;

  // Priority contribution (0-10 → 0-100)
  score += task.priority * WEIGHTS.priority;

  // Recency bonus (more recent update = higher score)
  const daysSinceUpdate = (Date.now() - new Date(task.updatedAt).getTime()) / DAY_MS;
  score += Math.max(0, WEIGHTS.recency * (30 - daysSinceUpdate));

  // In-progress bonus
  if (task.status === "InProgress") {
    score += WEIGHTS.inProgress;
  }

  // Blocked penalty
  if (task.status === "Blocked") {
    score += WEIGHTS.blockedPenalty;
  }

  return score;
}

// ── Recommendation ──

export interface RecommendOptions {
  limit?: number;
  includeBlocked?: boolean;
  all?: boolean;
}

export interface Recommendation {
  task: Task;
  score: number;
  pendingDeps?: string[];
}

export function recommend(tasks: Task[], options: RecommendOptions = {}): Recommendation[] {
  const limit = options.all ? Infinity : (options.limit ?? 5);
  const { ready, blocked } = computeReadySet(tasks);

  const recommendations: Recommendation[] = ready.map((task) => ({
    task,
    score: scoreTask(task),
  }));

  if (options.includeBlocked) {
    for (const { task, pendingDeps } of blocked) {
      recommendations.push({
        task,
        score: scoreTask(task),
        pendingDeps,
      });
    }
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
