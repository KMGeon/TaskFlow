"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import type { Task, TaskStatus } from "@/features/taskflow/types";

const TASKS_KEY = ["tasks"] as const;

async function fetchTasks(): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>("/api/tasks");
  return data;
}

async function setTaskStatus(id: string, to: TaskStatus): Promise<Task> {
  const { data } = await apiClient.post<Task>(`/api/tasks/${id}/status`, { to });
  return data;
}

export function useTasksQuery() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: fetchTasks,
  });
}

export function useSetStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: TaskStatus }) => setTaskStatus(id, to),
    onMutate: async ({ id, to }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueryData<Task[]>(TASKS_KEY);

      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) =>
        old?.map((task) =>
          task.id === id ? { ...task, status: to, updatedAt: new Date().toISOString() } : task,
        ),
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(TASKS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}
