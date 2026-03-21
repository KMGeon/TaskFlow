"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  GitFork,
  Clock,
  Settings,
  Search,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
};

const navItems: NavItem[] = [
  {
    label: "칸반 보드",
    href: "/dashboard",
    icon: <LayoutGrid className="h-4 w-4" />,
    shortcut: "G K",
  },
  {
    label: "의존성 그래프",
    href: "/dashboard/graph",
    icon: <GitFork className="h-4 w-4" />,
    shortcut: "G D",
  },
  {
    label: "타임라인",
    href: "/dashboard/timeline",
    icon: <Clock className="h-4 w-4" />,
    shortcut: "G T",
  },
  {
    label: "설정",
    href: "/dashboard/settings",
    icon: <Settings className="h-4 w-4" />,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-secondary/50">
      {/* Project selector */}
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-foreground">
          TF
        </div>
        <div className="flex flex-1 items-center gap-1">
          <span className="text-sm font-semibold text-foreground">
            TaskFlow
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      <Separator />

      {/* Command palette trigger */}
      <div className="px-3 py-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/20"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">검색...</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            /
          </kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent/15 font-medium text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="text-[10px] text-muted-foreground/60">
                  {item.shortcut}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Bottom status */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span>로컬 서버 연결됨</span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          v0.1.0 &middot; 3 태스크 진행 중
        </p>
      </div>
    </aside>
  );
}
