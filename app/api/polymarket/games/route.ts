"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { hasEliteAccess, normalizePlanName, type UserPlan } from "@/lib/plans";

/** Normalize market_type from title — whale tracker sometimes misclassifies */
function normalizeMarketType(currentType: string | null, title: string | null): string {
  const t = (title || "").trim();
  if (/^Spread:/i.test(t) || /spread/i.test(t)) return "spread";
  if (/O\/U\s*\d/i.test(t) || /over.?under/i.test(t)) return "total";
  if (/^Will .+ win on \d{4}-\d{2}-\d{2}\??$/i.test(t)) return "moneyline";
  if (/^.+\s+vs\.?\s+.+$/i.test(t) && !/spread|o\/u|over|under|total/i.test(t)) return "moneyline";
  return currentType || "unknown";
}

/**
 * GET /api/polymarket/games
 *
 * Returns aggregated market-level sharp signals grouped by condition_id.
 * Each "game" represents a unique market with net sharp flow, consensus direction,
 * confidence level, and expandable individual bets.
 *
 * Query params:
 *   sport     - filter by sport (e.g. "nba", "soccer")
 *   minFlow   - minimum total dollar flow (default 0)
 *   confidence - filter: "strong" | "lean" | "all" (default "all")
 *   resolved  - "true" | "false" | "all" (default "all")
 *   today     - "true" to only show today's games (default "false")
 *   limit     - max markets to return (default 50, max 100)
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

    // Plan check — Elite only
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
    const conditionId = sp.get("condition_id") || undefined;
    const sportFilter = sp.get("sport") || undefined;
    const minFlow = Math.max(parseInt(sp.get("minFlow") || "0", 10), 0);
    const confidenceFilter = sp.get("confidence") || "all";
    const resolvedFilter = sp.get("resolved") || "all";
    const todayOnly = sp.get("today") === "true";
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "50", 10), 1), 100);

    // Fetch raw signals (we aggregate in JS since Supabase REST can't do this grouping)
    let query = supabase
      .from("polymarket_signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(conditionId ? 200 : 2000); // Smaller fetch for single market lookup

    // Direct condition_id lookup — fast path
    if (conditionId) {
      query = query.eq("condition_id", conditionId);
    }

    if (sportFilter) {
      query = query.eq("sport", sportFilter);
    }
    if (resolvedFilter === "true") {
      query = query.eq("resolved", true);
    } else if (resolvedFilter === "false") {
      query = query.eq("resolved", false);
      // Filter out games that have already started — no longer actionable
      const cutoff = new Date().toISOString();
      query = query.or(`game_start_time.is.null,game_start_time.gte.${cutoff}`);
    }
    if (todayOnly) {
      const todayStr = new Date().toISOString().slice(0, 10);
      query = query.gte("created_at", `${todayStr}T00:00:00Z`);
    }

    // Exclude burner tier — proven negative ROI
    query = query.neq("tier", "burner");

    const { data: signals, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by condition_id
    const marketMap = new Map<string, {
      condition_id: string;
      market_title: string;
      sport: string | null;
      market_type: string | null;
      game_date: string | null;
      game_start_time: string | null;
      outcomes: Map<string, {
        outcome: string;
        signals: typeof signals;
        total_dollars: number;
        sharp_count: number;
        whale_count: number;
        avg_entry_price: number;
        best_book: string | null;
        best_book_price: string | null;
        best_book_decimal: number | null;
      }>;
      first_signal_at: string;
      last_signal_at: string;
      resolved: boolean;
    }>();

    for (const sig of signals ?? []) {
      const cid = sig.condition_id;
      if (!cid) continue;

      if (!marketMap.has(cid)) {
        marketMap.set(cid, {
          condition_id: cid,
          market_title: sig.market_title,
          sport: sig.sport,
          market_type: sig.market_type,
          game_date: sig.game_date,
          game_start_time: sig.game_start_time,
          outcomes: new Map(),
          first_signal_at: sig.created_at,
          last_signal_at: sig.created_at,
          resolved: sig.resolved,
        });
      }

      const market = marketMap.get(cid)!;
      market.last_signal_at = sig.created_at; // signals ordered desc, so first seen = latest
      if (sig.created_at < market.first_signal_at) {
        market.first_signal_at = sig.created_at;
      }

      const outcome = sig.outcome || sig.side || "unknown";
      if (!market.outcomes.has(outcome)) {
        market.outcomes.set(outcome, {
          outcome,
          signals: [],
          total_dollars: 0,
          sharp_count: 0,
          whale_count: 0,
          avg_entry_price: 0,
          best_book: null,
          best_book_price: null,
          best_book_decimal: null,
        });
      }

      const side = market.outcomes.get(outcome)!;
      side.signals.push(sig);
      side.total_dollars += sig.bet_size || 0;
      if (sig.tier === "sharp") side.sharp_count++;
      if (sig.tier === "whale") side.whale_count++;

      // Track best book odds (highest decimal = best for bettor)
      if (sig.best_book_decimal && (!side.best_book_decimal || sig.best_book_decimal > side.best_book_decimal)) {
        side.best_book = sig.best_book;
        side.best_book_price = sig.best_book_price;
        side.best_book_decimal = sig.best_book_decimal;
      }
    }

    // Build response
    const games = [];

    for (const [cid, market] of marketMap) {
      const outcomesArr = Array.from(market.outcomes.entries()).map(([name, data]) => {
        const entryPrices = data.signals.map(s => s.entry_price).filter(Boolean);
        const avgEntry = entryPrices.length > 0
          ? entryPrices.reduce((a, b) => a + b, 0) / entryPrices.length
          : 0;

        // Individual bets with anonymized display ID + full address for wallet lookup
        const bets = data.signals.map(s => ({
          anon_id: `#${(s.wallet_address || "0000").slice(0, 4).toUpperCase()}`,
          wallet_address: s.wallet_address,
          tier: s.tier,
          bet_size: s.bet_size,
          entry_price: s.entry_price,
          american_odds: s.american_odds,
          result: s.result,
          quality_score: s.quality_score,
          created_at: s.created_at,
        }));

        // Win/loss for this side
        const wins = data.signals.filter(s => s.result === "win").length;
        const losses = data.signals.filter(s => s.result === "loss").length;

        // Get token_id from first signal that has one
        const tokenId = data.signals.find(s => s.token_id)?.token_id || null;

        // Build odds_key from first signal with odds data
        const SPORT_MARKET_REMAP: Record<string, Record<string, string>> = {
          nba: { game_total: "total_points" },
          nhl: { game_total: "game_total_goals", game_spread: "game_puck_line" },
          ncaab: { game_total: "total_points" },
          mlb: { game_spread: "game_run_line" },
        };
        const oddsSig = data.signals.find(s => s.odds_event_id && s.odds_sport && s.odds_market_key);
        let oddsKey = null;
        if (oddsSig) {
          let mkt = oddsSig.odds_market_key;
          const remap = SPORT_MARKET_REMAP[oddsSig.odds_sport];
          if (remap && remap[mkt]) mkt = remap[mkt];

          let line: string | null = null;
          const title = oddsSig.market_title || "";
          if (mkt === "total_points" || mkt === "game_total_goals" || mkt === "game_total") {
            const m = title.match(/O\/U\s+([\d.]+)/i);
            if (m) line = m[1];
          } else if (mkt === "game_spread" || mkt === "game_puck_line" || mkt === "game_run_line") {
            const m = title.match(/\(([+-]?\d+\.?\d*)\)/);
            let rawLine = m ? m[1] : null;
            if (!rawLine) {
              const alt = title.match(/Spread\s+([+-]?\d+\.?\d*)/i);
              if (alt) rawLine = alt[1];
            }
            if (rawLine) {
              const titleTeam = title.match(/Spread:\s*(.+?)\s*\(/i)?.[1]?.trim().toLowerCase();
              const outcomeL = name.toLowerCase();
              if (titleTeam && outcomeL && !outcomeL.includes(titleTeam) && !titleTeam.includes(outcomeL)) {
                const num = parseFloat(rawLine);
                line = !isNaN(num) ? (num > 0 ? `-${Math.abs(num)}` : `+${Math.abs(num)}`) : rawLine;
              } else {
                line = rawLine;
              }
            }
          }

          // Normalize outcome for totals: "Over 225.5" → "over"
          let outcomeForOdds = name || null;
          if (mkt === "total_points" || mkt === "game_total_goals" || mkt === "game_total") {
            const ouMatch = (name || "").match(/^(over|under)/i);
            if (ouMatch) outcomeForOdds = ouMatch[1].toLowerCase();
          }

          oddsKey = {
            sport: oddsSig.odds_sport,
            event_id: oddsSig.odds_event_id,
            market: mkt,
            outcome: outcomeForOdds,
            line,
          };
        }

        return {
          outcome: name,
          total_dollars: data.total_dollars,
          sharp_count: data.sharp_count,
          whale_count: data.whale_count,
          total_bets: data.signals.length,
          avg_entry_price: avgEntry,
          best_book: data.best_book,
          best_book_price: data.best_book_price,
          best_book_decimal: data.best_book_decimal,
          wins,
          losses,
          bets,
          token_id: tokenId,
          odds_key: oddsKey,
        };
      });

      const totalDollars = outcomesArr.reduce((s, o) => s + o.total_dollars, 0);
      const totalBets = outcomesArr.reduce((s, o) => s + o.total_bets, 0);

      // Skip low-flow markets
      if (totalDollars < minFlow) continue;

      // Sort outcomes by total dollars (majority first)
      outcomesArr.sort((a, b) => b.total_dollars - a.total_dollars);

      // Compute consensus
      const majoritySide = outcomesArr[0];
      const flowPct = totalDollars > 0 ? (majoritySide.total_dollars / totalDollars) * 100 : 50;

      let confidence: "strong" | "lean" | "split";
      if (flowPct >= 75 && (majoritySide.sharp_count + majoritySide.whale_count) >= 3) {
        confidence = "strong";
      } else if (flowPct >= 60 || (majoritySide.sharp_count + majoritySide.whale_count) >= 2) {
        confidence = "lean";
      } else {
        confidence = "split";
      }

      // Filter by confidence
      if (confidenceFilter !== "all" && confidence !== confidenceFilter) continue;

      // Compute consensus result (did majority side win?)
      let consensus_result: "win" | "loss" | "pending" = "pending";
      if (market.resolved) {
        consensus_result = majoritySide.wins > majoritySide.losses ? "win" : "loss";
      }

      games.push({
        condition_id: cid,
        market_title: market.market_title,
        sport: market.sport,
        market_type: normalizeMarketType(market.market_type, market.market_title),
        game_date: market.game_date,
        game_start_time: market.game_start_time,
        resolved: market.resolved,
        consensus_outcome: majoritySide.outcome,
        consensus_result,
        flow_pct: Math.round(flowPct),
        confidence,
        total_dollars: totalDollars,
        total_bets: totalBets,
        total_sharps: outcomesArr.reduce((s, o) => s + o.sharp_count, 0),
        total_whales: outcomesArr.reduce((s, o) => s + o.whale_count, 0),
        outcomes: outcomesArr,
        first_signal_at: market.first_signal_at,
        last_signal_at: market.last_signal_at,
      });
    }

    // Sort by: confidence desc, then flow amount desc
    const confidenceOrder = { strong: 3, lean: 2, split: 1 };
    games.sort((a, b) => {
      const cDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      if (cDiff !== 0) return cDiff;
      return b.total_dollars - a.total_dollars;
    });

    return NextResponse.json({
      games: games.slice(0, limit),
      total: games.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
