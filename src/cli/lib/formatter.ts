import chalk from "chalk";
import Table from "cli-table3"; // eslint-disable-line
import boxen from "boxen";
import type { Task, TaskStatus } from "@/features/taskflow/types";

// ── Status Config ──────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { color: (t: string) => string; icon: string }> = {
  Todo:       { color: chalk.yellow,        icon: "○" },
  InProgress: { color: chalk.hex("#FFA500"), icon: "▶" },
  Blocked:    { color: chalk.red,            icon: "!" },
  Done:       { color: chalk.green,          icon: "✓" },
};

function getStatusWithColor(status: TaskStatus): string {
  const cfg = STATUS_CONFIG[status];
  return cfg.color(`${cfg.icon} ${status}`);
}

// ── Priority Format ────────────────────────────────────────────

function getPriorityWithColor(priority: number): string {
  if (priority >= 9) return chalk.red.bold(String(priority));
  if (priority >= 7) return chalk.red(String(priority));
  if (priority >= 4) return chalk.yellow(String(priority));
  return chalk.gray(String(priority));
}

// ── Helpers ────────────────────────────────────────────────────

export function truncate(text: string, maxLen: number): string {
  if (visibleLength(text) <= maxLen) return text;
  if (maxLen <= 3) return sliceByWidth(text, maxLen).taken;
  return sliceByWidth(text, maxLen - 3).taken + "...";
}

function getBoxWidth(percentage = 0.9, minWidth = 40): number {
  const terminalWidth = process.stdout.columns || 80;
  return Math.max(Math.floor(terminalWidth * percentage), minWidth);
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return iso.slice(0, 10);
}

// ── Progress Bar ───────────────────────────────────────────────

function createProgressBar(tasks: Task[], width = 30): string {
  const total = tasks.length;
  if (total === 0) return chalk.gray("태스크 없음");

  const counts: Record<TaskStatus, number> = { Todo: 0, InProgress: 0, Blocked: 0, Done: 0 };
  for (const t of tasks) counts[t.status]++;

  let bar = "";
  let used = 0;

  // Done → green filled
  const doneChars = Math.round((counts.Done / total) * width);
  if (doneChars > 0) { bar += chalk.green("█").repeat(doneChars); used += doneChars; }

  // InProgress → blue filled
  const ipChars = Math.min(Math.round((counts.InProgress / total) * width), width - used);
  if (ipChars > 0) { bar += chalk.blue("█").repeat(ipChars); used += ipChars; }

  // Todo → yellow empty
  const todoChars = Math.min(Math.round((counts.Todo / total) * width), width - used);
  if (todoChars > 0) { bar += chalk.yellow("░").repeat(todoChars); used += todoChars; }

  // Blocked → red empty
  const blockedChars = Math.min(Math.round((counts.Blocked / total) * width), width - used);
  if (blockedChars > 0) { bar += chalk.red("░").repeat(blockedChars); used += blockedChars; }

  // Fill remaining
  if (used < width) bar += chalk.yellow("░").repeat(width - used);

  const pct = Math.round((counts.Done / total) * 100);
  return `${bar} ${chalk.cyan(`${pct}%`)} (${counts.Done}/${total})`;
}

// ── Dashboard ──────────────────────────────────────────────────

function buildProjectDashboard(tasks: Task[]): string {
  const total = tasks.length;
  const counts: Record<TaskStatus, number> = { Todo: 0, InProgress: 0, Blocked: 0, Done: 0 };
  for (const t of tasks) counts[t.status]++;

  const progressBar = createProgressBar(tasks);

  // Priority breakdown
  let critical = 0, high = 0, medium = 0, low = 0;
  for (const t of tasks) {
    if (t.priority >= 9) critical++;
    else if (t.priority >= 7) high++;
    else if (t.priority >= 4) medium++;
    else low++;
  }

  const content =
    chalk.white.bold("프로젝트 대시보드") + "\n" +
    `진행률: ${progressBar}\n` +
    `완료: ${chalk.green(counts.Done)}  진행중: ${chalk.hex("#FFA500")(String(counts.InProgress))}  대기: ${chalk.yellow(counts.Todo)}  차단: ${chalk.red(counts.Blocked)}\n\n` +
    chalk.cyan.bold("우선순위 분포:") + "\n" +
    `${chalk.red("•")} ${chalk.white("긴급 (9-10):")} ${critical}\n` +
    `${chalk.red("•")} ${chalk.white("높음 (7-8):")} ${high}\n` +
    `${chalk.yellow("•")} ${chalk.white("보통 (4-6):")} ${medium}\n` +
    `${chalk.green("•")} ${chalk.white("낮음 (0-3):")} ${low}`;

  return content;
}

