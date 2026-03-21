"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type KanbanErrorProps = {
  message?: string;
  onRetry?: () => void;
};

export function KanbanError({ message, onRetry }: KanbanErrorProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">오류가 발생했습니다</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {message ?? "태스크를 불러오는 중 문제가 발생했습니다."}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          다시 시도
        </Button>
      )}
    </div>
  );
}
