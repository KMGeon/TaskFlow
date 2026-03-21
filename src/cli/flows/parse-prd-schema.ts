import { z } from "zod";

export const taskItemSchema = z.object({
  title: z.string().min(1, "태스크 제목은 필수입니다"),
  description: z.string().default(""),
  priority: z.number().int().min(0).max(10).default(5),
  dependencies: z.array(z.string()).default([]),
  parentId: z.string().optional(),
  status: z.enum(["Todo", "InProgress", "Blocked", "Done"]).default("Todo"),
});

export const parsePrdResponseSchema = z.object({
  tasks: z.array(taskItemSchema).min(1, "최소 하나의 태스크가 필요합니다"),
});

export type ParsePrdResponse = z.infer<typeof parsePrdResponseSchema>;
export type TaskItem = z.infer<typeof taskItemSchema>;
