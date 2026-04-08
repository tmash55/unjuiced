/**
 * State-specific sportsbook deep link replacement.
 *
 * Replaces the default state code in desktop deep links with the user's state,
 * but ONLY if the sportsbook is legal in that state. If the book isn't available,
 * the original URL is returned unchanged (vendor default).
 *
 * Supported books:
 *   FanDuel:   https://{state}.sportsbook.fanduel.com/...
 *   Caesars:   https://sportsbook.caesars.com/us/{state}/...
 *   BetMGM:    https://sports.{state}.betmgm.com/... (also .ca → .com)
 *   BetRivers: https://{state}.betrivers.com/...
 */

import { getSportsbookById } from "@/lib/data/sportsbooks";

interface StatePattern {
  /** Sportsbook ID for legal state lookup */
  bookId: string;
  /** Regex to detect the URL belongs to this book */
  detect: RegExp;
  /** Replace the state code in the URL */
  replace: (url: string, state: string) => string;
}

const STATE_PATTERNS: StatePattern[] = [
  {
    bookId: "fanduel",
    detect: /^https?:\/\/([a-z]{2})\.sportsbook\.fanduel\.com/i,
    replace: (url, state) =>
      url.replace(/^(https?:\/\/)[a-z]{2}(\.sportsbook\.fanduel\.com)/i, `$1${state}$2`),
  },
  {
    bookId: "caesars",
    detect: /^https?:\/\/sportsbook\.caesars\.com\/us\/[a-z]{2}\//i,
    replace: (url, state) =>
      url.replace(/(\/us\/)[a-z]{2}(\/)/i, `$1${state}$2`),
  },
  {
    bookId: "betmgm",
    detect: /^https?:\/\/sports\.[a-z]{2}\.betmgm\.(com|ca)/i,
    replace: (url, state) =>
      url.replace(/^(https?:\/\/sports\.)[a-z]{2}(\.betmgm\.)(com|ca)/i, `$1${state}$2com`),
  },
  {
    bookId: "betrivers",
    detect: /^https?:\/\/[a-z]{2}\.betrivers\.com/i,
    replace: (url, state) =>
      url.replace(/^(https?:\/\/)[a-z]{2}(\.betrivers\.com)/i, `$1${state}$2`),
  },
];

/**
 * Replace the state code in a desktop sportsbook link.
 *
 * - If the URL matches a known book pattern AND the book is legal in the user's state,
 *   the state code is replaced.
 * - If the book is NOT legal in the user's state, the original URL is returned
 *   (keeps the vendor default — better than sending them to a broken page).
 * - If no pattern matches, the original URL is returned unchanged.
 *
 * @param url - The original desktop deep link
 * @param userState - The user's state code (e.g., "ia", "mi", "nj")
 * @returns The URL with the state code replaced, or the original if not applicable.
 */
/**
 * Affiliate partner ID overrides.
 * Applied to all matching URLs regardless of state.
 */
function applyAffiliateParams(url: string): string {
  // ProphetX: replace partner_id with our affiliate code
  if (url.includes("prophetx.co") || url.includes("prophetx://")) {
    return url.replace(/partner_id=[^&]*/i, "partner_id=unjuiced");
  }
  return url;
}

export function replaceStateInLink(
  url: string | null | undefined,
  userState: string | null | undefined
): string | null {
  if (!url) return url ?? null;

  // Always apply affiliate params (state-independent)
  let result = applyAffiliateParams(url);

  if (!userState) return result;

  const state = userState.toLowerCase();
  const stateUpper = userState.toUpperCase();

  for (const pattern of STATE_PATTERNS) {
    if (pattern.detect.test(result)) {
      const book = getSportsbookById(pattern.bookId);
      if (book && book.legalStates && !book.legalStates.includes(stateUpper)) {
        return result;
      }
      return pattern.replace(result, state);
    }
  }

  return result;
}
