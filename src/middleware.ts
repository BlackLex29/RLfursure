// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  console.log(`🔒 Middleware protecting: ${pathname}`);
  
  const response = NextResponse.next();
  
  // DOBLE-DOBLE SEO BLOCKING
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
  response.headers.set("X-Content-Type-Options", "nosniff");
  
  return response;
}

// Simple matcher - apply to ALL pages
export const config = {
  matcher: "/:path*",
};