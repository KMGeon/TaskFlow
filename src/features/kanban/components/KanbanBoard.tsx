"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { ProgressCard } from "./ProgressCard";
import { KanbanSkeleton } from "./KanbanSkeleton";
import { KanbanError } from "./KanbanError";
import { useTasksQuery, useSetStatusMutation } from "../hooks/useTasksQuery";
import { useTaskSse } from "../hooks/useTaskSse";
import { groupByStatus, COLUMN_ORDER } from "../lib/kanban-utils";
import type { Task, TaskStatus } from "@/features/taskflow/types";
import { TASK_STATUSES } from "@/features/taskflow/types";

export function KanbanBoard() {
  const { data: tasks, isLoading, isError, error, refetch } = useTasksQuery();
  const mutation = useSetStatusMutation();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  useTaskSse();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  if (isLoading) return <KanbanSkeleton />;
  if (isError) return <KanbanError message={error?.message} onRetry={() => refetch()} />;

  const allTasks = tasks ?? [];
  const columns = groupByStatus(allTasks);

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const newStatus = String(over.id) as TaskStatus;

    if (!(TASK_STATUSES as readonly string[]).includes(newStatus)) return;

    const task = allTasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    mutation.mutate({ id: taskId, to: newStatus });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Board header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">칸반 보드</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {allTasks.length}개의 태스크
          </p>
        </div>
        <div className="w-64">
          <ProgressCard tasks={allTasks} />
        </div>
      </div>

      {/* Board columns */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {COLUMN_ORDER.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={columns[status]}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-[264px]">
              <TaskCard task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
