import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanError } from "../KanbanError";
import { ProgressCard } from "../ProgressCard";
import { KanbanSkeleton } from "../KanbanSkeleton";
import type { Task } from "@/features/taskflow/types";

const now = "2026-03-21T00:00:00.000Z";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "001",
    title: "Test task",
    status: "Todo",
    priority: 5,
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    description: "",
    ...overrides,
  };
}

describe("KanbanError", () => {
  it("should render error message", () => {
    render(<KanbanError message="테스트 오류" />);
    expect(screen.getByText("오류가 발생했습니다")).toBeInTheDocument();
    expect(screen.getByText("테스트 오류")).toBeInTheDocument();
  });

  it("should render default message when none provided", () => {
    render(<KanbanError />);
    expect(screen.getByText("태스크를 불러오는 중 문제가 발생했습니다.")).toBeInTheDocument();
  });

  it("should render retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<KanbanError onRetry={onRetry} />);
    const button = screen.getByText("다시 시도");
    expect(button).toBeInTheDocument();
    button.click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("should not render retry button without onRetry", () => {
    render(<KanbanError />);
    expect(screen.queryByText("다시 시도")).not.toBeInTheDocument();
  });
});

describe("ProgressCard", () => {
  it("should show 0% for no tasks", () => {
    render(<ProgressCard tasks={[]} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0/0")).toBeInTheDocument();
  });

  it("should show correct progress", () => {
    const tasks = [
      makeTask({ id: "1", status: "Done" }),
      makeTask({ id: "2", status: "Todo" }),
      makeTask({ id: "3", status: "Done" }),
      makeTask({ id: "4", status: "InProgress" }),
    ];
    render(<ProgressCard tasks={tasks} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("2/4")).toBeInTheDocument();
  });

  it("should have accessible progressbar", () => {
    const tasks = [makeTask({ id: "1", status: "Done" })];
    render(<ProgressCard tasks={tasks} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("KanbanSkeleton", () => {
  it("should render four column skeletons", () => {
    render(<KanbanSkeleton />);
    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});
