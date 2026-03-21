import { z } from "zod";

export const subtaskItemSchema = z.object({
  tempId: z.string().min(1),
  title: z.string().min(1, "서브태스크 제목은 필수입니다"),
  description: z.string().default(""),
  priority: z.number().int().min(0).max(10).default(5),
  dependencies: z.array(z.string()).default([]),
  estimate: z.string().optional(),
});

export const brainstormResponseSchema = z.object({
  subtasks: z.array(subtaskItemSchema).min(1, "최소 하나의 서브태스크가 필요합니다"),
  rationale: z.string().optional(),
});

export type SubtaskItem = z.infer<typeof subtaskItemSchema>;
export type BrainstormResponse = z.infer<typeof brainstormResponseSchema>;
