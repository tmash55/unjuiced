"use client";

import { useState, useMemo, useCallback, useSyncExternalStore } from "react";
import Image from "next/image";
import { ExternalLink, Clock, Star, RefreshCw, Zap, ChevronDown, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type SportsbookPromo,
  PROMO_TYPE_CONFIG,
  SPORTSBOOK_LOGO_MAP,
  SPORTSBOOK_BRAND_COLORS,
  type PromoType,
} from "@/lib/promos-schema";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { SportIcon } from "@/components/icons/sport-icons";

// Build a name → priority lookup from sportsbooks meta (higher = more popular)
const SPORTSBOOK_PRIORITY: Record<string, number> = {};
for (const sb of getAllActiveSportsbooks()) {
  SPORTSBOOK_PRIORITY[sb.name] = sb.priority ?? 0;
}

// ─── Claimed promos (localStorage) ────────────────────────────────────────────

const STORAGE_KEY = "unjuiced:claimed-promos";
let claimedCache: Set<number> = new Set();

function loadClaimed(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) claimedCache = new Set(JSON.parse(raw) as number[]);
  } catch { /* noop */ }
  return claimedCache;
}

function saveClaimed(ids: Set<number>) {
  claimedCache = ids;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* noop */ }
  // Notify all subscribers
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function getSnapshot() { return claimedCache; }
function getServerSnapshot() { return new Set<number>(); }

function useClaimedPromos() {
  const claimed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Load from localStorage once on mount
  useState(() => { if (typeof window !== "undefined") loadClaimed(); });

  const toggle = useCallback((id: number) => {
    const next = new Set(claimedCache);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveClaimed(next);
  }, []);

  return { claimed, toggle };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPromoTypeConfig(type: string) {
  const cfg = PROMO_TYPE_CONFIG[type as PromoType];
  if (cfg) return { label: cfg.label, classes: cfg.color, dotColor: cfg.dotColor };
  return {
    label: type,
    classes:
      "text-neutral-500 bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700",
    dotColor: "bg-neutral-400",
  };
}

function getSportsbookLogo(sportsbook: string): string {
  const filename = SPORTSBOOK_LOGO_MAP[sportsbook] ?? "generic-sportsbook.svg";
  return `/images/sports-books/${filename}`;
}

function getSportsbookBrandColor(sportsbook: string): string {
  return SPORTSBOOK_BRAND_COLORS[sportsbook] ?? "#6b7280";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonGroup() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        <div className="h-4 w-28 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-5 w-14 rounded-md bg-neutral-200 dark:bg-neutral-700" />
            </div>
            <div className="h-3 w-full rounded bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-3 w-3/4 rounded bg-neutral-100 dark:bg-neutral-800" />
            <div className="flex gap-2 mt-1">
              <div className="h-5 w-16 rounded-md bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-5 w-14 rounded-md bg-neutral-100 dark:bg-neutral-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
        <Zap className="w-5 h-5 text-neutral-400" />
      </div>
      <p className="text-neutral-900 dark:text-white font-semibold text-sm">
        No promos found
      </p>
      <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-1 max-w-[240px]">
        Try adjusting your filters or check back later — promos refresh daily.
      </p>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-3">
        <svg
          className="w-5 h-5 text-red-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-neutral-900 dark:text-white font-semibold text-sm">
        Failed to load promos
      </p>
      <p className="text-red-500 dark:text-red-400 text-xs mt-1 max-w-sm">
        {message}
      </p>
    </div>
  );
}

// ─── Sport Badge ──────────────────────────────────────────────────────────────

function SportBadge({ sport }: { sport: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
      <SportIcon sport={sport} className="w-3 h-3" />
      {sport}
    </span>
  );
}

// ─── Promo Card ───────────────────────────────────────────────────────────────

