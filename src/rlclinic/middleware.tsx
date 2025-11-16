import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { betterFetch } from "@better-fetch/fetch";

type Session = {
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
  };
};

const publicPaths = [
  "/sign-in",
  "/sign-up",
  "/reset-password",
  "/forgot-password",
  "/privacy-policy",
  "/email-verification",
  "/2fa-verification",
];

const rolePageAccess = {
  admin: [
    "/dashboard",
    "/deliveries",
    "/deliveries/overview",
    "/deliveries/assignments",
    "/manage-product",
    "/history",
    "/manage-users",
    "/settings",
  ],
  cashier: [
    "/dashboard",
    "/deliveries",
    "/deliveries/overview",
    "/deliveries/assignments",
    "/manage-product",
    "/settings",
  ],
  delivery: [
    "/deliveries",
    "/deliveries/overview",
    "/deliveries/assignments",
    "/settings",
  ],
  user: ["/settings"],
};

const roleDefaultPage = {
  admin: "/dashboard",
  cashier: "/dashboard",
  delivery: "/deliveries/overview",
  user: "/settings",
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get session
  const { data: session } = await betterFetch<Session>(
    "/api/auth/get-session",
    {
      baseURL: request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    }
  );

  // Redirect to sign-in if not authenticated
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const userRole = session.user.role;

  // Check if user has access to the requested path
  const allowedPages =
    rolePageAccess[userRole as keyof typeof rolePageAccess] || [];
  const hasAccess = allowedPages.some((page) => pathname.startsWith(page));

  if (!hasAccess) {
    const defaultPage =
      roleDefaultPage[userRole as keyof typeof roleDefaultPage] || "/settings";
    return NextResponse.redirect(new URL(defaultPage, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
