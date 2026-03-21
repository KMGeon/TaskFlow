"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const TASKS_KEY = ["tasks"];
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export function useTaskSse() {
  const queryClient = useQueryClient();
  const retryCount = useRef(0);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    function connect() {
      if (!mounted) return;

      es = new EventSource("/api/sse");

      es.addEventListener("connected", () => {
        retryCount.current = 0;
      });

      es.addEventListener("task-change", (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === "created" || event.type === "deleted" || event.type === "index") {
            queryClient.invalidateQueries({ queryKey: TASKS_KEY });
          } else if (event.type === "updated" && event.id) {
            queryClient.invalidateQueries({ queryKey: TASKS_KEY });
          }
        } catch {
          // Malformed event — skip
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (!mounted) return;
      const delay = Math.min(
        RECONNECT_DELAY_MS * 2 ** retryCount.current,
        MAX_RECONNECT_DELAY_MS,
      );
      retryCount.current++;
      reconnectTimer = setTimeout(connect, delay);
    }

    connect();

    return () => {
      mounted = false;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [queryClient]);
}
