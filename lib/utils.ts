import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

/**
 * Format NBA time strings from ISO 8601 duration format (PT03M32.00S) to readable format (3:32)
 * Also handles simple minute strings like "32" -> "32:00"
 */
export function formatNBATime(time: string | number): string {
  if (!time) return '0:00';
  
  const timeStr = String(time);
  
  // Handle ISO 8601 duration format: PT03M32.00S
  if (timeStr.startsWith('PT')) {
    const minutesMatch = timeStr.match(/PT(\d+)M/);
    const secondsMatch = timeStr.match(/M([\d.]+)S/);
    
    const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
    const seconds = secondsMatch ? Math.floor(parseFloat(secondsMatch[1])) : 0;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Handle simple minute format: "32" or "32.5"
  if (!timeStr.includes(':')) {
    const totalMinutes = parseFloat(timeStr);
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.floor((totalMinutes - minutes) * 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Already in M:SS format
  return timeStr;
}

/**
 * Format NBA game time strings from "Q2 PT00M00.00S" to "Q2 0:00"
 * Also handles other game time formats like "Final", "Halftime", "7:30 pm ET"
 */
export function formatGameTime(gameTime: string): string {
  if (!gameTime) return '';
  
  // If it contains PT (ISO 8601 duration), extract and format it
  if (gameTime.includes('PT')) {
    const quarterMatch = gameTime.match(/Q(\d+)/);
    const quarter = quarterMatch ? `Q${quarterMatch[1]}` : '';
    
    const minutesMatch = gameTime.match(/PT(\d+)M/);
    const secondsMatch = gameTime.match(/M([\d.]+)S/);
    
    const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
    const seconds = secondsMatch ? Math.floor(parseFloat(secondsMatch[1])) : 0;
    
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    return quarter ? `${quarter} ${formattedTime}` : formattedTime;
  }
  
  // Return as-is for other formats (Final, Halftime, scheduled times, etc.)
  return gameTime;
}
