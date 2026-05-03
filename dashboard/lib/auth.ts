import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { prisma } from "./db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const password = credentials.password as string

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.passwordHash) return null

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) return null

        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        })

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          telegramId: user.telegramId,
          tenantId: user.tenantId,
        }
      },
    }),

    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email! } })
        if (!dbUser || dbUser.status !== "ACTIVE") {
          return "/login?error=not_registered"
        }
      }
      return true
    },

    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google") {
          const dbUser = await prisma.user.findUnique({ where: { email: token.email! } })
          if (dbUser) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { lastActiveAt: new Date() },
            })
            token.id = dbUser.id
            token.role = dbUser.role
            token.telegramId = dbUser.telegramId
            token.tenantId = dbUser.tenantId
          }
        } else {
          token.id = user.id as string
          token.role = user.role
          token.telegramId = user.telegramId
          token.tenantId = user.tenantId
        }
      }
      return token
    },

    session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.telegramId = token.telegramId
      session.user.tenantId = token.tenantId
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
})
