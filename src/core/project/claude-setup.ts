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

  if (existing.includes(IMPORT_LINE)) {
    return;
  }

  const importBlock = `\n## TaskFlow\n${IMPORT_LINE}\n`;

  if (existing.trim()) {
    const content = existing.endsWith("\n") ? existing + importBlock : existing + "\n" + importBlock;
    await fs.writeFile(filePath, content, "utf-8");
  } else {
    const content = `# Claude Code Instructions\n${importBlock}`;
    await fs.writeFile(filePath, content, "utf-8");
  }
}
