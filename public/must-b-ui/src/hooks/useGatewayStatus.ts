import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";

export interface GatewayStatus {
  online: boolean;
  loading: boolean;
}

/**
 * Polls GET /api/gateway/status every 15 seconds.
 * When online transitions from false → true, callers should re-fetch their data
 * by including `online` in their useEffect dependency array.
 */
export function useGatewayStatus(): GatewayStatus {
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const check = async () => {
      try {
        const res = await apiFetch("/api/gateway/status");
        if (!mounted.current) return;
        const data = await res.json();
        setOnline(!!data?.online);
      } catch {
        if (mounted.current) setOnline(false);
      } finally {
        if (mounted.current) setLoading(false);
      }
    };

    check();
    const interval = setInterval(check, 15_000);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, []);

  return { online, loading };
}
