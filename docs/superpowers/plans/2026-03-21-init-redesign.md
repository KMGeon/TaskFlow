# Init Redesign — MCP-First Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `task init` to include Claude Code integration (MCP server + CLAUDE.md) and PRD generation (AI brainstorming + auto-analysis), while extracting business logic into a shared `src/core/` layer.

**Architecture:** MCP-First — all business logic lives in `src/core/` with no CLI dependencies. Three surfaces (CLI, MCP, Hono) import from core. MCP server uses `@modelcontextprotocol/sdk` with stdio transport. AI uses `@anthropic-ai/claude-agent-sdk` with Claude Max only (no API keys).

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `@anthropic-ai/claude-agent-sdk`, Commander.js, Zod, gray-matter

**Spec:** `docs/superpowers/specs/2026-03-21-init-redesign-design.md`

---

## File Structure

### New files to create

```
src/core/
├── types.ts                     # Shared types (PrdResult, BrainstormSession, etc.)
├── project/
│   ├── init.ts                  # initProject() — create .taskflow + config
│   ├── config.ts                # readConfig(), writeConfig()
│   └── claude-setup.ts          # generateClaudeMd(), generateMcpJson(), appendClaudeImport()
├── prd/
│   ├── generator.ts             # startBrainstorm(), continueBrainstorm(), buildPrdMarkdown()
│   ├── feature-generator.ts     # generateFeaturePrd()
│   └── auto-analyzer.ts         # runAutoAnalysis() — extracted from cli/flows/auto.ts
├── ai/
│   └── client.ts                # askClaude(), brainstormTask()
└── task/                        # Re-exports from features/taskflow (Phase 1: alias, Phase 2: move)

src/mcp/
├── index.ts                     # stdio transport bootstrap
├── server.ts                    # McpServer instance + tool registration
├── util.ts                      # resolveProjectRoot() helper
└── tools/
    ├── project.ts               # initialize_project, generate_claude_md
    ├── prd.ts                   # generate_prd, brainstorm_prd, auto_analyze_prd, generate_feature_prd
    ├── task.ts                  # list_tasks, read_task, create_task, update_task, delete_task
    ├── task-status.ts           # set_task_status, get_next_task
    ├── parse.ts                 # parse_prd
    ├── brainstorm.ts            # brainstorm_task, expand_subtasks
    └── refine.ts                # refine_tasks

bin/task-mcp.mjs                 # MCP server entry point
```

### Files to modify

```
src/cli/commands/init.ts         # Rewrite: full init flow with PRD generation
src/cli/index.ts                 # Remove prd command registration
src/cli/flows/prd-flow.ts        # Rewrite: delegate to core
package.json                     # Add @modelcontextprotocol/sdk, add bin entry
```

### Files to delete (after migration)

```
src/cli/commands/prd.ts          # Removed — PRD generation merged into init
```

---

## Task 1: Install dependencies and create core types

**Files:**
- Modify: `package.json`
- Create: `src/core/types.ts`

- [ ] **Step 1: Install `@modelcontextprotocol/sdk`**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npm install @modelcontextprotocol/sdk`
Expected: Package added to dependencies

- [ ] **Step 2: Create `src/core/types.ts`**

```typescript
// src/core/types.ts
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
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to new file

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/core/types.ts
git commit -m "feat: add core types and install @modelcontextprotocol/sdk"
```

---

## Task 2: Create AI client (Claude Max only)

**Files:**
- Create: `src/core/ai/client.ts`
- Test: `src/core/ai/__tests__/client.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/core/ai/__tests__/client.test.ts
import { describe, it, expect, vi } from "vitest";

// We can only unit-test the request/response shape, not the actual AI call
// since it requires Claude Max authentication
describe("askClaude", () => {
  it("should be importable and have correct signature", async () => {
    const { askClaude } = await import("../client.js");
    expect(typeof askClaude).toBe("function");
  });
});

