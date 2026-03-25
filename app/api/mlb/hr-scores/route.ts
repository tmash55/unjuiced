import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";

interface BestOddsData {
  best_book: string;
  best_price: number;
  line: number;
  side: string;
  player_id: string;
  player_name: string;
  book_count: number;
  updated_at: number;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface HRScorePlayer {
  player_id: number | null;
  player_name: string;
  team_abbr: string;
  hr_score: number;
  score_tier: string;
  // Sub-scores (0-100)
  batter_power_score: number;
  pitcher_vuln_score: number;
  park_factor_score: number;
  environment_score: number;
  matchup_context_score: number;
  // Matchup
  opp_pitcher_name: string | null;
  opp_pitcher_hand: string | null;
  bat_hand: string | null;
  venue_name: string | null;
  // Statcast
  barrel_pct: number | null;
  max_exit_velo: number | null;
  hard_hit_pct: number | null;
  iso: number | null;
  // Park & weather
  park_hr_factor: number | null;
  temperature_f: number | null;
  wind_label: string | null;
  env_boost: string | null;
  // Matchup context
  platoon_advantage: boolean | null;
  bvp_pa: number | null;
  bvp_hr: number | null;
  // Surge
  surge_direction: string | null;
  surge_barrel_pct_7d: number | null;
  surge_hr_7d: number | null;
  // Odds
  best_odds_american: number | null;
  best_odds_book: string | null;
  best_odds_link: string | null;
  best_odds_mobile_link: string | null;
  // Model
  model_implied_prob: number | null;
  odds_implied_prob: number | null;
  edge_pct: number | null;
  // Extra
  all_book_odds: Record<string, any> | null;
  hr_streak: number | null;
  hr_last_3_games: number | null;
  game_date: string;
}

export interface HRScoreResponse {
  players: HRScorePlayer[];
  meta: {
    date: string;
    totalPlayers: number;
    availableDates: string[];
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getETDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const targetDate = dateParam || getETDate();

    const sb = createServerSupabaseClient();

    const { data, error } = await sb
      .from("mlb_hr_scores")
      .select("*")
      .eq("game_date", targetDate)
      .order("hr_score", { ascending: false });

    if (error) {
      console.error("[HR Scores API] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch HR scores", details: error.message },
        { status: 500 }
      );
    }

    const rawPlayers = (data ?? []) as any[];

    // ── Fetch best HR odds from Redis ──────────────────────────────────
    // Try hit_rate_profiles first (has event_id + sel_key), fall back to
    // scanning Redis bestodds keys by player name if no profiles exist
    const playerIds = rawPlayers.map((p: any) => p.player_id).filter(Boolean);
    let oddsMap = new Map<number, BestOddsData | null>();