function buildDependencyDashboard(tasks: Task[]): string {
  const doneIds = new Set(tasks.filter((t) => t.status === "Done").map((t) => t.id));
  const activeTasks = tasks.filter((t) => t.status !== "Done");

  const noDeps = activeTasks.filter((t) => t.dependencies.length === 0).length;
  const depsSatisfied = activeTasks.filter(
    (t) => t.dependencies.length > 0 && t.dependencies.every((d) => doneIds.has(d)),
  ).length;
  const blockedByDeps = activeTasks.filter(
    (t) => t.dependencies.length > 0 && !t.dependencies.every((d) => doneIds.has(d)),
  ).length;

  // Most depended-on task
  const depCount: Record<string, number> = {};
  for (const t of tasks) {
    for (const d of t.dependencies) {
      depCount[d] = (depCount[d] || 0) + 1;
    }
  }
  let mostDepId: string | undefined;
  let mostDepCount = 0;
  for (const [id, count] of Object.entries(depCount)) {
    if (count > mostDepCount) { mostDepId = id; mostDepCount = count; }
  }

  const totalDeps = tasks.reduce((s, t) => s + t.dependencies.length, 0);
  const avgDeps = tasks.length > 0 ? (totalDeps / tasks.length).toFixed(1) : "0.0";

  const content =
    chalk.white.bold("의존성 현황") + "\n" +
    chalk.cyan.bold("의존성 지표:") + "\n" +
    `${chalk.green("•")} ${chalk.white("의존성 없음:")} ${noDeps}\n` +
    `${chalk.green("•")} ${chalk.white("작업 가능:")} ${noDeps + depsSatisfied}\n` +
    `${chalk.yellow("•")} ${chalk.white("의존성 대기:")} ${blockedByDeps}\n` +
    `${chalk.magenta("•")} ${chalk.white("최다 의존 태스크:")} ${
      mostDepId ? chalk.cyan(`#${mostDepId} (${mostDepCount}개 태스크가 의존)`) : chalk.gray("없음")
    }\n` +
    `${chalk.blue("•")} ${chalk.white("평균 의존성 수:")} ${avgDeps}`;

  return content;
}

export function formatDashboard(tasks: Task[]): string {
  if (tasks.length === 0) return "";

  const projectContent = buildProjectDashboard(tasks);
  const depContent = buildDependencyDashboard(tasks);

  const terminalWidth = process.stdout.columns || 80;
  const minSideWidth = 50;

  if (terminalWidth >= minSideWidth * 2 + 4) {
    // Side by side
    const halfWidth = Math.floor(terminalWidth / 2) - 1;
    const boxWidth = halfWidth - 2;

    const leftBox = boxen(projectContent, {
      padding: 1,
      borderColor: "blue",
      borderStyle: "round",
      width: boxWidth,
      dimBorder: false,
    });

    const rightBox = boxen(depContent, {
      padding: 1,
      borderColor: "magenta",
      borderStyle: "round",
      width: boxWidth,
      dimBorder: false,
    });

    const leftLines = leftBox.split("\n");
    const rightLines = rightBox.split("\n");
    const maxH = Math.max(leftLines.length, rightLines.length);

    const combined: string[] = [];
    for (let i = 0; i < maxH; i++) {
      const l = i < leftLines.length ? leftLines[i] : "";
      const r = i < rightLines.length ? rightLines[i] : "";
      combined.push(l.padEnd(halfWidth) + r);
    }
    return combined.join("\n");
  }

  // Stacked
  const leftBox = boxen(projectContent, {
    padding: 1,
    borderColor: "blue",
    borderStyle: "round",
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
  });

  const rightBox = boxen(depContent, {
    padding: 1,
    borderColor: "magenta",
    borderStyle: "round",
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
  });

  return leftBox + "\n" + rightBox;
}

// ── Task Table (cli-table3) ────────────────────────────────────

export function formatTaskTable(tasks: Task[]): string {
  if (tasks.length === 0) {
    return chalk.gray("태스크가 없습니다.");
  }

  const tableWidth = getBoxWidth(0.9, 80);

  // Column widths as ratios: ID, Title, Status, Priority, Dependencies, Updated
  const ratios = [0.07, 0.30, 0.18, 0.1, 0.15, 0.14];
  const colWidths = ratios.map((r) => Math.max(Math.floor(tableWidth * r), 6));

  const table = new Table({
    head: [
      chalk.blue.bold("ID"),
      chalk.blue.bold("제목"),
      chalk.blue.bold("상태"),
      chalk.blue.bold("우선순위"),
      chalk.blue.bold("의존성"),
      chalk.blue.bold("수정일"),
    ],
    style: { head: [], border: [] },
    colWidths,
    wordWrap: true,
  });

  for (const task of tasks) {
    table.push([
      chalk.cyan(task.id),
      truncate(task.title, colWidths[1] - 3),
      getStatusWithColor(task.status),
      getPriorityWithColor(task.priority),
      task.dependencies.length > 0
        ? chalk.cyan(task.dependencies.join(", "))
        : chalk.gray("-"),
      formatRelativeDate(task.updatedAt),
    ]);
  }

  return table.toString();
}

// ── Task Detail ────────────────────────────────────────────────

export function formatTaskDetail(task: Task): string {
  const content = [
    `${chalk.cyan.bold("ID:")}          ${chalk.cyan(task.id)}`,
    `${chalk.white.bold("제목:")}        ${task.title}`,
    `${chalk.white.bold("상태:")}        ${getStatusWithColor(task.status)}`,
    `${chalk.white.bold("우선순위:")}    ${getPriorityWithColor(task.priority)}`,
    `${chalk.white.bold("의존성:")}      ${
      task.dependencies.length > 0
        ? chalk.cyan(task.dependencies.join(", "))
        : chalk.gray("없음")
    }`,
  ];

  if (task.parentId) {
    content.push(`${chalk.white.bold("상위 태스크:")}  ${chalk.cyan(task.parentId)}`);
  }

  content.push(
    `${chalk.white.bold("생성일:")}      ${task.createdAt}`,
    `${chalk.white.bold("수정일:")}      ${task.updatedAt}`,
  );

  if (task.description) {
    content.push("", chalk.white.bold("설명:"), task.description);
  }

  const boxContent = content.join("\n");

  return boxen(boxContent, {
    padding: 1,
    borderColor: "cyan",
    borderStyle: "round",
    title: `Task #${task.id}`,
    titleAlignment: "left",
  });
}

