import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { 
  isAppSubdomain, 
  getRedirectUrl, 
  isAppRoute, 
  DOMAINS,
} from "@/lib/domain";

// Public routes that don't require auth (accessible to everyone)
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/pricing',
  '/blog',
  '/about',
  '/contact',
  '/help',
  '/docs',
  '/changelog',
  '/auth/callback',
  '/auth/auth-code-error',
  '/tools',
  '/api/billing/webhook',
];

// Auth routes (exist on both subdomains)
const AUTH_ROUTES = [
  '/login',
  '/register', 
  '/forgot-password',
];

// Tool preview to actual tool path mappings
const TOOL_PREVIEW_REDIRECTS: Record<string, string> = {
  '/tools/edge-finder': '/edge-finder',
  '/tools/positive-ev': '/positive-ev',
  '/tools/arbitrage': '/arbitrage',
  '/tools/odds': '/odds/nfl',
  '/tools/hit-rates': '/hit-rates/nba',
};

// Actual tool to preview page mappings
const TOOL_TO_PREVIEW_REDIRECTS: Record<string, string> = {
  '/edge-finder': '/tools/edge-finder',
  '/positive-ev': '/tools/positive-ev',
  '/arbitrage': '/tools/arbitrage',
};

// Freemium routes
const FREEMIUM_ROUTES = [
  '/arbitrage',
  '/odds',
  '/positive-ev',
  '/parlay-builder',
];

// Protected routes that require authentication
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/settings',
  '/account',
  '/billing',
  '/today',
  '/favorites',
  '/ladders',
  '/cheatsheets',
  '/hit-rates',
];

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const host = request.headers.get('host') || '';
  const isLocal = host.includes('localhost');
  const isVercelPreview = host.includes('.vercel.app');
  
  // For Vercel preview deployments, treat as app subdomain (full app experience)
  // For production, check for app.* subdomain
  const isOnAppSubdomain = isVercelPreview || isAppSubdomain(host);

  // Check route types
  const isAuthRoute = AUTH_ROUTES.some(route => pathname === route);
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  const isToolPreviewPage = pathname.startsWith('/tools/');
  const isFreemiumRoute = FREEMIUM_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  const isProtectedRoute = PROTECTED_PREFIXES.some(prefix => 
    pathname.startsWith(prefix)
  );
  const isApiRoute = pathname.startsWith('/api/');

  let supabaseResponse = NextResponse.next({ request });

  // Skip middleware for API routes
  if (isApiRoute) {
    return supabaseResponse;
  }

  // Get cookie domain for cross-subdomain sharing
  const cookieDomain = isLocal ? undefined : DOMAINS.cookieDomain;

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const enhancedOptions = {
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            };
            supabaseResponse.cookies.set(name, value, enhancedOptions);
          });
        },
      },
    }
  );

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // ═══════════════════════════════════════════════════════════════════
  // APP SUBDOMAIN LOGIC (app.localhost / app.unjuiced.bet)
  // ═══════════════════════════════════════════════════════════════════
  if (isOnAppSubdomain) {
    // Allow auth routes on app subdomain (login, register, etc.)
    if (isAuthRoute) {
      // If user is already logged in on auth pages, redirect to /today
      if (user) {
        return NextResponse.redirect(new URL('/today', request.url));
      }
      // Allow access to auth pages for unauthenticated users
      return supabaseResponse;
    }

    // For all other routes on app subdomain, require authentication
    if (!user) {
      // Redirect to login on the SAME subdomain (following dub.co pattern)
      const loginUrl = new URL('/login', request.url);
      if (pathname !== '/') {
        loginUrl.searchParams.set('next', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    // User is authenticated on app subdomain - allow access
    return supabaseResponse;
  }

  // ═══════════════════════════════════════════════════════════════════
  // MARKETING SITE LOGIC (localhost / unjuiced.bet)
  // ═══════════════════════════════════════════════════════════════════

  // If authenticated user visits an app route on marketing site → redirect to app subdomain
  if (user && isAppRoute(pathname)) {
    const search = searchParams.toString();
    const appUrl = getRedirectUrl(host, `${pathname}${search ? '?' + search : ''}`, 'app');
    return NextResponse.redirect(appUrl);
  }

  // If authenticated user visits tool preview → redirect to actual tool on app subdomain
  if (user && isToolPreviewPage) {
    const redirectPath = TOOL_PREVIEW_REDIRECTS[pathname] || '/today';
    const appUrl = getRedirectUrl(host, redirectPath, 'app');
    return NextResponse.redirect(appUrl);
  }

  // Public routes - allow access
  if (isPublicRoute && !isToolPreviewPage) {
    // If logged in user visits auth pages on marketing site, redirect to app subdomain
    if (user && isAuthRoute) {
      const appUrl = getRedirectUrl(host, '/today', 'app');
      return NextResponse.redirect(appUrl);
    }
    return supabaseResponse;
  }

  // Freemium routes for unauthenticated users → redirect to preview
  if (isFreemiumRoute && !user) {
    const previewPath = TOOL_TO_PREVIEW_REDIRECTS[pathname];
    if (previewPath) {
      return NextResponse.redirect(new URL(previewPath, request.url));
    }
    if (pathname.startsWith('/odds')) {
      return NextResponse.redirect(new URL('/tools/odds', request.url));
    }
  }

  // Freemium routes for authenticated users → redirect to app subdomain
  if (isFreemiumRoute && user) {
    const search = searchParams.toString();
    const appUrl = getRedirectUrl(host, `${pathname}${search ? '?' + search : ''}`, 'app');
    return NextResponse.redirect(appUrl);
  }

  // Protected routes require authentication
  if (isProtectedRoute) {
    if (!user) {
      if (pathname.startsWith('/hit-rates')) {
        return NextResponse.redirect(new URL('/tools/hit-rates', request.url));
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    } else {
      // Authenticated user on protected route → redirect to app subdomain
      const search = searchParams.toString();
      const appUrl = getRedirectUrl(host, `${pathname}${search ? '?' + search : ''}`, 'app');
      return NextResponse.redirect(appUrl);
    }
  }

  // Tool preview pages for unauthenticated users - allow access
  if (isToolPreviewPage && !user) {
    return supabaseResponse;
  }

  return supabaseResponse;
}
