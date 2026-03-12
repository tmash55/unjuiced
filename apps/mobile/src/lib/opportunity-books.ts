import type {
  BookOffer,
  DevigMethod,
  EVCalculation,
  MultiDevigResult,
  MultiEVCalculation,
  Opportunity,
  PositiveEVOpportunity,
} from "@unjuiced/types";
import { normalizeSportsbookId } from "@/src/lib/logos";

function americanToDecimal(price: number): number {
  if (!Number.isFinite(price)) return 0;
  if (price > 0) return 1 + price / 100;
  if (price < 0) return 1 + 100 / Math.abs(price);
  return 0;
}

function americanToImpliedProb(price: number): number {
  if (!Number.isFinite(price) || price === 0) return 0;
  if (price > 0) return 100 / (price + 100);
  return Math.abs(price) / (Math.abs(price) + 100);
}

function calculateEV(fairProb: number, americanOdds: number): number {
  const decimalOdds = americanToDecimal(americanOdds);
  if (fairProb <= 0 || fairProb >= 1 || decimalOdds <= 1) return 0;
  return fairProb * decimalOdds - 1;
}

function calculateKelly(fairProb: number, americanOdds: number): number {
  const decimalOdds = americanToDecimal(americanOdds);
  const b = decimalOdds - 1;
  const q = 1 - fairProb;
  if (fairProb <= 0 || fairProb >= 1 || b <= 0) return 0;
  return Math.max(0, ((b * fairProb) - q) / b);
}

function calculateEVDetails(
  fairProb: number,
  bookOffer: BookOffer,
  method: DevigMethod
): EVCalculation {
  const bookDecimal = americanToDecimal(bookOffer.price);
  const bookProb = americanToImpliedProb(bookOffer.price);
  const ev = calculateEV(fairProb, bookOffer.price);
  const kelly = calculateKelly(fairProb, bookOffer.price);

  return {
    method,
    fairProb,
    bookProb,
    bookDecimal,
    ev,
    evPercent: ev * 100,
    edge: bookProb - fairProb,
    kellyFraction: kelly,
  };
}

function calculateMultiEV(
  devigResults: MultiDevigResult,
  bookOffer: BookOffer,
  side: "over" | "under",
  selectedMethods?: DevigMethod[]
): MultiEVCalculation {
  const result: MultiEVCalculation = {
    evWorst: 0,
    evBest: 0,
    evDisplay: 0,
  };
  const evValues: number[] = [];
  const kellyValues: number[] = [];

  const methods: Array<{ key: keyof MultiDevigResult; method: DevigMethod }> = [
    { key: "power", method: "power" },
    { key: "multiplicative", method: "multiplicative" },
    { key: "additive", method: "additive" },
    { key: "probit", method: "probit" },
  ];
  const allowedMethods = selectedMethods?.length ? new Set(selectedMethods) : null;

  for (const { key, method } of methods) {
    if (allowedMethods && !allowedMethods.has(method)) continue;
    const resultEntry = devigResults[key];
    if (!resultEntry?.success) continue;
    const fairProb = side === "over" ? resultEntry.fairProbOver : resultEntry.fairProbUnder;
    const evCalc = calculateEVDetails(fairProb, bookOffer, method);
    result[key] = evCalc;
    evValues.push(evCalc.evPercent);
    if (typeof evCalc.kellyFraction === "number") {
      kellyValues.push(evCalc.kellyFraction);
    }
  }

  if (evValues.length > 0) {
    result.evWorst = Math.min(...evValues);
    result.evBest = Math.max(...evValues);
    result.evDisplay = result.evWorst;
  }

  if (kellyValues.length > 0) {
    result.kellyWorst = Math.min(...kellyValues);
  }

  return result;
}

function sortBooksByPrice<T extends { price: number; priceDecimal?: number; decimal?: number }>(a: T, b: T): number {
  const aDecimal = typeof a.priceDecimal === "number" ? a.priceDecimal : a.decimal ?? americanToDecimal(a.price);
  const bDecimal = typeof b.priceDecimal === "number" ? b.priceDecimal : b.decimal ?? americanToDecimal(b.price);
  const decimalDiff = bDecimal - aDecimal;
  if (decimalDiff !== 0) return decimalDiff;
  return b.price - a.price;
}