// ── Kanban Board ──────────────────────────────────────────────

const KANBAN_COLUMNS: { status: TaskStatus; label: string; color: (t: string) => string; dot: string }[] = [
  { status: "Todo",       label: "대기",   color: chalk.yellow,        dot: "○" },
  { status: "InProgress", label: "진행중", color: chalk.hex("#FFA500"), dot: "▶" },
  { status: "Blocked",    label: "차단",   color: chalk.red,           dot: "!" },
  { status: "Done",       label: "완료",   color: chalk.green,         dot: "✓" },
];

function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = { Todo: [], InProgress: [], Blocked: [], Done: [] };
  for (const t of tasks) groups[t.status].push(t);
  return groups;
}

function renderCard(task: Task, cardWidth: number, compact?: boolean): string[] {
  const lines: string[] = [];
  const inner = cardWidth - 4; // 양쪽 패딩/테두리

  // 상단 테두리
  lines.push(chalk.gray("┌" + "─".repeat(cardWidth - 2) + "┐"));

  // ID + 우선순위
  const idLine = ` ${chalk.cyan("#" + task.id)}  ${getPriorityWithColor(task.priority)}`;
  lines.push(chalk.gray("│") + padToWidth(idLine, inner) + chalk.gray("│"));

  // 제목 (줄바꿈 처리)
  const titleChunks = wrapText(task.title, inner - 1);
  for (const chunk of titleChunks) {
    lines.push(chalk.gray("│") + " " + padToWidth(chunk, inner - 1) + chalk.gray("│"));
  }

  // 설명 (compact 아닐 때만, 첫 줄만)
  if (!compact && task.description) {
    const descPreview = truncate(task.description.split("\n")[0], inner - 2);
    lines.push(chalk.gray("│") + " " + chalk.gray(padToWidth(descPreview, inner - 1)) + chalk.gray("│"));
  }

  // 의존성
  if (task.dependencies.length > 0) {
    const depText = chalk.gray("의존: ") + chalk.cyan(task.dependencies.join(", "));
    lines.push(chalk.gray("│") + " " + padToWidth(depText, inner - 1) + chalk.gray("│"));
  }

  // 수정일
  const dateLine = chalk.gray(formatRelativeDate(task.updatedAt));
  lines.push(chalk.gray("│") + " " + padToWidth(dateLine, inner - 1) + chalk.gray("│"));

  // 하단 테두리
  lines.push(chalk.gray("└" + "─".repeat(cardWidth - 2) + "┘"));

  return lines;
}

