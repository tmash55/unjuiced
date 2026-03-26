"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { hasEliteAccess, normalizePlanName, type UserPlan } from "@/lib/plans";
import type { FeedResponse, WalletTier, WhaleSignal } from "@/lib/polymarket/types";
import { computeSignalScore } from "@/lib/polymarket/score";

/**
 * Normalize market_type from Polymarket title patterns.
 * Runs at read-time so existing "unknown" data gets fixed without
 * altering the whale tracker's write path.
 */
function normalizeMarketType(
  currentType: string | null,
  title: string | null,
  outcome: string | null
): string {
  const t = (title || "").trim();
  const o = (outcome || "").toLowerCase();

  // Title-based overrides FIRST — whale tracker sometimes misclassifies
  // "Spread: Liverpool FC (-1.5)" → spread
  if (/^Spread:/i.test(t) || /spread/i.test(t)) return "spread";

  // "X vs Y: O/U 3.5" or "O/U" anywhere → total
  if (/O\/U\s*\d/i.test(t) || /over.?under/i.test(t)) return "total";
  // Outcome is "Over" or "Under" on a game-level market
  if (/^(over|under)$/i.test(o) && !/player|prop/i.test(t)) return "total";

  // "Will X win on DATE?" → moneyline (3-way: Yes=win, No=draw/loss)
  if (/^Will .+ win on \d{4}-\d{2}-\d{2}\??$/i.test(t)) return "moneyline";

  // "Team A vs. Team B" or "Team A vs Team B" (no spread/total qualifier) → moneyline
  if (/^.+\s+vs\.?\s+.+$/i.test(t) && !/spread|o\/u|over|under|total/i.test(t)) {
    return "moneyline";
  }

  // "Will X reach/advance/qualify" → futures
  if (/^Will .+ (reach|advance|qualify|make)/i.test(t)) return "futures";

  // "Winner" in title → futures
  if (/winner/i.test(t)) return "futures";

  return currentType || "unknown";
}

/**
 * Clean up "Yes"/"No" outcomes for "Will X win?" markets into team names.
 * "Will Liverpool FC win on 2026-03-18?" + outcome "Yes" → "Liverpool FC"
 * "Will Liverpool FC win on 2026-03-18?" + outcome "No"  → "Draw / Liverpool FC loss"
 */
