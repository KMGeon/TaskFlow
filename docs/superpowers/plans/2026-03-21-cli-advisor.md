# CLI Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI AI advisor that helps users maintain task context and recommends next actions via `task status`, `task next` (upgrade), and `task ask` commands.

**Architecture:** Three-layer design — SQLite DB layer (`sql.js` in-memory with async disk persistence), context builder (keyword-based classification + data collection), and AI advisor (Claude SDK calls with command-specific prompts). Local summary runs without AI; AI enhances with insights.

**Tech Stack:** sql.js (WASM SQLite), @anthropic-ai/claude-agent-sdk, commander, chalk, ora, zod, vitest

**Spec:** `docs/superpowers/specs/2026-03-21-cli-advisor-design.md`

---

## File Structure

```
src/features/taskflow/
├── types.ts                              # MODIFY — add advisor types
├── constants.ts                          # MODIFY — add advisor DB path helper
├── lib/
│   └── advisor/                          # CREATE — new module
│       ├── db.ts                         # SQLite connection, schema, CRUD
│       ├── db.test.ts                    # DB layer tests
│       ├── local-summary.ts             # Local progress calculation
│       ├── local-summary.test.ts        # Local summary tests
│       ├── context-builder.ts           # Data collection + keyword classification
│       ├── context-builder.test.ts      # Context builder tests
│       ├── ai-advisor.ts               # AI prompt building + SDK calls
│       ├── ai-advisor.test.ts          # AI advisor tests (mocked SDK)
│       └── prompts.ts                   # System/user prompt templates

src/cli/commands/
├── status.ts                             # CREATE — task status command
├── ask.ts                                # CREATE — task ask command
├── advisor.ts                            # CREATE — task advisor --cleanup/--stats
├── next.ts                               # MODIFY — add AI advisor integration

src/cli/index.ts                          # MODIFY — register new commands
```

---

### Task 1: Install sql.js and add advisor constants

**Files:**
- Modify: `package.json`
- Modify: `src/features/taskflow/constants.ts`
- Modify: `src/features/taskflow/types.ts`

- [ ] **Step 1: Install sql.js**

```bash
pnpm add sql.js
```

- [ ] **Step 2: Add advisor path helper to constants.ts**

Add to `src/features/taskflow/constants.ts`:

```typescript
export const ADVISOR_DB_FILE = "advisor.db";

export function getAdvisorDbPath(projectRoot: string): string {
  return path.join(getTaskflowRoot(projectRoot), ADVISOR_DB_FILE);
}
```

- [ ] **Step 3: Add advisor types to types.ts**

Add to `src/features/taskflow/types.ts`:

```typescript
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
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/features/taskflow/constants.ts src/features/taskflow/types.ts
git commit -m "feat(advisor): install sql.js and add advisor types/constants"
```

---

### Task 2: SQLite DB layer

**Files:**
- Create: `src/features/taskflow/lib/advisor/db.ts`
- Create: `src/features/taskflow/lib/advisor/db.test.ts`

- [ ] **Step 1: Write failing tests for DB layer**