function sliceByWidth(text: string, maxWidth: number): { taken: string; rest: string } {
  let width = 0;
  let i = 0;
  const chars = [...text]; // 유니코드 안전 분해
  for (; i < chars.length; i++) {
    const code = chars[i].codePointAt(0)!;
    const cw = isCjk(code) ? 2 : 1;
    if (width + cw > maxWidth) break;
    width += cw;
  }
  return { taken: chars.slice(0, i).join(""), rest: chars.slice(i).join("") };
}

function isCjk(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3040 && code <= 0x33bf) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x2fffd)
  );
}

function wrapText(text: string, maxWidth: number): string[] {
  if (visibleLength(text) <= maxWidth) return [text];
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (visibleLength(remaining) <= maxWidth) {
      lines.push(remaining);
      break;
    }
    const { taken, rest } = sliceByWidth(remaining, maxWidth);
    lines.push(taken);
    remaining = rest.trimStart();
  }
  return lines.slice(0, 3); // 최대 3줄
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleLength(str: string): number {
  const clean = stripAnsi(str);
  let len = 0;
  for (const ch of clean) {
    const code = ch.codePointAt(0)!;
    // CJK 문자 (한글, 한자, 일본어 등)는 터미널에서 2칸 차지
    if (
      (code >= 0x1100 && code <= 0x115f) ||  // 한글 자모
      (code >= 0x2e80 && code <= 0x303e) ||  // CJK 부수/기호
      (code >= 0x3040 && code <= 0x33bf) ||  // 히라가나/카타카나
      (code >= 0x3400 && code <= 0x4dbf) ||  // CJK 확장 A
      (code >= 0x4e00 && code <= 0xa4cf) ||  // CJK 통합 한자
      (code >= 0xac00 && code <= 0xd7af) ||  // 한글 음절
      (code >= 0xf900 && code <= 0xfaff) ||  // CJK 호환 한자
      (code >= 0xfe30 && code <= 0xfe4f) ||  // CJK 호환 형태
      (code >= 0xff01 && code <= 0xff60) ||  // 전각 문자
      (code >= 0xffe0 && code <= 0xffe6) ||  // 전각 기호
      (code >= 0x20000 && code <= 0x2fffd)   // CJK 확장 B~
    ) {
      len += 2;
    } else {
      len += 1;
    }
  }
  return len;
}

function padToWidth(str: string, width: number): string {
  const visible = visibleLength(str);
  if (visible >= width) return str;
  return str + " ".repeat(width - visible);
}

export function formatKanbanBoard(
  tasks: Task[],
  options?: { compact?: boolean },
): string {
  const compact = options?.compact;
  const groups = groupByStatus(tasks);
  const termWidth = process.stdout.columns || 80;
  const columnCount = KANBAN_COLUMNS.length;
  const gap = 2;
  const colWidth = Math.max(Math.floor((termWidth - gap * (columnCount - 1)) / columnCount), 20);
  const cardWidth = colWidth - 2;

  // 진행률 헤더
  const doneCount = groups.Done.length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const barWidth = Math.min(30, termWidth - 30);
  const filledCount = Math.round((pct / 100) * barWidth);
  const progressBar =
    chalk.green("█").repeat(filledCount) +
    chalk.gray("░").repeat(barWidth - filledCount);

  const header =
    chalk.white.bold("  칸반 보드") +
    chalk.gray(` — ${total}개 태스크`) +
    "  " +
    progressBar +
    " " +
    chalk.cyan(`${pct}%`);

  const output: string[] = [header, ""];

  // 컬럼 헤더
  const colHeaders: string[] = [];
  for (const col of KANBAN_COLUMNS) {
    const count = groups[col.status].length;
    const label = col.color(`${col.dot} ${col.label}`) + chalk.gray(` (${count})`);
    colHeaders.push(padToWidth(label, colWidth));
  }
  output.push(colHeaders.join(" ".repeat(gap)));

  // 구분선
  const separators: string[] = [];
  for (const col of KANBAN_COLUMNS) {
    separators.push(col.color("─".repeat(colWidth)));
  }
  output.push(separators.join(" ".repeat(gap)));

  // 카드 렌더링 — 각 컬럼의 카드를 줄별로 나란히 배치
  const columnCards: string[][][] = KANBAN_COLUMNS.map((col) => {
    const colTasks = groups[col.status].sort((a, b) => b.priority - a.priority);
    return colTasks.map((task) => renderCard(task, cardWidth, compact));
  });

  // 행 단위로 출력 (각 행 = 4개 컬럼에서 하나씩 카드)
  const maxRows = Math.max(...columnCards.map((cards) => cards.length));

  for (let row = 0; row < maxRows; row++) {
    // 이 행에서 각 컬럼의 카드 줄 수 중 최대값
    const cardLines: string[][] = columnCards.map((cards) =>
      row < cards.length ? cards[row] : [],
    );
    const maxLines = Math.max(...cardLines.map((lines) => lines.length));

    for (let line = 0; line < maxLines; line++) {
      const rowParts: string[] = [];
      for (let c = 0; c < columnCount; c++) {
        const content = line < cardLines[c].length ? cardLines[c][line] : "";
        rowParts.push(padToWidth(content, colWidth));
      }
      output.push(rowParts.join(" ".repeat(gap)));
    }

    // 카드 사이 빈 줄
    if (row < maxRows - 1) {
      output.push("");
    }
  }

  if (tasks.length === 0) {
    output.push("");
    output.push(chalk.gray("  태스크가 없습니다. task parse-prd로 태스크를 생성해보세요."));
  }

  return output.join("\n");
}

