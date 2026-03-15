type SnapshotBook = {
  price: number;
  u?: string | null;
  m?: string | null;
  sgp?: string | null;
};

type BooksSnapshot = Record<string, SnapshotBook>;

interface HydrateLiveBooksParams {
  sport: string;
  eventId: string;
  market: string;
  playerName?: string | null;
  line?: number | null;
  side: "over" | "under" | "yes" | "no";
  booksSnapshot: BooksSnapshot;
}

interface OddsBookResponse {
  book: string;
  link: string | null;
  sgp: string | null;
}

interface OddsSideResponse {
  all_books: OddsBookResponse[];
}

interface OddsPlayerResponse {
  player: string;
  line: number;
  over: OddsSideResponse | null;
  under: OddsSideResponse | null;
}

interface OddsApiResponse {
  players: OddsPlayerResponse[];
}

export async function hydrateBooksSnapshotWithLiveSgp({
  sport,
  eventId,
  market,
  playerName,
  line,
  side,
  booksSnapshot,
}: HydrateLiveBooksParams): Promise<BooksSnapshot> {
  const needsHydration = Object.values(booksSnapshot).some((book) => !book.sgp);
  if (!needsHydration || !playerName || line == null) return booksSnapshot;

  try {
    const params = new URLSearchParams({
      player: playerName,
      line: String(line),
    });
    const response = await fetch(
      `/api/v2/odds/${encodeURIComponent(sport)}/${encodeURIComponent(eventId)}/${encodeURIComponent(market)}?${params.toString()}`,
      { cache: "no-store" }
    );
    if (!response.ok) return booksSnapshot;

    const data = (await response.json()) as OddsApiResponse;
    const match = data.players?.find(
      (entry) => entry.player === playerName && Number(entry.line) === Number(line)
    );
    const sideData = side === "over" || side === "yes" ? match?.over : match?.under;
    if (!sideData?.all_books?.length) return booksSnapshot;

    const nextSnapshot: BooksSnapshot = { ...booksSnapshot };
    sideData.all_books.forEach((book) => {
      const existing = nextSnapshot[book.book];
      if (!existing) return;
      nextSnapshot[book.book] = {
        ...existing,
        u: existing.u || book.link || null,
        sgp: existing.sgp || book.sgp || null,
      };
    });
    return nextSnapshot;
  } catch {
    return booksSnapshot;
  }
}
