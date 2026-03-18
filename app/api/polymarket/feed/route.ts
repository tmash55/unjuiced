"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { hasEliteAccess, normalizePlanName, type UserPlan } from "@/lib/plans";
import type { FeedResponse, LiveOdds, LiveOddsEntry, WalletTier, WhaleSignal } from "@/lib/polymarket/types";
import { getRedisCommandEndpoint } from "@/lib/redis-endpoints";
import { computeSignalScore } from "@/lib/polymarket/score";

// Polymarket leaderboard cache (refreshes every hour)
let leaderboardCache: Map<string, { vol: number; rank: number }> | null = null;
let leaderboardCacheTime = 0;
const LEADERBOARD_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getLeaderboardMap(): Promise<Map<string, { vol: number; rank: number }>> {
  if (leaderboardCache && Date.now() - leaderboardCacheTime < LEADERBOARD_CACHE_TTL) {
    return leaderboardCache;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      "https://data-api.polymarket.com/v1/leaderboard?category=SPORTS&timePeriod=ALL&orderBy=PNL&limit=200",
      { signal: controller.signal }
    ).finally(() => clearTimeout(timeout));
    if (!res.ok) return leaderboardCache ?? new Map();
    const data = await res.json();
    const map = new Map<string, { vol: number; rank: number }>();
    for (const entry of data) {
      if (entry.proxyWallet) {
        map.set(entry.proxyWallet.toLowerCase(), {
          vol: entry.vol || 0,
          rank: parseInt(entry.rank, 10) || 0,
        });
      }
    }
    leaderboardCache = map;
    leaderboardCacheTime = Date.now();
    return map;
  } catch {
    return leaderboardCache ?? new Map();
  }
}