// ── Dependency Tree ───────────────────────────────────────────

interface TreeNode {
  task: Task;
  children: TreeNode[];
}

// 깊이별 연결선 색상
const DEPTH_COLORS: ((t: string) => string)[] = [
  chalk.white,
  chalk.cyan,
  chalk.blue,
  chalk.magenta,
  chalk.yellow,
];

function depthColor(depth: number): (t: string) => string {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

// 미니 우선순위 바
function priorityBar(priority: number): string {
  const maxBlocks = 5;
  const filled = Math.round((priority / 10) * maxBlocks);
  const empty = maxBlocks - filled;

  let barColor: (t: string) => string;
  if (priority >= 9) barColor = chalk.red;
  else if (priority >= 7) barColor = chalk.hex("#FFA500");
  else if (priority >= 4) barColor = chalk.yellow;
  else barColor = chalk.gray;

  return barColor("█".repeat(filled)) + chalk.gray("░".repeat(empty)) + " " + barColor(String(priority).padStart(2));
}

// 서브트리 진행률
function subtreeProgress(node: TreeNode): { done: number; total: number } {
  let done = node.task.status === "Done" ? 1 : 0;
  let total = 1;
  for (const child of node.children) {
    const sub = subtreeProgress(child);
    done += sub.done;
    total += sub.total;
  }
  return { done, total };
}

function buildTree(tasks: Task[], rootId?: string): TreeNode[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const childrenOf = new Map<string, string[]>();
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (!childrenOf.has(dep)) childrenOf.set(dep, []);
      childrenOf.get(dep)!.push(t.id);
    }
  }

  const visited = new Set<string>();

  function buildNode(id: string): TreeNode | null {
    if (visited.has(id)) return null;
    const task = taskMap.get(id);
    if (!task) return null;
    visited.add(id);

    const kids = (childrenOf.get(id) ?? [])
      .map((cid) => buildNode(cid))
      .filter((n): n is TreeNode => n !== null)
      .sort((a, b) => b.task.priority - a.task.priority);

    return { task, children: kids };
  }

  if (rootId) {
    const node = buildNode(rootId);
    return node ? [node] : [];
  }

  const roots = tasks
    .filter((t) => t.dependencies.length === 0)
    .sort((a, b) => b.priority - a.priority);

  const trees: TreeNode[] = [];
  for (const root of roots) {
    const node = buildNode(root.id);
    if (node) trees.push(node);
  }

  for (const t of tasks) {
    if (!visited.has(t.id)) {
      const node = buildNode(t.id);
      if (node) trees.push(node);
    }
  }

  return trees;
}

function isActionable(node: TreeNode, doneIds: Set<string>): boolean {
  return node.task.status !== "Done" && node.task.dependencies.every((d) => doneIds.has(d));
}

