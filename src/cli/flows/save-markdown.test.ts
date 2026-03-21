import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from "inquirer";
import { slugify, saveMarkdown } from "./save-markdown.js";

const mockPrompt = vi.mocked(inquirer.prompt);

let originalCwd: string;
let tempDir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  originalCwd = process.cwd();
  tempDir = await mkdtemp(join(tmpdir(), "save-md-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(tempDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

// ── slugify ──

describe("slugify", () => {
  it("공백을 하이픈으로 변환해야 한다", () => {
    expect(slugify("My Project")).toBe("my-project");
  });

  it("특수문자를 제거해야 한다", () => {
    expect(slugify("Project@#$%^&*!")).toBe("project");
  });

  it("연속 하이픈을 하나로 줄여야 한다", () => {
    expect(slugify("a---b")).toBe("a-b");
  });

  it("앞뒤 하이픈을 제거해야 한다", () => {
    expect(slugify("-project-")).toBe("project");
  });

  it("한글을 유지해야 한다", () => {
    expect(slugify("태스크 파일럿")).toBe("태스크-파일럿");
  });

  it("대문자를 소문자로 변환해야 한다", () => {
    expect(slugify("TaskPilot")).toBe("taskpilot");
  });

  it("숫자를 유지해야 한다", () => {
    expect(slugify("project123")).toBe("project123");
  });

  it("윈도우 예약문자를 제거해야 한다", () => {
    expect(slugify('CON<>:"/\\|?*file')).toBe("con-file");
  });

  it("빈 문자열 입력 시 빈 문자열을 반환해야 한다", () => {
    expect(slugify("@#$%")).toBe("");
  });
});

// ── saveMarkdown ──

describe("saveMarkdown", () => {
  const content = "# PRD\n\n내용입니다.";

  it("새 파일을 저장하고 경로를 반환해야 한다", async () => {
    const filePath = await saveMarkdown({
      projectName: "TestApp",
      filename: "prd.md",
      content,
    });

    expect(filePath).toBe(join(tempDir, "testapp-docs", "prd.md"));

    const saved = await readFile(filePath, "utf-8");
    expect(saved).toBe(content);
  });

  it("디렉토리를 자동 생성해야 한다", async () => {
    await saveMarkdown({
      projectName: "NewProject",
      filename: "prd.md",
      content,
    });

    const dirPath = join(tempDir, "newproject-docs");
    await expect(access(dirPath)).resolves.toBeUndefined();
  });

  it("중첩 경로의 filename도 처리해야 한다", async () => {
    const filePath = await saveMarkdown({
      projectName: "App",
      filename: "features/auth-prd.md",
      content,
    });

    expect(filePath).toBe(join(tempDir, "app-docs", "features", "auth-prd.md"));

    const saved = await readFile(filePath, "utf-8");
    expect(saved).toBe(content);
  });

  it("파일 존재 시 덮어쓰기 확인을 요청해야 한다", async () => {
    // 기존 파일 생성
    const dir = join(tempDir, "testapp-docs");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "prd.md"), "old content", "utf-8");

    mockPrompt.mockResolvedValueOnce({ overwrite: true });

    const filePath = await saveMarkdown({
      projectName: "TestApp",
      filename: "prd.md",
      content: "new content",
    });

    const saved = await readFile(filePath, "utf-8");
    expect(saved).toBe("new content");
    expect(mockPrompt).toHaveBeenCalledOnce();
  });

  it("덮어쓰기 거부 시 기존 파일을 유지해야 한다", async () => {
    const dir = join(tempDir, "testapp-docs");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "prd.md"), "old content", "utf-8");

    mockPrompt.mockResolvedValueOnce({ overwrite: false });

    await saveMarkdown({
      projectName: "TestApp",
      filename: "prd.md",
      content: "new content",
    });

    const saved = await readFile(join(dir, "prd.md"), "utf-8");
    expect(saved).toBe("old content");
  });

  it("파일이 없으면 덮어쓰기 확인을 요청하지 않아야 한다", async () => {
    await saveMarkdown({
      projectName: "Fresh",
      filename: "prd.md",
      content,
    });

    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it("UTF-8 인코딩으로 저장해야 한다", async () => {
    const koreanContent = "# 한국어 PRD\n\n프로젝트 설명 🚀";

    const filePath = await saveMarkdown({
      projectName: "Korean",
      filename: "prd.md",
      content: koreanContent,
    });

    const saved = await readFile(filePath, "utf-8");
    expect(saved).toBe(koreanContent);
  });

  it("유효하지 않은 프로젝트명이면 에러를 던져야 한다", async () => {
    await expect(
      saveMarkdown({
        projectName: "@#$%",
        filename: "prd.md",
        content,
      }),
    ).rejects.toThrow("프로젝트명이 유효하지 않습니다");
  });

  it("원자적 쓰기: 저장 후 tmp 파일이 남지 않아야 한다", async () => {
    const filePath = await saveMarkdown({
      projectName: "Atomic",
      filename: "prd.md",
      content,
    });

    const tmpPath = `${filePath}.tmp`;
    await expect(access(tmpPath)).rejects.toThrow();
  });
});
