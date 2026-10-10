"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null | undefined;

/** Anon client used ONLY to listen for broadcast signals. No table access (RLS, no policies). */
function realtimeClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  browserClient = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return browserClient;
}

export interface LiveTopic {
  channel: string;
  events: string[];
}

export class FetchError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new FetchError(res.status, body.error ?? "ERROR", body.message ?? "Request failed.");
  return body as T;
}

const POLL_MS = 5000;

/**
 * Loads `url`, refetches whenever a broadcast arrives on one of `topics`,
 * and polls every 5 s while Realtime is not connected.
 */
export function useLiveData<T>(url: string | null, topics: LiveTopic[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<FetchError | null>(null);
  const [connected, setConnected] = useState(false);
  const inflight = useRef(false);
  const again = useRef(false);
  const topicsKey = JSON.stringify(topics);

  const reload = useCallback(async () => {
    if (!url) return;
    if (inflight.current) {
      again.current = true;
      return;
    }
    inflight.current = true;
    try {
      do {
        again.current = false;
        const d = await fetchJson<T>(url);
        setData(d);
        setError(null);
      } while (again.current);
    } catch (e) {
      setError(e instanceof FetchError ? e : new FetchError(0, "NETWORK", "Network error. Retrying…"));
    } finally {
      inflight.current = false;
    }
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Realtime subscriptions
  useEffect(() => {
    const parsed: LiveTopic[] = JSON.parse(topicsKey);
    const client = realtimeClient();
    if (!client || parsed.length === 0) {
      setConnected(false);
      return;
    }
    const states = new Map<string, boolean>();
    const channels = parsed.map((t) => {
      let ch = client.channel(t.channel);
      for (const ev of t.events) ch = ch.on("broadcast", { event: ev }, () => reload());
      ch.subscribe((status) => {
        states.set(t.channel, status === "SUBSCRIBED");
        const all = parsed.every((p) => states.get(p.channel));
        setConnected(all);
        if (status === "SUBSCRIBED") reload(); // catch up on anything missed while disconnected
      });
      return ch;
    });
    return () => {
      channels.forEach((ch) => client.removeChannel(ch));
    };
  }, [topicsKey, reload]);

  // Polling fallback while Realtime is disconnected
  useEffect(() => {
    if (connected) return;
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [connected, reload]);

  // Refresh when the tab becomes visible again
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [reload]);

  return { data, error, connected, reload, setData };
}
