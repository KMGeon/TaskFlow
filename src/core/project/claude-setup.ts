import fs from "node:fs/promises";
import path from "node:path";
import { DOCS_NAMES } from "./docs-setup.js";

const TASKFLOW_DIR = ".taskflow";
const CLAUDE_MD = "CLAUDE.md";
const MCP_JSON = ".mcp.json";
const IMPORT_LINE = "@./.taskflow/CLAUDE.md";
const DOCS_SECTION_MARKER = "<!-- docs-reference -->";

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
- \`set_task_status\` — 상태 변경
- \`get_next_task\` — 의존성/우선순위 기반 다음 태스크 추천
- \`expand_subtasks\` — 서브태스크 파일 생성

### PRD & 코드베이스
- \`scan_codebase\` — 코드베이스 파일 목록/시그니처 스캔
- \`save_prd\` — PRD 마크다운 저장
- \`read_prd\` — PRD 읽기

### 프로젝트
- \`initialize_project\` — 프로젝트 초기화
- \`generate_claude_md\` — CLAUDE.md 재생성

## Claude Code 스킬

다음 스킬 커맨드를 사용하여 워크플로우를 실행할 수 있습니다:
- \`/prd\` — PRD 대화형 생성
- \`/trd\` — PRD 기반 TRD 생성
- \`/parse-prd\` — PRD → 태스크 분해
- \`/brainstorm\` — 태스크 서브태스크 분해
- \`/refine\` — 요구사항 변경 영향 분석
- \`/next\` — 다음 작업할 태스크 추천
- \`/task-status\` — 진행 상황 요약

## 워크플로우

### 새 기능 구현 시
1. \`/next\`로 다음 태스크 확인
2. \`set_task_status\` → in-progress
3. 구현 완료 후 \`set_task_status\` → done

### PRD → 태스크 생성
1. \`/prd\`로 PRD 대화형 생성
2. \`/trd\`로 구현 계획 작성
3. \`/parse-prd\`로 태스크 분해

### 요구사항 변경 시
1. \`/refine\`으로 영향 받는 태스크 분석
2. 영향 받는 태스크 확인 및 수정

## 파일 구조
- \`.taskflow/config.json\` — 프로젝트 설정
- \`.taskflow/prd.md\` — PRD 문서
- \`.taskflow/trd.md\` — TRD 문서
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

export async function appendDocsReference(projectRoot: string): Promise<void> {
  const filePath = path.join(projectRoot, CLAUDE_MD);

  let existing = "";
  try {
    existing = await fs.readFile(filePath, "utf-8");
  } catch {
    // file does not exist
  }

  if (existing.includes(DOCS_SECTION_MARKER)) {
    return;
  }

  const docsList = DOCS_NAMES.map((name) => `- ${name}.md: ./docs/${name}.md`).join("\n");

  const docsBlock = `
${DOCS_SECTION_MARKER}
For every request:

1. Always refer to the documentation files stored under \`/docs\`:
<docs>
${docsList}
</docs>

2. Use the relevant file(s) depending on the context of the request.
3. Never ignore these files. Consider them for:
    - Providing accurate information
    - Ensuring consistency
    - Following documented guidelines
    - Making decisions or generating content
`;

  if (existing.trim()) {
    // Insert docs reference at the top, after the first heading line
    const lines = existing.split("\n");
    const headingIndex = lines.findIndex((l) => l.startsWith("# "));
    if (headingIndex >= 0) {
      lines.splice(headingIndex + 1, 0, docsBlock);
      await fs.writeFile(filePath, lines.join("\n"), "utf-8");
    } else {
      const content = docsBlock + "\n" + existing;
      await fs.writeFile(filePath, content, "utf-8");
    }
  } else {
    const content = `# Claude Code Instructions\n${docsBlock}`;
    await fs.writeFile(filePath, content, "utf-8");
  }
}
