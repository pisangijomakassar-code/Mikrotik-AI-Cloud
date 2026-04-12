import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const ADMIN_ROUTES = ["/users", "/settings"]

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth

  const isAdminRoute = ADMIN_ROUTES.some(
    (route) =>
      nextUrl.pathname === route || nextUrl.pathname.startsWith(route + "/")
  )

  if (isAdminRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", nextUrl))
    }
    if (session.user?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/users/:path*", "/settings/:path*"],
}
