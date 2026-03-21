import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getSseBroadcaster, type SseEvent } from "./sse-broadcaster";

export const registerSseRoute = (app: Hono<any>) => {
  const projectRoot = process.cwd();

  app.get("/api/sse", (c) => {
    const broadcaster = getSseBroadcaster();
    broadcaster.init(projectRoot);

    return streamSSE(c, async (stream) => {
      // Send initial connection event
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({ ts: Date.now(), subscribers: broadcaster.subscriberCount + 1 }),
      });

      let closed = false;

      const unsubscribe = broadcaster.subscribe((event: SseEvent) => {
        if (closed) return;
        stream.writeSSE({
          event: "task-change",
          data: JSON.stringify(event),
        }).catch(() => {
          closed = true;
        });
      });

      // Keep stream alive until client disconnects
      stream.onAbort(() => {
        closed = true;
        unsubscribe();
      });

      // Block until aborted
      await new Promise<void>((resolve) => {
        stream.onAbort(resolve);
      });
    });
  });
};