function normalizeOutcome(
  outcome: string | null,
  title: string | null,
  marketType: string
): string {
  const o = (outcome || "").trim();
  const t = (title || "").trim();

  // Only transform Yes/No on "Will X win" moneyline markets
  if (marketType !== "moneyline") return o;
  if (!/^(Yes|No)$/i.test(o)) return o;

  const match = t.match(/^Will (.+?) win on \d{4}/i);
  if (!match) return o;

  const teamName = match[1].trim();
  if (/^yes$/i.test(o)) return teamName;
  // "No" on a 3-way soccer market means draw OR opponent wins
  return `Not ${teamName}`;
}

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
        { error: "Elite tier required for Sharp Intel" },
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
    const walletFilter = sp.get("wallet")?.split(",").filter(Boolean) || undefined;
    const showNew = sp.get("showNew") !== "false";
    const todayOnly = sp.get("today") === "true";
    const sortBy = sp.get("sort") || "score";
    const minScore = parseInt(sp.get("minScore") || "0", 10) || 0;
    const dateRange = sp.get("dateRange") || undefined;
    const minOdds = parseFloat(sp.get("minOdds") || "") || undefined;
    const maxOdds = parseFloat(sp.get("maxOdds") || "") || undefined;

    // Build signals query
    let query = supabase
      .from("polymarket_signals")
      .select(
        `id, tier, wallet_address, wallet_username, wallet_pnl,
         market_title, market_type, sport, outcome, side, token_id,
         event_title, league, home_team, away_team, market_label,
         entry_price, american_odds, bet_size, implied_probability,
         game_start_time, game_date, condition_id, event_slug,
         book_name, book_price, best_book, best_book_price, best_book_decimal,
         resolved, result, pnl,
         quality_score, all_book_odds, wallet_rank, created_at,
         odds_event_id, odds_sport, odds_market_key, odds_confidence`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // For score/stake sort, fetch more rows since sorting happens after enrichment
    // Need a large window to ensure top-scored picks from all sports are included
    const fetchLimit = sortBy === "recent" ? limit : Math.max(limit * 10, 500);
    query = query.range(0, fetchLimit - 1);

    // Filters
    // Push tier filter to DB level so pagination works correctly
    // (otherwise filtering 50 fetched rows could return only 2 matches)
    if (tierFilter && tierFilter.length > 0) {
      query = query.in("tier", tierFilter);
    }
    if (sport) query = query.eq("sport", sport);
    if (walletFilter && walletFilter.length > 0) {
      if (walletFilter.length === 1) {
        query = query.eq("wallet_address", walletFilter[0]);
      } else {
        query = query.in("wallet_address", walletFilter);
      }
    }
    if (minStake > 0) query = query.gte("bet_size", minStake);
    if (minQuality > 0) query = query.gte("quality_score", minQuality);

    if (resolvedFilter === "true") query = query.eq("resolved", true);
    else if (resolvedFilter === "false") {
      query = query.eq("resolved", false);
      // Filter out games that have already started — picks are no longer actionable
      const cutoff = new Date().toISOString();
      query = query.or(`game_start_time.is.null,game_start_time.gte.${cutoff}`);
    }

    if (todayOnly) {
      const today = new Date().toISOString().slice(0, 10);
      query = query.gte("created_at", `${today}T00:00:00Z`);
    }

    // Date range filter
    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let cutoff: Date;
      if (dateRange === "today") {
        cutoff = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
      } else if (dateRange === "3d") {
        cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      } else if (dateRange === "7d") {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        cutoff = new Date(0);
      }
      query = query.gte("created_at", cutoff.toISOString());
    }

    // Odds range filter (american_odds)
    if (minOdds != null) query = query.gte("american_odds", minOdds);
    if (maxOdds != null) query = query.lte("american_odds", maxOdds);

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
      .select("wallet_address, rank, tier, roi, wins, losses, avg_stake, total_profit, is_new_account, poly_pnl, poly_rank, poly_volume, poly_month_pnl, poly_week_pnl, hot_cold, poly_total_trades, poly_sport_breakdown, poly_avg_stake")
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

        // Normalize market_type and outcome at read-time
        const normalizedMarketType = normalizeMarketType(
          s.market_type,
          s.market_title,
          s.outcome
        );
        const normalizedOutcome = normalizeOutcome(
          s.outcome,
          s.market_title,
          normalizedMarketType
        );

        // Compute correct spread display for the bettor's side
        // Polymarket: "Spread: Thunder (-18.5)" — Thunder outcome = -18.5, Nets outcome = +18.5
        let spreadDisplay: string | null = null;
        if (normalizedMarketType === "spread") {
          const lineMatch = (s.market_title || "").match(/\(([+-]?\d+\.?\d*)\)/);
          const favoriteMatch = (s.market_title || "").match(/Spread:\s*(.+?)\s*\(/i);
          if (lineMatch && favoriteMatch) {
            const favoriteLine = parseFloat(lineMatch[1]); // e.g. -18.5
            const favoriteTeam = favoriteMatch[1].trim();
            const isFavorite = normalizedOutcome.toLowerCase().includes(favoriteTeam.toLowerCase())
              || favoriteTeam.toLowerCase().includes(normalizedOutcome.toLowerCase());
            const line = isFavorite ? favoriteLine : -favoriteLine;
            spreadDisplay = `${normalizedOutcome} ${line > 0 ? "+" : ""}${line}`;
          }
        }

        return {
          ...s,
          market_type: normalizedMarketType,
          outcome: normalizedOutcome,
          spread_display: spreadDisplay,
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
          wallet_total_trades: ws?.poly_total_trades ?? null,
          wallet_sport_breakdown: ws?.poly_sport_breakdown ?? null,
          stake_vs_avg: stakeVsAvg,
          is_new_account: ws?.is_new_account ?? false,
          signal_score: scoreResult.total,
          signal_label: scoreResult.label,
          score_breakdown: scoreResult.breakdown,
        };
      })
      .filter((s) => {
        // Tier filter already applied at DB level
        // Filter new accounts if disabled
        if (!showNew && s.is_new_account) return false;
        return true;
      });

    // Aggregate duplicate fills: same wallet + same market (token_id) + same side
    // Wallets often split large bets into 5+ chunks within seconds to avoid moving the book
    let aggregated = (() => {
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

    // ── Opposing position detection (two layers) ────────────────
    // Layer 1: Same condition_id — wallet bet both outcomes of same market
    //          (e.g., Team A ML + Team B ML on same moneyline market)
    // Layer 2: Same event_slug — wallet bet correlated markets on same game
    //          (e.g., Team A ML + Team B spread, or Over + Team A ML)
    // This catches hedging, arbing, and position management across market types.
    {
      // ── Layer 1: Exact market opposition (same condition_id) ──
      const conditionMap = new Map<string, Map<string, { totalSize: number; outcome: string }>>();
      for (const s of aggregated) {
        const condId = (s as any).condition_id;
        if (!condId || !s.wallet_address) continue;
        const key = `${s.wallet_address}:${condId}`;
        if (!conditionMap.has(key)) conditionMap.set(key, new Map());
        const outcomes = conditionMap.get(key)!;
        const outcome = s.outcome || "unknown";
        const existing = outcomes.get(outcome);
        if (existing) {
          existing.totalSize += s.bet_size ?? 0;
        } else {
          outcomes.set(outcome, { totalSize: s.bet_size ?? 0, outcome });
        }
      }

      // ── Layer 2: Same-game cross-market opposition (same event_slug) ──
      // Determine each signal's "side" of the game: home team, away team, over, under
      // Two signals conflict if one backs home team (ML/spread) and another backs away team
      const getGameSide = (s: any): string | null => {
        const outcome = (s.outcome || "").toLowerCase();
        const marketType = (s.market_type || "").toLowerCase();
        const homeTeam = (s.home_team || "").toLowerCase();
        const awayTeam = (s.away_team || "").toLowerCase();

        if (marketType === "total" || /over|under/i.test(outcome)) {
          return /over/i.test(outcome) ? "over" : "under";
        }

        // For ML / spread: match outcome to home or away team
        if (homeTeam && outcome.includes(homeTeam)) return "home";
        if (awayTeam && outcome.includes(awayTeam)) return "away";

        // Fuzzy: check if any word in outcome matches team name
        const homeWords = homeTeam.split(/\s+/).filter((w: string) => w.length > 3);
        const awayWords = awayTeam.split(/\s+/).filter((w: string) => w.length > 3);
        for (const w of homeWords) { if (outcome.includes(w)) return "home"; }
        for (const w of awayWords) { if (outcome.includes(w)) return "away"; }

        return null;
      };

      const OPPOSING_SIDES: Record<string, string> = {
        home: "away", away: "home", over: "under", under: "over",
      };

      // Build event-level position map: wallet+event → gameSide → signals
      const eventMap = new Map<string, Map<string, { totalSize: number; outcomes: string[]; marketTypes: string[] }>>();
      for (const s of aggregated) {
        const slug = (s as any).event_slug || (s as any).odds_event_id;
        if (!slug || !s.wallet_address) continue;
        const gameSide = getGameSide(s);
        if (!gameSide) continue;

        const key = `${s.wallet_address}:${slug}`;
        if (!eventMap.has(key)) eventMap.set(key, new Map());
        const sides = eventMap.get(key)!;
        const existing = sides.get(gameSide);
        if (existing) {
          existing.totalSize += s.bet_size ?? 0;
          if (!existing.outcomes.includes(s.outcome)) existing.outcomes.push(s.outcome);
          const mt = (s as any).market_type || "unknown";
          if (!existing.marketTypes.includes(mt)) existing.marketTypes.push(mt);
        } else {
          sides.set(gameSide, {
            totalSize: s.bet_size ?? 0,
            outcomes: [s.outcome || "unknown"],
            marketTypes: [(s as any).market_type || "unknown"],
          });
        }
      }

      // ── Tag each signal ──
      for (const s of aggregated) {
        // Default: no opposing position
        (s as any).has_opposing_position = false;
        (s as any).opposing_position = null;

        const condId = (s as any).condition_id;
        const thisOutcome = s.outcome || "unknown";
        const thisSize = s.bet_size ?? 0;

        // Layer 1: Same condition_id (exact market — both outcomes)
        if (condId && s.wallet_address) {
          const key = `${s.wallet_address}:${condId}`;
          const outcomes = conditionMap.get(key);
          if (outcomes && outcomes.size >= 2) {
            let opposingOutcome = "";
            let opposingSize = 0;
            for (const [oc, data] of outcomes) {
              if (oc !== thisOutcome && data.totalSize > opposingSize) {
                opposingOutcome = oc;
                opposingSize = data.totalSize;
              }
            }
            const thisSideSize = outcomes.get(thisOutcome)?.totalSize ?? thisSize;
            (s as any).has_opposing_position = true;
            (s as any).opposing_position = {
              outcome: opposingOutcome,
              total_size: Math.round(opposingSize * 100) / 100,
              net_direction: thisSideSize >= opposingSize ? "this" : "opposing",
              net_size: Math.round(Math.abs(thisSideSize - opposingSize) * 100) / 100,
              is_hedge: thisSideSize < opposingSize,
              type: "same_market",
            };
            continue; // Layer 1 takes priority — skip Layer 2
          }
        }

        // Layer 2: Same event_slug (cross-market — ML vs spread, spread vs spread)
        const slug = (s as any).event_slug || (s as any).odds_event_id;
        const gameSide = getGameSide(s);
        if (!slug || !gameSide || !s.wallet_address) continue;

        const key = `${s.wallet_address}:${slug}`;
        const sides = eventMap.get(key);
        if (!sides) continue;

        const oppSideKey = OPPOSING_SIDES[gameSide];
        if (!oppSideKey) continue;

        const oppData = sides.get(oppSideKey);
        if (!oppData) continue;

        // This wallet has bets on the opposing side of the same game
        const thisSideData = sides.get(gameSide);
        const thisSideTotal = thisSideData?.totalSize ?? thisSize;

        (s as any).has_opposing_position = true;
        (s as any).opposing_position = {
          outcome: oppData.outcomes.join(", "),
          total_size: Math.round(oppData.totalSize * 100) / 100,
          net_direction: thisSideTotal >= oppData.totalSize ? "this" : "opposing",
          net_size: Math.round(Math.abs(thisSideTotal - oppData.totalSize) * 100) / 100,
          is_hedge: thisSideTotal < oppData.totalSize,
          type: "cross_market",
          opposing_markets: oppData.marketTypes,
        };
      }
    }

    // Detect split markets — different wallets on opposing outcomes of same condition_id
    const splitMarketOutcomes = new Map<string, Set<string>>();
    for (const s of aggregated) {
      const cid = s.condition_id;
      if (!cid) continue;
      if (!splitMarketOutcomes.has(cid)) splitMarketOutcomes.set(cid, new Set());
      splitMarketOutcomes.get(cid)!.add(s.outcome);
    }
    const splitConditionIds = new Set<string>();
    for (const [cid, outcomes] of splitMarketOutcomes) {
      if (outcomes.size > 1) splitConditionIds.add(cid);
    }
    for (const s of aggregated) {
      (s as any).is_split_market = s.condition_id ? splitConditionIds.has(s.condition_id) : false;
    }

    // Build odds_key for frontend to fetch odds separately (no Redis calls here)
    // Remap generic market keys to sport-specific Redis key names
    const SPORT_MARKET_REMAP: Record<string, Record<string, string>> = {
      nba: { game_total: "total_points" },
      nhl: { game_total: "game_total_goals", game_spread: "game_puck_line" },
      ncaab: { game_total: "total_points" },
      mlb: { game_spread: "game_run_line" },
    };

    for (const s of aggregated) {
      if (!s.odds_event_id || !s.odds_sport || !s.odds_market_key) continue;

      let market = s.odds_market_key;
      const remap = SPORT_MARKET_REMAP[s.odds_sport];
      if (remap && remap[market]) market = remap[market];

      // Extract line from title for totals and spreads
      let line: string | null = null;
      if (market === "total_points" || market === "game_total_goals" || market === "game_total") {
        const lineMatch = (s.market_title || "").match(/O\/U\s+([\d.]+)/i);
        if (lineMatch) line = lineMatch[1];
      } else if (market === "game_spread" || market === "game_puck_line" || market === "game_run_line") {
        // Extract spread line from title: "Spread: Bucks (-5.5)" → "-5.5"
        const lineMatch = (s.market_title || "").match(/\(([+-]?\d+\.?\d*)\)/);
        let rawLine = lineMatch ? lineMatch[1] : null;

        // Also try "Spread -15.5" format without parens
        if (!rawLine) {
          const altMatch = (s.market_title || "").match(/Spread\s+([+-]?\d+\.?\d*)/i);
          if (altMatch) rawLine = altMatch[1];
        }

        if (rawLine) {
          // The title line belongs to the team mentioned in the title (e.g., "Bucks")
          // If the sharp bet the OTHER team, flip the sign
          // "Spread: Bucks (-5.5)" + outcome="Jazz" → Jazz is +5.5
          const titleTeam = (s.market_title || "").match(/Spread:\s*(.+?)\s*\(/i)?.[1]?.trim().toLowerCase();
          const sharpOutcome = (s.outcome || "").toLowerCase();

          if (titleTeam && sharpOutcome && !sharpOutcome.includes(titleTeam) && !titleTeam.includes(sharpOutcome)) {
            // Sharp bet the opposite team — flip the sign
            const num = parseFloat(rawLine);
            if (!isNaN(num)) {
              line = num > 0 ? `-${Math.abs(num)}` : `+${Math.abs(num)}`;
            } else {
              line = rawLine;
            }
          } else {
            line = rawLine;
          }
        }
      }

      // Normalize outcome for totals: "Over 225.5" → "over", "Under 225.5" → "under"
      let outcomeForOdds = s.outcome || null;
      if (market === "total_points" || market === "game_total_goals" || market === "game_total") {
        const ouMatch = (s.outcome || "").match(/^(over|under)/i);
        if (ouMatch) outcomeForOdds = ouMatch[1].toLowerCase();
      }

      (s as any).odds_key = {
        sport: s.odds_sport,
        event_id: s.odds_event_id,
        market,
        outcome: outcomeForOdds,
        line,
      };
    }

    // Apply min score filter (computed post-enrichment)
    if (minScore > 0) {
      const beforeCount = aggregated.length;
      aggregated = aggregated.filter((s: any) => (s.signal_score ?? 0) >= minScore);
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
