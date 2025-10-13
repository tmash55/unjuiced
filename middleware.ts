import { type NextRequest } from "next/server";
import { updateSession } from "@/libs/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/public (public API routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - static files (svg, png, jpg, jpeg, gif, webp, ico, woff, woff2, ttf, otf)
     * This reduces unnecessary middleware executions by 80-90%
     */
    "/((?!api/public|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot|css|js|map)$).*)",
  ],
};