function PromoCard({
  promo,
  isClaimed,
  onToggleClaim,
}: {
  promo: SportsbookPromo;
  isClaimed: boolean;
  onToggleClaim: () => void;
}) {
  const typeConfig = getPromoTypeConfig(promo.promo_type);
  const brandColor = getSportsbookBrandColor(promo.sportsbook);
  const logoSrc = getSportsbookLogo(promo.sportsbook);

  return (
    <article
      className={cn(
        "group flex flex-col rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-neutral-200/50 dark:hover:shadow-black/30 hover:-translate-y-0.5",
        isClaimed
          ? "border-emerald-300 dark:border-emerald-800/60 opacity-60"
          : "border-neutral-200 dark:border-neutral-800"
      )}
    >
      {/* ── Branded header with watermark logo ── */}
      <div
        className="relative px-3.5 pt-3 pb-2.5 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${brandColor}0a 0%, ${brandColor}15 50%, ${brandColor}08 100%)`,
        }}
      >
        {/* Watermark logo */}
        <div className="absolute -right-3 -top-3 w-20 h-20 opacity-[0.06] dark:opacity-[0.08] pointer-events-none">
          <Image
            src={logoSrc}
            alt=""
            width={80}
            height={80}
            className="object-contain"
            unoptimized
            aria-hidden
          />
        </div>

        {/* Bottom border accent */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, ${brandColor}30, ${brandColor}08)` }}
        />

        {/* Badges row */}
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <SportBadge sport={promo.sport} />
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${typeConfig.classes}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${typeConfig.dotColor}`}
              />
              {typeConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {promo.boost_or_bonus && (
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: brandColor }}
              >
                {promo.boost_or_bonus}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-col flex-1 px-3.5 pt-3 pb-3.5 gap-2.5">
        {/* Title */}
        <h3 className="text-neutral-900 dark:text-white font-semibold text-sm leading-snug line-clamp-2">
          {promo.title}
        </h3>

        {/* Description */}
        {promo.description && (
          <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed line-clamp-2">
            {promo.description}
          </p>
        )}

        {/* Requirements */}
        {promo.requirements && (
          <div
            className="rounded-lg px-2.5 py-1.5"
            style={{ background: `${brandColor}06` }}
          >
            <p className="text-neutral-500 dark:text-neutral-400 text-[11px] leading-relaxed">
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                Req:{" "}
              </span>
              {promo.requirements}
            </p>
          </div>
        )}

        {/* Meta tags */}
        {(promo.expiration || promo.is_new_user_only || promo.is_daily) && (
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            {promo.expiration && (
              <span className="inline-flex items-center gap-1 text-neutral-400">
                <Clock className="w-3 h-3" />
                {promo.expiration}
              </span>
            )}
            {promo.is_new_user_only && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Star className="w-2.5 h-2.5" />
                New User
              </span>
            )}
            {promo.is_daily && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <RefreshCw className="w-2.5 h-2.5" />
                Daily
              </span>
            )}
          </div>
        )}

        {/* CTA + Claim */}
        <div className="mt-auto pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
          {promo.source_url && (
            <a
              href={promo.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all duration-150 hover:opacity-90 hover:shadow-md"
              style={{
                backgroundColor: brandColor,
                boxShadow: `0 2px 8px ${brandColor}30`,
              }}
            >
              View on {promo.sportsbook}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleClaim();
            }}
            title={isClaimed ? "Mark as unclaimed" : "Mark as claimed"}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 border",
              isClaimed
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400"
                : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-500 dark:hover:text-emerald-400"
            )}
          >
            <CircleCheck className="w-3.5 h-3.5" />
            {isClaimed ? "Claimed" : "Claim"}
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Sportsbook Group ─────────────────────────────────────────────────────────

function SportsbookGroup({
  sportsbook,
  promos,
  defaultOpen,
  claimed,
  onToggleClaim,
}: {
  sportsbook: string;
  promos: SportsbookPromo[];
  defaultOpen: boolean;
  claimed: Set<number>;
  onToggleClaim: (id: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const brandColor = getSportsbookBrandColor(sportsbook);
  const logoSrc = getSportsbookLogo(sportsbook);

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-full flex items-center gap-3.5 px-4 py-3 transition-colors overflow-hidden"
        style={{
          background: `linear-gradient(90deg, ${brandColor}08 0%, transparent 60%)`,
        }}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 flex-shrink-0"
          style={{ backgroundColor: brandColor }}
        />

        {/* Logo */}
        <div
          className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center p-1 border"
          style={{
            backgroundColor: `${brandColor}08`,
            borderColor: `${brandColor}20`,
          }}
        >
          <Image
            src={logoSrc}
            alt={sportsbook}
            width={28}
            height={28}
            className="object-contain"
            unoptimized
          />
        </div>

        {/* Name + count */}
        <div className="flex-1 text-left flex items-center gap-2.5">
          <span className="text-sm font-bold text-neutral-900 dark:text-white">
            {sportsbook}
          </span>
          <span
            className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
            style={{
              color: brandColor,
              backgroundColor: `${brandColor}12`,
            }}
          >
            {promos.length}
          </span>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-neutral-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Cards grid */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {promos.map((promo) => (
              <PromoCard
                key={promo.id}
                promo={promo}
                isClaimed={claimed.has(promo.id)}
                onToggleClaim={() => onToggleClaim(promo.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PromosTableProps {
  promos: SportsbookPromo[];
  isLoading: boolean;
  error: string | null;
}

export function PromosTable({ promos, isLoading, error }: PromosTableProps) {
  const { claimed, toggle } = useClaimedPromos();

  // Group by sportsbook, sorted by priority (highest first), then count as tiebreaker
  const grouped = useMemo(() => {
    const map = new Map<string, SportsbookPromo[]>();
    for (const promo of promos) {
      const existing = map.get(promo.sportsbook) ?? [];
      existing.push(promo);
      map.set(promo.sportsbook, existing);
    }
    return Array.from(map.entries()).sort(([nameA, a], [nameB, b]) => {
      const prioA = SPORTSBOOK_PRIORITY[nameA] ?? 0;
      const prioB = SPORTSBOOK_PRIORITY[nameB] ?? 0;
      if (prioB !== prioA) return prioB - prioA;
      return b.length - a.length;
    });
  }, [promos]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonGroup key={i} />
        ))}
      </div>
    );
  }

  if (error) return <ErrorState message={error} />;
  if (promos.length === 0) return <EmptyState />;

  return (
    <div className="space-y-3">
      {/* Results count */}
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
          {promos.length}
        </span>{" "}
        promo{promos.length !== 1 ? "s" : ""} across{" "}
        <span className="font-semibold text-neutral-700 dark:text-neutral-300">
          {grouped.length}
        </span>{" "}
        sportsbook{grouped.length !== 1 ? "s" : ""}
      </p>

      {/* Grouped by sportsbook */}
      {grouped.map(([sportsbook, bookPromos], idx) => (
        <SportsbookGroup
          key={sportsbook}
          sportsbook={sportsbook}
          promos={bookPromos}
          defaultOpen={idx < 3}
          claimed={claimed}
          onToggleClaim={toggle}
        />
      ))}
    </div>
  );
}
