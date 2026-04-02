/**
 * Replace the default state code in sportsbook deep links with the user's state.
 *
 * Only applies to desktop links for books with state-specific URL patterns.
 * Mobile links (app deep links) don't need state replacement.
 *
 * Supported books:
 *   FanDuel:   https://{state}.sportsbook.fanduel.com/...
 *   Caesars:   https://sportsbook.caesars.com/us/{state}/...
 *   BetMGM:    https://sports.{state}.betmgm.com/...
 *   BetRivers: https://{state}.betrivers.com/...
 */

const STATE_PATTERNS: {
  /** Regex to detect and capture the state code in the URL */
  detect: RegExp;
  /** Function to replace the state code */
  replace: (url: string, state: string) => string;
}[] = [
  // FanDuel: https://nj.sportsbook.fanduel.com/...
  {
    detect: /^https?:\/\/([a-z]{2})\.sportsbook\.fanduel\.com/i,
    replace: (url, state) => url.replace(/^(https?:\/\/)[a-z]{2}(\.sportsbook\.fanduel\.com)/i, `$1${state}$2`),
  },
  // Caesars: https://sportsbook.caesars.com/us/mi/...
  {
    detect: /^https?:\/\/sportsbook\.caesars\.com\/us\/[a-z]{2}\//i,
    replace: (url, state) => url.replace(/(\/us\/)[a-z]{2}(\/)/i, `$1${state}$2`),
  },
  // BetMGM: https://sports.nj.betmgm.com/... or https://sports.on.betmgm.ca/...
  {
    detect: /^https?:\/\/sports\.[a-z]{2}\.betmgm\.(com|ca)/i,
    replace: (url, state) => url
      .replace(/^(https?:\/\/sports\.)[a-z]{2}(\.betmgm\.)(com|ca)/i, `$1${state}$2com`),
  },
  // BetRivers: https://mi.betrivers.com/...
  {
    detect: /^https?:\/\/[a-z]{2}\.betrivers\.com/i,
    replace: (url, state) => url.replace(/^(https?:\/\/)[a-z]{2}(\.betrivers\.com)/i, `$1${state}$2`),
  },
];

/**
 * Replace the state code in a desktop sportsbook link.
 *
 * @param url - The original desktop deep link
 * @param userState - The user's state code (e.g., "ia", "mi", "nj"). Case-insensitive, lowered internally.
 * @returns The URL with the state code replaced, or the original URL if no pattern matched.
 */
export function replaceStateInLink(url: string | null | undefined, userState: string | null | undefined): string | null {
  if (!url || !userState) return url ?? null;
  const state = userState.toLowerCase();

  for (const pattern of STATE_PATTERNS) {
    if (pattern.detect.test(url)) {
      return pattern.replace(url, state);
    }
  }

  return url;
}
