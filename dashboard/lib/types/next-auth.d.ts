import type { UserRole } from "@/app/generated/prisma/enums";
import "next-auth";
import "@auth/core/jwt";

declare module "next-auth" {
  interface User {
    role: UserRole;
    telegramId: string;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      telegramId: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    telegramId: string;
  }
}
