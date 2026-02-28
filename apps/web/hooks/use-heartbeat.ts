"use client";

import { useEffect } from "react";
import { sendHeartbeat, persistProject } from "@/lib/api";

/**
 * Sends periodic heartbeats to keep the sandbox alive.
 * Also persists the project on tab close via sendBeacon.
 */
export function useHeartbeat(projectId: string | null) {
  useEffect(() => {
    if (!projectId) return;

    // Send heartbeat every 30 seconds
    const interval = setInterval(() => {
      sendHeartbeat(projectId);
    }, 30_000);

    // Send initial heartbeat
    sendHeartbeat(projectId);

    // Persist on tab close
    const onBeforeUnload = () => {
      persistProject(projectId);
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [projectId]);
}
