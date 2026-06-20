import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "./src/lib/prisma";
import type { UserRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// Custom error codes (for URL query: ?error=CredentialsSignin&code=...)
// ---------------------------------------------------------------------------

class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

class AccountDisabledError extends CredentialsSignin {
  code = "account_disabled";
}

// ---------------------------------------------------------------------------
// Zod validation for sign-in input
// ---------------------------------------------------------------------------

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Auth.js v5 configuration
// ---------------------------------------------------------------------------

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          throw new InvalidCredentialsError();
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            role: true,
            isActive: true,
          },
        });

        if (!user) {
          throw new InvalidCredentialsError();
        }

        if (!user.isActive) {
          throw new AccountDisabledError();
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          throw new InvalidCredentialsError();
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.isActive = user.isActive;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      session.user.isActive = token.isActive as boolean;
      return session;
    },
  },
});