describe("brainstormTask", () => {
  it("should be importable and have correct signature", async () => {
    const { brainstormTask } = await import("../client.js");
    expect(typeof brainstormTask).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx vitest run src/core/ai/__tests__/client.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/core/ai/client.ts`**

```typescript
// src/core/ai/client.ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { TaskBrainstormResult } from "../types.js";

export interface AiRequest {
  prompt: string;
  systemPrompt: string;
  maxTurns?: number;
}

export interface AiResponse {
  text: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function askClaude(req: AiRequest): Promise<AiResponse> {
  const conversation = query({
    prompt: req.prompt,
    options: {
      model: DEFAULT_MODEL,
      systemPrompt: req.systemPrompt,
      maxTurns: req.maxTurns ?? 1,
      tools: [],
      permissionMode: "plan",
    },
  });

  let result = "";

  for await (const message of conversation) {
    if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content) {
        if (block.type === "text") {
          result += block.text;
        }
      }
    }
  }

  if (!result.trim()) {
    throw new Error("AI 응답이 비어있습니다.");
  }

  return { text: result };
}

const RETRY_BASE_MS = 1_000;
const MAX_RETRIES = 3;

export async function askClaudeWithRetry(req: AiRequest): Promise<AiResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await askClaude(req);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export async function brainstormTask(
  projectRoot: string,
  taskId: string,
  taskContent: string,
  depth: number = 1,
): Promise<TaskBrainstormResult> {
  const systemPrompt = `당신은 소프트웨어 태스크 분해 전문가입니다.
주어진 태스크를 실행 가능한 서브태스크로 분해하세요.

규칙:
- 각 서브태스크는 독립적으로 실행 가능해야 합니다.
- 우선순위는 0(낮음)~10(높음)으로 지정하세요.
- 의존성이 있으면 다른 서브태스크의 tempId를 참조하세요.
- JSON 형식으로만 응답하세요.

응답 형식:
{
  "subtasks": [
    { "title": "...", "description": "...", "priority": 5, "dependencies": [], "estimate": "1h" }
  ],
  "rationale": "분해 근거"
}`;

  const response = await askClaudeWithRetry({
    prompt: `다음 태스크를 서브태스크로 분해해주세요 (깊이: ${depth}):\n\n${taskContent}`,
    systemPrompt,
  });

  try {
    const parsed = JSON.parse(response.text);
    return parsed as TaskBrainstormResult;
  } catch {
    // AI가 JSON 외의 텍스트를 포함한 경우, JSON 부분만 추출
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as TaskBrainstormResult;
    }
    throw new Error("AI 응답을 파싱할 수 없습니다.");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx vitest run src/core/ai/__tests__/client.test.ts 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/ai/
git commit -m "feat: add core AI client with Claude Max integration"
```

---

## Task 3: Create project init core logic

**Files:**
- Create: `src/core/project/init.ts`
- Create: `src/core/project/config.ts`
- Test: `src/core/project/__tests__/init.test.ts`
- Test: `src/core/project/__tests__/config.test.ts`

- [ ] **Step 1: Write tests for config**

```typescript
// src/core/project/__tests__/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readConfig, writeConfig, DEFAULT_CONFIG } from "../config.js";

describe("config", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "taskflow-test-"));
    await fs.mkdir(path.join(tmpDir, ".taskflow"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should return default config when file does not exist", async () => {
    const config = await readConfig(tmpDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("should write and read config", async () => {
    const config = { ...DEFAULT_CONFIG, project: { ...DEFAULT_CONFIG.project, name: "test" } };
    await writeConfig(tmpDir, config);
    const result = await readConfig(tmpDir);
    expect(result.project.name).toBe("test");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx vitest run src/core/project/__tests__/config.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: Create `src/core/project/config.ts`**

```typescript
// src/core/project/config.ts
import fs from "node:fs/promises";
import path from "node:path";
import type { TaskFlowConfig } from "../types.js";

const CONFIG_FILE = "config.json";
const TASKFLOW_DIR = ".taskflow";

export const DEFAULT_CONFIG: TaskFlowConfig = {
  version: "1.0",
  project: {
    name: "",
  },
  tasks: {
    statusFlow: ["pending", "in-progress", "blocked", "done"],
  },
};

export async function readConfig(projectRoot: string): Promise<TaskFlowConfig> {
  const configPath = path.join(projectRoot, TASKFLOW_DIR, CONFIG_FILE);
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    return JSON.parse(raw) as TaskFlowConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeConfig(
  projectRoot: string,
  config: TaskFlowConfig,
): Promise<void> {
  const configPath = path.join(projectRoot, TASKFLOW_DIR, CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
```

- [ ] **Step 4: Run config test**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx vitest run src/core/project/__tests__/config.test.ts 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 5: Write tests for init**

```typescript
// src/core/project/__tests__/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initProject } from "../init.js";

describe("initProject", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "taskflow-init-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create .taskflow directory and config.json", async () => {
    const result = await initProject(tmpDir);
    expect(result.created).toBe(true);

    const stat = await fs.stat(path.join(tmpDir, ".taskflow"));
    expect(stat.isDirectory()).toBe(true);

    const config = await fs.readFile(path.join(tmpDir, ".taskflow/config.json"), "utf-8");
    expect(JSON.parse(config).version).toBe("1.0");
  });

  it("should return created=false when .taskflow already exists", async () => {
    await fs.mkdir(path.join(tmpDir, ".taskflow"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, ".taskflow/config.json"), "{}");

    const result = await initProject(tmpDir);
    expect(result.created).toBe(false);
    expect(result.alreadyExists).toBe(true);
  });
});
```

- [ ] **Step 6: Create `src/core/project/init.ts`**

```typescript
// src/core/project/init.ts
import fs from "node:fs/promises";
import path from "node:path";
import { writeConfig, DEFAULT_CONFIG } from "./config.js";

const TASKFLOW_DIR = ".taskflow";

export interface InitResult {
  created: boolean;
  alreadyExists: boolean;
  projectRoot: string;
}

export async function initProject(projectRoot: string, projectName?: string): Promise<InitResult> {
  const taskflowDir = path.join(projectRoot, TASKFLOW_DIR);

  let alreadyExists = false;
  try {
    await fs.access(taskflowDir);
    alreadyExists = true;
  } catch {
    // directory does not exist — proceed with creation
  }

  if (alreadyExists) {
    return { created: false, alreadyExists: true, projectRoot };
  }

  // Create directory structure
  await fs.mkdir(path.join(taskflowDir, "tasks"), { recursive: true });
  await fs.mkdir(path.join(taskflowDir, "index"), { recursive: true });
  await fs.mkdir(path.join(taskflowDir, "logs"), { recursive: true });
  await fs.mkdir(path.join(taskflowDir, "cache"), { recursive: true });

  // Write default config
  const config = {
    ...DEFAULT_CONFIG,
    project: {
      ...DEFAULT_CONFIG.project,
      name: projectName ?? "",
    },
  };
  await writeConfig(projectRoot, config);

  return { created: true, alreadyExists: false, projectRoot };
}
```

- [ ] **Step 7: Run init test**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx vitest run src/core/project/__tests__/init.test.ts 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/project/
git commit -m "feat: add core project init and config"
```

---

## Task 4: Create Claude setup (CLAUDE.md + .mcp.json generation)

**Files:**
- Create: `src/core/project/claude-setup.ts`
- Test: `src/core/project/__tests__/claude-setup.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/core/project/__tests__/claude-setup.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  generateClaudeMd,
  generateMcpJson,
  appendClaudeImport,
} from "../claude-setup.js";

describe("generateClaudeMd", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "claude-setup-"));
    await fs.mkdir(path.join(tmpDir, ".taskflow"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should generate .taskflow/CLAUDE.md with project info", async () => {
    await generateClaudeMd(tmpDir, {
      projectName: "TestProject",
      summary: "A test project",
      stack: ["TypeScript", "Next.js"],
    });

    const content = await fs.readFile(path.join(tmpDir, ".taskflow/CLAUDE.md"), "utf-8");
    expect(content).toContain("TestProject");
    expect(content).toContain("A test project");
    expect(content).toContain("TypeScript");
    expect(content).toContain("list_tasks");
  });
});

describe("generateMcpJson", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-json-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create .mcp.json with taskflow server config", async () => {
    await generateMcpJson(tmpDir);

    const content = await fs.readFile(path.join(tmpDir, ".mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.taskflow).toBeDefined();
    expect(parsed.mcpServers.taskflow.type).toBe("stdio");
  });

  it("should merge with existing .mcp.json without overwriting other servers", async () => {
    await fs.writeFile(
      path.join(tmpDir, ".mcp.json"),
      JSON.stringify({ mcpServers: { other: { type: "stdio", command: "other" } } }),
    );

    await generateMcpJson(tmpDir);

    const content = await fs.readFile(path.join(tmpDir, ".mcp.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.other).toBeDefined();
    expect(parsed.mcpServers.taskflow).toBeDefined();
  });
});

describe("appendClaudeImport", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "claude-import-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create CLAUDE.md with import if it does not exist", async () => {
    await appendClaudeImport(tmpDir);

    const content = await fs.readFile(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("@./.taskflow/CLAUDE.md");
  });

  it("should append import to existing CLAUDE.md", async () => {
    await fs.writeFile(path.join(tmpDir, "CLAUDE.md"), "# My Project\n\nExisting content\n");

    await appendClaudeImport(tmpDir);

    const content = await fs.readFile(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Existing content");
    expect(content).toContain("@./.taskflow/CLAUDE.md");
  });

  it("should not duplicate import if already present", async () => {
    await fs.writeFile(
      path.join(tmpDir, "CLAUDE.md"),
      "# My Project\n\n## TaskFlow\n@./.taskflow/CLAUDE.md\n",
    );

    await appendClaudeImport(tmpDir);

    const content = await fs.readFile(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    const matches = content.match(/@\.\/\.taskflow\/CLAUDE\.md/g);
    expect(matches).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx vitest run src/core/project/__tests__/claude-setup.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: Create `src/core/project/claude-setup.ts`**

```typescript
// src/core/project/claude-setup.ts
import fs from "node:fs/promises";
import path from "node:path";

const TASKFLOW_DIR = ".taskflow";
const CLAUDE_MD = "CLAUDE.md";
const MCP_JSON = ".mcp.json";
const IMPORT_LINE = "@./.taskflow/CLAUDE.md";

export interface ClaudeMdContext {
  projectName: string;
  summary?: string;
  stack?: string[];
}

export async function generateClaudeMd(
  projectRoot: string,
  ctx: ClaudeMdContext,
): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  const stackLine = ctx.stack?.length ? ctx.stack.join(", ") : "N/A";

  const content = `# TaskFlow — ${ctx.projectName} 개발 가이드

## 프로젝트 정보
- 이름: ${ctx.projectName}
- 설명: ${ctx.summary ?? "N/A"}
- 기술 스택: ${stackLine}
- 생성일: ${date}

## TaskFlow MCP 도구

이 프로젝트는 TaskFlow로 태스크를 관리합니다.
아래 MCP 도구를 사용하여 태스크를 조회하고 관리하세요.

### 태스크 관리
- \`list_tasks\` — 태스크 목록 조회 (필터: status, priority)
- \`read_task\` — 태스크 상세 조회
- \`create_task\` — 새 태스크 생성
- \`update_task\` — 태스크 수정
- \`delete_task\` — 태스크 삭제
- \`set_task_status\` — 상태 변경 (pending → in-progress → done)
- \`get_next_task\` — 의존성/우선순위 기반 다음 태스크 추천

### PRD & 분석
- \`generate_prd\` — PRD 생성
- \`brainstorm_prd\` — AI 브레인스토밍 멀티턴 대화로 PRD 생성
- \`auto_analyze_prd\` — 코드베이스 스캔 → PRD 자동 생성
- \`generate_feature_prd\` — 기능별 PRD 생성
- \`parse_prd\` — PRD를 태스크로 분해

### 브레인스토밍 & 분석
- \`brainstorm_task\` — 태스크를 서브태스크로 분해
- \`expand_subtasks\` — 분해 결과를 파일로 생성
- \`refine_tasks\` — 요구사항 변경 시 영향도 분석
- \`generate_claude_md\` — CLAUDE.md 재생성

## 워크플로우

### 새 기능 구현 시
1. \`get_next_task\`로 다음 태스크 확인
2. \`set_task_status\` → in-progress
3. 구현 완료 후 \`set_task_status\` → done

### 요구사항 변경 시
1. \`refine_tasks\`로 영향 받는 태스크 분석
2. 영향 받는 태스크 확인 및 수정

## 파일 구조
- \`.taskflow/config.json\` — 프로젝트 설정
- \`.taskflow/prd.md\` — PRD 문서
- \`.taskflow/tasks/task-{NNN}.md\` — 개별 태스크 파일
`;

  const filePath = path.join(projectRoot, TASKFLOW_DIR, CLAUDE_MD);
  await fs.writeFile(filePath, content, "utf-8");
}

export async function generateMcpJson(projectRoot: string): Promise<void> {
  const filePath = path.join(projectRoot, MCP_JSON);

  let existing: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    // file does not exist or invalid JSON
  }

  const mcpServers = (existing.mcpServers as Record<string, unknown>) ?? {};
  mcpServers.taskflow = {
    type: "stdio",
    command: "node",
    args: ["./bin/task-mcp.mjs"],
    env: {},
  };

  const merged = { ...existing, mcpServers };
  await fs.writeFile(filePath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

export async function appendClaudeImport(projectRoot: string): Promise<void> {
  const filePath = path.join(projectRoot, CLAUDE_MD);

  let existing = "";
  try {
    existing = await fs.readFile(filePath, "utf-8");
  } catch {
    // file does not exist
  }

  // Skip if import already present
  if (existing.includes(IMPORT_LINE)) {
    return;
  }

  const importBlock = `\n## TaskFlow\n${IMPORT_LINE}\n`;

  if (existing.trim()) {
    // Append to existing file
    const content = existing.endsWith("\n") ? existing + importBlock : existing + "\n" + importBlock;
    await fs.writeFile(filePath, content, "utf-8");
  } else {
    // Create new file
    const content = `# Claude Code Instructions\n${importBlock}`;
    await fs.writeFile(filePath, content, "utf-8");
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx vitest run src/core/project/__tests__/claude-setup.test.ts 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/project/claude-setup.ts src/core/project/__tests__/claude-setup.test.ts
git commit -m "feat: add Claude Code setup (CLAUDE.md + .mcp.json generation)"
```

---

## Task 5: Create PRD auto-analyzer (extract from cli/flows/auto.ts)

**Files:**
- Create: `src/core/prd/auto-analyzer.ts`
- Test: `src/core/prd/__tests__/auto-analyzer.test.ts`

- [ ] **Step 1: Write test for pure functions (scanFiles, maskSensitive, extractSignature)**

```typescript
// src/core/prd/__tests__/auto-analyzer.test.ts
import { describe, it, expect } from "vitest";
import { maskSensitive, extractSignature, inferProjectName } from "../auto-analyzer.js";
import type { FileSample } from "../auto-analyzer.js";

describe("maskSensitive", () => {
  it("should mask API keys", () => {
    const input = 'const apiKey = "sk-abc123def456ghi789jkl012"';
    const result = maskSensitive(input);
    expect(result).not.toContain("sk-abc123def456ghi789jkl012");
    expect(result).toContain("[REDACTED]");
  });
});

describe("extractSignature", () => {
  it("should keep import/export lines within byte limit", () => {
    const content = 'import foo from "bar";\nexport function test() {}\nconst x = 1;\nconst y = 2;\n';
    const result = extractSignature(content, 100);
    expect(result).toContain("import foo");
    expect(result).toContain("export function");
  });
});

describe("inferProjectName", () => {
  it("should extract name from package.json sample", () => {
    const samples: FileSample[] = [
      { path: "package.json", content: '{"name": "my-project"}', truncated: false },
    ];
    expect(inferProjectName(samples)).toBe("my-project");
  });
});
```

- [ ] **Step 2: Create `src/core/prd/auto-analyzer.ts`**

Extract the pure functions from `src/cli/flows/auto.ts` — `maskSensitive`, `extractSignature`, `scanFiles`, `sampleFiles`, `inferProjectName`, `buildAnalysisPrompt`. Remove the `generateWithAI` function (replaced by `askClaudeWithRetry` from `core/ai/client.ts`). Add a new `runAutoAnalysis()` that ties them together.

```typescript
// src/core/prd/auto-analyzer.ts
import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { askClaudeWithRetry } from "../ai/client.js";
import type { PrdResult } from "../types.js";

// ── 설정 ──

const SCAN_PATTERNS = [
  "package.json", "tsconfig*.json", "next.config.*", "vite.config.*",
  "nuxt.config.*", "nest-cli.json", "angular.json",
  "docker-compose*.{yml,yaml}", "Dockerfile", ".env.example",
  "src/**/*.{ts,tsx,js,jsx}", "app/**/*.{ts,tsx,js,jsx}",
  "server/**/*.{ts,tsx,js,jsx}", "api/**/*.{ts,tsx,js,jsx}",
  "lib/**/*.{ts,tsx,js,jsx}", "pages/**/*.{ts,tsx,js,jsx}",
];

const IGNORE_PATTERNS = [
  "**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**",
  "**/.next/**", "**/coverage/**", "**/*.test.*", "**/*.spec.*",
  "**/__tests__/**", "**/*.d.ts",
];

const MAX_BYTES_PER_FILE = 16_000;
const MAX_FILES = 200;

// ── 민감정보 마스킹 ──

const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|secret|token|password|credential|auth)\s*[:=]\s*["']?[^\s"',]+/gi,
  /(?:sk|pk|key)-[a-zA-Z0-9]{20,}/g,
  /\/Users\/[^\s/]+/g,
  /\/home\/[^\s/]+/g,
  /C:\\Users\\[^\s\\]+/g,
];

export function maskSensitive(content: string): string {
  let masked = content;
  for (const pattern of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, "[REDACTED]");
  }
  return masked;
}

// ── 파일 수집/샘플링 ──

export interface FileSample {
  path: string;
  content: string;
  truncated: boolean;
}

export async function scanFiles(cwd: string): Promise<string[]> {
  const files = await fg(SCAN_PATTERNS, {
    cwd,
    ignore: IGNORE_PATTERNS,
    dot: true,
    absolute: false,
    onlyFiles: true,
  });
  return files.slice(0, MAX_FILES).sort();
}

export function extractSignature(content: string, maxBytes: number): string {
  if (Buffer.byteLength(content, "utf-8") <= maxBytes) {
    return content;
  }

  const lines = content.split("\n");
  const significant: string[] = [];
  let bytes = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const isSignificant =
      trimmed.startsWith("import ") || trimmed.startsWith("export ") ||
      trimmed.startsWith("//") || trimmed.startsWith("/*") ||
      trimmed.startsWith("* ") || trimmed.startsWith("*/") ||
      trimmed.startsWith("interface ") || trimmed.startsWith("type ") ||
      trimmed.startsWith("class ") || trimmed.startsWith("function ") ||
      trimmed.startsWith("const ") || trimmed.startsWith("async function") ||
      trimmed.startsWith("@") ||
      /^\s*(app|router|server)\.(get|post|put|delete|patch|use)\(/.test(trimmed) ||
      trimmed === "" || trimmed === "{" || trimmed === "}";

    if (isSignificant) {
      const lineBytes = Buffer.byteLength(line + "\n", "utf-8");
      if (bytes + lineBytes > maxBytes) break;
      significant.push(line);
      bytes += lineBytes;
    }
  }

  return significant.join("\n");
}

export async function sampleFiles(filePaths: string[], cwd: string): Promise<FileSample[]> {
  const samples: FileSample[] = [];

  for (const filePath of filePaths) {
    try {
      const fullPath = `${cwd}/${filePath}`;
      const raw = await readFile(fullPath, "utf-8");
      const originalBytes = Buffer.byteLength(raw, "utf-8");
      const content = extractSignature(raw, MAX_BYTES_PER_FILE);
      const masked = maskSensitive(content);
      samples.push({ path: filePath, content: masked, truncated: originalBytes > MAX_BYTES_PER_FILE });
    } catch {
      // skip unreadable files
    }
  }

  return samples;
}

export function inferProjectName(samples: FileSample[], projectRoot: string): string {
  const pkgSample = samples.find((s) => s.path === "package.json");
  if (pkgSample) {
    try {
      const pkg = JSON.parse(pkgSample.content);
      if (pkg.name && typeof pkg.name === "string") return pkg.name;
    } catch { /* fallback */ }
  }
  return basename(projectRoot);
}

function buildAnalysisPrompt(samples: FileSample[]): string {
  const fileList = samples
    .map((s) => {
      const tag = s.truncated ? " [일부 발췌]" : "";
      return `### ${s.path}${tag}\n\`\`\`\n${s.content}\n\`\`\``;
    })
    .join("\n\n");

  return `아래는 프로젝트의 소스 코드 및 설정 파일입니다. 이 내용만을 근거로 PRD를 작성해주세요.\n\n${fileList}`;
}

const SYSTEM_PROMPT = `당신은 소프트웨어 프로젝트 분석 전문가입니다.
제공된 소스 코드와 설정 파일을 분석하여 한국어 PRD(Product Requirements Document)를 작성합니다.

규칙:
- 실제 파일 내용에서 확인된 사실만 작성하세요. 추측하지 마세요.
- 확인할 수 없는 항목은 "N/A (코드에서 확인 불가)"로 표시하세요.
- 응답은 마크다운 형식이어야 합니다.
- 모든 내용은 한국어로 작성하세요.

다음 섹션을 포함하세요:
1. 제품 개요
2. 타겟 사용자
3. 해결하려는 문제 및 솔루션
4. 목표 및 핵심 지표
5. 주요 사용 시나리오
6. 기능 요구사항 (Must-Have / Optional 표)
7. 비기능 요구사항
8. 기술 스택
9. 범위 (포함 / 제외)
10. 마일스톤
11. 리스크 및 완화 전략`;

// ── 메인 플로우 ──

export async function runAutoAnalysis(projectRoot: string): Promise<PrdResult> {
  const filePaths = await scanFiles(projectRoot);

  if (filePaths.length === 0) {
    throw new Error("분석할 소스 파일을 찾을 수 없습니다. 프로젝트 루트 디렉토리에서 실행해주세요.");
  }

  const samples = await sampleFiles(filePaths, projectRoot);
  const projectName = inferProjectName(samples, projectRoot);
  const prompt = buildAnalysisPrompt(samples);

  const response = await askClaudeWithRetry({ prompt, systemPrompt: SYSTEM_PROMPT });

  return {
    markdown: response.text,
    meta: {
      projectName,
      generatedAt: new Date().toISOString(),
      mode: "auto",
      filesScanned: filePaths.length,
    },
  };
}
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx vitest run src/core/prd/__tests__/auto-analyzer.test.ts 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/prd/
git commit -m "feat: extract PRD auto-analyzer to core"
```

---

## Task 6: Create PRD brainstorm generator

**Files:**
- Create: `src/core/prd/generator.ts`
- Test: `src/core/prd/__tests__/generator.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// src/core/prd/__tests__/generator.test.ts
import { describe, it, expect } from "vitest";
import { buildPrdMarkdown } from "../generator.js";
import type { PrdData } from "../../types.js";

describe("buildPrdMarkdown", () => {
  it("should generate markdown with all sections", () => {
    const data: PrdData = {
      projectName: "TestProject",
      summary: "A test project",
      target: "Developers",
      pains: ["Pain 1"],
      solutions: ["Solution 1"],
      goals: ["Goal 1"],
      scenarios: ["Scenario 1"],
      mustFeatures: ["Feature 1"],
      optFeatures: ["Optional 1"],
      nonfunc: ["Performance"],
      stack: ["TypeScript"],
      scope: "MVP",
      outScope: "None",
      milestones: ["M1"],
      risks: ["Risk 1"],
    };

    const md = buildPrdMarkdown(data);
    expect(md).toContain("# TestProject — PRD");
    expect(md).toContain("A test project");
    expect(md).toContain("Pain 1");
    expect(md).toContain("Solution 1");
    expect(md).toContain("Feature 1");
    expect(md).toContain("TypeScript");
  });
});
```

- [ ] **Step 2: Create `src/core/prd/generator.ts`**

```typescript
// src/core/prd/generator.ts
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { askClaudeWithRetry } from "../ai/client.js";
import type { BrainstormSession, BrainstormTurn, PrdData, PrdResult } from "../types.js";

// ── PRD 마크다운 빌드 ──

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, "\\$1");
}

export function buildPrdMarkdown(data: PrdData): string {
  const painRows = data.pains
    .map((p, i) => {
      const sol = data.solutions[i] ?? "-";
      return `| ${escapeMarkdown(p)} | ${escapeMarkdown(sol)} |`;
    })
    .join("\n");

  const featureRows = [
    ...data.mustFeatures.map((f, i) => `| ${i + 1} | ${escapeMarkdown(f)} | Must-Have |`),
    ...data.optFeatures.map((f, i) => `| ${data.mustFeatures.length + i + 1} | ${escapeMarkdown(f)} | Optional |`),
  ].join("\n");

  const goalList = data.goals.map((g) => `- ${escapeMarkdown(g)}`).join("\n");
  const scenarioList = data.scenarios.map((s, i) => `${i + 1}. ${escapeMarkdown(s)}`).join("\n");
  const nonfuncList = data.nonfunc.map((n) => `- ${escapeMarkdown(n)}`).join("\n");
  const stackList = data.stack.map((s) => `\`${s}\``).join(", ");
  const milestoneList = data.milestones.map((m, i) => `${i + 1}. ${escapeMarkdown(m)}`).join("\n");
  const riskList = data.risks.map((r) => `- ${escapeMarkdown(r)}`).join("\n");

  return `# ${escapeMarkdown(data.projectName)} — PRD

## 1. 제품 개요

${escapeMarkdown(data.summary)}

## 2. 타겟 사용자

${escapeMarkdown(data.target)}

## 3. 해결하려는 문제 및 솔루션

| Pain Point | 해결 방안 |
|---|---|
${painRows}

## 4. 목표 및 핵심 지표

${goalList}

## 5. 주요 사용 시나리오

${scenarioList}

## 6. 기능 요구사항

| # | 기능 | 우선순위 |
|---|---|---|
${featureRows}

## 7. 비기능 요구사항

${nonfuncList || "\\-"}

## 8. 기술 스택

${stackList}

## 9. 범위

### 포함

${escapeMarkdown(data.scope)}

### 제외

${data.outScope.trim() ? escapeMarkdown(data.outScope) : "\\-"}

## 10. 마일스톤

${milestoneList}

## 11. 리스크 및 완화 전략

${riskList || "\\-"}
`;
}

// ── 브레인스토밍 엔진 ──

const BRAINSTORM_SYSTEM_PROMPT = `당신은 PRD(Product Requirements Document) 작성 전문가입니다.
사용자와 대화하며 프로젝트 요구사항을 파악합니다.

규칙:
- 한 번에 하나의 질문만 하세요.
- 사용자의 답변을 바탕으로 후속 질문을 동적으로 생성하세요.
- 다음 정보를 모두 파악할 때까지 질문을 계속하세요:
  프로젝트명, 요약, 타겟 사용자, 해결할 문제, 해결 방안, 목표/지표,
  사용 시나리오, 필수 기능, 선택 기능, 비기능 요구사항, 기술 스택,
  범위, 마일스톤, 리스크
- 충분한 정보가 모이면 "[PRD_COMPLETE]" 태그와 함께 PRD 마크다운을 작성하세요.
- PRD는 한국어로 작성하세요.
- PRD 형식은 다음 섹션을 포함해야 합니다:
  1. 제품 개요, 2. 타겟 사용자, 3. 문제 및 솔루션,
  4. 목표/지표, 5. 시나리오, 6. 기능 요구사항(표),
  7. 비기능 요구사항, 8. 기술 스택, 9. 범위, 10. 마일스톤, 11. 리스크`;

export async function startBrainstorm(
  projectRoot: string,
  projectContext?: string,
): Promise<BrainstormTurn> {
  const sessionId = crypto.randomUUID();
  const contextNote = projectContext
    ? `\n\n참고 — 현재 프로젝트 컨텍스트:\n${projectContext}`
    : "";

  const prompt = `새 프로젝트의 PRD를 작성하려고 합니다. 첫 번째 질문을 해주세요.${contextNote}`;

  const response = await askClaudeWithRetry({
    prompt,
    systemPrompt: BRAINSTORM_SYSTEM_PROMPT,
  });

  const isComplete = response.text.includes("[PRD_COMPLETE]");
  const prdMarkdown = isComplete ? extractPrd(response.text) : undefined;

  const session: BrainstormSession = {
    sessionId,
    messages: [
      { role: "user", content: prompt },
      { role: "assistant", content: response.text },
    ],
    isComplete,
  };

  return {
    session,
    aiMessage: response.text.replace("[PRD_COMPLETE]", "").trim(),
    isComplete,
    prdMarkdown,
  };
}

export async function continueBrainstorm(
  session: BrainstormSession,
  userMessage: string,
): Promise<BrainstormTurn> {
  const messagesContext = session.messages
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
    .join("\n\n");

  const prompt = `${messagesContext}\n\n사용자: ${userMessage}`;

  const response = await askClaudeWithRetry({
    prompt,
    systemPrompt: BRAINSTORM_SYSTEM_PROMPT,
  });

  const isComplete = response.text.includes("[PRD_COMPLETE]");
  const prdMarkdown = isComplete ? extractPrd(response.text) : undefined;

  const updatedSession: BrainstormSession = {
    ...session,
    messages: [
      ...session.messages,
      { role: "user", content: userMessage },
      { role: "assistant", content: response.text },
    ],
    isComplete,
  };

  return {
    session: updatedSession,
    aiMessage: response.text.replace("[PRD_COMPLETE]", "").trim(),
    isComplete,
    prdMarkdown,
  };
}

function extractPrd(text: string): string {
  // PRD는 [PRD_COMPLETE] 뒤에 오거나, 마크다운 헤더(#)로 시작하는 부분
  const marker = "[PRD_COMPLETE]";
  const idx = text.indexOf(marker);
  if (idx >= 0) {
    return text.slice(idx + marker.length).trim();
  }
  // fallback: 첫 번째 # 헤더부터
  const headerIdx = text.indexOf("# ");
  if (headerIdx >= 0) {
    return text.slice(headerIdx).trim();
  }
  return text.trim();
}

// ── PRD 저장 ──

export async function savePrd(projectRoot: string, markdown: string): Promise<string> {
  const filePath = path.join(projectRoot, ".taskflow", "prd.md");
  await fs.writeFile(filePath, markdown, "utf-8");
  return filePath;
}
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx vitest run src/core/prd/__tests__/generator.test.ts 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/prd/generator.ts src/core/prd/__tests__/generator.test.ts
git commit -m "feat: add PRD brainstorm generator with multi-turn conversation"
```

---

## Task 7: Create task re-export layer in core

**Files:**
- Create: `src/core/task/index.ts`

- [ ] **Step 1: Create `src/core/task/index.ts`**

Phase 1: re-export from existing location. Phase 2 (later) will move the files.

```typescript
// src/core/task/index.ts
// Phase 1: Re-export from existing feature module
// Phase 2: Move files here and update imports

export {
  ensureRepo,
  readTask,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  searchTasks,
} from "../../features/taskflow/lib/repository.js";

export { parseTask, serializeTask } from "../../features/taskflow/lib/serializer.js";
export { filterTasks, sortTasks } from "../../features/taskflow/lib/filter.js";
export { detectCycles, computeReadySet, recommend } from "../../features/taskflow/lib/graph.js";
```

- [ ] **Step 2: Verify imports resolve**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/core/task/
git commit -m "feat: add core task re-export layer"
```

---

## Task 8: Create MCP server

**Files:**
- Create: `src/mcp/index.ts`
- Create: `src/mcp/server.ts`
- Create: `src/mcp/util.ts`
- Create: `src/mcp/tools/project.ts`
- Create: `src/mcp/tools/task.ts`
- Create: `src/mcp/tools/task-status.ts`
- Create: `src/mcp/tools/prd.ts`
- Create: `src/mcp/tools/brainstorm.ts`
- Create: `src/mcp/tools/refine.ts`
- Create: `src/mcp/tools/parse.ts`
- Create: `bin/task-mcp.mjs`
- Modify: `package.json` (add bin entry)

- [ ] **Step 1: Create `src/mcp/util.ts`**

```typescript
// src/mcp/util.ts
import path from "node:path";

export function resolveProjectRoot(input?: string): string {
  if (input) return path.resolve(input);
  return process.cwd();
}
```

- [ ] **Step 2: Create `src/mcp/tools/project.ts`**

```typescript
// src/mcp/tools/project.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { initProject } from "../../core/project/init.js";
import { generateClaudeMd, generateMcpJson, appendClaudeImport } from "../../core/project/claude-setup.js";
import { resolveProjectRoot } from "../util.js";

export function registerProjectTools(server: McpServer): void {
  server.tool(
    "initialize_project",
    "프로젝트를 초기화합니다 (.taskflow 디렉토리 + config.json 생성)",
    {
      projectRoot: z.string().optional().describe("프로젝트 루트 경로 (기본: cwd)"),
      projectName: z.string().optional().describe("프로젝트명"),
    },
    async ({ projectRoot, projectName }) => {
      const root = resolveProjectRoot(projectRoot);
      const result = await initProject(root, projectName);
      return {
        content: [{
          type: "text" as const,
          text: result.created
            ? `프로젝트가 초기화되었습니다: ${root}/.taskflow`
            : `이미 초기화된 프로젝트입니다: ${root}/.taskflow`,
        }],
      };
    },
  );

  server.tool(
    "generate_claude_md",
    "CLAUDE.md를 동적으로 생성/갱신합니다",
    {
      projectRoot: z.string().optional().describe("프로젝트 루트 경로 (기본: cwd)"),
      projectName: z.string().describe("프로젝트명"),
      summary: z.string().optional().describe("프로젝트 설명"),
      stack: z.array(z.string()).optional().describe("기술 스택"),
    },
    async ({ projectRoot, projectName, summary, stack }) => {
      const root = resolveProjectRoot(projectRoot);
      await generateClaudeMd(root, { projectName, summary, stack });
      await generateMcpJson(root);
      await appendClaudeImport(root);
      return {
        content: [{ type: "text" as const, text: "CLAUDE.md, .mcp.json 생성 완료" }],
      };
    },
  );
}
```

- [ ] **Step 3: Create `src/mcp/tools/task.ts`**

```typescript
// src/mcp/tools/task.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listTasks, readTask, createTask, updateTask, deleteTask } from "../../core/task/index.js";
import { resolveProjectRoot } from "../util.js";

// NOTE: All MCP tool handlers MUST wrap core calls in try/catch.
// On error, return { content: [{ type: "text", text: errorMessage }], isError: true }
// This pattern applies to ALL tools in ALL files.

export function registerTaskTools(server: McpServer): void {
  server.tool(
    "list_tasks",
    "태스크 목록을 조회합니다",
    {
      projectRoot: z.string().optional(),
      status: z.string().optional().describe("상태 필터 (Todo, InProgress, Blocked, Done)"),
      sortBy: z.string().optional().describe("정렬 기준 (priority, status, createdAt, updatedAt, title)"),
      sortOrder: z.string().optional().describe("정렬 순서 (asc, desc)"),
    },
    async ({ projectRoot, status, sortBy, sortOrder }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const tasks = await listTasks(root, {
          filter: status ? { status: status as any } : undefined,
          sortKey: sortBy as any,
          sortOrder: sortOrder as any,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "read_task",
    "태스크 상세 정보를 조회합니다",
    {
      projectRoot: z.string().optional(),
      taskId: z.string().describe("태스크 ID"),
    },
    async ({ projectRoot, taskId }) => {
      const root = resolveProjectRoot(projectRoot);
      const task = await readTask(root, taskId);
      if (!task) {
        return { content: [{ type: "text" as const, text: `태스크를 찾을 수 없습니다: ${taskId}` }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    "create_task",
    "새 태스크를 생성합니다",
    {
      projectRoot: z.string().optional(),
      title: z.string().describe("태스크 제목"),
      description: z.string().optional().describe("태스크 설명"),
      priority: z.number().optional().describe("우선순위 (0-10)"),
      status: z.string().optional().describe("상태"),
      parentId: z.string().optional().describe("부모 태스크 ID"),
      dependencies: z.array(z.string()).optional().describe("의존 태스크 ID 배열"),
    },
    async ({ projectRoot, title, description, priority, status, parentId, dependencies }) => {
      const root = resolveProjectRoot(projectRoot);
      const task = await createTask(root, { title, description, priority, status: status as any, parentId, dependencies });
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    "update_task",
    "태스크를 수정합니다",
    {
      projectRoot: z.string().optional(),
      taskId: z.string().describe("태스크 ID"),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.number().optional(),
      status: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
    },
    async ({ projectRoot, taskId, ...patch }) => {
      const root = resolveProjectRoot(projectRoot);
      const task = await updateTask(root, taskId, patch as any);
      return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    "delete_task",
    "태스크를 삭제합니다",
    {
      projectRoot: z.string().optional(),
      taskId: z.string().describe("태스크 ID"),
    },
    async ({ projectRoot, taskId }) => {
      const root = resolveProjectRoot(projectRoot);
      const removed = await deleteTask(root, taskId);
      return {
        content: [{ type: "text" as const, text: removed ? `태스크 ${taskId} 삭제 완료` : `태스크를 찾을 수 없습니다: ${taskId}` }],
        isError: !removed,
      };
    },
  );
}
```

- [ ] **Step 4: Create `src/mcp/tools/task-status.ts`**

```typescript
// src/mcp/tools/task-status.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { updateTask, listTasks } from "../../core/task/index.js";
import { recommend } from "../../core/task/index.js";
import { resolveProjectRoot } from "../util.js";

export function registerTaskStatusTools(server: McpServer): void {
  server.tool(
    "set_task_status",
    "태스크 상태를 변경합니다",
    {
      projectRoot: z.string().optional(),
      taskId: z.string().describe("태스크 ID"),
      status: z.string().describe("변경할 상태 (Todo, InProgress, Blocked, Done)"),
    },
    async ({ projectRoot, taskId, status }) => {
      const root = resolveProjectRoot(projectRoot);
      const task = await updateTask(root, taskId, { status: status as any });
      return { content: [{ type: "text" as const, text: `태스크 ${taskId} 상태 → ${task.status}` }] };
    },
  );

  server.tool(
    "get_next_task",
    "의존성과 우선순위 기반으로 다음 작업할 태스크를 추천합니다",
    {
      projectRoot: z.string().optional(),
      count: z.number().optional().describe("추천 개수 (기본: 3)"),
    },
    async ({ projectRoot, count }) => {
      const root = resolveProjectRoot(projectRoot);
      const tasks = await listTasks(root);
      const recommendations = recommend(tasks, { limit: count ?? 3 });
      return { content: [{ type: "text" as const, text: JSON.stringify(recommendations, null, 2) }] };
    },
  );
}
```

- [ ] **Step 5: Create `src/mcp/tools/prd.ts`**

```typescript
// src/mcp/tools/prd.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startBrainstorm, continueBrainstorm, savePrd } from "../../core/prd/generator.js";
import { runAutoAnalysis } from "../../core/prd/auto-analyzer.js";
import { resolveProjectRoot } from "../util.js";

export function registerPrdTools(server: McpServer): void {
  server.tool(
    "generate_prd",
    "PRD를 생성합니다 (모드 선택: brainstorm 또는 auto)",
    {
      projectRoot: z.string().optional(),
      mode: z.enum(["brainstorm", "auto"]).describe("생성 모드"),
      projectContext: z.string().optional().describe("프로젝트 컨텍스트 (brainstorm 모드)"),
    },
    async ({ projectRoot, mode, projectContext }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        if (mode === "auto") {
          const result = await runAutoAnalysis(root);
          await savePrd(root, result.markdown);
          return { content: [{ type: "text" as const, text: result.markdown }] };
        }
        // brainstorm mode — start a new session
        const turn = await startBrainstorm(root, projectContext);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ aiMessage: turn.aiMessage, session: turn.session, isComplete: turn.isComplete }, null, 2),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
  );

  server.tool(
    "brainstorm_prd",
    "AI와 대화하며 PRD를 생성합니다. session 없이 호출하면 새 세션, session과 userMessage를 전달하면 대화 계속",
    {
      projectRoot: z.string().optional(),
      session: z.any().optional().describe("기존 브레인스토밍 세션 객체"),
      userMessage: z.string().optional().describe("사용자 응답 (세션 계속 시 필수)"),
      projectContext: z.string().optional().describe("프로젝트 컨텍스트 (새 세션 시 선택)"),
    },
    async ({ projectRoot, session, userMessage, projectContext }) => {
      const root = resolveProjectRoot(projectRoot);

      const turn = session && userMessage
        ? await continueBrainstorm(session, userMessage)
        : await startBrainstorm(root, projectContext);

      if (turn.isComplete && turn.prdMarkdown) {
        await savePrd(root, turn.prdMarkdown);
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            aiMessage: turn.aiMessage,
            isComplete: turn.isComplete,
            session: turn.session,
            prdSaved: turn.isComplete && !!turn.prdMarkdown,
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    "auto_analyze_prd",
    "코드베이스를 스캔하여 PRD를 자동 생성합니다",
    {
      projectRoot: z.string().optional(),
    },
    async ({ projectRoot }) => {
      const root = resolveProjectRoot(projectRoot);
      const result = await runAutoAnalysis(root);
      await savePrd(root, result.markdown);
      return {
        content: [{ type: "text" as const, text: `PRD 생성 완료 (${result.meta.filesScanned}개 파일 스캔)\n\n${result.markdown}` }],
      };
    },
  );

  server.tool(
    "generate_feature_prd",
    "기능별 PRD를 생성합니다",
    {
      projectRoot: z.string().optional(),
      featureName: z.string().describe("기능명"),
      goal: z.string().describe("기능 목표"),
      parentPrd: z.string().optional().describe("상위 PRD 경로"),
    },
    async ({ projectRoot, featureName, goal, parentPrd }) => {
      // Phase 2: core/prd/feature-generator.ts 연결
      return {
        content: [{ type: "text" as const, text: `기능 PRD 생성은 아직 MCP에서 미구현입니다. CLI에서 task fprd를 사용하세요.` }],
      };
    },
  );
}
```

- [ ] **Step 6: Create `src/mcp/tools/brainstorm.ts` and `src/mcp/tools/refine.ts` and `src/mcp/tools/parse.ts`**

```typescript
// src/mcp/tools/brainstorm.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readTask, listTasks, createTask } from "../../core/task/index.js";
import { brainstormTask } from "../../core/ai/client.js";
import { resolveProjectRoot } from "../util.js";

export function registerBrainstormTools(server: McpServer): void {
  server.tool(
    "brainstorm_task",
    "태스크를 서브태스크로 분해합니다",
    {
      projectRoot: z.string().optional(),
      taskId: z.string().describe("분해할 태스크 ID"),
      depth: z.number().optional().describe("분해 깊이 (기본: 1)"),
    },
    async ({ projectRoot, taskId, depth }) => {
      const root = resolveProjectRoot(projectRoot);
      const task = await readTask(root, taskId);
      if (!task) {
        return { content: [{ type: "text" as const, text: `태스크를 찾을 수 없습니다: ${taskId}` }], isError: true };
      }
      const result = await brainstormTask(root, taskId, `${task.title}\n\n${task.description}`, depth);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "expand_subtasks",
    "브레인스토밍 결과를 실제 태스크 파일로 생성합니다",
    {
      projectRoot: z.string().optional(),
      parentTaskId: z.string().describe("부모 태스크 ID"),
      subtasks: z.array(z.object({
        title: z.string(),
        description: z.string(),
        priority: z.number().optional(),
        dependencies: z.array(z.string()).optional(),
      })).describe("생성할 서브태스크 배열"),
    },
    async ({ projectRoot, parentTaskId, subtasks }) => {
      const root = resolveProjectRoot(projectRoot);
      const created = [];
      for (const sub of subtasks) {
        const task = await createTask(root, {
          title: sub.title,
          description: sub.description,
          priority: sub.priority ?? 0,
          parentId: parentTaskId,
          dependencies: sub.dependencies,
        });
        created.push(task);
      }
      return {
        content: [{ type: "text" as const, text: `${created.length}개 서브태스크 생성 완료\n${JSON.stringify(created, null, 2)}` }],
      };
    },
  );
}
```

```typescript
// src/mcp/tools/refine.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProjectRoot } from "../util.js";

export function registerRefineTools(server: McpServer): void {
  server.tool(
    "refine_tasks",
    "요구사항 변경에 따른 태스크 영향도를 분석합니다",
    {
      projectRoot: z.string().optional(),
      changes: z.string().describe("변경된 요구사항 설명"),
    },
    async ({ projectRoot, changes }) => {
      // Phase 2: core/ai/refine-engine.ts 연결
      return {
        content: [{ type: "text" as const, text: `refine 기능은 아직 MCP에서 미구현입니다. CLI에서 task refine을 사용하세요.` }],
      };
    },
  );
}
```

```typescript
// src/mcp/tools/parse.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveProjectRoot } from "../util.js";

export function registerParseTools(server: McpServer): void {
  server.tool(
    "parse_prd",
    "PRD를 태스크로 분해합니다",
    {
      projectRoot: z.string().optional(),
      prdPath: z.string().optional().describe("PRD 파일 경로 (기본: .taskflow/prd.md)"),
    },
    async ({ projectRoot, prdPath }) => {
      // Phase 2: core/prd/parser.ts 연결
      return {
        content: [{ type: "text" as const, text: `parse-prd 기능은 아직 MCP에서 미구현입니다. CLI에서 task parse-prd를 사용하세요.` }],
      };
    },
  );
}
```

- [ ] **Step 7: Create `src/mcp/server.ts`**

```typescript
// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./tools/project.js";
import { registerTaskTools } from "./tools/task.js";
import { registerTaskStatusTools } from "./tools/task-status.js";
import { registerPrdTools } from "./tools/prd.js";
import { registerBrainstormTools } from "./tools/brainstorm.js";
import { registerRefineTools } from "./tools/refine.js";
import { registerParseTools } from "./tools/parse.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "taskflow",
    version: "0.1.0",
  });

  registerProjectTools(server);
  registerTaskTools(server);
  registerTaskStatusTools(server);
  registerPrdTools(server);
  registerBrainstormTools(server);
  registerRefineTools(server);
  registerParseTools(server);

  return server;
}
```

- [ ] **Step 8: Create `src/mcp/index.ts`**

```typescript
// src/mcp/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";

const server = createMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
```

- [ ] **Step 9: Create `bin/task-mcp.mjs`**

```javascript
#!/usr/bin/env node

import { spawn } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const entry = resolve(root, "src/mcp/index.ts");
const tsx = resolve(root, "node_modules/.bin/tsx");

const child = spawn(tsx, [entry], {
  stdio: "inherit",
  cwd: process.cwd(),
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
```

- [ ] **Step 10: Update `package.json` bin entry**

Add `"task-mcp": "./bin/task-mcp.mjs"` to the `bin` field.

- [ ] **Step 11: Verify TypeScript compilation**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in new files

- [ ] **Step 12: Commit**

```bash
git add src/mcp/ bin/task-mcp.mjs package.json
git commit -m "feat: add MCP server with 17 tools via @modelcontextprotocol/sdk"
```

---

## Task 9: Rewrite `task init` CLI command

**Files:**
- Modify: `src/cli/commands/init.ts`
- Modify: `src/cli/index.ts`

- [ ] **Step 1: Rewrite `src/cli/commands/init.ts`**

```typescript
// src/cli/commands/init.ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { initProject } from "../../core/project/init.js";
import { readConfig, writeConfig } from "../../core/project/config.js";
import { generateClaudeMd, generateMcpJson, appendClaudeImport } from "../../core/project/claude-setup.js";
import { startBrainstorm, continueBrainstorm, savePrd } from "../../core/prd/generator.js";
import { runAutoAnalysis } from "../../core/prd/auto-analyzer.js";

export function registerInitCommand(program: Command) {
  program
    .command("init")
    .description("Initialize a new TaskFlow project (setup + Claude Code integration + PRD)")
    .action(
      withCliErrorBoundary(async () => {
        const cwd = process.cwd();
        const taskflowDir = join(cwd, ".taskflow");
        const alreadyExists = existsSync(taskflowDir);

        if (alreadyExists) {
          await handleReinit(cwd);
        } else {
          await handleNewInit(cwd);
        }
      }),
    );
}

async function handleNewInit(cwd: string): Promise<void> {
  console.log(chalk.bold("\n🚀 TaskFlow 프로젝트를 초기화합니다.\n"));

  // Step 1-2: Create directory + config
  const spinner = ora("프로젝트 구조 생성 중...").start();
  await initProject(cwd);
  spinner.succeed("프로젝트 구조 생성 완료");

  // Step 3: .mcp.json
  const mcpSpinner = ora("Claude Code 연동 설정 중...").start();
  await generateMcpJson(cwd);
  mcpSpinner.succeed("Claude Code 연동 설정 완료 (.mcp.json)");

  // Step 4: PRD generation
  const prdResult = await runPrdGeneration(cwd);

  if (prdResult) {
    // Step 5: Save PRD
    const savePath = await savePrd(cwd, prdResult.markdown);
    console.log(chalk.green(`✔ PRD 저장 완료: ${savePath}`));

    // Update config with project name
    const config = await readConfig(cwd);
    config.project.name = prdResult.meta.projectName;
    await writeConfig(cwd, config);

    // Step 6: Generate CLAUDE.md
    const claudeSpinner = ora("CLAUDE.md 생성 중...").start();
    await generateClaudeMd(cwd, {
      projectName: prdResult.meta.projectName,
      summary: undefined, // extracted from PRD in future
      stack: undefined,
    });
    claudeSpinner.succeed("CLAUDE.md 생성 완료");

    // Step 7: Append import to root CLAUDE.md
    await appendClaudeImport(cwd);
    console.log(chalk.green("✔ 루트 CLAUDE.md에 TaskFlow import 추가 완료"));
  }

  console.log(chalk.bold.green("\n✅ TaskFlow 초기화가 완료되었습니다!\n"));
  console.log(chalk.gray("  다음 단계:"));
  console.log(chalk.gray("  $ task parse-prd      PRD를 태스크로 분해"));
  console.log(chalk.gray("  $ task list           태스크 목록 확인"));
  console.log(chalk.gray("  $ task next           다음 태스크 추천\n"));
}

async function handleReinit(cwd: string): Promise<void> {
  console.log(chalk.yellow("\n⚠ TaskFlow 프로젝트가 이미 초기화되어 있습니다.\n"));

  const { action } = await inquirer.prompt<{ action: "prd" | "exit" }>([
    {
      type: "list",
      name: "action",
      message: "무엇을 하시겠습니까?",
      choices: [
        { name: "📝 PRD를 다시 생성합니다", value: "prd" },
        { name: "🚪 종료", value: "exit" },
      ],
    },
  ]);

  if (action === "exit") {
    console.log(chalk.gray("\n👋 종료합니다.\n"));
    return;
  }

  const prdResult = await runPrdGeneration(cwd);

  if (prdResult) {
    const savePath = await savePrd(cwd, prdResult.markdown);
    console.log(chalk.green(`✔ PRD 저장 완료: ${savePath}`));

    // Regenerate CLAUDE.md with updated PRD info
    const config = await readConfig(cwd);
    config.project.name = prdResult.meta.projectName;
    await writeConfig(cwd, config);

    await generateClaudeMd(cwd, {
      projectName: prdResult.meta.projectName,
    });
    console.log(chalk.green("✔ CLAUDE.md 재생성 완료"));
  }
}

async function runPrdGeneration(cwd: string): Promise<{ markdown: string; meta: { projectName: string } } | null> {
  const { mode } = await inquirer.prompt<{ mode: "brainstorm" | "auto" }>([
    {
      type: "list",
      name: "mode",
      message: "PRD 생성 모드를 선택하세요:",
      choices: [
        { name: "1) 대화형 브레인스토밍 (AI와 대화하며 PRD 작성)", value: "brainstorm" },
        { name: "2) AI 자동 분석 (코드베이스 스캔)", value: "auto" },
      ],
    },
  ]);

  if (mode === "auto") {
    const spinner = ora("코드베이스 분석 중...").start();
    try {
      const result = await runAutoAnalysis(cwd);
      spinner.succeed("PRD 자동 생성 완료!");
      return { markdown: result.markdown, meta: { projectName: result.meta.projectName } };
    } catch (error) {
      spinner.fail("PRD 자동 생성 실패");
      console.log(chalk.red(`  ${error instanceof Error ? error.message : "알 수 없는 오류"}`));
      return null;
    }
  }

  // Brainstorm mode
  console.log(chalk.cyan("\n💬 AI 브레인스토밍을 시작합니다. 대화를 통해 PRD를 작성합니다.\n"));
  console.log(chalk.gray("  (종료하려면 CTRL+C를 누르세요)\n"));

  try {
    let turn = await startBrainstorm(cwd);
    console.log(chalk.blue(`\n🤖 AI: ${turn.aiMessage}\n`));

    while (!turn.isComplete) {
      const { answer } = await inquirer.prompt<{ answer: string }>([
        {
          type: "input",
          name: "answer",
          message: "당신:",
          validate: (v: string) => (v.trim() ? true : "응답을 입력하세요."),
        },
      ]);

      const spinner = ora("AI 응답 생성 중...").start();
      turn = await continueBrainstorm(turn.session, answer);
      spinner.stop();

      console.log(chalk.blue(`\n🤖 AI: ${turn.aiMessage}\n`));
    }

    if (turn.prdMarkdown) {
      // Extract project name from PRD (first heading)
      const nameMatch = turn.prdMarkdown.match(/^#\s+(.+?)(?:\s*—|\s*-|\n)/m);
      const projectName = nameMatch ? nameMatch[1].trim() : "project";
      return { markdown: turn.prdMarkdown, meta: { projectName } };
    }

    return null;
  } catch (error) {
    console.log(chalk.red(`\n브레인스토밍 중 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`));
    return null;
  }
}
```

- [ ] **Step 2: Remove prd command from `src/cli/index.ts`**

Remove these lines:
```typescript
import { registerPrdCommand } from "./commands/prd.js";
registerPrdCommand(program);
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/init.ts src/cli/index.ts
git commit -m "feat: rewrite task init with full setup flow, remove task prd command"
```

---

## Task 10: Integration test and cleanup

**Files:**
- Delete: `src/cli/commands/prd.ts`
- Verify all components work together

- [ ] **Step 1: Delete `src/cli/commands/prd.ts` and its test**

Run: `rm /Users/mugeon/IdeaProjects/TaskPilot/src/cli/commands/prd.ts`

Also delete or update any test files that import from `prd.ts`:

Run: `rm -f /Users/mugeon/IdeaProjects/TaskPilot/src/cli/commands/__tests__/prd.test.ts`

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx vitest run 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 3: Verify MCP server starts**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}' | timeout 5 node bin/task-mcp.mjs 2>&1 | head -5`
Expected: JSON-RPC response with server capabilities

- [ ] **Step 4: Verify CLI help shows updated init description**

Run: `cd /Users/mugeon/IdeaProjects/TaskPilot && npx tsx src/cli/index.ts init --help`
Expected: Shows new init description, no prd command in help

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated prd command, integration verification"
```

---

## Summary of Tasks

| Task | Description | Est. |
|------|-------------|------|
| 1 | Install deps + core types | 3 min |
| 2 | AI client (Claude Max) | 5 min |
| 3 | Project init core logic | 5 min |
| 4 | Claude setup (CLAUDE.md + .mcp.json) | 5 min |
| 5 | PRD auto-analyzer (extract from flows) | 5 min |
| 6 | PRD brainstorm generator | 5 min |
| 7 | Task re-export layer | 2 min |
| 8 | MCP server (17 tools) | 10 min |
| 9 | Rewrite task init CLI | 5 min |
| 10 | Integration test + cleanup | 5 min |
