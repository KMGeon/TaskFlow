# TaskFlow 스킬 아키텍처 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MCP에서 AI 호출을 제거하고, Claude Code 스킬 프롬프트가 워크플로우를 오케스트레이션하는 구조로 전환한다.

**Architecture:** MCP 도구는 순수 데이터 접근만 담당하고, 7개 스킬 프롬프트(`.taskflow/.claude/commands/`)가 Claude Code에게 워크플로우를 안내한다. `task init`이 스킬 원본을 생성하고 `.claude/commands/`에 심볼릭 링크를 건다.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, Vitest, Commander.js

**Spec:** `docs/superpowers/specs/2026-03-21-skill-architecture-design.md`

---

## File Structure

### 새로 생성
- `src/core/project/skill-setup.ts` — 스킬 파일 생성 + 심볼릭 링크 로직
- `src/core/project/__tests__/skill-setup.test.ts` — 스킬 설치 테스트
- `src/core/prd/scanner.ts` — `auto-analyzer.ts`에서 순수 함수만 추출
- `src/core/prd/__tests__/scanner.test.ts` — 스캐너 테스트
- `.taskflow/.claude/commands/prd.md` — PRD 생성 스킬
- `.taskflow/.claude/commands/trd.md` — TRD 생성 스킬
- `.taskflow/.claude/commands/parse-prd.md` — PRD → 태스크 분해 스킬
- `.taskflow/.claude/commands/brainstorm.md` — 태스크 브레인스토밍 스킬
- `.taskflow/.claude/commands/refine.md` — 요구사항 변경 분석 스킬
- `.taskflow/.claude/commands/next.md` — 다음 태스크 추천 스킬
- `.taskflow/.claude/commands/task-status.md` — 진행 상황 요약 스킬

### 수정
- `src/mcp/tools/prd.ts` — AI 도구 제거, `scan_codebase`/`save_prd`/`read_prd` 추가
- `src/mcp/tools/brainstorm.ts` — `brainstorm_task` 제거, `expand_subtasks` 유지
- `src/mcp/server.ts` — refine/parse 등록 제거
- `src/core/prd/generator.ts` — 브레인스톰 함수 제거, `savePrd()` 유지
- `src/core/prd/auto-analyzer.ts` — `runAutoAnalysis()` 제거, 순수 함수 유지
- `src/core/project/claude-setup.ts` — `generateClaudeMd()` 새 도구/스킬 반영
- `src/cli/commands/init.ts` — AI PRD 생성 제거 + 스킬 설치 단계 추가
- `src/cli/index.ts` — Phase 3에서 AI CLI 커맨드 제거
- `src/core/types.ts` — 사용되지 않는 AI 관련 타입 제거
- `package.json` — `@anthropic-ai/claude-agent-sdk` 제거

### 삭제
- `src/core/ai/client.ts` — AI 클라이언트 전체
- `src/core/ai/__tests__/client.test.ts` — AI 클라이언트 테스트
- `src/mcp/tools/refine.ts` — refine stub
- `src/mcp/tools/parse.ts` — parse stub

---

## Task 1: 순수 스캐너 모듈 분리

`auto-analyzer.ts`에서 AI 의존 없는 순수 함수를 `scanner.ts`로 분리한다.

**Files:**
- Create: `src/core/prd/scanner.ts`
- Create: `src/core/prd/__tests__/scanner.test.ts`
- Modify: `src/core/prd/auto-analyzer.ts`
- Modify: `src/core/prd/__tests__/auto-analyzer.test.ts`

- [ ] **Step 1: Write scanner.ts tests**

```typescript
// src/core/prd/__tests__/scanner.test.ts
import { describe, it, expect, vi } from "vitest";
import { maskSensitive, extractSignature, inferProjectName } from "../scanner.js";
import type { FileSample } from "../scanner.js";

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
    expect(inferProjectName(samples, "/tmp/test")).toBe("my-project");
  });

  it("should fallback to projectRoot basename", () => {
    const samples: FileSample[] = [];
    expect(inferProjectName(samples, "/tmp/my-awesome-project")).toBe("my-awesome-project");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/prd/__tests__/scanner.test.ts`
Expected: FAIL — `scanner.js` does not exist

- [ ] **Step 3: Create scanner.ts with pure functions extracted from auto-analyzer.ts**

`src/core/prd/scanner.ts`에 `auto-analyzer.ts`에서 다음 함수/상수를 이동:
- `FileSample` interface
- `SCAN_PATTERNS`, `IGNORE_PATTERNS`, `MAX_FILES`, `MAX_SAMPLE_BYTES` 상수
- `maskSensitive()` 함수
- `extractSignature()` 함수
- `scanFiles()` 함수
- `sampleFiles()` 함수
- `inferProjectName()` 함수

