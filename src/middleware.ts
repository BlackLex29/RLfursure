// ========================================
// FILE 1: src/middleware.ts
// ========================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  console.log(`🛡️ Middleware protecting: ${pathname}`);

  const response = NextResponse.next();
  
  // TRIPLE PROTECTION - Headers + Meta + Robots.txt
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

// Protect ALL dashboard and sensitive pages
export const config = {
  matcher: [
    '/usersdashboard/:path*',
    '/admindashboard/:path*',
    '/vetdashboard/:path*',
    '/petregistration/:path*',
    '/Appointment/:path*',
    '/MonthlyStatistic/:path*',
    '/payment/:path*',
    '/MedicalRecord/:path*',
    '/createaccount/:path*',
    '/forgotpassword/:path*',
    '/Homepage/:path*',
    '/layout/:path*',
    '/registry/:path*'
  ]
};