export function remapPositiveEvOpportunityToSelectedBooks(
  opp: PositiveEVOpportunity,
  selectedBooks: string[],
  selectedMethods?: DevigMethod[]
): PositiveEVOpportunity | null {
  const currentCalcSide = opp.side === "under" || opp.side === "no" ? "under" : "over";
  const currentEvCalculations = calculateMultiEV(opp.devigResults, opp.book, currentCalcSide, selectedMethods);

  if (selectedBooks.length === 0) return opp;

  const selectedSet = new Set(selectedBooks.map((book) => normalizeSportsbookId(book)));
  const candidateBooks = opp.allBooks.filter((book) => selectedSet.has(normalizeSportsbookId(book.bookId)));
  if (candidateBooks.length === 0) return null;

  const rankedCandidates = candidateBooks
    .map((book) => ({
      book,
      evCalculations: calculateMultiEV(opp.devigResults, book, currentCalcSide, selectedMethods),
    }))
    .filter((candidate) => candidate.evCalculations.evWorst > 0)
    .sort((a, b) => {
      const evDiff = b.evCalculations.evWorst - a.evCalculations.evWorst;
      if (evDiff !== 0) return evDiff;
      return sortBooksByPrice(a.book, b.book);
    });

  if (rankedCandidates.length === 0) return null;

  const bestCandidate = rankedCandidates[0];
  if (normalizeSportsbookId(opp.book.bookId) === normalizeSportsbookId(bestCandidate.book.bookId)) {
    return {
      ...opp,
      book: {
        ...opp.book,
        evPercent: currentEvCalculations.evWorst,
      },
      evCalculations: currentEvCalculations,
    };
  }

  return {
    ...opp,
    book: {
      ...bestCandidate.book,
      evPercent: bestCandidate.evCalculations.evWorst,
      isSharpRef: false,
    },
    evCalculations: bestCandidate.evCalculations,
  };
}

export function normalizePositiveEvOpportunityForDevigMethods(
  opp: PositiveEVOpportunity,
  selectedMethods?: DevigMethod[]
): PositiveEVOpportunity {
  if (!selectedMethods?.length) return opp;
  const calcSide = opp.side === "under" || opp.side === "no" ? "under" : "over";
  const evCalculations = calculateMultiEV(opp.devigResults, opp.book, calcSide, selectedMethods);
  return {
    ...opp,
    book: {
      ...opp.book,
      evPercent: evCalculations.evWorst,
    },
    evCalculations,
  };
}

export function remapEdgeOpportunityToSelectedBooks(
  opp: Opportunity,
  selectedBooks: string[]
): Opportunity | null {
  if (selectedBooks.length === 0) return opp;

  const selectedSet = new Set(selectedBooks.map((book) => normalizeSportsbookId(book)));
  const eligibleBooks = (opp.allBooks ?? [])
    .filter((book) => selectedSet.has(normalizeSportsbookId(book.book)))
    .sort(sortBooksByPrice);

  const bestEligibleBook = eligibleBooks[0];
  if (!bestEligibleBook) return null;

  const sharpDecimal = opp.sharpDecimal;
  const edge = sharpDecimal != null ? bestEligibleBook.decimal - sharpDecimal : null;
  const edgePct =
    sharpDecimal != null && sharpDecimal > 0
      ? ((bestEligibleBook.decimal / sharpDecimal) - 1) * 100
      : null;

  if (edgePct == null || edgePct <= 0) return null;

  if (normalizeSportsbookId(bestEligibleBook.book) === normalizeSportsbookId(opp.bestBook)) {
    return {
      ...opp,
      edge,
      edgePct,
    };
  }

  const bestImplied = bestEligibleBook.decimal > 0 ? 1 / bestEligibleBook.decimal : null;
  const trueProbability = opp.trueProbability;
  const ev = trueProbability != null ? (trueProbability * bestEligibleBook.decimal) - 1 : null;
  const evPct = ev != null ? ev * 100 : null;
  const impliedEdge =
    trueProbability != null && bestImplied != null ? trueProbability - bestImplied : null;
  const kellyFraction =
    ev != null && ev > 0 && trueProbability != null && bestEligibleBook.decimal > 1
      ? Math.max(
          0,
          (((bestEligibleBook.decimal - 1) * trueProbability) - (1 - trueProbability)) /
            (bestEligibleBook.decimal - 1)
        )
      : null;

  return {
    ...opp,
    bestBook: bestEligibleBook.book,
    bestPrice: bestEligibleBook.priceFormatted,
    bestDecimal: bestEligibleBook.decimal,
    bestLink: bestEligibleBook.link ?? null,
    bestMobileLink: bestEligibleBook.mobileLink ?? null,
    bestImplied,
    edge,
    edgePct,
    impliedEdge,
    ev,
    evPct,
    kellyFraction,
  };
}
