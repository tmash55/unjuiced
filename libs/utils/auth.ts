export function getRedirectUrl() {
    // Get the base URL from environment variable or window.location.origin
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    
    // Always use the /auth/callback path
    return `${baseUrl}/auth/callback`;
  }
  
  export function getBaseUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  } 