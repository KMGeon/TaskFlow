import { diffLines, type Change } from "diff";
import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, Heading, Content } from "mdast";

// ── Types ──

export type ChangeType = "added" | "removed" | "modified";
export type Severity = "low" | "medium" | "high";

export interface SectionDiff {
  id: string;
  title: string;
  changeType: ChangeType;
  beforeSnippet: string;
  afterSnippet: string;
  severity: Severity;
}

export interface LineDiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

export interface DiffReport {
  sections: SectionDiff[];
  lineDiffSummary: LineDiffSummary;
}

// ── Markdown AST helpers ──

interface Section {
  title: string;
  depth: number;
  content: string;
}

function parseMarkdownAst(text: string): Root {
  return unified().use(remarkParse).parse(text);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

function extractNodeText(node: Content): string {
  if ("value" in node) return (node as { value: string }).value;
  if ("children" in node) {
    return (node as { children: Content[] }).children.map(extractNodeText).join("");
  }
  return "";
}

function indexSections(ast: Root): Map<string, Section> {
  const sections = new Map<string, Section>();
  const lines = ast.children;
  let currentKey = "__root__";
  let currentTitle = "(root)";
  let currentDepth = 0;
  let currentContent: string[] = [];

  function flush() {
    sections.set(currentKey, {
      title: currentTitle,
      depth: currentDepth,
      content: currentContent.join("\n").trim(),
    });
  }

  for (const node of lines) {
    if (node.type === "heading") {
      flush();
      const heading = node as Heading;
      currentTitle = heading.children.map(extractNodeText).join("");
      currentKey = `h${heading.depth}-${slugify(currentTitle)}`;
      currentDepth = heading.depth;
      currentContent = [];
    } else {
      const text = extractNodeText(node as Content);
      if (text) currentContent.push(text);
    }
  }
  flush();

  return sections;
}

// ── Diff computation ──

function summarizeLineDiff(changes: Change[]): LineDiffSummary {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const c of changes) {
    const lineCount = (c.value.match(/\n/g) || []).length || 1;
    if (c.added) added += lineCount;
    else if (c.removed) removed += lineCount;
    else unchanged += lineCount;
  }

  return { added, removed, unchanged };
}

function estimateSeverity(
  before: Section | undefined,
  after: Section | undefined,
  lineSummary: LineDiffSummary,
): Severity {
  if (!before || !after) return "high";

  const beforeLen = before.content.length;
  const afterLen = after.content.length;
  const diff = Math.abs(afterLen - beforeLen);
  const ratio = beforeLen > 0 ? diff / beforeLen : 1;

  if (ratio > 0.5) return "high";
  if (ratio > 0.15) return "medium";
  return "low";
}

function extractSnippet(section: Section | undefined, maxLen = 200): string {
  if (!section) return "";
  return section.content.length > maxLen
    ? section.content.slice(0, maxLen) + "..."
    : section.content;
}

function unionKeys<T>(a: Map<string, T>, b: Map<string, T>): string[] {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys];
}

// ── Public API ──

export function analyzeDiff(baseText: string, changedText: string): DiffReport {
  const lineDiffChanges = diffLines(baseText, changedText);
  const lineDiffSummary = summarizeLineDiff(lineDiffChanges);

  const baseAst = parseMarkdownAst(baseText);
  const changedAst = parseMarkdownAst(changedText);

  const sectionMapBase = indexSections(baseAst);
  const sectionMapChanged = indexSections(changedAst);

  const sections = unionKeys(sectionMapBase, sectionMapChanged)
    .map((k) => {
      const before = sectionMapBase.get(k);
      const after = sectionMapChanged.get(k);
      const changeType: ChangeType = !before
        ? "added"
        : !after
          ? "removed"
          : before.content !== after.content
            ? "modified"
            : "modified"; // same key present in both

      // Skip unchanged sections
      if (before && after && before.content === after.content) return null;

      return {
        id: k,
        title: after?.title || before?.title || k,
        changeType,
        beforeSnippet: extractSnippet(before),
        afterSnippet: extractSnippet(after),
        severity: estimateSeverity(before, after, lineDiffSummary),
      };
    })
    .filter((s): s is SectionDiff => s !== null);

  return { sections, lineDiffSummary };
}

/**
 * Generate a diff report when only changed text is provided.
 * Uses existing PRD from .taskflow as base if available.
 */
export function analyzeDiffFromChanged(changedText: string, baseText?: string): DiffReport {
  if (baseText) {
    return analyzeDiff(baseText, changedText);
  }

  // No base — treat everything as new additions
  const changedAst = parseMarkdownAst(changedText);
  const sectionMap = indexSections(changedAst);

  const sections: SectionDiff[] = [...sectionMap.entries()].map(([k, section]) => ({
    id: k,
    title: section.title,
    changeType: "added" as const,
    beforeSnippet: "",
    afterSnippet: extractSnippet(section),
    severity: "high" as const,
  }));

  const lineCount = (changedText.match(/\n/g) || []).length + 1;
  return {
    sections,
    lineDiffSummary: { added: lineCount, removed: 0, unchanged: 0 },
  };
}
