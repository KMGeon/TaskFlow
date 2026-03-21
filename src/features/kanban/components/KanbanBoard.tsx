import { KanbanColumn } from "./KanbanColumn";
import type { TaskCardData, TaskStatus } from "./TaskCard";

const mockTasks: TaskCardData[] = [
  // Pending
  { id: "TSK-001", title: "PRD 문서 파싱 모듈 구현", status: "pending", complexity: "high" },
  { id: "TSK-002", title: "CLI init 명령어 스캐폴딩", status: "pending", complexity: "medium" },
  { id: "TSK-003", title: "프로젝트 설정 스키마 정의", status: "pending", complexity: "low" },
  { id: "TSK-004", title: "마크다운 렌더링 유틸리티", status: "pending", complexity: "low" },
  // In Progress
  { id: "TSK-005", title: "AI 태스크 분해 엔진 개발", status: "in-progress", complexity: "high" },
  { id: "TSK-006", title: "칸반 보드 UI 목업", status: "in-progress", complexity: "medium" },
  { id: "TSK-007", title: "Supabase 인증 연동", status: "in-progress", complexity: "medium" },
  // Blocked
  { id: "TSK-008", title: "의존성 그래프 시각화", status: "blocked", complexity: "high" },
  { id: "TSK-009", title: "SSE 실시간 알림 연동", status: "blocked", complexity: "medium" },
  { id: "TSK-010", title: "변경 영향도 분석 API", status: "blocked", complexity: "high" },
  // Done
  { id: "TSK-011", title: "디자인 시스템 및 테마 설정", status: "done", complexity: "medium" },
  { id: "TSK-012", title: "프로젝트 초기 세팅", status: "done", complexity: "low" },
  { id: "TSK-013", title: "Supabase 마이그레이션 작성", status: "done", complexity: "low" },
  { id: "TSK-014", title: "라우팅 구조 설계", status: "done", complexity: "medium" },
  { id: "TSK-015", title: "shadcn/ui 컴포넌트 추가", status: "done", complexity: "low" },
];

const columns: TaskStatus[] = ["pending", "in-progress", "blocked", "done"];

export function KanbanBoard() {
  return (
    <div className="flex h-full flex-col">
      {/* Board header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">칸반 보드</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {mockTasks.length}개의 태스크
          </p>
        </div>
      </div>

      {/* Board columns */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {columns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={mockTasks.filter((t) => t.status === status)}
          />
        ))}
      </div>
    </div>
  );
}
