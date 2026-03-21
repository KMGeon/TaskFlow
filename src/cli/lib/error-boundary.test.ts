import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { withCliErrorBoundary, humanizeError } from "./error-boundary.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── humanizeError ──

describe("humanizeError", () => {
  it("일반 Error 메시지를 반환해야 한다", () => {
    expect(humanizeError(new Error("뭔가 잘못됨"))).toBe("뭔가 잘못됨");
  });

  it("EACCES 코드에 대한 한국어 메시지를 반환해야 한다", () => {
    const err = Object.assign(new Error("원본"), { code: "EACCES" });
    const msg = humanizeError(err);
    expect(msg).toContain("접근 권한");
    expect(msg).toContain("EACCES");
  });

  it("ETIMEDOUT 코드에 대한 한국어 메시지를 반환해야 한다", () => {
    const err = Object.assign(new Error("원본"), { code: "ETIMEDOUT" });
    expect(humanizeError(err)).toContain("시간이 초과");
  });

  it("ENOSPC 코드에 대한 한국어 메시지를 반환해야 한다", () => {
    const err = Object.assign(new Error("원본"), { code: "ENOSPC" });
    expect(humanizeError(err)).toContain("디스크 공간");
  });

  it("ENAMETOOLONG 코드에 대한 한국어 메시지를 반환해야 한다", () => {
    const err = Object.assign(new Error("원본"), { code: "ENAMETOOLONG" });
    expect(humanizeError(err)).toContain("경로가 너무 깁니다");
  });

  it("알 수 없는 코드는 원본 메시지를 반환해야 한다", () => {
    const err = Object.assign(new Error("원본 메시지"), { code: "UNKNOWN" });
    expect(humanizeError(err)).toBe("원본 메시지");
  });

  it("Error가 아닌 값은 문자열로 변환해야 한다", () => {
    expect(humanizeError("문자열 에러")).toBe("문자열 에러");
    expect(humanizeError(42)).toBe("42");
    expect(humanizeError(null)).toBe("null");
  });
});

// ── withCliErrorBoundary ──

describe("withCliErrorBoundary", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it("성공 시 원래 반환값을 전달해야 한다", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const wrapped = withCliErrorBoundary(fn);
    const result = await wrapped();
    expect(result).toBe("result");
  });

  it("일반 에러 발생 시 exitCode를 1로 설정해야 한다", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("실패"));
    const wrapped = withCliErrorBoundary(fn);

    await wrapped();

    expect(process.exitCode).toBe(1);
  });

  it("일반 에러 발생 시 한국어 오류 메시지를 출력해야 한다", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("실패"));
    const wrapped = withCliErrorBoundary(fn);

    await wrapped();

    const allOutput = consoleSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("오류가 발생했습니다");
    expect(allOutput).toContain("실패");
    expect(allOutput).toContain("해결 방법");
  });

  it("CTRL+C (ExitPromptError) 시 exitCode를 0으로 설정해야 한다", async () => {
    const err = new Error("User force closed");
    err.name = "ExitPromptError";
    const fn = vi.fn().mockRejectedValue(err);
    const wrapped = withCliErrorBoundary(fn);

    await wrapped();

    expect(process.exitCode).toBe(0);
  });

  it("CTRL+C 시 친절한 종료 메시지를 출력해야 한다", async () => {
    const logSpy = vi.spyOn(console, "log");
    const err = new Error("User force closed");
    err.name = "ExitPromptError";
    const fn = vi.fn().mockRejectedValue(err);
    const wrapped = withCliErrorBoundary(fn);

    await wrapped();

    const allOutput = logSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("취소");
  });

  it("시스템 에러 코드에 대해 한국어 메시지를 출력해야 한다", async () => {
    const err = Object.assign(new Error("permission denied"), { code: "EACCES" });
    const fn = vi.fn().mockRejectedValue(err);
    const wrapped = withCliErrorBoundary(fn);

    await wrapped();

    const allOutput = consoleSpy.mock.calls.flat().join(" ");
    expect(allOutput).toContain("접근 권한");
  });

  it("인자를 원래 함수에 전달해야 한다", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const wrapped = withCliErrorBoundary(fn);

    await wrapped("arg1", "arg2");

    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });
});
