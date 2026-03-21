// 하위 호환성을 위한 re-export
export {
  type FileSample,
  maskSensitive,
  extractSignature,
  scanFiles,
  sampleFiles,
  inferProjectName,
} from "./scanner.js";

import { askClaudeWithRetry } from "../ai/client.js";
import type { PrdResult } from "../types.js";
import * as scanner from "./scanner.js";

function buildAnalysisPrompt(samples: scanner.FileSample[]): string {
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

export async function runAutoAnalysis(projectRoot: string): Promise<PrdResult> {
  const filePaths = await scanner.scanFiles(projectRoot);

  if (filePaths.length === 0) {
    throw new Error("분석할 소스 파일을 찾을 수 없습니다. 프로젝트 루트 디렉토리에서 실행해주세요.");
  }

  const samples = await scanner.sampleFiles(filePaths, projectRoot);
  const projectName = scanner.inferProjectName(samples, projectRoot);
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
