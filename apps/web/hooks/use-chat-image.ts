"use client";

import { useEffect, useState } from "react";
import { getBackendUrl } from "@/lib/util";

export function useChatImage(
  projectId: string,
  key: string | undefined,
): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!projectId || !key) {
      setUrl(undefined);
      return;
    }

    let objectUrl: string | undefined;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${getBackendUrl()}/api/v1/chat/${projectId}/image?key=${encodeURIComponent(key)}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        // ignore image load failures
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [projectId, key]);

  return url;
}
