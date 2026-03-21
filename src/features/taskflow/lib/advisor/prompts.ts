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
