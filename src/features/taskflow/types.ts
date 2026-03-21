export const TASK_STATUSES = ["Todo", "InProgress", "Blocked", "Done"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: number;
  dependencies: string[];
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  description: string;
}

export type TaskCreateInput = Pick<Task, "title"> &
  Partial<Omit<Task, "id" | "title" | "createdAt" | "updatedAt">>;

export type TaskUpdateInput = Partial<Omit<Task, "id" | "createdAt">>;

export interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  priority?: number;
  parentId?: string;
  updatedSince?: string;
  hasDependency?: string;
}

export type TaskSortKey = "priority" | "status" | "createdAt" | "updatedAt" | "title";

export type TaskSortOrder = "asc" | "desc";

// Advisor types
export type SessionType = "prd" | "parse-prd" | "trd" | "brainstorm" | "ask" | "refine";

export interface ConvLog {
  id: number;
  sessionType: SessionType;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Decision {
  id: number;
  sessionId: string;
  decision: string;
  reason: string;
  relatedTasks: string[];
  createdAt: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  priority: number;
  dependencies: string[];
}

export interface AdvisorContext {
  tasks: TaskSummary[];
  decisions: Decision[];
  trdContent?: string;
  prdContent?: string;
  gitDiff?: string;
  conversationLogs?: ConvLog[];
}