/**
 * GET /api/polymarket/feed
 *
 * Returns real-time whale bet feed enriched with wallet scores.
 * Elite-tier only.
 *
 * Query params:
 *   limit         - signals per page (default 50, max 200)
 *   offset        - pagination offset (default 0)
 *   sport         - filter by sport (e.g. "nba", "soccer")
 *   tier          - filter by wallet tier: S, A, B, C, FADE, NEW (comma-separated)
 *   minStake      - minimum bet_size in USD (default 0)
 *   minQuality    - minimum quality_score 1-5 (default 0)
 *   resolved      - "true" | "false" | "all" (default "all")
 *   wallet        - filter by specific wallet_address
 *   showNew       - include NEW/burner wallet bets (default "true")
 *   today         - only today's bets (default "false")
 *   sort          - "score" | "recent" | "stake" (default "score")
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Plan check
    const { data: ent } = await supabase
      .from("current_entitlements")
      .select("current_plan")
      .eq("user_id", user.id)
      .single();

    const normalized = normalizePlanName(String(ent?.current_plan || "free"));
    const plan: UserPlan =
      normalized === "anonymous" ||
      normalized === "free" ||
      normalized === "scout" ||
      normalized === "sharp" ||
      normalized === "elite"
        ? normalized
        : "free";

    if (!hasEliteAccess(plan)) {
      return NextResponse.json(
        { error: "Elite tier required for Sharp Signals" },
        { status: 403 }
      );
    }

    // Parse query params
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "50", 10), 1), 200);
    const offset = Math.max(parseInt(sp.get("offset") || "0", 10), 0);
    const sport = sp.get("sport") || undefined;
    const tierFilter = sp.get("tier")?.split(",").filter(Boolean) || undefined;
    const minStake = parseFloat(sp.get("minStake") || "0") || 0;
    const minQuality = parseInt(sp.get("minQuality") || "0", 10) || 0;
    const resolvedFilter = sp.get("resolved") || "all";
    const walletFilter = sp.get("wallet") || undefined;
    const showNew = sp.get("showNew") !== "false";
    const todayOnly = sp.get("today") === "true";
    const sortBy = sp.get("sort") || "score";

    // Build signals query
    let query = supabase
      .from("polymarket_signals")
      .select(
        `id, tier, wallet_address, wallet_username, wallet_pnl,
         market_title, market_type, sport, outcome, side, token_id,
         event_title, league, home_team, away_team, market_label,
         entry_price, american_odds, bet_size, implied_probability,
         game_start_time, game_date,
         book_name, book_price, best_book, best_book_price, best_book_decimal,
         resolved, result, pnl,
         quality_score, all_book_odds, wallet_rank, created_at,
         odds_event_id, odds_sport, odds_market_key, odds_confidence`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // For score/stake sort, fetch more rows since sorting happens after enrichment
    const fetchLimit = sortBy === "recent" ? limit : Math.max(limit * 5, 100);
    query = query.range(0, fetchLimit - 1);

    // Filters
    if (sport) query = query.eq("sport", sport);
    if (walletFilter) query = query.eq("wallet_address", walletFilter);
    if (minStake > 0) query = query.gte("bet_size", minStake);
    if (minQuality > 0) query = query.gte("quality_score", minQuality);

    if (resolvedFilter === "true") query = query.eq("resolved", true);
    else if (resolvedFilter === "false") {
      query = query.eq("resolved", false);
      // Also filter out games that have already started (with 30min buffer)
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      query = query.or(`game_start_time.is.null,game_start_time.gte.${cutoff}`);
    }

    if (todayOnly) {
      const today = new Date().toISOString().slice(0, 10);
      query = query.gte("created_at", `${today}T00:00:00Z`);
    }

    const { data: signals, error, count } = await query;

    if (error) {
      console.error("[/api/polymarket/feed] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
    }

    if (!signals || signals.length === 0) {
      return NextResponse.json({ signals: [], total: 0 });
    }

    // Enrich signals with wallet scores
    const walletAddresses = [...new Set(signals.map((s) => s.wallet_address))];
    const { data: walletScores } = await supabase
      .from("polymarket_wallet_scores")
      .select("wallet_address, rank, tier, roi, wins, losses, avg_stake, total_profit, is_new_account, poly_pnl, poly_rank, poly_volume, poly_month_pnl, poly_week_pnl, hot_cold")
      .in("wallet_address", walletAddresses);

    const scoreMap = new Map(
      (walletScores ?? []).map((w) => [w.wallet_address, w])
    );

    // Fetch lifetime stats from Polymarket leaderboard (cached)
    const leaderboardMap = await getLeaderboardMap();

    // Filter by tier if specified (applied after join since tier comes from wallet_scores)
    const enriched = signals
      .map((s) => {
        const ws = scoreMap.get(s.wallet_address);
        const walletTier = (ws?.tier ?? "C") as WalletTier;
        const stakeVsAvg =
          ws?.avg_stake && s.bet_size
            ? Math.round((s.bet_size / ws.avg_stake) * 10) / 10
            : null;
        const bookDecimal = s.best_book_decimal;
        const bookImplied = bookDecimal ? 1 / bookDecimal : null;

        // Compute composite signal score
        const scoreResult = computeSignalScore({
          tier: s.tier,
          bet_size: s.bet_size ?? 0,
          wallet_avg_stake: ws?.avg_stake ?? null,
          wallet_roi: ws?.roi ?? null,
          wallet_win_rate: ws ? ws.wins / Math.max(ws.wins + ws.losses, 1) : null,
          wallet_total_bets: ws ? ws.wins + ws.losses : null,
          wallet_rank: ws?.rank ?? s.wallet_rank ?? null,
          wallet_pnl: ws?.total_profit ?? s.wallet_pnl ?? null,
          clv_avg: null,
          american_odds: s.american_odds,
          entry_price: s.entry_price,
          book_implied: bookImplied,
          quality_score: s.quality_score,
          created_at: s.created_at,
        });

        return {
          ...s,
          wallet_rank: ws?.rank ?? null,
          wallet_tier: walletTier,
          wallet_roi: ws?.roi ?? null,
          wallet_record: ws ? `${ws.wins}-${ws.losses}` : null,
          wallet_total_bets: ws ? ws.wins + ws.losses : null,
          wallet_avg_stake: ws?.avg_stake ?? null,
          wallet_total_profit: ws?.total_profit ?? null,
          wallet_lifetime_volume: ws?.poly_volume ?? leaderboardMap.get(s.wallet_address?.toLowerCase())?.vol ?? null,
          wallet_polymarket_rank: ws?.poly_rank ?? leaderboardMap.get(s.wallet_address?.toLowerCase())?.rank ?? null,
          wallet_poly_pnl: ws?.poly_pnl ?? null,
          wallet_poly_month_pnl: ws?.poly_month_pnl ?? null,
          wallet_poly_week_pnl: ws?.poly_week_pnl ?? null,
          wallet_hot_cold: ws?.hot_cold ?? null,
          stake_vs_avg: stakeVsAvg,
          is_new_account: ws?.is_new_account ?? false,
          signal_score: scoreResult.total,
          signal_label: scoreResult.label,
          score_breakdown: scoreResult.breakdown,
        };
      })
      .filter((s) => {
        // Apply tier filter
        if (tierFilter && tierFilter.length > 0 && !tierFilter.includes(s.wallet_tier)) {
          return false;
        }
        // Filter new accounts if disabled
        if (!showNew && s.is_new_account) return false;
        return true;
      });

    // Aggregate duplicate fills: same wallet + same market (token_id) + same side
    // Wallets often split large bets into 5+ chunks within seconds to avoid moving the book
    const aggregated = (() => {
      const groups = new Map<string, typeof enriched>();
      for (const s of enriched) {
        // Group key: wallet + market token + side
        const key = `${s.wallet_address}:${s.token_id || s.market_title}:${s.side}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(s);
      }

      const merged: any[] = [];
      for (const [, group] of groups) {
        if (group.length === 1) {
          // Single fill — just add wager_count = 1
          const single = group[0] as any;
          single.wager_count = 1;
          merged.push(single);
          continue;
        }

        // Sort fills chronologically
        group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        // Use the most recent signal as the base (has latest enrichment)
        const base = group[group.length - 1] as any;
        const totalSize = group.reduce((sum, s) => sum + (s.bet_size ?? 0), 0);
        const totalShares = group.reduce((sum, s) => sum + Math.round((s.bet_size ?? 0) / (s.entry_price || 1)), 0);

        // Weighted average entry price
        const weightedPrice = totalSize > 0
          ? group.reduce((sum, s) => sum + (s.entry_price ?? 0) * (s.bet_size ?? 0), 0) / totalSize
          : base.entry_price;

        // Build fills BEFORE mutating base (base is a reference into group,
        // so mutating base.bet_size would corrupt the last fill's size)
        base.fills = group.map(s => ({
          price: s.entry_price,
          size: s.bet_size ?? 0,
          created_at: s.created_at,
          american_odds: s.american_odds,
        }));

        base.bet_size = totalSize;
        base.entry_price = weightedPrice;
        base.implied_probability = weightedPrice;
        base.wager_count = group.length;
        base.total_shares = totalShares;

        // Recalculate signal score with aggregated bet_size (higher conviction)
        const ws = scoreMap.get(base.wallet_address);
        const bookDecimal = base.best_book_decimal;
        const bookImplied = bookDecimal ? 1 / bookDecimal : null;
        const scoreResult = computeSignalScore({
          tier: base.tier,
          bet_size: totalSize,
          wallet_avg_stake: ws?.avg_stake ?? null,
          wallet_roi: ws?.roi ?? null,
          wallet_win_rate: ws ? ws.wins / Math.max(ws.wins + ws.losses, 1) : null,
          wallet_total_bets: ws ? ws.wins + ws.losses : null,
          wallet_rank: ws?.rank ?? base.wallet_rank ?? null,
          wallet_pnl: ws?.total_profit ?? base.wallet_pnl ?? null,
          clv_avg: null,
          american_odds: base.american_odds,
          entry_price: weightedPrice,
          book_implied: bookImplied,
          quality_score: base.quality_score,
          created_at: base.created_at,
        });
        base.signal_score = scoreResult.total;
        base.signal_label = scoreResult.label;
        base.score_breakdown = scoreResult.breakdown;

        // Recalculate stake_vs_avg with total size
        if (ws?.avg_stake && totalSize) {
          base.stake_vs_avg = Math.round((totalSize / ws.avg_stake) * 10) / 10;
        }

        merged.push(base);
      }
      return merged;
    })();

    // Enrich with live odds from Redis
    const BETTABLE_BOOKS = ["draftkings", "fanduel", "betmgm", "caesars", "bet365", "fanatics", "hard-rock", "espnbet", "betrivers"];

    const oddsSignals = aggregated.filter(
      (s: any) => s.odds_event_id && s.odds_sport && s.odds_market_key
    );

    if (oddsSignals.length > 0) {
      const redis = getRedisCommandEndpoint();
      if (redis.url && redis.token) {
        // Collect unique combos
        const combos = new Map<string, { sport: string; eventId: string; marketKey: string }>();
        for (const s of oddsSignals) {
          const comboKey = `${s.odds_sport}:${s.odds_event_id}:${s.odds_market_key}`;
          if (!combos.has(comboKey)) {
            combos.set(comboKey, { sport: s.odds_sport, eventId: s.odds_event_id, marketKey: s.odds_market_key });
          }
        }

        // Fetch all book odds for all combos in parallel
        type RedisResult = { comboKey: string; book: string; data: any };
        const fetches: Promise<RedisResult | null>[] = [];
        for (const [comboKey, combo] of combos) {
          for (const book of BETTABLE_BOOKS) {
            const redisKey = `odds:${combo.sport}:${combo.eventId}:${combo.marketKey}:${book}`;
            fetches.push(
              Promise.race([
                fetch(`${redis.url}/GET/${encodeURIComponent(redisKey)}`, {
                  headers: { Authorization: `Bearer ${redis.token}` },
                })
                  .then((r) => r.json())
                  .then((json: any) => {
                    if (!json.result) return null;
                    return { comboKey, book, data: JSON.parse(json.result) } as RedisResult;
                  })
                  .catch(() => null),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
              ])
            );
          }
        }

        const results = await Promise.allSettled(fetches);

        // Build odds lookup: comboKey -> book -> parsed data
        const oddsLookup = new Map<string, Map<string, any>>();
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            const { comboKey, book, data } = r.value;
            if (!oddsLookup.has(comboKey)) oddsLookup.set(comboKey, new Map());
            oddsLookup.get(comboKey)!.set(book, data);
          }
        }

        // Match odds to signals
        for (const s of oddsSignals) {
          const comboKey = `${s.odds_sport}:${s.odds_event_id}:${s.odds_market_key}`;
          const bookOdds = oddsLookup.get(comboKey);
          if (!bookOdds || bookOdds.size === 0) continue;

          const allEntries: LiveOddsEntry[] = [];
          for (const [book, data] of bookOdds) {
            // data is expected to be an object or array of selections
            const selections = Array.isArray(data) ? data : (data?.selections ?? data?.outcomes ?? [data]);
            for (const sel of selections) {
              if (!sel) continue;
              // Match outcome name (case-insensitive)
              const selName = (sel.name || sel.selection || sel.outcome || "").toLowerCase();
              const signalOutcome = (s.outcome || "").toLowerCase();
              if (selName && signalOutcome && selName.includes(signalOutcome) || signalOutcome.includes(selName)) {
                const decimal = sel.decimal ?? sel.price ?? (sel.american ? (sel.american > 0 ? sel.american / 100 + 1 : 100 / Math.abs(sel.american) + 1) : null);
                if (decimal && decimal > 1) {
                  allEntries.push({
                    book,
                    price: sel.american?.toString() ?? sel.price?.toString() ?? "",
                    decimal: Math.round(decimal * 1000) / 1000,
                    line: sel.line?.toString(),
                    mobile_link: sel.mobile_link ?? sel.deep_link ?? undefined,
                  });
                }
              }
            }
          }

          if (allEntries.length > 0) {
            // Best = highest decimal (best payout)
            allEntries.sort((a, b) => b.decimal - a.decimal);
            (s as any).live_odds = {
              best: allEntries[0],
              all: allEntries,
            } satisfies LiveOdds;
          }
        }
      }
    }

    // Sort
    if (sortBy === "score") {
      aggregated.sort((a, b) => (b.signal_score ?? 0) - (a.signal_score ?? 0));
    } else if (sortBy === "stake") {
      aggregated.sort((a, b) => (b.bet_size ?? 0) - (a.bet_size ?? 0));
    }
    // "recent" = default DB order (created_at desc), no re-sort needed

    // Apply pagination after sorting (for score/stake sorts that fetched extra rows)
    const paginated = sortBy === "recent"
      ? aggregated
      : aggregated.slice(offset, offset + limit);

    const response: FeedResponse = {
      signals: paginated as WhaleSignal[],
      total: count ?? 0,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15",
      },
    });
  } catch (err) {
    console.error("[/api/polymarket/feed] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
