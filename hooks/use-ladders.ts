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
  const queryClient = useQueryClient();
  const q = new URLSearchParams();
  if (mkt) q.set("mkt", mkt);
  if (search) q.set("q", search);
  q.set("sport", sport);
  q.set("scope", scope);
  
  return useQuery<{ players: { ent: string; name?: string; team?: string; position?: string }[] }>({
    queryKey: ["ladder-players", sport, mkt ?? "", search ?? "", scope],
    queryFn: async () => {
      const url = `/api/props/players?${q.toString()}`;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[usePlayers] Fetching players: ${url}`);
      }
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("players failed");
      const data = await res.json();
      if (process.env.NODE_ENV === 'development') {
        console.log(`[usePlayers] Received ${data.players?.length || 0} players for market: ${mkt}`);
      }
      
      // Prefetch SIDs for first 5 players to speed up selection
      if (data.players && data.players.length > 0 && mkt) {
        const topPlayers = data.players.slice(0, 5);
        topPlayers.forEach((player: any) => {
          queryClient.prefetchQuery({
            queryKey: ["ladder-find", sport, player.ent, mkt],
            queryFn: async () => {
              const r = await findSid({ sport, ent: player.ent, mkt, eid: "" as any });
              return { sids: r.sids };
            },
            staleTime: 60_000,
          });
        });
      }
      
      return data;
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
    staleTime: 60_000, // Increased from 30s to 60s to match API cache
    gcTime: 5 * 60_000, // Keep in cache for 5 minutes
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


