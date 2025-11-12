import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public routes that don't require auth checks (accessible to everyone)
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
  // Explicitly allow Stripe webhooks (must be publicly accessible)
  '/api/billing/webhook',
];

// Freemium routes - accessible to everyone but with plan-based limits
// These routes handle their own feature gating in the component/API layer
const FREEMIUM_ROUTES = [
  '/arbitrage',
  '/odds',
  '/positive-ev',
  '/parlay-builder',
];

// Protected routes that require authentication (no anonymous access)
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/settings',
  '/account',
  '/billing',
];

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check route types
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  const isFreemiumRoute = FREEMIUM_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  const isProtectedRoute = PROTECTED_PREFIXES.some(prefix => 
    pathname.startsWith(prefix)
  );
  const isPublicApi = pathname.startsWith('/api/public');

  let supabaseResponse = NextResponse.next({
    request,
  });

  // Skip auth entirely for public routes and public APIs
  if (isPublicRoute || isPublicApi) {
    return supabaseResponse;
  }

  // For freemium and protected routes, create Supabase client
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
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // For freemium routes: refresh token but allow anonymous access
  // Feature gating happens in the component/API layer
  if (isFreemiumRoute) {
    await supabase.auth.getUser();
    return supabaseResponse;
  }

  // For protected routes: require authentication
  if (isProtectedRoute) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
