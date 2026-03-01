export function getRedirectUrl() {
    // Canonical OAuth callback endpoint.
    // Server route performs code exchange and post-auth redirects.
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/auth/callback`;
    }
    // Fallback for SSR (shouldn't happen for OAuth initiation)
    return `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/callback`;
  }

  export function getBaseUrl() {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  } 
