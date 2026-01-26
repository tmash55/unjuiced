import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format NBA minutes played (e.g., "PT32M15S" -> "32:15" or just minutes number -> "32")
 */
export function formatNBATime(minutes: string | number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '-';
  
  // If it's a number, just return it as minutes
  if (typeof minutes === 'number') {
    return `${Math.floor(minutes)}`;
  }
  
  // If it's ISO duration format (PT32M15S)
  if (minutes.startsWith('PT')) {
    const match = minutes.match(/PT(\d+)M(\d+)?S?/);
    if (match) {
      const mins = match[1] || '0';
      const secs = match[2] || '00';
      return `${mins}:${secs.padStart(2, '0')}`;
    }
  }
  
  // Otherwise return as-is
  return String(minutes);
}

/**
 * Format game time/clock (e.g., "Q3 5:42" or quarter info)
 */
export function formatGameTime(gameTime: string | null | undefined): string {
  if (!gameTime) return '-';
  return gameTime;
}
