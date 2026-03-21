import path from "node:path";
import { watch, type FSWatcher } from "chokidar";
import { getTasksDir, getIndexFilePath, extractTaskId } from "@/features/taskflow/constants";

// ── SSE Event Types ──

export type SseEventType = "created" | "updated" | "deleted" | "index";

export interface SseEvent {
  type: SseEventType;
  id?: string;
  path: string;
  ts: number;
}

export type SseListener = (event: SseEvent) => void;

// ── Broadcaster ──

const THROTTLE_MS = 300;
const KEEPALIVE_INTERVAL_MS = 30_000;

class SseBroadcaster {
  private listeners = new Set<SseListener>();
  private watcher: FSWatcher | null = null;
  private lastEmit = 0;
  private pendingEvent: SseEvent | null = null;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  init(projectRoot: string): void {
    if (this.initialized) return;
    this.initialized = true;

    const tasksDir = getTasksDir(projectRoot);
    const indexPath = getIndexFilePath(projectRoot);

    this.watcher = watch(
      [path.join(tasksDir, "task-*.md"), indexPath],
      {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      },
    );

    this.watcher.on("add", (fp) => this.handleFsEvent("created", fp, indexPath));
    this.watcher.on("change", (fp) => this.handleFsEvent("updated", fp, indexPath));
    this.watcher.on("unlink", (fp) => this.handleFsEvent("deleted", fp, indexPath));

    this.keepAliveTimer = setInterval(() => {
      this.broadcast({ type: "index", path: "", ts: Date.now() });
    }, KEEPALIVE_INTERVAL_MS);
  }

  subscribe(listener: SseListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get subscriberCount(): number {
    return this.listeners.size;
  }

  async destroy(): Promise<void> {
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    if (this.watcher) await this.watcher.close();
    this.listeners.clear();
    this.initialized = false;
    this.watcher = null;
  }

  private handleFsEvent(fsEvent: "created" | "updated" | "deleted", filePath: string, indexPath: string): void {
    const isIndex = path.resolve(filePath) === path.resolve(indexPath);

    const event: SseEvent = {
      type: isIndex ? "index" : fsEvent,
      id: isIndex ? undefined : (extractTaskId(path.basename(filePath)) ?? undefined),
      path: filePath,
      ts: Date.now(),
    };

    this.throttledBroadcast(event);
  }

  private throttledBroadcast(event: SseEvent): void {
    const now = Date.now();
    const elapsed = now - this.lastEmit;

    if (elapsed >= THROTTLE_MS) {
      this.lastEmit = now;
      this.broadcast(event);
      return;
    }

    // Throttle: replace pending event (latest wins)
    this.pendingEvent = event;

    if (!this.throttleTimer) {
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null;
        if (this.pendingEvent) {
          this.lastEmit = Date.now();
          this.broadcast(this.pendingEvent);
          this.pendingEvent = null;
        }
      }, THROTTLE_MS - elapsed);
    }
  }

  private broadcast(event: SseEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Remove broken listeners
        this.listeners.delete(listener);
      }
    }
  }
}

// ── Singleton ──

let instance: SseBroadcaster | null = null;

export function getSseBroadcaster(): SseBroadcaster {
  if (!instance) {
    instance = new SseBroadcaster();
  }
  return instance;
}

export function resetBroadcaster(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