function renderTreeNode(
  node: TreeNode,
  prefix: string,
  isLast: boolean,
  depth: number,
  doneIds: Set<string>,
  maxDepth?: number,
  output: string[] = [],
): string[] {
  const { task } = node;
  const isDone = task.status === "Done";
  const actionable = isActionable(node, doneIds);
  const dc = depthColor(depth);

  // 연결선
  const connector = depth === 0 ? "" : dc(isLast ? "└─ " : "├─ ");
  const childPrefix = depth === 0 ? "" : dc(isLast ? "   " : "│  ");

  // 상태 아이콘 (고정 2칸: 아이콘 + 공백)
  const statusIcons: Record<TaskStatus, string> = {
    Done: chalk.green("✔"),
    InProgress: chalk.hex("#FFA500")("▶"),
    Todo: chalk.yellow("○"),
    Blocked: chalk.red("✕"),
  };
  const icon = statusIcons[task.status];

  // ID (고정 4칸: #001)
  const idStr = `#${task.id}`;
  const id = isDone ? chalk.gray(idStr) : chalk.cyan.bold(idStr);
  const idCol = padToWidth(id, 4);

  // 우선순위 바 (고정 8칸: █████ + 공백 + 2자리숫자 = "███░░ 10")
  const pBar = isDone
    ? chalk.gray(`${"·".repeat(5)} ${String(task.priority).padStart(2)}`)
    : priorityBar(task.priority);

  // 제목 — 완료는 흐리게, 미완료는 밝게
  const title = isDone ? chalk.gray(task.title) : chalk.white.bold(task.title);

  // 작업 가능 뱃지 (제목 뒤에 배치)
  const actionBadge = actionable ? "  " + chalk.bgYellow.black(" 작업 가능 ") : "";

  // 서브트리 진행률 (자식이 있을 때만)
  let progressBadge = "";
  if (node.children.length > 0) {
    const { done, total } = subtreeProgress(node);
    const pct = Math.round((done / total) * 100);
    if (pct === 100) {
      progressBadge = chalk.green(` (${done}/${total} 완료)`);
    } else {
      progressBadge = chalk.gray(` (${done}/${total} `) + chalk.cyan(`${pct}%`) + chalk.gray(")");
    }
  }

  // 메인 라인: [prefix][connector][icon] [id]  [pBar]  [title][progress][badge]
  const line = `${prefix}${connector}${icon} ${idCol}  ${pBar}  ${title}${progressBadge}${actionBadge}`;
  output.push(line);

  // 깊이 제한
  if (maxDepth !== undefined && depth >= maxDepth) {
    if (node.children.length > 0) {
      output.push(`${prefix}${childPrefix}   ${chalk.gray(`⋯ ${node.children.length}개 하위 태스크 (--depth로 확장)`)}`);
    }
    return output;
  }

  // 자식 노드
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const childIsLast = i === node.children.length - 1;

    // 깊이 1 분기 사이에 여백 추가
    if (depth === 0 && i > 0) {
      output.push(prefix + childPrefix + dc("│"));
    }

    renderTreeNode(child, prefix + childPrefix, childIsLast, depth + 1, doneIds, maxDepth, output);
  }

  return output;
}

export function formatDependencyTree(
  tasks: Task[],
  options?: { rootId?: string; maxDepth?: number },
): string {
  if (tasks.length === 0) {
    return chalk.gray("  태스크가 없습니다.");
  }

  const trees = buildTree(tasks, options?.rootId);
  const doneIds = new Set(tasks.filter((t) => t.status === "Done").map((t) => t.id));
  const output: string[] = [];

  // 헤더
  const total = tasks.length;
  const doneCount = doneIds.size;
  const pct = Math.round((doneCount / total) * 100);
  const barWidth = 20;
  const filled = Math.round((pct / 100) * barWidth);
  const headerBar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(barWidth - filled));

  output.push(
    chalk.white.bold("  의존성 트리") +
    "  " + headerBar + " " +
    chalk.cyan.bold(`${pct}%`) +
    chalk.gray(` (${doneCount}/${total})`),
  );
  output.push("");

  // 범례
  output.push(
    "  " +
    chalk.green("✔") + chalk.gray(" 완료  ") +
    chalk.hex("#FFA500")("▶") + chalk.gray(" 진행중  ") +
    chalk.yellow("○") + chalk.gray(" 대기  ") +
    chalk.red("✕") + chalk.gray(" 차단  ") +
    chalk.bgYellow.black(" 작업 가능 "),
  );
  output.push("  " + chalk.gray("─".repeat(60)));
  output.push("");

  // 트리 렌더링
  for (let i = 0; i < trees.length; i++) {
    renderTreeNode(trees[i], "  ", false, 0, doneIds, options?.maxDepth, output);
    if (i < trees.length - 1) {
      output.push("");
    }
  }

  return output.join("\n");
}
