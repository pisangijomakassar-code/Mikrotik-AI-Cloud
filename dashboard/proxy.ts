import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const publicPaths = ["/login", "/register", "/api/auth"]
const adminRoutes = ["/users", "/settings"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = publicPaths.some((p) => pathname.startsWith(p))
  if (isPublic) {
    return NextResponse.next()
  }

  // Check for NextAuth session token
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value

  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin-only routes — role is stored in the JWT payload (base64 middle segment)
  const isAdminRoute = adminRoutes.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  )
  if (isAdminRoute) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      if (payload?.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }
    } catch {
      // Malformed token — let the page-level auth handle it
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
