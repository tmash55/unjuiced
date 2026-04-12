"use client";

import { cn } from "@/lib/utils";
import type { ActivePlay } from "@/app/api/polymarket/active-plays/route";
import { TierBadge } from "./tier-badge";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import useSWR from "swr";
import { useSignalPreferences } from "@/hooks/use-signal-preferences";
import { getScoreStyle } from "./play-card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatVolume(v: number | string | null): string {
  if (!v) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatPrice(p: string | number | null): string {
  if (!p) return "—";
  const n = typeof p === "string" ? parseFloat(p) : p;
  if (isNaN(n)) return "—";
  return `${(n * 100).toFixed(0)}¢`;
}

function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

// ── Kelly Calculator ─────────────────────────────────────────────────────────

function calculateKelly(
  play: ActivePlay,
  bankroll: number,
  riskTolerance: "conservative" | "moderate" | "aggressive",
  maxBetPct = 5
) {
  const p = parseFloat(play.estimated_true_prob ?? "0");
  const price = parseFloat(play.current_poly_price ?? "0");
  if (!bankroll || !p || !price || price >= 1) return null;

  const b = 1 / price - 1;
  const q = 1 - p;
  const fullKelly = (b * p - q) / b;
  if (fullKelly <= 0) return null;

  const fractions = { conservative: 0.25, moderate: 0.5, aggressive: 1.0 };
  const fraction = fractions[riskTolerance] ?? 0.5;
  const kellyPct = fullKelly * fraction;
  const cappedPct = Math.min(kellyPct, maxBetPct / 100);

  return {
    betAmount: Math.round(bankroll * cappedPct),
    kellyPct: (cappedPct * 100).toFixed(1),
  };
}

// ── Signal row type ───────────────────────────────────────────────────────────

interface SignalRow {
  id: number;
  wallet_address: string;
  tier: string;
  wallet_username: string | null;
  bet_size: string;
  entry_price: string;
  side: string;
  outcome: string;
  created_at: string;
  quality_score: number | null;
}

// ── Main detail component ────────────────────────────────────────────────────

