export type OddsFormat = "cents" | "american"

/**
 * Convert Polymarket cents (0-100) to American odds
 * - If probability > 50%: American odds = -(probability / (1 - probability)) * 100
 * - If probability <= 50%: American odds = +((1 - probability) / probability) * 100
 */
export function centsToAmerican(cents: number): string {
  // cents is the implied probability (e.g., 69 = 69%)
  const probability = cents / 100

  if (probability >= 1) return "-10000"
  if (probability <= 0) return "+10000"

  if (probability > 0.5) {
    const odds = -Math.round((probability / (1 - probability)) * 100)
    return odds.toString()
  } else if (probability < 0.5) {
    const odds = Math.round(((1 - probability) / probability) * 100)
    return `+${odds}`
  } else {
    return "-100"
  }
}

/**
 * Format price based on selected odds format
 */
export function formatOdds(cents: number, format: OddsFormat): string {
  if (format === "american") {
    return centsToAmerican(cents)
  }
  return `${cents}¢`
}