`scanner.ts`는 AI 관련 import가 없어야 한다 (`askClaudeWithRetry` 없음).

- [ ] **Step 4: auto-analyzer.ts를 scanner.ts의 re-export로 변경**

`auto-analyzer.ts`를 다음과 같이 변경:
```typescript
// 하위 호환성을 위한 re-export
export {
  type FileSample,
  maskSensitive,
  extractSignature,
  scanFiles,
  sampleFiles,
  inferProjectName,
} from "./scanner.js";
```

`runAutoAnalysis()`, `SYSTEM_PROMPT` 등 AI 관련 코드는 제거.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/core/prd/__tests__/scanner.test.ts src/core/prd/__tests__/auto-analyzer.test.ts`
Expected: PASS — 기존 auto-analyzer 테스트도 re-export 통해 통과

- [ ] **Step 6: Commit**

```bash
git add src/core/prd/scanner.ts src/core/prd/__tests__/scanner.test.ts src/core/prd/auto-analyzer.ts src/core/prd/__tests__/auto-analyzer.test.ts
git commit -m "refactor: extract pure scanner functions from auto-analyzer"
```

---

## Task 2: MCP 도구 정리 — AI 도구 제거 + 새 데이터 도구 추가

**Files:**
- Modify: `src/mcp/tools/prd.ts`
- Modify: `src/mcp/tools/brainstorm.ts`
- Modify: `src/mcp/server.ts`
- Delete: `src/mcp/tools/refine.ts`
- Delete: `src/mcp/tools/parse.ts`

- [ ] **Step 1: Rewrite src/mcp/tools/prd.ts**

기존 4개 도구(generate_prd, brainstorm_prd, auto_analyze_prd, generate_feature_prd) 전부 제거.
새로 3개 도구 등록:

```typescript
// src/mcp/tools/prd.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { savePrd } from "../../core/prd/generator.js";
import { scanFiles, sampleFiles, inferProjectName } from "../../core/prd/scanner.js";
import { resolveProjectRoot } from "../util.js";
import fs from "node:fs/promises";
import path from "node:path";

