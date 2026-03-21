import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from "inquirer";
import {
  runInteractivePrd,
  buildMarkdown,
  escapeMarkdown,
  splitComma,
  type PrdAnswers,
} from "./interactive.js";

const mockPrompt = vi.mocked(inquirer.prompt);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 유틸리티 함수 테스트 ──

describe("escapeMarkdown", () => {
  it("마크다운 특수문자를 이스케이프해야 한다", () => {
    expect(escapeMarkdown("**bold**")).toBe("\\*\\*bold\\*\\*");
    expect(escapeMarkdown("# heading")).toBe("\\# heading");
    expect(escapeMarkdown("`code`")).toBe("\\`code\\`");
    expect(escapeMarkdown("[link](url)")).toBe("\\[link\\]\\(url\\)");
  });

  it("특수문자가 없으면 원본을 반환해야 한다", () => {
    expect(escapeMarkdown("일반 텍스트")).toBe("일반 텍스트");
  });

  it("파이프 문자를 이스케이프해야 한다", () => {
    expect(escapeMarkdown("A | B")).toBe("A \\| B");
  });
});

describe("splitComma", () => {
  it("쉼표로 분리하고 트림해야 한다", () => {
    expect(splitComma("a, b , c")).toEqual(["a", "b", "c"]);
  });

  it("빈 문자열은 빈 배열을 반환해야 한다", () => {
    expect(splitComma("")).toEqual([]);
    expect(splitComma("   ")).toEqual([]);
  });

  it("빈 요소를 필터링해야 한다", () => {
    expect(splitComma("a,, b,")).toEqual(["a", "b"]);
  });
});

// ── 마크다운 빌더 테스트 ──

const sampleAnswers: PrdAnswers = {
  projectName: "TaskPilot",
  summary: "AI 기반 태스크 관리 도구",
  target: "개발자 및 프로젝트 매니저",
  pains: "수동 태스크 관리, 진행 상황 파악 어려움",
  solutions: "자동 태스크 분류, 실시간 대시보드",
  goals: "생산성 30% 향상, 주간 보고 시간 50% 단축",
  scenarios: "태스크 생성, 진행 상황 확인, 주간 리포트 생성",
  mustFeatures: "태스크 CRUD, 칸반 보드, 알림",
  optFeatures: "AI 요약, 슬랙 연동",
  nonfunc: "응답 시간 200ms 이내, 99.9% 가용성",
  stack: "Next.js, Hono, Supabase, TypeScript",
  scope: "웹 애플리케이션 MVP",
  outScope: "모바일 앱, 데스크톱 앱",
  milestones: "설계 완료, MVP 개발, 베타 출시, 정식 출시",
  risks: "일정 지연 시 MVP 기능 축소, 기술 부채 관리",
};

