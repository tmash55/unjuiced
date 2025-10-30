"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Sport } from "@/libs/ladders/client";
import { findSid, getFamily, openAltSSE } from "@/libs/ladders/client";

export function useMarkets(sport: Sport) {
  return useQuery<{ mkts: string[] }>({
    queryKey: ["ladder-mkts", sport],
    queryFn: async () => {
      const res = await fetch(`/api/props/mkts?sport=${sport}`, { cache: "no-store" });
      if (!res.ok) throw new Error("mkts failed");
      return res.json();
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    enabled: !!sport,
  });
}

export function usePlayers(sport: Sport, mkt?: string, search?: string, scope: 'pregame' | 'live' = 'pregame') {
  const q = new URLSearchParams();
  if (mkt) q.set("mkt", mkt);
  if (search) q.set("q", search);
  q.set("sport", sport);
  q.set("scope", scope);
  return useQuery<{ players: { ent: string; name?: string; team?: string; position?: string }[] }>({
    queryKey: ["ladder-players", sport, mkt ?? "", search ?? "", scope],
    queryFn: async () => {
      const res = await fetch(`/api/props/players?${q.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("players failed");
      return res.json();
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    enabled: !!sport && !!mkt,
  });
}

export function useFindSid(sport: Sport, ent?: string, mkt?: string) {
  const queryClient = useQueryClient();
  return useQuery<{ sids: string[] }>({
    queryKey: ["ladder-find", sport, ent ?? "", mkt ?? ""],
    queryFn: async () => {
      if (!ent || !mkt) return { sids: [] };
      const r = await findSid({ sport, ent, mkt, eid: "" as any }); // eid optional per new SOP
      return { sids: r.sids };
    },
    enabled: !!sport && !!ent && !!mkt,
    staleTime: 30_000,
  });
}

export function useLadderFamily(sport: Sport, sid?: string) {
  const [etag, setEtag] = useState<string | undefined>(undefined);
  const [family, setFamily] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const lastIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!sport || !sid) {
        setFamily(null);
        setError(null);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        const r = await getFamily(sport, sid, etag);
        if (!active) return;
        if (r.status !== 304) {
          setFamily(r.body);
          setEtag(r.etag);
          setError(null);
        }
      } catch (e: any) {
        // 404 or other error
        if (active) {
          setFamily(null);
          setEtag(undefined);
          // Check if it's a 404 (no alternates available)
          if (e.message?.includes('not_found')) {
            setError('not_found');
          } else {
            setError('error');
          }
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }
    load();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, sid]);

  useEffect(() => {
    // manage SSE subscription for live updates
    if (!sport || !sid) return;
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    const es = openAltSSE({ sport, sids: [sid], onAlt: async ({ id, sid }) => {
      lastIdRef.current = id;
      try {
        const r = await getFamily(sport, sid, etag);
        if (r.status !== 304) { setFamily(r.body); setEtag(r.etag); setError(null); }
      } catch {}
    }});
    esRef.current = es;
    return () => { es.close(); esRef.current = null; };
  }, [sport, sid]);

  return { family, etag, error, isLoading };
}


