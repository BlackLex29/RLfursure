import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Role = "admin" | "user" | "vet";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface Session {
  user: SessionUser;
}

// Mga public paths - hindi need ng authentication
const publicPaths: string[] = [
  "/login",
  "/createaccount",
  "/forgotpassword",
  "/registration",
  "/homepage",
  "/",
  "/api/auth", // Allow auth API routes
];

// Role-based access control
const rolePageAccess: Record<Role, string[]> = {
  admin: [
    "/admindashboard",
    "/MedicalRecord",
    "/MonthlyStatistic", 
    "/payment",
    "/petregistration",
    "/Appointment",
    "/Usermedicalrecord",
    "/uservaccination",
    "/userdashboard",
    "/vetdashboard",
    "/settings",
  ],
  user: [
    "/userdashboard",
    "/Usermedicalrecord",
    "/uservaccination",
    "/Appointment", 
    "/settings",
  ],
  vet: [
    "/vetdashboard",
    "/MedicalRecord",
    "/Appointment",
    "/settings",
  ],
};

const roleDefaultPage: Record<Role, string> = {
  admin: "/admindashboard",
  user: "/userdashboard",
  vet: "/vetdashboard",
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  console.log(`🛡️ Middleware processing: ${pathname}`);

  // Skip middleware for static files, API routes, and public files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") || // Allow all API routes for now
    pathname.includes(".") || // Files with extensions
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check if it's a public path
  const isPublicPath = publicPaths.some((path) => 
    pathname === path || pathname.startsWith(path + "/")
  );

  if (isPublicPath) {
    console.log(`✅ Public path access: ${pathname}`);
    
    // If user is already logged in and tries to access login, redirect to dashboard
    if (pathname === "/login" || pathname === "/") {
      const session = await getSession(request);
      if (session) {
        const defaultPage = roleDefaultPage[session.user.role];
        console.log(`🔀 Redirecting logged-in user to: ${defaultPage}`);
        return NextResponse.redirect(new URL(defaultPage, request.url));
      }
    }
    
    return NextResponse.next();
  }

  // SESSION CHECK for protected pages
  const session = await getSession(request);

  if (!session) {
    console.log(`❌ No session, redirecting to login from: ${pathname}`);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", encodeURIComponent(pathname));
    return NextResponse.redirect(loginUrl);
  }

  // ROLE-BASED ACCESS CONTROL
  const role: Role = session.user.role;
  const allowedPages = rolePageAccess[role];
  
  // Check if current path is allowed for this role
  const hasAccess = allowedPages.some((path) => 
    pathname === path || pathname.startsWith(path + "/")
  );

  console.log(`👤 User role: ${role}, Access to ${pathname}: ${hasAccess ? '✅ Granted' : '❌ Denied'}`);

  if (!hasAccess) {
    console.log(`🚫 Access denied for ${role} to ${pathname}`);
    const defaultPage = roleDefaultPage[role];
    return NextResponse.redirect(new URL(defaultPage, request.url));
  }

  // SEO BLOCKING - ITO YUNG MAGBABLOCK NG SEARCH ENGINES
  const response = NextResponse.next();
  
  // CRITICAL: Block search engines from indexing protected pages
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, notranslate, noimageindex");
  
  // Additional security headers
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  
  // Add user info to headers for debugging
  response.headers.set("x-user-role", role);
  response.headers.set("x-user-email", session.user.email);
  
  console.log(`✅ Access granted to ${pathname} with SEO blocking`);
  return response;
}

// Firebase Session Check Function
async function getSession(request: NextRequest): Promise<Session | null> {
  try {
    // Kunin ang session token mula sa cookies
    const sessionToken = request.cookies.get('session')?.value || 
                        request.cookies.get('__session')?.value ||
                        request.cookies.get('auth-token')?.value;
    
    if (!sessionToken) {
      console.log('🔐 No session token found in cookies');
      return null;
    }

    console.log('🔐 Session token found, verifying...');

    // Tawagan ang iyong Firebase auth API para i-verify ang session
    const verifyResponse = await fetch(`${request.nextUrl.origin}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ token: sessionToken }),
    });

    if (!verifyResponse.ok) {
      console.log('❌ Session verification failed');
      return null;
    }

    const userData = await verifyResponse.json();
    
    if (userData && userData.uid) {
      console.log(`✅ Session verified for user: ${userData.email}`);
      return {
        user: {
          id: userData.uid,
          email: userData.email || '',
          name: userData.name || userData.email,
          role: (userData.role || 'user') as Role
        }
      };
    }

    return null;
  } catch (error) {
    console.error('🚨 Session verification error:', error);
    return null;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) - pero hinahandle na natin sa logic
     * - _next/static (static files)
     * - _next/image (image optimization files) 
     * - favicon.ico (favicon file)
     * - public folder
     * - .*\\..*$ (files with extensions)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};