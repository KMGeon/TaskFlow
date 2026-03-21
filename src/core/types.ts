// Re-export existing task types for convenience
export type {
  Task,
  TaskStatus,
  TaskCreateInput,
  TaskUpdateInput,
  TaskFilter,
  TaskSortKey,
  TaskSortOrder,
} from "../features/taskflow/types.js";

export { TASK_STATUSES } from "../features/taskflow/types.js";

// PRD types (consolidated from cli/flows/auto.ts and cli/flows/interactive.ts)
export interface PrdResult {
  markdown: string;
  meta: {
    projectName: string;
    generatedAt: string;
    mode: "brainstorm" | "auto";
    filesScanned?: number;
  };
}

// Feature PRD types
export interface FeaturePrdResult {
  markdown: string;
  meta: {
    projectName: string;
    featureName: string;
    generatedAt: string;
  };
}

// Project config
export interface TaskFlowConfig {
  version: string;
  project: {
    name: string;
    summary?: string;
    stack?: string[];
  };
  tasks: {
    statusFlow: string[];
  };
}

// Task brainstorm result
export interface TaskBrainstormResult {
  subtasks: Array<{
    title: string;
    description: string;
    priority: number;
    dependencies?: string[];
    estimate?: string;
  }>;
  rationale?: string;
}
