import type { MiddleMode, MiddleRow } from "@/lib/middles-schema";

export type { MiddleMode, MiddleRow } from "@/lib/middles-schema";

export type MiddlesResponse = {
  format: number;
  v: number;
  mode: MiddleMode;
  ids: string[];
  rows: MiddleRow[];
};

export async function fetchMiddles(params: {
  v?: number;
  limit?: number;
  cursor?: number;
  event_id?: string;
  mode?: MiddleMode;
}): Promise<MiddlesResponse | { unchanged: true }> {
  const sp = new URLSearchParams();
  if (params.v != null) sp.set("v", String(params.v));
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.cursor != null) sp.set("cursor", String(params.cursor));
  if (params.event_id) sp.set("event_id", params.event_id);
  if (params.mode) sp.set("mode", params.mode);

  const res = await fetch(`/api/middles?${sp.toString()}`, {
    credentials: "include",
  });
  if (res.status === 304) return { unchanged: true as const };
  if (!res.ok) throw new Error(`GET /api/middles ${res.status}`);
  return (await res.json()) as MiddlesResponse;
}

export async function fetchMiddlesCounts(): Promise<{
  all: number;
  live: number;
  pregame: number;
  v: number;
}> {
  const res = await fetch("/api/middles/counts", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET /api/middles/counts ${res.status}`);
  return (await res.json()) as {
    all: number;
    live: number;
    pregame: number;
    v: number;
  };
}
