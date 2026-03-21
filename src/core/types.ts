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

export interface PrdData {
  projectName: string;
  summary: string;
  target: string;
  pains: string[];
  solutions: string[];
  goals: string[];
  scenarios: string[];
  mustFeatures: string[];
  optFeatures: string[];
  nonfunc: string[];
  stack: string[];
  scope: string;
  outScope: string;
  milestones: string[];
  risks: string[];
}

// Brainstorm session types
export interface BrainstormMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BrainstormSession {
  sessionId: string;
  messages: BrainstormMessage[];
  isComplete: boolean;
}

export interface BrainstormTurn {
  session: BrainstormSession;
  aiMessage: string;
  isComplete: boolean;
  prdMarkdown?: string;
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
