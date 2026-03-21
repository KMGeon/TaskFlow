import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { AdvisorContext, TaskSummary } from "../../types.js";
import { listTasks } from "../repository.js";
import type { AdvisorDb } from "./db.js";

const TOKEN_BUDGET = {
  status: 4_000,
  next: 8_000,
  ask: 12_000,
} as const;

const CODE_KEYWORDS = ["코드", "git", "커밋", "변경", "diff", "코드변경", "수정"];
const DECISION_KEYWORDS = ["왜", "이유", "결정", "배경", "판단"];
const PLANNING_KEYWORDS = ["계획", "전체", "목표", "방향", "prd", "trd"];

export interface QuestionClassification {
  needsGitDiff: boolean;
  needsConversationLogs: boolean;
  needsTrdPrd: boolean;
}

export function classifyQuestion(question: string): QuestionClassification {
  const q = question.toLowerCase();
  return {
    needsGitDiff: CODE_KEYWORDS.some((kw) => q.includes(kw)),
    needsConversationLogs: DECISION_KEYWORDS.some((kw) => q.includes(kw)),
    needsTrdPrd: PLANNING_KEYWORDS.some((kw) => q.includes(kw)),
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface BuildContextOptions {
  command: "status" | "next" | "ask";
  projectRoot: string;
  db: AdvisorDb;
  question?: string;
}

export async function buildContext(opts: BuildContextOptions): Promise<AdvisorContext> {
  const { command, projectRoot, db, question } = opts;
  const budget = TOKEN_BUDGET[command];

  const tasks = await listTasks(projectRoot);
  const taskSummaries: TaskSummary[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dependencies: t.dependencies,
  }));

  const decisionLimit = command === "status" ? 10 : 20;
  const decisions = db.getRecentDecisions(decisionLimit);

  const context: AdvisorContext = { tasks: taskSummaries, decisions };

  if (command === "status") return context;

  if (command === "next") {
    context.trdContent = await safeReadTrdPrd(projectRoot, "trd");
    context.prdContent = await safeReadTrdPrd(projectRoot, "prd");
    return truncateContext(context, budget);
  }

  if (command === "ask" && question) {
    const classification = classifyQuestion(question);

    if (classification.needsTrdPrd) {
      context.trdContent = await safeReadTrdPrd(projectRoot, "trd");
      context.prdContent = await safeReadTrdPrd(projectRoot, "prd");
    }

    if (classification.needsGitDiff) {
      context.gitDiff = safeGitDiff(projectRoot);
    }

    if (classification.needsConversationLogs) {
      context.conversationLogs = db.getLogsByType("brainstorm")
        .concat(db.getLogsByType("refine"))
        .concat(db.getLogsByType("prd"))
        .slice(-50);
    }

    return truncateContext(context, budget);
  }

  return context;
}

async function safeReadTrdPrd(projectRoot: string, type: "trd" | "prd"): Promise<string | undefined> {
  const candidates = [
    path.join(projectRoot, "vooster-docs", `${type}.md`),
    path.join(projectRoot, ".taskflow", `${type}.md`),
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf-8");
    } catch {
      continue;
    }
  }

  return undefined;
}

function safeGitDiff(projectRoot: string): string | undefined {
  try {
    const diff = execSync("git diff --stat HEAD~3", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 5_000,
    });
    return diff || undefined;
  } catch {
    return undefined;
  }
}

function truncateContext(context: AdvisorContext, maxTokens: number): AdvisorContext {
  let totalTokens = estimateTokens(JSON.stringify(context));

  if (totalTokens <= maxTokens) return context;

  if (context.conversationLogs && totalTokens > maxTokens) {
    context.conversationLogs = context.conversationLogs.slice(-20);
    totalTokens = estimateTokens(JSON.stringify(context));
  }

  if (context.gitDiff && totalTokens > maxTokens) {
    const lines = context.gitDiff.split("\n");
    context.gitDiff = lines.slice(-5).join("\n");
    totalTokens = estimateTokens(JSON.stringify(context));
  }

  if (context.trdContent && totalTokens > maxTokens) {
    context.trdContent = context.trdContent.slice(0, 2000) + "\n...(truncated)";
    totalTokens = estimateTokens(JSON.stringify(context));
  }

  if (context.prdContent && totalTokens > maxTokens) {
    context.prdContent = context.prdContent.slice(0, 2000) + "\n...(truncated)";
  }

  return context;
}
