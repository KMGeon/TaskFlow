import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock("ora", () => {
  const spinner = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  };
  return { default: vi.fn(() => spinner) };
});

vi.mock("./auto.js", () => ({
  scanFiles: vi.fn(),
  sampleFiles: vi.fn(),
  generateWithAI: vi.fn(),
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock("./save-markdown.js", () => ({
  saveMarkdown: vi.fn().mockResolvedValue("/fake/path/features/auth.md"),
  slugify: vi.fn((name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, ""),
  ),
}));

import inquirer from "inquirer";
import { scanFiles, sampleFiles, generateWithAI } from "./auto.js";
import { saveMarkdown, slugify } from "./save-markdown.js";
import {
  runFeaturePrdFlow,
  buildFeatureMarkdown,
  analyzeRelated,
  type FeatureAnswers,
} from "./feature-prd-flow.js";

const mockPrompt = vi.mocked(inquirer.prompt);
const mockScanFiles = vi.mocked(scanFiles);
const mockSampleFiles = vi.mocked(sampleFiles);
const mockGenerateWithAI = vi.mocked(generateWithAI);
const mockSaveMarkdown = vi.mocked(saveMarkdown);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 샘플 데이터 ──

const sampleAnswers: FeatureAnswers = {
  projectName: "TaskFlow",
  featureName: "사용자 인증",
  goal: "이메일/비밀번호 기반 로그인 및 회원가입 기능 제공",
  stories: "사용자는 이메일로 회원가입할 수 있다, 사용자는 로그인할 수 있다",
  reqs: "회원가입 폼, 로그인 폼, JWT 토큰 발급, 비밀번호 해싱",
  criteria: "회원가입 후 자동 로그인, 잘못된 비밀번호 시 에러 메시지, 토큰 만료 시 리다이렉트",
  nonfunc: "응답 시간 500ms 이내, 비밀번호 bcrypt 해싱",
  scope: "auth 모듈, API /api/auth/*, 미들웨어",
  risks: "토큰 탈취 위험 - httpOnly 쿠키 사용, 비밀번호 유출 - bcrypt + salt",
  timeline: "1주차: 설계, 2주차: 구현, 3주차: 테스트",
  autoAnalyze: true,
};

function mockAllQuestions(answers: FeatureAnswers) {
  const keys: Array<keyof FeatureAnswers> = [
    "projectName", "featureName", "goal", "stories", "reqs",
    "criteria", "nonfunc", "scope", "risks", "timeline", "autoAnalyze",
  ];
  for (const key of keys) {
    mockPrompt.mockResolvedValueOnce({ [key]: answers[key] });
  }
}

// ── buildFeatureMarkdown ──

describe("buildFeatureMarkdown", () => {
  it("기능명을 제목으로 포함해야 한다", () => {
    const md = buildFeatureMarkdown(sampleAnswers, "");
    expect(md).toContain("사용자 인증 — 기능 PRD");
  });

  it("프로젝트명을 표시해야 한다", () => {
    const md = buildFeatureMarkdown(sampleAnswers, "");
    expect(md).toContain("프로젝트: TaskFlow");
  });

  it("모든 섹션 헤딩을 포함해야 한다", () => {
    const md = buildFeatureMarkdown(sampleAnswers, "");
    expect(md).toContain("## 1. 개요");
    expect(md).toContain("## 2. 사용자 스토리");
    expect(md).toContain("## 3. 기능 요구사항");
    expect(md).toContain("## 4. 코드 분석 결과");
    expect(md).toContain("## 5. 수용 기준");
    expect(md).toContain("## 6. 비기능 요구사항");
    expect(md).toContain("## 7. 영향 범위");
    expect(md).toContain("## 8. 리스크 및 완화 전략");
    expect(md).toContain("## 9. 예상 타임라인");
  });

  it("요구사항을 테이블로 렌더링해야 한다", () => {
    const md = buildFeatureMarkdown(sampleAnswers, "");
    expect(md).toContain("| # | 요구사항 |");
    expect(md).toContain("| 1 |");
    expect(md).toContain("회원가입 폼");
  });

  it("수용 기준을 체크리스트로 렌더링해야 한다", () => {
    const md = buildFeatureMarkdown(sampleAnswers, "");
    expect(md).toContain("- [ ] 회원가입 후 자동 로그인");
  });

  it("코드 분석 결과가 있으면 해당 섹션에 포함해야 한다", () => {
    const analysis = "관련 파일: src/auth/login.ts";
    const md = buildFeatureMarkdown(sampleAnswers, analysis);
    expect(md).toContain("관련 파일: src/auth/login.ts");
    expect(md).not.toContain("N/A (코드 분석 미수행)");
  });

  it("코드 분석 결과가 없으면 N/A를 표시해야 한다", () => {
    const md = buildFeatureMarkdown(sampleAnswers, "");
    expect(md).toContain("N/A (코드 분석 미수행)");
  });

  it("선택 항목이 비어있으면 '-'를 표시해야 한다", () => {
    const answers = { ...sampleAnswers, nonfunc: "", risks: "", timeline: "" };
    const md = buildFeatureMarkdown(answers, "");

    const nonfuncSection = md.split("## 6. 비기능 요구사항")[1].split("## 7.")[0];
    expect(nonfuncSection.trim()).toBe("\\-");
  });

  it("스냅샷: 대표 입력으로 생성된 마크다운이 일관되어야 한다", () => {
    const md = buildFeatureMarkdown(sampleAnswers, "AI 분석 결과 텍스트");
    expect(md).toMatchSnapshot();
  });
});

// ── analyzeRelated ──

describe("analyzeRelated", () => {
  it("키워드 기반으로 관련 파일을 우선 샘플링해야 한다", async () => {
    mockScanFiles.mockResolvedValue([
      "src/auth/login.ts",
      "src/auth/register.ts",
      "src/utils/helpers.ts",
      "src/api/users.ts",
    ]);
    mockSampleFiles.mockResolvedValue([
      { path: "src/auth/login.ts", content: "export function login() {}", truncated: false },
    ]);
    mockGenerateWithAI.mockResolvedValue("분석 결과");

    const result = await analyzeRelated("auth login");

    expect(mockScanFiles).toHaveBeenCalled();
    expect(mockSampleFiles).toHaveBeenCalled();
    expect(mockGenerateWithAI).toHaveBeenCalled();
    expect(result).toBe("분석 결과");
  });

  it("파일이 없으면 빈 문자열을 반환해야 한다", async () => {
    mockScanFiles.mockResolvedValue([]);

    const result = await analyzeRelated("nonexistent");

    expect(result).toBe("");
    expect(mockGenerateWithAI).not.toHaveBeenCalled();
  });

  it("AI 프롬프트에 기능명이 포함되어야 한다", async () => {
    mockScanFiles.mockResolvedValue(["src/index.ts"]);
    mockSampleFiles.mockResolvedValue([
      { path: "src/index.ts", content: "code", truncated: false },
    ]);
    mockGenerateWithAI.mockResolvedValue("result");

    await analyzeRelated("사용자 인증");

    const prompt = mockGenerateWithAI.mock.calls[0][0];
    expect(prompt).toContain("사용자 인증");
    expect(prompt).toContain("추측하지 마세요");
  });
});

// ── runFeaturePrdFlow (통합) ──

describe("runFeaturePrdFlow", () => {
  it("질문 수집 → 코드 분석 → 마크다운 생성 → 저장 플로우", async () => {
    mockAllQuestions(sampleAnswers);
    mockScanFiles.mockResolvedValue(["src/index.ts"]);
    mockSampleFiles.mockResolvedValue([
      { path: "src/index.ts", content: "code", truncated: false },
    ]);
    mockGenerateWithAI.mockResolvedValue("AI 분석 결과");

    const result = await runFeaturePrdFlow();

    expect(result.markdown).toContain("사용자 인증 — 기능 PRD");
    expect(result.markdown).toContain("AI 분석 결과");
    expect(result.meta.projectName).toBe("TaskFlow");
    expect(result.meta.featureName).toBe("사용자 인증");
    expect(result.meta.mode).toBe("feature");
    expect(result.meta.codeAnalyzed).toBe(true);
    expect(mockSaveMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: "TaskFlow",
        filename: expect.stringContaining("features/"),
      }),
    );
  });

  it("코드 분석 OFF 시 AI 호출을 하지 않아야 한다", async () => {
    const noAnalyze = { ...sampleAnswers, autoAnalyze: false };
    mockAllQuestions(noAnalyze);

    const result = await runFeaturePrdFlow();

    expect(mockScanFiles).not.toHaveBeenCalled();
    expect(result.markdown).toContain("N/A (코드 분석 미수행)");
    expect(result.meta.codeAnalyzed).toBe(false);
  });

  it("코드 분석 실패 시 분석 없이 계속 진행해야 한다", async () => {
    mockAllQuestions(sampleAnswers);
    mockScanFiles.mockRejectedValue(new Error("스캔 실패"));

    const result = await runFeaturePrdFlow();

    expect(result.markdown).toContain("N/A (코드 분석 미수행)");
    expect(mockSaveMarkdown).toHaveBeenCalled();
  });

  it("질문은 11개여야 한다", async () => {
    mockAllQuestions(sampleAnswers);
    mockScanFiles.mockResolvedValue([]);

    await runFeaturePrdFlow();

    expect(mockPrompt).toHaveBeenCalledTimes(11);
  });

  it("필수 필드에 validate가 설정되어 있어야 한다", async () => {
    mockAllQuestions(sampleAnswers);
    mockScanFiles.mockResolvedValue([]);

    await runFeaturePrdFlow();

    // projectName validate 확인
    const firstCall = mockPrompt.mock.calls[0][0] as Array<Record<string, unknown>>;
    const validate = firstCall[0].validate as (v: string) => true | string;
    expect(validate("")).not.toBe(true);
    expect(validate("TaskFlow")).toBe(true);

    // featureName validate 확인
    const secondCall = mockPrompt.mock.calls[1][0] as Array<Record<string, unknown>>;
    const validate2 = secondCall[0].validate as (v: string) => true | string;
    expect(validate2("")).not.toBe(true);
  });

  it("저장 경로에 기능명 슬러그가 포함되어야 한다", async () => {
    mockAllQuestions(sampleAnswers);
    mockScanFiles.mockResolvedValue([]);

    await runFeaturePrdFlow();

    const saveCall = mockSaveMarkdown.mock.calls[0][0] as { filename: string };
    expect(saveCall.filename).toMatch(/^features\/.+\.md$/);
  });
});
