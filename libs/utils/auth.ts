export function getRedirectUrl() {
    // IMPORTANT: Always use window.location.origin for OAuth callbacks
    // This ensures the callback goes to the same domain where the OAuth was initiated,
    // which is required for PKCE flow (code_verifier cookie must be readable)
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/auth/callback`;
    }
    // Fallback for SSR (shouldn't happen for OAuth initiation)
    return `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`;
  }

  export function getBaseUrl() {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  } 