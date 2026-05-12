import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { ArbRow } from "@/lib/arb-schema";
import type { SSEBookSelections, SSESelection } from "@/lib/odds/types";
import { normalizePlayerName } from "@/lib/odds/types";

const LINE_TOLERANCE = 0.001;

type ArbOddsSide = "over" | "under";

type ArbOddsOffer = {
  book: string;
  side: ArbOddsSide;
  odds: number;
  decimal?: number | null;
  line?: number | null;
  selection?: string | null;
  max?: number | null;
  link?: string | null;
  mobileLink?: string | null;
  updated?: string | null;
  locked?: boolean;
  selected?: boolean;
};

function parseIndexMember(
  member: string,
): { market: string; book: string } | null {
  const sep = member.lastIndexOf(":");
  if (sep <= 0 || sep >= member.length - 1) return null;
  return {
    market: member.slice(0, sep),
    book: member.slice(sep + 1),
  };
}

function parseAmericanOdds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace("+", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLine(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameLine(a: unknown, b: unknown): boolean {
  const left = parseLine(a);
  const right = parseLine(b);
  if (left === null || right === null) return true;
  return Math.abs(left - right) <= LINE_TOLERANCE;
}

function selectionEntityKey(key: string): string {
  return key.split("|")[0] || "";
}

function selectionSide(key: string, selection: SSESelection): string {
  return String(selection.side || key.split("|")[1] || "").toLowerCase();
}

function selectionLine(key: string, selection: SSESelection): number | null {
  const fromSelection = parseLine(selection.line);
  if (fromSelection !== null) return fromSelection;
  return parseLine(key.split("|").slice(2).join("|"));
}

function getSport(row: ArbRow): string | null {
  return row.sp || row.lg?.id || row.lg?.name?.toLowerCase() || null;
}

function getEntityCandidates(row: ArbRow): Set<string> {
  const out = new Set<string>();
  const names = [
    row.ent,
    row.inj?.name,
    row.o?.name?.replace(/\s+(Over|Under).*$/i, "").trim(),
    row.u?.name?.replace(/\s+(Over|Under).*$/i, "").trim(),
  ];
  for (const name of names) {
    if (name) out.add(normalizePlayerName(name));
  }
  for (const id of [row.ent_id, row.inj?.pid, row.inj?.odds_id]) {
    if (id) out.add(String(id).toLowerCase());
  }
  return out;
}

function matchesEntity(
  row: ArbRow,
  key: string,
  selection: SSESelection,
  candidates: Set<string>,
): boolean {
  if (candidates.size === 0) return true;

  const values = [
    selectionEntityKey(key),
    selection.player,
    selection.player_id,
    selection.odd_id,
  ]
    .filter(Boolean)
    .flatMap((value) => {
      const raw = String(value);
      return [raw.toLowerCase(), normalizePlayerName(raw)];
    });

  if (values.some((value) => candidates.has(value))) return true;

  const rowEntity = row.ent ? normalizePlayerName(row.ent) : null;
  const selectionName = selection.player
    ? normalizePlayerName(selection.player)
    : null;
  return !!rowEntity && !!selectionName && rowEntity === selectionName;
}

function buildOffer(
  row: ArbRow,
  key: string,
  book: string,
  selection: SSESelection,
  side: ArbOddsSide,
): ArbOddsOffer | null {
  const odds = parseAmericanOdds(selection.price);
  if (odds === null) return null;
  const selectedLeg = side === "over" ? row.o : row.u;

  return {
    book,
    side,
    odds,
    decimal: selection.price_decimal ?? null,
    line: selectionLine(key, selection),
    selection: selection.player || selectionEntityKey(key) || null,
    max: selection.limits?.max ?? null,
    link: selection.link ?? null,
    mobileLink: selection.mobile_link ?? null,
    updated: selection.updated ?? null,
    locked: selection.locked,
    selected:
      selectedLeg?.bk === book && parseAmericanOdds(selectedLeg?.od) === odds,
  };
}

function fallbackOffer(row: ArbRow, side: ArbOddsSide): ArbOddsOffer | null {
  const leg = side === "over" ? row.o : row.u;
  if (!leg) return null;
  const odds = parseAmericanOdds(leg.od);
  if (odds === null) return null;
  return {
    book: leg.bk,
    side,
    odds,
    line: row.ln ?? null,
    selection: leg.name ?? row.ent ?? null,
    max: leg.max ?? null,
    link: leg.u ?? null,
    mobileLink: leg.m ?? null,
    updated: leg.upd ?? null,
    selected: true,
  };
}

function sortOffers(offers: ArbOddsOffer[]): ArbOddsOffer[] {
  return offers.sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? 1 : -1;
    return (b.decimal ?? 0) - (a.decimal ?? 0);
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const row = body?.row as ArbRow | undefined;

    if (!row?.eid || !row?.mkt) {
      return NextResponse.json(
        { error: "missing_row_context" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const sport = getSport(row);
    if (!sport) {
      return NextResponse.json(
        { error: "missing_sport" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const membersRaw = await (redis as any).smembers(
      `odds_idx:${sport}:${row.eid}`,
    );
    const members = Array.isArray(membersRaw) ? membersRaw.map(String) : [];
    const matchingMembers = members
      .map(parseIndexMember)
      .filter(
        (member): member is { market: string; book: string } =>
          !!member && member.market === row.mkt,
      );

    const keys = matchingMembers.map(
      ({ market, book }) => `odds:${sport}:${row.eid}:${market}:${book}`,
    );
    const rawSelections = keys.length
      ? ((await (redis as any).mget(...keys)) as unknown[])
      : [];

    const candidates = getEntityCandidates(row);
    const over: ArbOddsOffer[] = [];
    const under: ArbOddsOffer[] = [];

    rawSelections.forEach((bookSelections, index) => {
      if (!bookSelections || typeof bookSelections !== "object") return;
      const book = matchingMembers[index]?.book;
      if (!book) return;

      for (const [selectionKey, selection] of Object.entries(
        bookSelections as SSEBookSelections,
      )) {
        if (!selection || typeof selection !== "object") continue;
        if (!sameLine(selectionLine(selectionKey, selection), row.ln)) continue;
        if (!matchesEntity(row, selectionKey, selection, candidates)) continue;

        const sideRaw = selectionSide(selectionKey, selection);
        if (sideRaw === "over") {
          const offer = buildOffer(row, selectionKey, book, selection, "over");
          if (offer) over.push(offer);
        } else if (sideRaw === "under") {
          const offer = buildOffer(row, selectionKey, book, selection, "under");
          if (offer) under.push(offer);
        }
      }
    });

    if (over.length === 0) {
      const offer = fallbackOffer(row, "over");
      if (offer) over.push(offer);
    }
    if (under.length === 0) {
      const offer = fallbackOffer(row, "under");
      if (offer) under.push(offer);
    }

    return NextResponse.json(
      {
        sport,
        eventId: row.eid,
        market: row.mkt,
        source: keys.length > 0 ? "odds_idx" : "row",
        over: sortOffers(over),
        under: sortOffers(under),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