export function registerPrdTools(server: McpServer): void {
  server.tool(
    "scan_codebase",
    "코드베이스를 스캔하여 파일 목록과 시그니처를 반환합니다 (AI 분석 없음)",
    { projectRoot: z.string().optional() },
    async ({ projectRoot }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const files = await scanFiles(root);
        const samples = await sampleFiles(files, root);
        const projectName = inferProjectName(samples, root);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ files, samples, projectName }, null, 2),
          }],
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
    "save_prd",
    "PRD 마크다운을 .taskflow/prd.md에 저장합니다",
    { projectRoot: z.string().optional(), markdown: z.string() },
    async ({ projectRoot, markdown }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const filePath = await savePrd(root, markdown);
        return { content: [{ type: "text" as const, text: `PRD 저장 완료: ${filePath}` }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "read_prd",
    ".taskflow/prd.md를 읽어서 반환합니다",
    { projectRoot: z.string().optional() },
    async ({ projectRoot }) => {
      try {
        const root = resolveProjectRoot(projectRoot);
        const filePath = path.join(root, ".taskflow", "prd.md");
        const content = await fs.readFile(filePath, "utf-8");
        return { content: [{ type: "text" as const, text: content }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `오류: PRD 파일을 읽을 수 없습니다. ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
```

- [ ] **Step 2: Update src/mcp/tools/brainstorm.ts — brainstorm_task 제거**

```typescript
// src/mcp/tools/brainstorm.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTask } from "../../core/task/index.js";
import { resolveProjectRoot } from "../util.js";

export function registerBrainstormTools(server: McpServer): void {
  server.tool(
    "expand_subtasks",
    "브레인스토밍 결과를 실제 태스크 파일로 생성합니다",
    {
      projectRoot: z.string().optional(),
      parentTaskId: z.string(),
      subtasks: z.array(z.object({
        title: z.string(),
        description: z.string(),
        priority: z.number().optional(),
        dependencies: z.array(z.string()).optional(),
      })),
    },
    async ({ projectRoot, parentTaskId, subtasks }) => {
      try {
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
          content: [{
            type: "text" as const,
            text: `${created.length}개 서브태스크 생성 완료\n${JSON.stringify(created, null, 2)}`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `오류: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
```

- [ ] **Step 3: Update src/mcp/server.ts — refine/parse 등록 제거**

```typescript
// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "./tools/project.js";
import { registerTaskTools } from "./tools/task.js";
import { registerTaskStatusTools } from "./tools/task-status.js";
import { registerPrdTools } from "./tools/prd.js";
import { registerBrainstormTools } from "./tools/brainstorm.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "taskflow",
    version: "0.2.0",
  });

  registerProjectTools(server);
  registerTaskTools(server);
  registerTaskStatusTools(server);
  registerPrdTools(server);
  registerBrainstormTools(server);

  return server;
}
```

- [ ] **Step 4: Delete refine.ts and parse.ts**

```bash
rm src/mcp/tools/refine.ts src/mcp/tools/parse.ts
```

- [ ] **Step 5: Run all tests to verify nothing breaks**

Run: `npx vitest run`
Expected: PASS (refine/parse had no tests, brainstorm_task had no dedicated tests)

- [ ] **Step 6: Commit**

```bash
git add src/mcp/tools/prd.ts src/mcp/tools/brainstorm.ts src/mcp/server.ts
git rm src/mcp/tools/refine.ts src/mcp/tools/parse.ts
git commit -m "refactor: remove AI-calling MCP tools, add pure data tools (scan_codebase, save_prd, read_prd)"
```

---

## Task 3: AI 클라이언트, 의존성, init.ts AI 로직 제거

**Files:**
- Delete: `src/core/ai/client.ts`
- Delete: `src/core/ai/__tests__/client.test.ts`
- Modify: `src/core/prd/generator.ts`
- Modify: `src/core/prd/__tests__/generator.test.ts`
- Modify: `src/cli/commands/init.ts`
- Modify: `src/core/types.ts`
- Modify: `package.json`

- [ ] **Step 1: Clean up generator.ts — 브레인스톰 함수 제거**

`src/core/prd/generator.ts`에서 제거:
- `startBrainstorm()` 함수 (lines 110-144)
- `continueBrainstorm()` 함수 (lines 146-180)
- `extractPrd()` 함수 (lines 182-193)
- `buildPrdMarkdown()` 함수 (lines 13-89) + `escapeMarkdown()` 헬퍼 (line 9-11)
- `BRAINSTORM_SYSTEM_PROMPT` 상수 (lines 93-108)
- `crypto` import (line 1)
- `askClaudeWithRetry` import (line 4)
- `BrainstormSession`, `BrainstormTurn`, `PrdData` type imports (line 5)

남길 것:
```typescript
// src/core/prd/generator.ts
import fs from "node:fs/promises";
import path from "node:path";

export async function savePrd(projectRoot: string, markdown: string): Promise<string> {
  const filePath = path.join(projectRoot, ".taskflow", "prd.md");
  await fs.writeFile(filePath, markdown, "utf-8");
  return filePath;
}
```

- [ ] **Step 2: Update generator.test.ts — buildPrdMarkdown 테스트 제거**

`src/core/prd/__tests__/generator.test.ts`를 savePrd 테스트로 교체:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { savePrd } from "../generator.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("savePrd", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gen-test-"));
    await fs.mkdir(path.join(tmpDir, ".taskflow"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should save PRD markdown to .taskflow/prd.md", async () => {
    const markdown = "# Test PRD\n\nContent here";
    const result = await savePrd(tmpDir, markdown);
    expect(result).toContain("prd.md");
    const content = await fs.readFile(result, "utf-8");
    expect(content).toBe(markdown);
  });
});
```

- [ ] **Step 3: Clean up init.ts — AI PRD 생성 로직 제거**

`src/cli/commands/init.ts`에서:
- `startBrainstorm`, `continueBrainstorm` import 제거 (line 11)
- `runAutoAnalysis` import 제거 (line 12)
- `runPrdGeneration()` 함수 전체 제거 (lines 116-178)
- `handleNewInit()`에서 PRD 생성 단계를 스킵하고, "PRD는 Claude Code에서 /prd 스킬로 생성하세요" 안내 메시지로 대체
- `handleReinit()`에서 PRD 재생성 옵션 제거

수정 후 `handleNewInit()`:
```typescript
async function handleNewInit(cwd: string): Promise<void> {
  console.log(chalk.bold("\n🚀 TaskFlow 프로젝트를 초기화합니다.\n"));

  // Step 1: Create directory + config
  const spinner = ora("프로젝트 구조 생성 중...").start();
  await initProject(cwd);
  spinner.succeed("프로젝트 구조 생성 완료");

  // Step 2: .mcp.json
  const mcpSpinner = ora("Claude Code 연동 설정 중...").start();
  await generateMcpJson(cwd);
  mcpSpinner.succeed("Claude Code 연동 설정 완료 (.mcp.json)");

  // Step 3: Generate CLAUDE.md
  const config = await readConfig(cwd);
  const claudeSpinner = ora("CLAUDE.md 생성 중...").start();
  await generateClaudeMd(cwd, { projectName: config.project.name || basename(cwd) });
  claudeSpinner.succeed("CLAUDE.md 생성 완료");

  // Step 4: Append import to root CLAUDE.md
  await appendClaudeImport(cwd);

  // Step 5: Install skills + symlinks
  const skillSpinner = ora("Claude Code 스킬 설치 중...").start();
  await installSkills(cwd);
  skillSpinner.succeed("Claude Code 스킬 설치 완료");

  console.log(chalk.bold.green("\n✅ TaskFlow 초기화가 완료되었습니다!\n"));
  console.log(chalk.gray("  다음 단계:"));
  console.log(chalk.gray("  /prd              PRD 대화형 생성"));
  console.log(chalk.gray("  /parse-prd        PRD → 태스크 분해"));
  console.log(chalk.gray("  /next             다음 태스크 추천\n"));
}
```

새 import 추가:
```typescript
import { basename } from "node:path";
import { installSkills } from "../../core/project/skill-setup.js";
```

`savePrd` import 제거 (더 이상 init에서 사용 안 함).

- [ ] **Step 4: Clean up types.ts — 사용되지 않는 타입 제거**

`src/core/types.ts`에서 다음 타입/인터페이스 제거 (generator.ts에서 더 이상 사용 안 함):
- `PrdData` interface
- `BrainstormMessage` interface
- `BrainstormSession` interface
- `BrainstormTurn` interface

유지: `PrdResult`, `Task`, `TaskStatus`, `TaskFlowConfig`, `TaskBrainstormResult`, `FeaturePrdResult` 등

- [ ] **Step 5: Delete AI client files**

```bash
rm src/core/ai/client.ts src/core/ai/__tests__/client.test.ts
rmdir src/core/ai/__tests__ src/core/ai
```

- [ ] **Step 6: Remove @anthropic-ai/claude-agent-sdk from package.json**

`package.json`에서 `"@anthropic-ai/claude-agent-sdk"` 라인 제거.

- [ ] **Step 7: Run pnpm install to update lockfile**

Run: `pnpm install`
Expected: lockfile 업데이트, claude-agent-sdk 패키지 제거

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: PASS — AI client 테스트 삭제, generator 테스트 업데이트, 나머지 통과

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: remove AI client, SDK dependency, and AI PRD generation from init"
```

---

## Task 4: 7개 스킬 프롬프트 파일 작성

**Files:**
- Create: `.taskflow/.claude/commands/prd.md`
- Create: `.taskflow/.claude/commands/trd.md`
- Create: `.taskflow/.claude/commands/parse-prd.md`
- Create: `.taskflow/.claude/commands/brainstorm.md`
- Create: `.taskflow/.claude/commands/refine.md`
- Create: `.taskflow/.claude/commands/next.md`
- Create: `.taskflow/.claude/commands/task-status.md`

- [ ] **Step 1: Create directory**

```bash
mkdir -p .taskflow/.claude/commands
```

- [ ] **Step 2: Create prd.md**

`.taskflow/.claude/commands/prd.md`:
```markdown
# PRD 생성

사용자와 대화하며 PRD(Product Requirements Document)를 작성합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__scan_codebase` — 코드베이스 파일 목록/시그니처 스캔
- `mcp__taskflow__save_prd` — PRD를 .taskflow/prd.md에 저장

## 워크플로우

1. 먼저 `mcp__taskflow__scan_codebase`로 현재 프로젝트 상태를 파악합니다.
2. 사용자에게 **한 번에 하나씩** 질문하며 요구사항을 수집합니다:
   - 프로젝트명, 한 줄 요약
   - 타겟 사용자
   - 해결하려는 문제 (Pain Points)와 해결 방안
   - 목표 및 핵심 지표 (KPI)
   - 주요 사용 시나리오
   - 필수 기능 (Must-Have)과 선택 기능 (Nice-to-Have)
   - 비기능 요구사항 (성능, 보안 등)
   - 기술 스택
   - 범위 (포함/제외)
   - 마일스톤
   - 리스크 및 완화 전략
3. 충분한 정보가 모이면 PRD 마크다운을 작성합니다.
4. 사용자에게 최종 확인을 받은 후 `mcp__taskflow__save_prd`로 저장합니다.

## PRD 형식

다음 11개 섹션을 포함하는 마크다운으로 작성합니다:

1. 제품 개요
2. 타겟 사용자
3. 해결하려는 문제 및 솔루션 (표)
4. 목표 및 핵심 지표
5. 주요 사용 시나리오
6. 기능 요구사항 (표: #, 기능, 우선순위)
7. 비기능 요구사항
8. 기술 스택
9. 범위 (포함/제외)
10. 마일스톤
11. 리스크 및 완화 전략

## 규칙
- 한국어로 작성합니다.
- 한 번에 하나의 질문만 합니다.
- 가능하면 객관식으로 제시합니다.
- 사용자의 답변이 모호하면 구체적으로 되물어봅니다.
```

- [ ] **Step 3: Create trd.md**

`.taskflow/.claude/commands/trd.md`:
```markdown
# TRD 생성 (Task Implementation Plan)

PRD를 기반으로 기술적 구현 계획(TRD)을 작성합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__read_prd` — .taskflow/prd.md 읽기
- `mcp__taskflow__list_tasks` — 기존 태스크 목록 확인

## 워크플로우

1. `mcp__taskflow__read_prd`로 PRD를 읽습니다.
2. `mcp__taskflow__list_tasks`로 기존 태스크가 있는지 확인합니다.
3. PRD를 분석하여 구현 단계별 TRD를 작성합니다:
   - 각 단계의 목적과 산출물
   - 기술적 결정사항 (라이브러리, 패턴, 구조)
   - 단계 간 의존성
   - 리스크 및 대안
4. 사용자에게 섹션별로 확인을 받습니다.
5. 최종 확인 후 Write 도구로 `.taskflow/trd.md`에 저장합니다.

## TRD 형식

```
# {프로젝트명} — TRD (Task Implementation Plan)

## 아키텍처 개요
(시스템 구조, 주요 컴포넌트, 데이터 흐름)

## Phase 1: {단계명}
### 목적
### 산출물
### 기술 결정사항
### 태스크 목록
### 의존성
### 리스크

## Phase 2: ...
```

## 규칙
- 한국어로 작성합니다.
- PRD의 우선순위(Must-Have → Nice-to-Have)를 반영합니다.
- 각 Phase는 독립적으로 배포 가능한 단위로 나눕니다.
```

- [ ] **Step 4: Create parse-prd.md**

`.taskflow/.claude/commands/parse-prd.md`:
```markdown
# PRD → 태스크 분해

PRD를 분석하여 개별 태스크 파일을 자동 생성합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__read_prd` — .taskflow/prd.md 읽기
- `mcp__taskflow__list_tasks` — 기존 태스크 확인 (중복 방지)
- `mcp__taskflow__create_task` — 태스크 생성

## 워크플로우

1. `mcp__taskflow__read_prd`로 PRD를 읽습니다.
2. `mcp__taskflow__list_tasks`로 기존 태스크를 확인합니다.
3. PRD의 기능 요구사항을 분석하여 태스크 목록을 도출합니다:
   - 각 태스크의 제목, 설명, 우선순위
   - 태스크 간 의존성
   - 예상 복잡도
4. 도출된 태스크 목록을 사용자에게 보여주고 확인을 받습니다.
5. 승인 후 `mcp__taskflow__create_task`로 하나씩 생성합니다.
6. 생성 결과를 요약하여 보여줍니다.

## 태스크 분해 기준
- Must-Have 기능 → 높은 우선순위 태스크
- Nice-to-Have 기능 → 낮은 우선순위 태스크
- 하나의 기능이 크면 여러 태스크로 분할
- 의존성이 있으면 dependencies에 명시
- 기존 태스크와 중복되면 스킵

## 규칙
- 한국어로 작성합니다.
- 태스크 하나는 1~2일 이내에 완료할 수 있는 크기로 분할합니다.
- 분해 결과를 보여주고 반드시 사용자 승인을 받은 후 생성합니다.
```

- [ ] **Step 5: Create brainstorm.md**

`.taskflow/.claude/commands/brainstorm.md`:
```markdown
# 태스크 브레인스토밍

특정 태스크를 서브태스크로 분해합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__list_tasks` — 전체 태스크 목록 조회
- `mcp__taskflow__read_task` — 태스크 상세 읽기
- `mcp__taskflow__expand_subtasks` — 서브태스크 파일 생성

## 워크플로우

1. 사용자에게 분해할 태스크 ID를 확인합니다.
   - ID를 모르면 `mcp__taskflow__list_tasks`로 목록을 보여줍니다.
2. `mcp__taskflow__read_task`로 해당 태스크의 상세 정보를 읽습니다.
3. 사용자와 대화하며 분해 방향을 논의합니다:
   - 어떤 관점으로 나눌지 (기능별, 계층별, 단계별)
   - 어느 정도 깊이로 나눌지
4. 서브태스크 목록을 제안합니다 (제목, 설명, 우선순위, 의존성).
5. 사용자 확인 후 `mcp__taskflow__expand_subtasks`로 생성합니다.

## 규칙
- 한국어로 작성합니다.
- 서브태스크는 4시간 이내에 완료 가능한 크기로 나눕니다.
- 반드시 사용자 승인 후 생성합니다.
```

- [ ] **Step 6: Create refine.md**

`.taskflow/.claude/commands/refine.md`:
```markdown
# 요구사항 변경 분석

요구사항 변경이 기존 태스크에 미치는 영향을 분석하고 업데이트합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__read_prd` — 현재 PRD 읽기
- `mcp__taskflow__list_tasks` — 전체 태스크 조회
- `mcp__taskflow__read_task` — 개별 태스크 읽기
- `mcp__taskflow__update_task` — 태스크 수정
- `mcp__taskflow__create_task` — 새 태스크 생성
- `mcp__taskflow__delete_task` — 불필요한 태스크 삭제
- `mcp__taskflow__save_prd` — PRD 업데이트

## 워크플로우

1. 사용자에게 변경사항을 확인합니다:
   - 어떤 요구사항이 바뀌었는지 설명을 듣거나
   - 변경된 파일/diff를 확인합니다
2. `mcp__taskflow__read_prd`로 현재 PRD를 읽습니다.
3. `mcp__taskflow__list_tasks`로 전체 태스크를 조회합니다.
4. 변경사항이 영향을 미치는 태스크를 식별합니다:
   - 수정이 필요한 태스크
   - 새로 추가해야 할 태스크
   - 더 이상 필요 없는 태스크
5. 영향 분석 결과를 사용자에게 표로 보여줍니다.
6. 사용자 승인 후:
   - `mcp__taskflow__update_task`로 수정
   - `mcp__taskflow__create_task`로 추가
   - `mcp__taskflow__delete_task`로 삭제
7. 필요시 `mcp__taskflow__save_prd`로 PRD도 업데이트합니다.

## 규칙
- 한국어로 작성합니다.
- 변경 전/후를 명확히 대비하여 보여줍니다.
- 반드시 사용자 승인 후 수정합니다.
```

- [ ] **Step 7: Create next.md**

`.taskflow/.claude/commands/next.md`:
```markdown
# 다음 태스크 추천

의존성과 우선순위를 기반으로 다음 작업할 태스크를 추천합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__get_next_task` — 추천 태스크 조회
- `mcp__taskflow__read_task` — 태스크 상세 읽기
- `mcp__taskflow__set_task_status` — 태스크 상태 변경

## 워크플로우

1. `mcp__taskflow__get_next_task`로 추천 태스크 목록을 조회합니다.
2. 각 추천 태스크에 대해:
   - `mcp__taskflow__read_task`로 상세 정보를 읽습니다.
   - 추천 이유를 설명합니다 (의존성 해소됨, 높은 우선순위 등).
3. 사용자가 태스크를 선택하면 `mcp__taskflow__set_task_status`로 상태를 `in-progress`로 변경합니다.

## 규칙
- 한국어로 응답합니다.
- 추천 목록은 최대 3개까지 보여줍니다.
- 각 추천에 이유를 명확히 설명합니다.
```

- [ ] **Step 8: Create task-status.md**

`.taskflow/.claude/commands/task-status.md`:
```markdown
# 프로젝트 진행 상황

현재 프로젝트의 태스크 진행 상황을 요약합니다.

## 사용 가능한 MCP 도구
- `mcp__taskflow__list_tasks` — 전체 태스크 조회

## 워크플로우

1. `mcp__taskflow__list_tasks`로 전체 태스크를 조회합니다.
2. 다음을 요약하여 보여줍니다:
   - 상태별 태스크 수 (Todo / In-Progress / Blocked / Done)
   - 전체 완료율 (%)
   - 현재 진행 중인 태스크
   - 블로커가 있는 태스크
   - 의존성이 해소되어 시작 가능한 태스크
3. 주요 이슈나 지연된 태스크가 있으면 하이라이트합니다.

## 규칙
- 한국어로 응답합니다.
- 간결한 표 형식으로 요약합니다.
```

- [ ] **Step 9: Commit**

```bash
git add .taskflow/.claude/commands/
git commit -m "feat: add 7 Claude Code skill prompts for TaskFlow workflows"
```

---

## Task 5: 스킬 설치 + 심볼릭 링크 모듈

`installSkills()`는 두 가지를 한다:
1. 스킬 템플릿(내장된 마크다운 콘텐츠)을 `.taskflow/.claude/commands/`에 **생성**
2. `.claude/commands/`에 **심볼릭 링크** 생성

이렇게 하면 `task init` 시 대상 프로젝트에 스킬 원본 파일이 생성되고 링크도 걸린다.

**Files:**
- Create: `src/core/project/skill-setup.ts`
- Create: `src/core/project/skill-templates.ts` — 7개 스킬 마크다운 콘텐츠를 문자열로 내장
- Create: `src/core/project/__tests__/skill-setup.test.ts`

- [ ] **Step 1: Write skill-setup tests**

```typescript
// src/core/project/__tests__/skill-setup.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installSkills, SKILL_NAMES } from "../skill-setup.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("installSkills", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-test-"));
    // .taskflow 디렉토리만 생성 (스킬 파일은 installSkills가 생성)
    await fs.mkdir(path.join(tmpDir, ".taskflow"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create skill source files and symlinks", async () => {
    await installSkills(tmpDir);

    const srcDir = path.join(tmpDir, ".taskflow", ".claude", "commands");
    const destDir = path.join(tmpDir, ".claude", "commands");

    for (const name of SKILL_NAMES) {
      // 원본 파일이 존재하는지
      const srcFile = path.join(srcDir, `${name}.md`);
      const srcContent = await fs.readFile(srcFile, "utf-8");
      expect(srcContent.length).toBeGreaterThan(0);

      // 심볼릭 링크가 존재하는지
      const linkPath = path.join(destDir, `${name}.md`);
      const stat = await fs.lstat(linkPath);
      expect(stat.isSymbolicLink()).toBe(true);

      // 링크가 원본과 같은 내용인지
      const linkContent = await fs.readFile(linkPath, "utf-8");
      expect(linkContent).toBe(srcContent);
    }
  });

  it("should skip symlink if destination file already exists", async () => {
    const destDir = path.join(tmpDir, ".claude", "commands");
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(destDir, "prd.md"), "# user custom prd");

    await installSkills(tmpDir);

    // 사용자 파일이 유지되어야 함
    const content = await fs.readFile(path.join(destDir, "prd.md"), "utf-8");
    expect(content).toBe("# user custom prd");
  });

  it("should overwrite stale skill source files on re-init", async () => {
    // 첫 번째 설치
    await installSkills(tmpDir);

    // 원본 파일을 수정 (stale 시뮬레이션)
    const srcFile = path.join(tmpDir, ".taskflow", ".claude", "commands", "prd.md");
    await fs.writeFile(srcFile, "# old content");

    // 재설치 — 원본은 최신 템플릿으로 덮어쓰기
    await installSkills(tmpDir);

    const content = await fs.readFile(srcFile, "utf-8");
    expect(content).not.toBe("# old content");
    expect(content).toContain("PRD");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/project/__tests__/skill-setup.test.ts`
Expected: FAIL — `skill-setup.js` does not exist

- [ ] **Step 3: Create skill-templates.ts — 스킬 콘텐츠를 문자열로 내장**

Task 4에서 작성한 7개 스킬 마크다운 콘텐츠를 `Record<string, string>` 형태로 export한다.

```typescript
// src/core/project/skill-templates.ts
export const SKILL_TEMPLATES: Record<string, string> = {
  prd: `# PRD 생성
...Task 4의 prd.md 전체 내용...`,
  trd: `# TRD 생성 (Task Implementation Plan)
...Task 4의 trd.md 전체 내용...`,
  "parse-prd": `# PRD → 태스크 분해
...`,
  brainstorm: `# 태스크 브레인스토밍
...`,
  refine: `# 요구사항 변경 분석
...`,
  next: `# 다음 태스크 추천
...`,
  "task-status": `# 프로젝트 진행 상황
...`,
};
```

> **참고:** Task 4에서 `.taskflow/.claude/commands/`에 직접 생성하는 파일은 TaskPilot 자체 개발용. `skill-templates.ts`에 내장된 버전은 다른 프로젝트에서 `task init` 할 때 생성되는 템플릿.

- [ ] **Step 4: Implement skill-setup.ts**

```typescript
// src/core/project/skill-setup.ts
import fs from "node:fs/promises";
import path from "node:path";
import { SKILL_TEMPLATES } from "./skill-templates.js";

export const SKILL_NAMES = Object.keys(SKILL_TEMPLATES);

export async function installSkills(projectRoot: string): Promise<void> {
  const srcDir = path.join(projectRoot, ".taskflow", ".claude", "commands");
  const destDir = path.join(projectRoot, ".claude", "commands");

  await fs.mkdir(srcDir, { recursive: true });
  await fs.mkdir(destDir, { recursive: true });

  for (const [name, content] of Object.entries(SKILL_TEMPLATES)) {
    const srcFile = path.join(srcDir, `${name}.md`);
    const destFile = path.join(destDir, `${name}.md`);

    // 원본 스킬 파일 생성 (항상 최신 템플릿으로 덮어쓰기)
    await fs.writeFile(srcFile, content, "utf-8");

    // 기존 링크/파일이 있으면 심볼릭 링크 스킵
    try {
      await fs.lstat(destFile);
      continue;
    } catch {
      // 없으면 생성
    }

    const relativePath = path.relative(destDir, srcFile);
    await fs.symlink(relativePath, destFile);
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/core/project/__tests__/skill-setup.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/project/skill-setup.ts src/core/project/skill-templates.ts src/core/project/__tests__/skill-setup.test.ts
git commit -m "feat: add skill template embedding and installation with symlinks"
```

---

## Task 6: task init 통합 검증

init.ts의 AI 로직 제거와 스킬 설치 통합은 Task 3에서 완료. 이 태스크는 수동 검증만.

- [ ] **Step 1: Run task init in a temp directory to verify full flow**

```bash
cd $(mktemp -d)
node /path/to/TaskPilot/bin/task.mjs init
```
Expected:
- `.taskflow/` 디렉토리 생성
- `.mcp.json` 생성
- `.taskflow/CLAUDE.md` 생성
- `.taskflow/.claude/commands/`에 7개 스킬 파일 생성
- `.claude/commands/`에 7개 심볼릭 링크 생성
- PRD 생성 프롬프트 없이 바로 완료
- 안내 메시지에 `/prd`, `/parse-prd`, `/next` 표시

- [ ] **Step 2: Verify reinit flow**

같은 디렉토리에서 다시 `task init` 실행.
Expected: 이미 초기화됨 메시지, 스킬 파일 최신 템플릿으로 갱신

- [ ] **Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: task init integration fixes"
```

---

## Task 7: generateClaudeMd() 업데이트

**Files:**
- Modify: `src/core/project/claude-setup.ts`
- Modify: `src/core/project/__tests__/claude-setup.test.ts`

- [ ] **Step 1: Update generateClaudeMd() template**

`src/core/project/claude-setup.ts`의 `generateClaudeMd()` 내부 마크다운 템플릿을 수정:

**MCP 도구 섹션** — 제거된 도구 삭제, 새 도구 추가:
```markdown
### 태스크 관리
- `list_tasks` — 태스크 목록 조회 (필터: status, priority)
- `read_task` — 태스크 상세 조회
- `create_task` — 새 태스크 생성
- `update_task` — 태스크 수정
- `delete_task` — 태스크 삭제
- `set_task_status` — 상태 변경
- `get_next_task` — 의존성/우선순위 기반 다음 태스크 추천
- `expand_subtasks` — 서브태스크 파일 생성

### PRD & 코드베이스
- `scan_codebase` — 코드베이스 파일 목록/시그니처 스캔
- `save_prd` — PRD 마크다운 저장
- `read_prd` — PRD 읽기

### 프로젝트
- `initialize_project` — 프로젝트 초기화
- `generate_claude_md` — CLAUDE.md 재생성
```

**스킬 커맨드 섹션** 추가:
```markdown
## Claude Code 스킬

다음 스킬 커맨드를 사용하여 워크플로우를 실행할 수 있습니다:
- `/prd` — PRD 대화형 생성
- `/trd` — PRD 기반 TRD 생성
- `/parse-prd` — PRD → 태스크 분해
- `/brainstorm` — 태스크 서브태스크 분해
- `/refine` — 요구사항 변경 영향 분석
- `/next` — 다음 작업할 태스크 추천
- `/task-status` — 진행 상황 요약
```

- [ ] **Step 2: Update claude-setup.test.ts**

기존 테스트에서 제거된 도구 참조 업데이트, 새 도구/스킬 커맨드 존재 확인 추가.

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/core/project/__tests__/claude-setup.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/project/claude-setup.ts src/core/project/__tests__/claude-setup.test.ts
git commit -m "feat: update generateClaudeMd with new MCP tools and skill commands"
```

---

## Task 8: 전체 테스트 + 정리

**Files:** `.gitignore` (선택)

- [ ] **Step 1: .gitignore에 심볼릭 링크 추가 (선택)**

`.claude/commands/`의 심볼릭 링크는 `task init`이 생성하는 아티팩트이므로 git에 커밋하지 않는 것이 좋다:

```
# .gitignore에 추가
.claude/commands/prd.md
.claude/commands/trd.md
.claude/commands/parse-prd.md
.claude/commands/brainstorm.md
.claude/commands/refine.md
.claude/commands/next.md
.claude/commands/task-status.md
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: 모든 테스트 PASS

- [ ] **Step 2: TypeScript type check**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Lint check**

Run: `npx eslint src/`
Expected: 에러 없음

- [ ] **Step 4: Verify MCP server starts**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node bin/task-mcp.mjs`
Expected: JSON-RPC 응답에 `scan_codebase`, `save_prd`, `read_prd` 도구 포함, `brainstorm_prd` 등 제거된 도구 미포함

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: verify skill architecture migration - all tests pass"
```