export function PlayDetail({ play }: { play: ActivePlay }) {
  const score = play.combined_score ?? play.play_score ?? 0;
  const ss = getScoreStyle(score);
  const edge = parseFloat(play.estimated_edge ?? "0");
  const volume = parseFloat(
    (play.total_volume ?? play.total_sharp_volume ?? "0") as string
  );
  const trueProb = parseFloat(play.estimated_true_prob ?? "0");
  const walletCount = play.wallet_count ?? play.sharp_count ?? 0;
  const lastSignal = play.last_signal_at ?? play.latest_signal_at;
  const question = play.market_question ?? play.market_title ?? "";
  const side = play.recommended_side ?? play.outcome ?? "";
  const opp = play.opposing_side_summary;
  const isSplit = opp?.conflict_status === "split";

  const { prefs } = useSignalPreferences();
  const bankroll = prefs.bankroll ?? null;
  const risk = (prefs.risk_tolerance as "conservative" | "moderate" | "aggressive") ?? "moderate";

  // Fetch signal timeline
  const signalIds = play.signal_ids ?? [];
  const { data: signalsData } = useSWR(
    signalIds.length > 0
      ? `/api/polymarket/feed?ids=${signalIds.join(",")}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const signals: SignalRow[] = signalsData?.signals ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            {play.sport}
            {play.league && play.league !== play.sport && ` · ${play.league}`}
          </span>
          {play.game_date && (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
              · {play.game_date}
            </span>
          )}
        </div>
        <h2 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100 leading-snug tracking-tight">
          {question}
        </h2>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
            {side}
          </span>
          {play.current_poly_price && (
            <span className="text-sm text-neutral-400 dark:text-neutral-500">
              @ {formatPrice(play.current_poly_price)}
            </span>
          )}
        </div>
      </div>

      {/* Score hero */}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0",
            ss.badge
          )}
        >
          <span className="text-2xl font-black leading-none font-mono tabular-nums">
            {score}
          </span>
        </div>
        <div>
          <p className={cn("text-sm font-black uppercase tracking-wide", ss.labelColor)}>
            {play.play_label}
          </p>
          <div className="h-2 w-32 bg-neutral-200 dark:bg-neutral-700/60 rounded-full overflow-hidden mt-1.5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                score >= 90
                  ? "bg-red-500"
                  : score >= 75
                  ? "bg-orange-500"
                  : score >= 60
                  ? "bg-sky-500"
                  : score >= 45
                  ? "bg-neutral-500"
                  : "bg-neutral-700"
              )}
              style={{ width: `${score}%` }}
            />
          </div>
          {isSplit && (
            <p className="text-[10px] text-amber-500 font-medium mt-1">
              Sharps divided — both sides active
            </p>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-3 py-2.5">
          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
            Sharps
          </p>
          <p className="text-xl font-black font-mono tabular-nums text-neutral-900 dark:text-neutral-100 leading-none">
            {walletCount}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {(play.s_tier_count ?? 0) > 0 && (
              <span className="text-[9px] font-black px-1 py-0.5 rounded bg-amber-500/15 text-amber-500">
                S×{play.s_tier_count}
              </span>
            )}
            {(play.a_tier_count ?? 0) > 0 && (
              <span className="text-[9px] font-black px-1 py-0.5 rounded bg-violet-500/15 text-violet-400">
                A×{play.a_tier_count}
              </span>
            )}
            {(play.b_tier_count ?? 0) > 0 && (
              <span className="text-[9px] font-black px-1 py-0.5 rounded bg-sky-500/15 text-sky-400">
                B×{play.b_tier_count}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-3 py-2.5">
          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
            Volume
          </p>
          <p className="text-xl font-black font-mono tabular-nums text-neutral-900 dark:text-neutral-100 leading-none">
            {formatVolume(volume)}
          </p>
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
            avg entry {formatPrice(play.avg_entry_price)}
          </p>
        </div>

        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-3 py-2.5">
          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
            True Prob
          </p>
          <p className="text-xl font-black font-mono tabular-nums text-neutral-900 dark:text-neutral-100 leading-none">
            {trueProb > 0 ? `${(trueProb * 100).toFixed(1)}%` : "—"}
          </p>
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
            market {formatPrice(play.current_poly_price)}
          </p>
        </div>

        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/40 px-3 py-2.5">
          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
            Edge
          </p>
          <p
            className={cn(
              "text-xl font-black font-mono tabular-nums leading-none",
              edge > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : edge < 0
                ? "text-red-500 dark:text-red-400"
                : "text-neutral-400"
            )}
          >
            {edge !== 0 ? `${edge > 0 ? "+" : ""}${edge.toFixed(1)}%` : "—"}
          </p>
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
            model vs market
          </p>
        </div>
      </div>

      {/* Kelly sizing */}
      {bankroll && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
            Bet Sizing (Kelly)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["conservative", "moderate", "aggressive"] as const).map((r) => {
              const k = calculateKelly(play, bankroll, r);
              if (!k)
                return (
                  <div
                    key={r}
                    className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 p-2 text-center"
                  >
                    <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">
                      {r}
                    </span>
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500 block mt-0.5">
                      No edge
                    </span>
                  </div>
                );
              return (
                <div
                  key={r}
                  className={cn(
                    "rounded-lg p-2.5 text-center",
                    r === risk
                      ? "bg-sky-500/10 ring-1 ring-sky-500/20"
                      : "bg-neutral-50 dark:bg-neutral-800/40"
                  )}
                >
                  <span className="text-[9px] uppercase tracking-wider text-neutral-400 block">
                    {r}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-black font-mono tabular-nums block mt-0.5",
                      r === risk
                        ? "text-sky-600 dark:text-sky-400"
                        : "text-neutral-900 dark:text-neutral-100"
                    )}
                  >
                    ${k.betAmount.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-neutral-400">
                    {k.kellyPct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sportsbook odds */}
      {Array.isArray(play.sportsbook_odds) && play.sportsbook_odds.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
            Sportsbook Odds
          </p>
          <div className="space-y-1">
            {(play.sportsbook_odds as Record<string, unknown>[])
              .filter(
                (o, i, arr) =>
                  arr.findIndex((x) => x.book === o.book) === i
              )
              .slice(0, 8)
              .map((odds, i) => {
                const sbId = odds.book as string;
                const logo =
                  getSportsbookById(sbId)?.image?.light ??
                  getSportsbookById(sbId)?.image?.square;
                const name =
                  (odds.displayBook as string) ??
                  getSportsbookById(sbId)?.name ??
                  sbId;
                return (
                  <div
                    key={`${sbId}-${i}`}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/30"
                  >
                    <div className="flex items-center gap-2">
                      {logo && (
                        <img
                          src={logo}
                          alt=""
                          className="h-4 w-4 object-contain"
                        />
                      )}
                      <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                        {name}
                      </span>
                    </div>
                    <span className="text-xs font-bold font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
                      {odds.price as string}
                    </span>
                  </div>
                );
              })}
          </div>
          {play.sportsbook_implied && trueProb > 0 && (
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">
              Book implied:{" "}
              {(parseFloat(play.sportsbook_implied) * 100).toFixed(1)}%{" "}
              <span
                className={cn(
                  "font-bold",
                  trueProb > parseFloat(play.sportsbook_implied)
                    ? "text-emerald-500"
                    : "text-red-500"
                )}
              >
                ({trueProb > parseFloat(play.sportsbook_implied) ? "+" : ""}
                {(
                  (trueProb - parseFloat(play.sportsbook_implied)) *
                  100
                ).toFixed(1)}
                % vs model)
              </span>
            </p>
          )}
        </div>
      )}

      {/* Pricing chart placeholder */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
          Price History
        </p>
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200/40 dark:border-neutral-700/20 h-[120px] flex items-center justify-center">
          <div className="flex items-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-500">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
              />
            </svg>
            Chart coming soon
          </div>
        </div>
      </div>

      {/* Signal timeline */}
      {signals.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
            Signal Timeline ({signals.length})
          </p>
          <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-thin">
            {signals.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/30"
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    s.side === "BUY" ? "bg-emerald-500" : "bg-red-500"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {s.wallet_username ||
                        `${s.wallet_address.slice(0, 6)}…${s.wallet_address.slice(-4)}`}
                    </span>
                    <TierBadge tier={s.tier} size="xs" />
                    <span
                      className={cn(
                        "font-bold text-[10px]",
                        s.side === "BUY"
                          ? "text-emerald-500"
                          : "text-red-500"
                      )}
                    >
                      {s.side}
                    </span>
                    <span className="font-mono font-bold tabular-nums text-neutral-700 dark:text-neutral-300 text-[10px]">
                      {formatVolume(parseFloat(s.bet_size ?? "0"))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    <span>@ {formatPrice(s.entry_price)}</span>
                    <span>
                      {s.created_at
                        ? formatTimeAgo(s.created_at)
                        : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 pt-2 border-t border-neutral-100 dark:border-neutral-800/40">
        <span>
          First: <span className="font-mono tabular-nums">{formatTimeAgo(play.first_signal_at)}</span>
        </span>
        <span>
          Last: <span className="font-mono tabular-nums">{formatTimeAgo(lastSignal)}</span>
        </span>
      </div>

      {/* Polymarket link */}
      {play.event_slug && (
        <a
          href={`https://polymarket.com/event/${play.event_slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl",
            "text-xs font-semibold",
            "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900",
            "hover:opacity-90 transition-opacity active:scale-[0.98]"
          )}
        >
          View on Polymarket
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