Create `src/features/taskflow/lib/advisor/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AdvisorDb } from "./db.js";

let tmpDir: string;
let db: AdvisorDb;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "advisor-db-"));
  db = await AdvisorDb.open(path.join(tmpDir, "advisor.db"));
});

afterEach(async () => {
  db.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("AdvisorDb", () => {
  describe("conversation_logs", () => {
    it("should insert and query conversation logs", async () => {
      db.insertLog("brainstorm", "session-1", "user", "hello");
      db.insertLog("brainstorm", "session-1", "assistant", "hi there");

      const logs = db.getLogsBySession("session-1");
      expect(logs).toHaveLength(2);
      expect(logs[0].role).toBe("user");
      expect(logs[0].content).toBe("hello");
      expect(logs[1].role).toBe("assistant");
    });

    it("should filter logs by session type", () => {
      db.insertLog("brainstorm", "s1", "user", "msg1");
      db.insertLog("ask", "s2", "user", "msg2");

      const brainstormLogs = db.getLogsByType("brainstorm");
      expect(brainstormLogs).toHaveLength(1);
      expect(brainstormLogs[0].sessionId).toBe("s1");
    });

    it("should delete logs older than N days", () => {
      db.insertLog("ask", "old", "user", "old message");
      // Manually backdate the record
      db.exec(
        "UPDATE conversation_logs SET created_at = datetime('now', '-10 days') WHERE session_id = 'old'"
      );
      db.insertLog("ask", "new", "user", "new message");

      const deleted = db.deleteExpiredLogs(7);
      expect(deleted).toBe(1);

      const remaining = db.getLogsByType("ask");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].sessionId).toBe("new");
    });
  });

  describe("decisions", () => {
    it("should insert and query decisions", () => {
      db.insertDecision("session-1", "Use sql.js", "No native deps", ["1", "2"]);

      const decisions = db.getAllDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0].decision).toBe("Use sql.js");
      expect(decisions[0].relatedTasks).toEqual(["1", "2"]);
    });

    it("should get recent decisions with limit", () => {
      db.insertDecision("s1", "Decision 1", "Reason 1", []);
      db.insertDecision("s2", "Decision 2", "Reason 2", []);
      db.insertDecision("s3", "Decision 3", "Reason 3", []);

      const recent = db.getRecentDecisions(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].decision).toBe("Decision 3"); // newest first
    });
  });

  describe("persistence", () => {
    it("should persist to disk and reload", async () => {
      const dbPath = path.join(tmpDir, "persist-test.db");
      const db1 = await AdvisorDb.open(dbPath);
      db1.insertDecision("s1", "Persisted decision", "reason", []);
      await db1.persistToDisk();
      db1.close();

      const db2 = await AdvisorDb.open(dbPath);
      const decisions = db2.getAllDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0].decision).toBe("Persisted decision");
      db2.close();
    });
  });

  describe("stats", () => {
    it("should return correct stats", () => {
      db.insertLog("ask", "s1", "user", "q1");
      db.insertLog("ask", "s1", "assistant", "a1");
      db.insertDecision("s1", "d1", "r1", []);

      const stats = db.getStats();
      expect(stats.logCount).toBe(2);
      expect(stats.decisionCount).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/taskflow/lib/advisor/db.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement db.ts**

Create `src/features/taskflow/lib/advisor/db.ts`:

```typescript
import initSqlJs, { type Database } from "sql.js";
import fs from "node:fs/promises";
import path from "node:path";
import type { ConvLog, Decision, SessionType } from "../../types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  related_tasks TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conv_session ON conversation_logs(session_type, session_id);
CREATE INDEX IF NOT EXISTS idx_conv_created ON conversation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id);
`;

export class AdvisorDb {
  private db: Database;
  private dbPath: string;

  private constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  static async open(dbPath: string): Promise<AdvisorDb> {
    const SQL = await initSqlJs();

    let db: Database;
    try {
      const buffer = await fs.readFile(dbPath);
      db = new SQL.Database(buffer);
    } catch {
      db = new SQL.Database();
    }

    db.run(SCHEMA);
    return new AdvisorDb(db, dbPath);
  }

  // --- Conversation Logs ---

  insertLog(
    sessionType: SessionType,
    sessionId: string,
    role: "user" | "assistant",
    content: string
  ): void {
    this.db.run(
      "INSERT INTO conversation_logs (session_type, session_id, role, content) VALUES (?, ?, ?, ?)",
      [sessionType, sessionId, role, content]
    );
  }

  getLogsBySession(sessionId: string): ConvLog[] {
    return this.queryLogs(
      "SELECT * FROM conversation_logs WHERE session_id = ? ORDER BY id ASC",
      [sessionId]
    );
  }

  getLogsByType(sessionType: SessionType): ConvLog[] {
    return this.queryLogs(
      "SELECT * FROM conversation_logs WHERE session_type = ? ORDER BY id ASC",
      [sessionType]
    );
  }

  deleteExpiredLogs(days: number): number {
    this.db.run(
      "DELETE FROM conversation_logs WHERE created_at < datetime('now', ? || ' days')",
      [`-${days}`]
    );
    return this.db.getRowsModified();
  }

  // --- Decisions ---

  insertDecision(
    sessionId: string,
    decision: string,
    reason: string,
    relatedTasks: string[]
  ): void {
    this.db.run(
      "INSERT INTO decisions (session_id, decision, reason, related_tasks) VALUES (?, ?, ?, ?)",
      [sessionId, decision, reason, JSON.stringify(relatedTasks)]
    );
  }

  getAllDecisions(): Decision[] {
    return this.queryDecisions(
      "SELECT * FROM decisions ORDER BY id DESC"
    );
  }

  getRecentDecisions(limit: number): Decision[] {
    return this.queryDecisions(
      "SELECT * FROM decisions ORDER BY id DESC LIMIT ?",
      [limit]
    );
  }

  // --- Stats ---

  getStats(): { logCount: number; decisionCount: number; dbSizeBytes: number } {
    const logRow = this.db.exec("SELECT COUNT(*) FROM conversation_logs");
    const decisionRow = this.db.exec("SELECT COUNT(*) FROM decisions");
    const data = this.db.export();

    return {
      logCount: Number(logRow[0]?.values[0]?.[0] ?? 0),
      decisionCount: Number(decisionRow[0]?.values[0]?.[0] ?? 0),
      dbSizeBytes: data.length,
    };
  }

  // --- Persistence ---

  async persistToDisk(): Promise<void> {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    await fs.writeFile(this.dbPath, buffer);
  }

  persistToDiskAsync(): void {
    this.persistToDisk().catch((err) => {
      console.error("⚠️ advisor.db 디스크 저장 실패:", err);
    });
  }

  // --- Utilities ---

  exec(sql: string): void {
    this.db.run(sql);
  }

  close(): void {
    this.db.close();
  }

  // --- Private ---

  private queryLogs(sql: string, params: unknown[] = []): ConvLog[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);

    const results: ConvLog[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: Number(row.id),
        sessionType: row.session_type as SessionType,
        sessionId: String(row.session_id),
        role: row.role as "user" | "assistant",
        content: String(row.content),
        createdAt: String(row.created_at),
      });
    }
    stmt.free();
    return results;
  }

  private queryDecisions(sql: string, params: unknown[] = []): Decision[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);

    const results: Decision[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: Number(row.id),
        sessionId: String(row.session_id),
        decision: String(row.decision),
        reason: String(row.reason),
        relatedTasks: JSON.parse(String(row.related_tasks)),
        createdAt: String(row.created_at),
      });
    }
    stmt.free();
    return results;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/taskflow/lib/advisor/db.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/taskflow/lib/advisor/db.ts src/features/taskflow/lib/advisor/db.test.ts
git commit -m "feat(advisor): implement SQLite DB layer with sql.js"
```