    if (playerIds.length > 0) {
      // Approach 1: Look up via hit_rate_profiles (works when pipeline has run)
      const { data: profileRows } = await sb
        .from("mlb_hit_rate_profiles")
        .select("player_id, event_id, sel_key, market")
        .eq("game_date", targetDate)
        .eq("market", "player_home_runs")
        .in("player_id", playerIds);

      if (profileRows && profileRows.length > 0) {
        const profileMap = new Map<number, { event_id: string; sel_key: string }>();
        for (const row of profileRows) {
          if (row.event_id && row.sel_key) {
            profileMap.set(row.player_id, { event_id: row.event_id, sel_key: row.sel_key });
          }
        }

        const lookups = playerIds
          .map((pid: number) => ({ pid, profile: profileMap.get(pid) }))
          .filter((l: any) => l.profile);

        if (lookups.length > 0) {
          const redisKeys = lookups.map((l: any) =>
            `bestodds:mlb:${l.profile.event_id}:player_home_runs:${l.profile.sel_key}`
          );
          try {
            const values = await redis.mget<(BestOddsData | string | null)[]>(...redisKeys);
            lookups.forEach((l: any, i: number) => {
              const val = values[i];
              if (!val) { oddsMap.set(l.pid, null); return; }
              if (typeof val === "string") {
                try { oddsMap.set(l.pid, JSON.parse(val)); } catch { oddsMap.set(l.pid, null); }
              } else {
                oddsMap.set(l.pid, val);
              }
            });
          } catch (e) {
            console.error("[HR Scores] Redis best odds error:", e);
          }
        }
      } else {
        // Approach 2: No profiles — try to find odds via active events
        // Get event IDs for this date from mlb_games
        const { data: gameRows } = await sb
          .from("mlb_games")
          .select("game_id, event_id")
          .eq("game_date", targetDate);

        const eventIds = (gameRows ?? [])
          .map((g: any) => g.event_id)
          .filter(Boolean) as string[];

        if (eventIds.length > 0) {
          // For each event, get the odds index to find HR market keys
          const indexKeys = eventIds.map((eid) => `odds_idx:mlb:${eid}`);
          try {
            // Get all market:book combos for each event
            const pipeline = redis.pipeline();
            for (const key of indexKeys) {
              pipeline.smembers(key);
            }
            const indexResults = await pipeline.exec<string[][]>();

            // Find player_home_runs entries and extract book names
            const hrOddsKeys: string[] = [];
            const hrEventMap: string[] = []; // parallel array tracking which event
            for (let i = 0; i < eventIds.length; i++) {
              const members = indexResults?.[i] ?? [];
              for (const member of members) {
                if (typeof member === "string" && member.startsWith("player_home_runs:")) {
                  hrOddsKeys.push(`odds:mlb:${eventIds[i]}:${member}`);
                  hrEventMap.push(eventIds[i]);
                }
              }
            }

            if (hrOddsKeys.length > 0) {
              // Fetch the actual odds data (these can be large)
              // Just fetch first book per event to get player names/odds
              const oddsValues = await redis.mget<(string | any | null)[]>(...hrOddsKeys.slice(0, 30));

              // Parse and map by player name
              const playerNameMap = new Map<string, number>();
              for (const p of rawPlayers) {
                if (p.player_name) playerNameMap.set(p.player_name.toLowerCase(), p.player_id);
              }

              for (let i = 0; i < (oddsValues?.length ?? 0); i++) {
                const raw = oddsValues?.[i];
                if (!raw) continue;
                const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                // Odds data has selections with player names
                const selections = parsed?.selections ?? parsed?.outcomes ?? [];
                for (const sel of (Array.isArray(selections) ? selections : [])) {
                  const name = (sel.description ?? sel.name ?? sel.player_name ?? "").toLowerCase();
                  const price = sel.price ?? sel.odds ?? null;
                  const pid = playerNameMap.get(name);
                  if (pid && price != null && !oddsMap.has(pid)) {
                    oddsMap.set(pid, {
                      best_book: parsed.book ?? parsed.sportsbook ?? "unknown",
                      best_price: price,
                      line: sel.line ?? 0.5,
                      side: "over",
                      player_id: String(pid),
                      player_name: sel.description ?? sel.name ?? "",
                      book_count: 1,
                      updated_at: Date.now(),
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error("[HR Scores] Redis odds index scan error:", e);
          }
        }
      }
    }

    // Enrich players with live odds
    const players: HRScorePlayer[] = rawPlayers.map((p: any) => {
      const odds = oddsMap.get(p.player_id);
      return {
        ...p,
        best_odds_american: odds?.best_price ?? p.best_odds_american ?? null,
        best_odds_book: odds?.best_book ?? p.best_odds_book ?? null,
      };
    });

    // Fetch available dates from hr_scores table
    const today = getETDate();
    const { data: dateRows } = await sb
      .from("mlb_hr_scores")
      .select("game_date")
      .gte("game_date", today)
      .order("game_date", { ascending: true });

    const availableDates = [
      ...new Set((dateRows ?? []).map((r: { game_date: string }) => r.game_date)),
    ] as string[];

    const response: HRScoreResponse = {
      players,
      meta: {
        date: targetDate,
        totalPlayers: players.length,
        availableDates,
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err: any) {
    console.error("[HR Scores API]", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
