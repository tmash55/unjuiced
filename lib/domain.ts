/**
 * Domain and subdomain utilities for cross-domain auth and routing
 */

// Environment-aware domain configuration
export const DOMAINS = {
  // Production domains
  marketing: process.env.NEXT_PUBLIC_MARKETING_URL || 'https://unjuiced.bet',
  app: process.env.NEXT_PUBLIC_APP_URL || 'https://app.unjuiced.bet',
  
  // Cookie domain (with leading dot for cross-subdomain sharing)
  cookieDomain: process.env.NODE_ENV === 'production' ? '.unjuiced.bet' : undefined,
} as const;

/**
 * Hostnames that should serve the app (authenticated) experience
 */
export const APP_HOSTNAMES = new Set([
  'app.unjuiced.bet',
  'app.localhost',
  'app.localhost:3000',
]);

/**
 * Detect if the request is on the app subdomain
 */
export function isAppSubdomain(host: string): boolean {
  if (APP_HOSTNAMES.has(host)) return true;
  if (host.startsWith('app.')) return true;
  if (host.includes('vercel.app') && !host.startsWith('app-')) return false;
  return false;
}

/**
 * Routes that exist on the app subdomain
 */
export const APP_ROUTES = [
  '/today',
  '/arbitrage',
  '/odds',
  '/positive-ev',
  '/edge-finder',
  '/hit-rates',
  '/cheatsheets',
  '/saved-plays',
  '/account',
  '/ladders',
  '/plans',
  '/changelog',
  '/sportsbooks',
  '/markets',
];

/**
 * Auth routes
 */
export const AUTH_ROUTES = [
  '/login',
  '/register', 
  '/forgot-password',
  '/auth/callback',
  '/api/auth/callback',
  '/auth/reset-password',
];

/**
 * Get redirect URL
 */
export function getRedirectUrl(
  host: string, 
  path: string, 
  subdomain: 'app' | 'marketing' = 'app'
): string {
  const isLocal = host.includes('localhost');
  
  if (isLocal) {
    const protocol = 'http://';
    const port = host.split(':')[1] || '3000';
    
    if (subdomain === 'app') {
      return `${protocol}app.localhost:${port}${path}`;
    } else {
      return `${protocol}localhost:${port}${path}`;
    }
  }
  
  if (subdomain === 'app') {
    return `${DOMAINS.app}${path}`;
  }
  return `${DOMAINS.marketing}${path}`;
}

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}
