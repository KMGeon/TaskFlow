import { describe, expect, it, vi, beforeEach } from "vitest";

// inquirer, ora를 모킹
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

vi.mock("./interactive.js", () => ({
  runInteractivePrd: vi.fn(),
}));

vi.mock("./auto.js", () => ({
  runAutoPrd: vi.fn(),
}));

import inquirer from "inquirer";
import ora from "ora";
import { runInteractivePrd } from "./interactive.js";
import { runAutoPrd } from "./auto.js";
import { runPrdFlow } from "./prd-flow.js";

const mockPrompt = vi.mocked(inquirer.prompt);
const mockInteractive = vi.mocked(runInteractivePrd);
const mockAuto = vi.mocked(runAutoPrd);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runPrdFlow", () => {
  const fakePrdResult = {
    markdown: "# PRD\n내용",
    meta: { version: "1.0" },
  };

  it("대화형 모드 선택 시 runInteractivePrd를 호출해야 한다", async () => {
    mockPrompt.mockResolvedValueOnce({ mode: "interactive" });
    mockInteractive.mockResolvedValueOnce(fakePrdResult);

    const result = await runPrdFlow();

    expect(mockInteractive).toHaveBeenCalledOnce();
    expect(mockAuto).not.toHaveBeenCalled();
    expect(result).toEqual(fakePrdResult);
  });

  it("AI 자동 분석 모드 선택 시 runAutoPrd를 호출해야 한다", async () => {
    mockPrompt.mockResolvedValueOnce({ mode: "auto" });
    mockAuto.mockResolvedValueOnce(fakePrdResult);

    const result = await runPrdFlow();

    expect(mockAuto).toHaveBeenCalledOnce();
    expect(mockInteractive).not.toHaveBeenCalled();
    expect(result).toEqual(fakePrdResult);
  });

  it("성공 시 스피너가 succeed 상태로 전이되어야 한다", async () => {
    mockPrompt.mockResolvedValueOnce({ mode: "interactive" });
    mockInteractive.mockResolvedValueOnce(fakePrdResult);

    await runPrdFlow();

    const spinner = ora();
    expect(spinner.start).toHaveBeenCalled();
    expect(spinner.succeed).toHaveBeenCalled();
    expect(spinner.fail).not.toHaveBeenCalled();
  });

  it("실패 시 스피너가 fail 상태로 전이되어야 한다", async () => {
    mockPrompt
      .mockResolvedValueOnce({ mode: "interactive" })
      .mockResolvedValueOnce({ retry: false });
    mockInteractive.mockRejectedValueOnce(new Error("테스트 에러"));

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(runPrdFlow()).rejects.toThrow("process.exit");

    const spinner = ora();
    expect(spinner.fail).toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it("실패 후 재시도 선택 시 runPrdFlow를 재귀 호출해야 한다", async () => {
    // 1차: 실패 → 재시도
    mockPrompt
      .mockResolvedValueOnce({ mode: "auto" })
      .mockResolvedValueOnce({ retry: true })
      // 2차: 성공
      .mockResolvedValueOnce({ mode: "interactive" });

    mockAuto.mockRejectedValueOnce(new Error("일시적 오류"));
    mockInteractive.mockResolvedValueOnce(fakePrdResult);

    const result = await runPrdFlow();

    expect(mockAuto).toHaveBeenCalledOnce();
    expect(mockInteractive).toHaveBeenCalledOnce();
    expect(result).toEqual(fakePrdResult);
  });

  it("실패 후 재시도 거부 시 종료해야 한다", async () => {
    mockPrompt
      .mockResolvedValueOnce({ mode: "interactive" })
      .mockResolvedValueOnce({ retry: false });
    mockInteractive.mockRejectedValueOnce(new Error("치명적 오류"));

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(runPrdFlow()).rejects.toThrow("process.exit");

    expect(mockExit).toHaveBeenCalledWith(0);
    mockExit.mockRestore();
  });

  it("모드 선택 프롬프트에 한국어 메시지가 포함되어야 한다", async () => {
    mockPrompt.mockResolvedValueOnce({ mode: "interactive" });
    mockInteractive.mockResolvedValueOnce(fakePrdResult);

    await runPrdFlow();

    const promptArgs = mockPrompt.mock.calls[0][0] as Array<Record<string, unknown>>;
    const modeQuestion = promptArgs[0];

    expect(modeQuestion.message).toContain("모드를 선택");
    expect(modeQuestion.type).toBe("list");

    const choices = modeQuestion.choices as Array<{ name: string; value: string }>;
    expect(choices).toHaveLength(2);
    expect(choices[0].name).toContain("대화형");
    expect(choices[1].name).toContain("AI 자동 분석");
  });

  it("에러 메시지가 한국어로 표시되어야 한다", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockPrompt
      .mockResolvedValueOnce({ mode: "interactive" })
      .mockResolvedValueOnce({ retry: false });
    mockInteractive.mockRejectedValueOnce(new Error("연결 실패"));

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(runPrdFlow()).rejects.toThrow("process.exit");

    // 재시도 프롬프트에 한국어 메시지 확인
    const retryArgs = mockPrompt.mock.calls[1][0] as Array<Record<string, unknown>>;
    expect(retryArgs[0].message).toContain("다시 시도");

    consoleSpy.mockRestore();
    mockExit.mockRestore();
  });
});