---

### Task 3: Local summary module

**Files:**
- Create: `src/features/taskflow/lib/advisor/local-summary.ts`
- Create: `src/features/taskflow/lib/advisor/local-summary.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/features/taskflow/lib/advisor/local-summary.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildLocalSummary, formatStatusOutput } from "./local-summary.js";
import type { Task } from "../../types.js";

const makeTasks = (): Task[] => [
  { id: "1", title: "Task A", status: "Done", priority: 5, dependencies: [], createdAt: "", updatedAt: "", description: "" },
  { id: "2", title: "Task B", status: "Done", priority: 4, dependencies: ["1"], createdAt: "", updatedAt: "", description: "" },
  { id: "3", title: "Task C", status: "InProgress", priority: 3, dependencies: [], createdAt: "", updatedAt: "", description: "" },
  { id: "4", title: "Task D", status: "Todo", priority: 2, dependencies: ["3"], createdAt: "", updatedAt: "", description: "" },
  { id: "5", title: "Task E", status: "Blocked", priority: 1, dependencies: [], createdAt: "", updatedAt: "", description: "" },
];

describe("buildLocalSummary", () => {
  it("should calculate correct progress", () => {
    const summary = buildLocalSummary(makeTasks());
    expect(summary.total).toBe(5);
    expect(summary.done).toBe(2);
    expect(summary.progressPercent).toBe(40);
  });

  it("should group tasks by status", () => {
    const summary = buildLocalSummary(makeTasks());
    expect(summary.groups.Done).toHaveLength(2);
    expect(summary.groups.InProgress).toHaveLength(1);
    expect(summary.groups.Todo).toHaveLength(1);
    expect(summary.groups.Blocked).toHaveLength(1);
  });

  it("should handle empty task list", () => {
    const summary = buildLocalSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.progressPercent).toBe(0);
  });
});

describe("formatStatusOutput", () => {
  it("should produce formatted output with all sections", () => {
    const summary = buildLocalSummary(makeTasks());
    const output = formatStatusOutput(summary);
    expect(output).toContain("2/5");
    expect(output).toContain("40%");
    expect(output).toContain("Done");
    expect(output).toContain("In Progress");
    expect(output).toContain("Todo");
    expect(output).toContain("Blocked");
  });

  it("should handle no tasks gracefully", () => {
    const summary = buildLocalSummary([]);
    const output = formatStatusOutput(summary);
    expect(output).toContain("0/0");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/taskflow/lib/advisor/local-summary.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement local-summary.ts**

Create `src/features/taskflow/lib/advisor/local-summary.ts`:

```typescript
import chalk from "chalk";
import type { Task, TaskStatus } from "../../types.js";

export interface LocalSummary {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  blocked: number;
  progressPercent: number;
  groups: Record<TaskStatus, Task[]>;
}

export function buildLocalSummary(tasks: Task[]): LocalSummary {
  const groups: Record<TaskStatus, Task[]> = {
    Done: [],
    InProgress: [],
    Todo: [],
    Blocked: [],
  };

  for (const task of tasks) {
    groups[task.status].push(task);
  }

  const total = tasks.length;
  const done = groups.Done.length;
  const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    total,
    done,
    inProgress: groups.InProgress.length,
    todo: groups.Todo.length,
    blocked: groups.Blocked.length,
    progressPercent,
    groups,
  };
}

const STATUS_DISPLAY: Record<TaskStatus, { icon: string; label: string; color: (s: string) => string }> = {
  Done:       { icon: "✅", label: "Done",        color: chalk.green },
  InProgress: { icon: "🔵", label: "In Progress", color: chalk.hex("#FFA500") },
  Todo:       { icon: "⬜", label: "Todo",        color: chalk.yellow },
  Blocked:    { icon: "🔴", label: "Blocked",     color: chalk.red },
};

const DISPLAY_ORDER: TaskStatus[] = ["Done", "InProgress", "Blocked", "Todo"];