describe("buildMarkdown", () => {
  it("프로젝트명을 제목으로 포함해야 한다", () => {
    const md = buildMarkdown(sampleAnswers);
    expect(md).toContain("# TaskPilot — PRD");
  });

  it("모든 섹션 헤딩을 포함해야 한다", () => {
    const md = buildMarkdown(sampleAnswers);
    expect(md).toContain("## 1. 제품 개요");
    expect(md).toContain("## 2. 타겟 사용자");
    expect(md).toContain("## 3. 해결하려는 문제 및 솔루션");
    expect(md).toContain("## 4. 목표 및 핵심 지표");
    expect(md).toContain("## 5. 주요 사용 시나리오");
    expect(md).toContain("## 6. 기능 요구사항");
    expect(md).toContain("## 7. 비기능 요구사항");
    expect(md).toContain("## 8. 기술 스택");
    expect(md).toContain("## 9. 범위");
    expect(md).toContain("## 10. 마일스톤");
    expect(md).toContain("## 11. 리스크 및 완화 전략");
  });

  it("Pain Point-솔루션 매핑 테이블을 생성해야 한다", () => {
    const md = buildMarkdown(sampleAnswers);
    expect(md).toContain("| Pain Point | 해결 방안 |");
    expect(md).toContain("수동 태스크 관리");
    expect(md).toContain("자동 태스크 분류");
    expect(md).toContain("진행 상황 파악 어려움");
    expect(md).toContain("실시간 대시보드");
  });

  it("솔루션 수가 문제보다 적으면 '-'로 채워야 한다", () => {
    const answers = { ...sampleAnswers, pains: "문제1, 문제2, 문제3", solutions: "해결1" };
    const md = buildMarkdown(answers);
    expect(md).toContain("| 문제2 | \\- |");
    expect(md).toContain("| 문제3 | \\- |");
  });

  it("기능 테이블에 Must-Have와 Optional을 구분해야 한다", () => {
    const md = buildMarkdown(sampleAnswers);
    expect(md).toContain("| # | 기능 | 우선순위 |");
    expect(md).toContain("Must-Have");
    expect(md).toContain("Optional");
    expect(md).toContain("태스크 CRUD");
    expect(md).toContain("AI 요약");
  });

  it("기술 스택을 코드 포맷으로 나열해야 한다", () => {
    const md = buildMarkdown(sampleAnswers);
    expect(md).toContain("`Next.js`");
    expect(md).toContain("`Hono`");
    expect(md).toContain("`Supabase`");
  });

  it("선택 항목이 비어있으면 '-'를 표시해야 한다", () => {
    const answers = { ...sampleAnswers, optFeatures: "", nonfunc: "", risks: "" };
    const md = buildMarkdown(answers);
    // 비기능 요구사항, 리스크 섹션이 \- 를 포함
    const nonfuncSection = md.split("## 7. 비기능 요구사항")[1].split("## 8.")[0];
    expect(nonfuncSection.trim()).toBe("\\-");
  });

  it("제외 범위가 비어있으면 '-'를 표시해야 한다", () => {
    const answers = { ...sampleAnswers, outScope: "" };
    const md = buildMarkdown(answers);
    const scopeSection = md.split("### 제외")[1].split("## 10.")[0];
    expect(scopeSection.trim()).toBe("\\-");
  });

  it("마크다운 특수문자를 이스케이프해야 한다", () => {
    const answers = { ...sampleAnswers, projectName: "Project**Bold" };
    const md = buildMarkdown(answers);
    expect(md).toContain("Project\\*\\*Bold");
  });

  it("스냅샷: 대표 입력으로 생성된 마크다운이 일관되어야 한다", () => {
    const md = buildMarkdown(sampleAnswers);
    expect(md).toMatchSnapshot();
  });
});

// ── 오케스트레이션 플로우 테스트 ──

describe("runInteractivePrd", () => {
  function mockAllQuestions(answers: PrdAnswers) {
    const keys = Object.keys(answers) as Array<keyof PrdAnswers>;
    for (const key of keys) {
      mockPrompt.mockResolvedValueOnce({ [key]: answers[key] });
    }
  }

  it("모든 질문 수집 후 확인 시 PrdResult를 반환해야 한다", async () => {
    mockAllQuestions(sampleAnswers);
    // 확인 단계
    mockPrompt.mockResolvedValueOnce({ action: "confirm" });

    const result = await runInteractivePrd();

    expect(result.markdown).toContain("# TaskPilot — PRD");
    expect(result.meta.projectName).toBe("TaskPilot");
    expect(result.meta.mode).toBe("interactive");
    expect(result.meta.generatedAt).toBeDefined();
  });

  it("수정 선택 시 항목 수정 후 재확인해야 한다", async () => {
    mockAllQuestions(sampleAnswers);
    // 1차 확인: 수정 선택
    mockPrompt.mockResolvedValueOnce({ action: "edit" });
    // 수정할 항목 선택
    mockPrompt.mockResolvedValueOnce({ fields: ["summary"] });
    // 수정 입력
    mockPrompt.mockResolvedValueOnce({ summary: "수정된 요약" });
    // 2차 확인: 승인
    mockPrompt.mockResolvedValueOnce({ action: "confirm" });

    const result = await runInteractivePrd();

    expect(result.markdown).toContain("수정된 요약");
  });

  it("질문 수는 15개여야 한다", async () => {
    mockAllQuestions(sampleAnswers);
    mockPrompt.mockResolvedValueOnce({ action: "confirm" });

    await runInteractivePrd();

    // 15 질문 + 1 확인 = 16 prompt 호출
    expect(mockPrompt).toHaveBeenCalledTimes(16);
  });

  it("필수 필드에 validate 함수가 설정되어 있어야 한다", async () => {
    mockAllQuestions(sampleAnswers);
    mockPrompt.mockResolvedValueOnce({ action: "confirm" });

    await runInteractivePrd();

    // 첫 번째 호출(projectName)의 validate 확인
    const firstCall = mockPrompt.mock.calls[0][0] as Array<Record<string, unknown>>;
    const validate = firstCall[0].validate as (v: string) => true | string;

    expect(validate("")).not.toBe(true);
    expect(validate("   ")).not.toBe(true);
    expect(validate("TaskPilot")).toBe(true);
  });
});
