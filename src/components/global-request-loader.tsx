"use client";

import { useEffect, useState } from "react";

export function GlobalRequestLoader() {
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    const originalFetch = window.fetch;
    let inFlight = 0;

    const updatePending = (count: number) => {
      setPendingRequests(count);
    };

    window.fetch = (...args: Parameters<typeof window.fetch>) => {
      inFlight += 1;
      updatePending(inFlight);

      return originalFetch(...args).finally(() => {
        inFlight = Math.max(0, inFlight - 1);
        updatePending(inFlight);
      });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (pendingRequests === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
    </div>
  );
}