export function formatStatusOutput(summary: LocalSummary): string {
  const lines: string[] = [];

  lines.push(
    chalk.bold(`📊 프로젝트 진행률: ${summary.done}/${summary.total} (${summary.progressPercent}%)`)
  );
  lines.push("");

  for (const status of DISPLAY_ORDER) {
    const tasks = summary.groups[status];
    if (tasks.length === 0) continue;

    const { icon, label, color } = STATUS_DISPLAY[status];
    lines.push(color(`${icon} ${label} (${tasks.length})`));

    for (const task of tasks) {
      lines.push(chalk.gray(`  ${task.id}. ${task.title}`));
    }
    lines.push("");
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/taskflow/lib/advisor/local-summary.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/taskflow/lib/advisor/local-summary.ts src/features/taskflow/lib/advisor/local-summary.test.ts
git commit -m "feat(advisor): implement local summary module"
```

---

### Task 4: Context builder module

**Files:**
- Create: `src/features/taskflow/lib/advisor/context-builder.ts`
- Create: `src/features/taskflow/lib/advisor/context-builder.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/features/taskflow/lib/advisor/context-builder.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { classifyQuestion, buildContext } from "./context-builder.js";
import { AdvisorDb } from "./db.js";
import { createTask, ensureRepo } from "../repository.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ctx-builder-"));
  await ensureRepo(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("classifyQuestion", () => {
  it("should detect code-related keywords", () => {
    const result = classifyQuestion("최근 코드 변경사항 알려줘");
    expect(result.needsGitDiff).toBe(true);
  });

  it("should detect decision-related keywords", () => {
    const result = classifyQuestion("왜 인증을 빼기로 결정했어?");
    expect(result.needsConversationLogs).toBe(true);
  });

  it("should detect planning keywords", () => {
    const result = classifyQuestion("전체 목표가 뭐야?");
    expect(result.needsTrdPrd).toBe(true);
  });

  it("should return defaults for generic questions", () => {
    const result = classifyQuestion("다음 뭐 해?");
    expect(result.needsGitDiff).toBe(false);
    expect(result.needsConversationLogs).toBe(false);
    expect(result.needsTrdPrd).toBe(false);
  });
});

describe("buildContext", () => {
  it("should always include tasks and decisions for status command", async () => {
    await createTask(tmpDir, { title: "Test task" });
    const db = await AdvisorDb.open(path.join(tmpDir, ".taskflow", "advisor.db"));
    db.insertDecision("s1", "test decision", "reason", []);

    const ctx = await buildContext({ command: "status", projectRoot: tmpDir, db });
    expect(ctx.tasks.length).toBeGreaterThan(0);
    expect(ctx.decisions.length).toBeGreaterThan(0);
    expect(ctx.gitDiff).toBeUndefined();

    db.close();
  });

  it("should include TRD/PRD for next command", async () => {
    await createTask(tmpDir, { title: "Test task" });
    const db = await AdvisorDb.open(path.join(tmpDir, ".taskflow", "advisor.db"));

    const ctx = await buildContext({ command: "next", projectRoot: tmpDir, db });
    expect(ctx.tasks.length).toBeGreaterThan(0);
    // trdContent/prdContent may be undefined if files don't exist — that's expected

    db.close();
  });
});

describe("estimateTokens", () => {
  it("should approximate tokens from character count", async () => {
    const { estimateTokens } = await import("./context-builder.js");
    expect(estimateTokens("hello world")).toBe(3); // 11 chars / 4 = 2.75 → 3
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/taskflow/lib/advisor/context-builder.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement context-builder.ts**

Create `src/features/taskflow/lib/advisor/context-builder.ts`:

```typescript
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { AdvisorContext, TaskSummary } from "../../types.js";
import { listTasks } from "../repository.js";
import type { AdvisorDb } from "./db.js";

// Token budget per command (in estimated tokens)
const TOKEN_BUDGET = {
  status: 4_000,
  next: 8_000,
  ask: 12_000,
} as const;

// Keyword sets for question classification
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

  // Always: tasks + decisions
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

  // For status, that's enough
  if (command === "status") return context;

  // For next, include TRD/PRD
  if (command === "next") {
    context.trdContent = await safeReadTrdPrd(projectRoot, "trd");
    context.prdContent = await safeReadTrdPrd(projectRoot, "prd");
    return truncateContext(context, budget);
  }

  // For ask, classify and collect
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
        .slice(-50); // last 50 entries max
    }

    return truncateContext(context, budget);
  }

  return context;
}

// --- Helpers ---

async function safeReadTrdPrd(projectRoot: string, type: "trd" | "prd"): Promise<string | undefined> {
  // Check vooster-docs first, then .taskflow
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

  // Truncation priority: conversationLogs > gitDiff > trdContent > prdContent
  if (context.conversationLogs && totalTokens > maxTokens) {
    context.conversationLogs = context.conversationLogs.slice(-20);
    totalTokens = estimateTokens(JSON.stringify(context));
  }

  if (context.gitDiff && totalTokens > maxTokens) {
    // Reduce to file list only
    const lines = context.gitDiff.split("\n");
    context.gitDiff = lines.slice(-5).join("\n"); // summary lines only
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/taskflow/lib/advisor/context-builder.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/taskflow/lib/advisor/context-builder.ts src/features/taskflow/lib/advisor/context-builder.test.ts
git commit -m "feat(advisor): implement context builder with keyword classification"
```

---

### Task 5: AI advisor module (prompts + SDK calls)

**Files:**
- Create: `src/features/taskflow/lib/advisor/prompts.ts`
- Create: `src/features/taskflow/lib/advisor/ai-advisor.ts`
- Create: `src/features/taskflow/lib/advisor/ai-advisor.test.ts`

- [ ] **Step 1: Create prompt templates**

Create `src/features/taskflow/lib/advisor/prompts.ts`:

```typescript
import type { AdvisorContext } from "../../types.js";
import type { LocalSummary } from "./local-summary.js";

export function buildStatusPrompt(context: AdvisorContext, summary: LocalSummary): string {
  return `너는 프로젝트 비서야. 현황을 보고 한 줄 인사이트를 줘.

## 현재 진행률
- 전체: ${summary.total}개
- 완료: ${summary.done}개 (${summary.progressPercent}%)
- 진행중: ${summary.inProgress}개
- 대기: ${summary.todo}개
- 차단: ${summary.blocked}개

## 태스크 목록
${formatTaskList(context)}

## 최근 결정 사항
${formatDecisions(context)}

## 요청
한 줄로 현재 상황에 대한 인사이트를 줘. "💡 " 로 시작해. 한국어로 답변해.`;
}

export function buildNextPrompt(context: AdvisorContext): string {
  return `너는 프로젝트 비서야. 다음에 할 태스크를 추천해.

## 전체 태스크 목록
${formatTaskList(context)}

## 최근 결정 사항
${formatDecisions(context)}

${context.trdContent ? `## TRD (구현 계획)\n${context.trdContent}\n` : ""}
${context.prdContent ? `## PRD (제품 요구사항)\n${context.prdContent}\n` : ""}

## 요청
다음에 할 태스크 1개를 추천해. 아래 형식으로 답변해:

👉 추천: #ID 태스크 제목
   이유: (왜 이것을 다음에 해야 하는지)
   의존: (선행 태스크가 있다면)

한국어로 답변해. 짧게.`;
}

export function buildAskPrompt(context: AdvisorContext, question: string): string {
  return `너는 프로젝트 비서야. 질문에 맞게 답변해.
짧은 질문이면 짧게, 현황 질문이면 브리핑 형태로.

## 태스크 목록
${formatTaskList(context)}

## 최근 결정 사항
${formatDecisions(context)}

${context.trdContent ? `## TRD\n${context.trdContent}\n` : ""}
${context.prdContent ? `## PRD\n${context.prdContent}\n` : ""}
${context.gitDiff ? `## 최근 코드 변경\n${context.gitDiff}\n` : ""}
${context.conversationLogs ? `## 관련 대화 로그\n${formatConvLogs(context)}\n` : ""}

## 질문
${question}

한국어로 답변해.`;
}

// --- Formatters ---

function formatTaskList(context: AdvisorContext): string {
  if (context.tasks.length === 0) return "(태스크 없음)";
  return context.tasks
    .map((t) => `- [${t.status}] #${t.id} ${t.title} (우선순위: ${t.priority}, 의존: ${t.dependencies.join(", ") || "없음"})`)
    .join("\n");
}

function formatDecisions(context: AdvisorContext): string {
  if (context.decisions.length === 0) return "(결정 기록 없음)";
  return context.decisions
    .map((d) => `- ${d.decision} (이유: ${d.reason})`)
    .join("\n");
}

function formatConvLogs(context: AdvisorContext): string {
  if (!context.conversationLogs || context.conversationLogs.length === 0) return "";
  return context.conversationLogs
    .map((l) => `[${l.role}] ${l.content}`)
    .join("\n");
}
```

- [ ] **Step 2: Write failing tests for ai-advisor**

Create `src/features/taskflow/lib/advisor/ai-advisor.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { getInsight, getRecommendation, getAnswer } from "./ai-advisor.js";
import type { AdvisorContext } from "../../types.js";
import type { LocalSummary } from "./local-summary.js";

// Mock the existing AI client (not the SDK directly)
vi.mock("@/core/ai/client", () => ({
  askClaudeWithRetry: vi.fn(async () => ({
    text: "💡 테스트 인사이트 입니다.",
  })),
}));

const mockContext: AdvisorContext = {
  tasks: [
    { id: "1", title: "Task A", status: "Done", priority: 5, dependencies: [] },
    { id: "2", title: "Task B", status: "Todo", priority: 3, dependencies: ["1"] },
  ],
  decisions: [],
};

const mockSummary: LocalSummary = {
  total: 2,
  done: 1,
  inProgress: 0,
  todo: 1,
  blocked: 0,
  progressPercent: 50,
  groups: { Done: [], InProgress: [], Todo: [], Blocked: [] },
};

describe("getInsight", () => {
  it("should return AI-generated insight string", async () => {
    const result = await getInsight(mockContext, mockSummary);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getRecommendation", () => {
  it("should return AI-generated recommendation string", async () => {
    const result = await getRecommendation(mockContext);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getAnswer", () => {
  it("should return AI-generated answer string", async () => {
    const result = await getAnswer(mockContext, "다음 뭐 해?");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/features/taskflow/lib/advisor/ai-advisor.test.ts
```

Expected: FAIL

- [ ] **Step 4: Implement ai-advisor.ts**

Create `src/features/taskflow/lib/advisor/ai-advisor.ts`:

```typescript
import { askClaudeWithRetry } from "@/core/ai/client";
import type { AdvisorContext } from "../../types.js";
import type { LocalSummary } from "./local-summary.js";
import { buildStatusPrompt, buildNextPrompt, buildAskPrompt } from "./prompts.js";

const ADVISOR_SYSTEM_PROMPT = "너는 개발 프로젝트의 AI 비서야. 태스크 현황을 파악하고, 다음 작업을 추천하고, 프로젝트에 대한 질문에 답변해. 항상 한국어로 답변해.";

export async function getInsight(
  context: AdvisorContext,
  summary: LocalSummary
): Promise<string> {
  const prompt = buildStatusPrompt(context, summary);
  const response = await askClaudeWithRetry({
    prompt,
    systemPrompt: ADVISOR_SYSTEM_PROMPT,
  });
  return response.text.trim();
}

export async function getRecommendation(context: AdvisorContext): Promise<string> {
  const prompt = buildNextPrompt(context);
  const response = await askClaudeWithRetry({
    prompt,
    systemPrompt: ADVISOR_SYSTEM_PROMPT,
  });
  return response.text.trim();
}

export async function getAnswer(
  context: AdvisorContext,
  question: string
): Promise<string> {
  const prompt = buildAskPrompt(context, question);
  const response = await askClaudeWithRetry({
    prompt,
    systemPrompt: ADVISOR_SYSTEM_PROMPT,
  });
  return response.text.trim();
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/features/taskflow/lib/advisor/ai-advisor.test.ts
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/taskflow/lib/advisor/prompts.ts src/features/taskflow/lib/advisor/ai-advisor.ts src/features/taskflow/lib/advisor/ai-advisor.test.ts
git commit -m "feat(advisor): implement AI advisor with prompt templates"
```

---

### Task 6: `task status` CLI command

**Files:**
- Create: `src/cli/commands/status.ts`
- Modify: `src/cli/index.ts`

- [ ] **Step 1: Implement status.ts**

Create `src/cli/commands/status.ts`:

```typescript
import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { listTasks, ensureRepo } from "@/features/taskflow/lib/repository";
import { getAdvisorDbPath } from "@/features/taskflow/constants";
import { AdvisorDb } from "@/features/taskflow/lib/advisor/db";
import { buildLocalSummary, formatStatusOutput } from "@/features/taskflow/lib/advisor/local-summary";
import { buildContext } from "@/features/taskflow/lib/advisor/context-builder";
import { getInsight } from "@/features/taskflow/lib/advisor/ai-advisor";

export function registerStatusCommand(program: Command) {
  program
    .command("status")
    .description("프로젝트 진행률과 AI 인사이트를 표시합니다")
    .option("--no-ai", "AI 인사이트 없이 로컬 진행률만 표시")
    .action(
      withCliErrorBoundary(async (opts: { ai?: boolean }) => {
        const projectRoot = process.cwd();
        await ensureRepo(projectRoot);

        const tasks = await listTasks(projectRoot);
        if (tasks.length === 0) {
          console.log(chalk.yellow("태스크가 없습니다. `task parse-prd`로 시작하세요."));
          return;
        }

        const summary = buildLocalSummary(tasks);
        console.log(formatStatusOutput(summary));

        // AI insight (skip if --no-ai)
        if (opts.ai === false) return;

        const spinner = ora("인사이트 생성 중...").start();
        try {
          const db = await AdvisorDb.open(getAdvisorDbPath(projectRoot));
          const context = await buildContext({ command: "status", projectRoot, db });
          const insight = await getInsight(context, summary);
          db.persistToDiskAsync();
          db.close();

          spinner.stop();
          console.log(insight);
        } catch {
          spinner.stop();
          console.log(chalk.gray("💡 인사이트 생성 실패 — 로컬 진행률만 표시합니다."));
        }
      })
    );
}
```

- [ ] **Step 2: Register in index.ts**

Add to `src/cli/index.ts`:

```typescript
import { registerStatusCommand } from "./commands/status.js";
```

And in the command registration section:

```typescript
registerStatusCommand(program);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Manual test**

```bash
pnpm task -- status --no-ai
```

Expected: shows progress output (or "태스크가 없습니다" message if no tasks)

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/status.ts src/cli/index.ts
git commit -m "feat(advisor): add task status CLI command"
```

---

### Task 7: `task ask` CLI command

**Files:**
- Create: `src/cli/commands/ask.ts`
- Modify: `src/cli/index.ts`

- [ ] **Step 1: Implement ask.ts**

Create `src/cli/commands/ask.ts`:

```typescript
import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { ensureRepo } from "@/features/taskflow/lib/repository";
import { getAdvisorDbPath } from "@/features/taskflow/constants";
import { AdvisorDb } from "@/features/taskflow/lib/advisor/db";
import { buildContext } from "@/features/taskflow/lib/advisor/context-builder";
import { getAnswer } from "@/features/taskflow/lib/advisor/ai-advisor";

export function registerAskCommand(program: Command) {
  program
    .command("ask")
    .description("AI 비서에게 프로젝트에 대해 자유롭게 질문합니다")
    .argument("<question>", "질문 내용")
    .action(
      withCliErrorBoundary(async (question: string) => {
        const projectRoot = process.cwd();
        await ensureRepo(projectRoot);

        const spinner = ora("답변 생성 중...").start();

        try {
          const db = await AdvisorDb.open(getAdvisorDbPath(projectRoot));
          const context = await buildContext({
            command: "ask",
            projectRoot,
            db,
            question,
          });

          const answer = await getAnswer(context, question);

          // Save Q&A to conversation logs
          const sessionId = `ask-${Date.now()}`;
          db.insertLog("ask", sessionId, "user", question);
          db.insertLog("ask", sessionId, "assistant", answer);
          db.persistToDiskAsync();
          db.close();

          spinner.stop();
          console.log("");
          console.log(answer);
          console.log("");
        } catch {
          spinner.stop();
          console.log(chalk.red("AI 연결 실패. 잠시 후 다시 시도해주세요."));
        }
      })
    );
}
```

- [ ] **Step 2: Register in index.ts**

Add to `src/cli/index.ts`:

```typescript
import { registerAskCommand } from "./commands/ask.js";
```

And in the command registration section:

```typescript
registerAskCommand(program);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/ask.ts src/cli/index.ts
git commit -m "feat(advisor): add task ask CLI command"
```

---

### Task 8: Upgrade `task next` with AI advisor + fallback

**Files:**
- Modify: `src/cli/commands/next.ts`

- [ ] **Step 1: Read current next.ts to understand existing logic**

Read `src/cli/commands/next.ts` fully before modifying.

- [ ] **Step 2: Add AI advisor integration with fallback**

Modify `src/cli/commands/next.ts` — add AI path that falls back to existing `recommend()`:

```typescript
// Add these imports at the top:
import { getAdvisorDbPath } from "@/features/taskflow/constants";
import { AdvisorDb } from "@/features/taskflow/lib/advisor/db";
import { buildContext } from "@/features/taskflow/lib/advisor/context-builder";
import { getRecommendation } from "@/features/taskflow/lib/advisor/ai-advisor";

// Inside the action handler, before the existing recommend() call:
// Use AI recommendation only when no specific flags are set (default usage)
// When flags like --json, --all, --include-blocked are used, keep existing local scoring
const hasFlags = opts.json || opts.all || opts.includeBlocked || opts.limit;

if (!hasFlags) {
  const spinner = ora("추천 생성 중...").start();
  try {
    const db = await AdvisorDb.open(getAdvisorDbPath(projectRoot));
    const context = await buildContext({ command: "next", projectRoot, db });
    const aiRecommendation = await getRecommendation(context);
    db.persistToDiskAsync();
    db.close();

    spinner.stop();
    console.log(aiRecommendation);
    return;
  } catch {
    spinner.stop();
    // AI failed — fall through to existing local recommend()
  }
}

// ... existing recommend() logic stays as-is below (handles all flags)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/next.ts
git commit -m "feat(advisor): upgrade task next with AI recommendation + local fallback"
```

---

### Task 9: `task advisor` utility command

**Files:**
- Create: `src/cli/commands/advisor.ts`
- Modify: `src/cli/index.ts`

- [ ] **Step 1: Implement advisor.ts**

Create `src/cli/commands/advisor.ts`:

```typescript
import type { Command } from "commander";
import chalk from "chalk";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { ensureRepo } from "@/features/taskflow/lib/repository";
import { getAdvisorDbPath } from "@/features/taskflow/constants";
import { AdvisorDb } from "@/features/taskflow/lib/advisor/db";

export function registerAdvisorCommand(program: Command) {
  program
    .command("advisor")
    .description("AI 비서 관리 유틸리티")
    .option("--cleanup", "만료된 대화 로그를 삭제합니다 (기본: 7일)")
    .option("--days <n>", "로그 보관 기간 (일)", parseInt, 7)
    .option("--stats", "DB 통계를 표시합니다")
    .action(
      withCliErrorBoundary(async (opts: { cleanup?: boolean; days: number; stats?: boolean }) => {
        const projectRoot = process.cwd();
        await ensureRepo(projectRoot);

        const db = await AdvisorDb.open(getAdvisorDbPath(projectRoot));

        if (opts.cleanup) {
          const deleted = db.deleteExpiredLogs(opts.days);
          await db.persistToDisk();
          console.log(chalk.green(`✔ ${deleted}개의 만료된 로그를 삭제했습니다.`));
        }

        if (opts.stats) {
          const stats = db.getStats();
          console.log("");
          console.log(chalk.bold("📊 Advisor DB 통계"));
          console.log(`  대화 로그: ${stats.logCount}개`);
          console.log(`  결정 기록: ${stats.decisionCount}개`);
          console.log(`  DB 크기: ${(stats.dbSizeBytes / 1024).toFixed(1)} KB`);
          console.log("");
        }

        if (!opts.cleanup && !opts.stats) {
          console.log(chalk.yellow("옵션을 지정해주세요. --help로 사용법을 확인하세요."));
        }

        db.close();
      })
    );
}
```

- [ ] **Step 2: Register in index.ts**

Add to `src/cli/index.ts`:

```typescript
import { registerAdvisorCommand } from "./commands/advisor.js";
```

And in the command registration section:

```typescript
registerAdvisorCommand(program);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/advisor.ts src/cli/index.ts
git commit -m "feat(advisor): add task advisor utility command (--cleanup, --stats)"
```

---

### Task 10: Integration test — full advisor flow

**Files:**
- Create: `src/features/taskflow/lib/advisor/__tests__/advisor-integration.test.ts`

- [ ] **Step 1: Write integration test**

Create `src/features/taskflow/lib/advisor/__tests__/advisor-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AdvisorDb } from "../db.js";
import { buildLocalSummary, formatStatusOutput } from "../local-summary.js";
import { buildContext, classifyQuestion } from "../context-builder.js";
import { createTask, ensureRepo } from "../../repository.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "advisor-integ-"));
  await ensureRepo(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("Advisor Integration", () => {
  it("should build local summary from real tasks", async () => {
    await createTask(tmpDir, { title: "Task 1", status: "Done" });
    await createTask(tmpDir, { title: "Task 2", status: "Todo" });
    await createTask(tmpDir, { title: "Task 3", status: "InProgress" });

    const { listTasks } = await import("../../repository.js");
    const tasks = await listTasks(tmpDir);
    const summary = buildLocalSummary(tasks);

    expect(summary.total).toBe(3);
    expect(summary.done).toBe(1);
    expect(summary.progressPercent).toBe(33);
  });

  it("should build context with DB decisions", async () => {
    await createTask(tmpDir, { title: "Test Task" });

    const dbPath = path.join(tmpDir, ".taskflow", "advisor.db");
    const db = await AdvisorDb.open(dbPath);
    db.insertDecision("s1", "Test decision", "Test reason", ["1"]);

    const context = await buildContext({
      command: "status",
      projectRoot: tmpDir,
      db,
    });

    expect(context.tasks.length).toBe(1);
    expect(context.decisions.length).toBe(1);
    expect(context.decisions[0].decision).toBe("Test decision");

    db.close();
  });

  it("should persist DB, reload, and retain data", async () => {
    const dbPath = path.join(tmpDir, ".taskflow", "advisor.db");

    const db1 = await AdvisorDb.open(dbPath);
    db1.insertLog("ask", "s1", "user", "테스트 질문");
    db1.insertDecision("s1", "테스트 결정", "이유", []);
    await db1.persistToDisk();
    db1.close();

    const db2 = await AdvisorDb.open(dbPath);
    expect(db2.getLogsBySession("s1")).toHaveLength(1);
    expect(db2.getAllDecisions()).toHaveLength(1);
    db2.close();
  });

  it("should format status output correctly", async () => {
    await createTask(tmpDir, { title: "Done task", status: "Done" });
    await createTask(tmpDir, { title: "Todo task", status: "Todo" });

    const { listTasks } = await import("../../repository.js");
    const tasks = await listTasks(tmpDir);
    const summary = buildLocalSummary(tasks);
    const output = formatStatusOutput(summary);

    expect(output).toContain("1/2");
    expect(output).toContain("50%");
  });

  it("should classify questions correctly in context building", async () => {
    await createTask(tmpDir, { title: "Test" });
    const dbPath = path.join(tmpDir, ".taskflow", "advisor.db");
    const db = await AdvisorDb.open(dbPath);

    const ctx = await buildContext({
      command: "ask",
      projectRoot: tmpDir,
      db,
      question: "최근 코드 변경 뭐 있어?",
    });

    // Should have attempted to collect git diff (may be undefined if not a git repo)
    expect(ctx.tasks.length).toBe(1);

    db.close();
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npx vitest run src/features/taskflow/lib/advisor/__tests__/advisor-integration.test.ts
```

Expected: all tests PASS

- [ ] **Step 3: Run all advisor tests together**

```bash
npx vitest run src/features/taskflow/lib/advisor/
```

Expected: all tests PASS

- [ ] **Step 4: Run full project test suite**

```bash
npx vitest run
```

Expected: no regressions

- [ ] **Step 5: Commit**

```bash
git add src/features/taskflow/lib/advisor/__tests__/advisor-integration.test.ts
git commit -m "test(advisor): add integration tests for full advisor flow"
```

---

### Task 11: Final verification and typecheck

**Files:** None (verification only)

- [ ] **Step 1: TypeScript full check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all pass

- [ ] **Step 3: Manual smoke test — task status**

```bash
pnpm task -- status --no-ai
```

Expected: progress output or "no tasks" message

- [ ] **Step 4: Manual smoke test — task advisor --stats**

```bash
pnpm task -- advisor --stats
```

Expected: DB stats output

- [ ] **Step 5: Commit any remaining fixes**

If fixes needed, commit with appropriate message. Otherwise, skip.
