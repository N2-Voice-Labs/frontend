"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeError } from "./platform-errors";

/**
 * Loads data on mount (and optionally on an interval) with a stale-response guard.
 * `load` must be stable: wrap it in useCallback, or pass a module-level function.
 */
export function useResource<T>(load: () => Promise<T>, options: { interval?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);

  const reload = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const result = await load();
      if (current !== sequence.current) return;
      setData(result);
      setError("");
    } catch (cause) {
      if (current === sequence.current) setError(describeError(cause));
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void reload();
    if (!options.interval) return;
    const timer = window.setInterval(() => void reload(), options.interval);
    return () => window.clearInterval(timer);
  }, [reload, options.interval]);

  return { data, error, loading, reload, setData };
}
