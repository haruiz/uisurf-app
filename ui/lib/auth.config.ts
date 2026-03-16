import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: async ({ auth: session, request }) => {
      const isLoggedIn = Boolean(session?.user);
      const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

      if (isLoginRoute) {
        return true;
      }

      return isLoggedIn;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.firebaseIdToken = (user as { firebaseIdToken?: string }).firebaseIdToken;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id;
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
      }
      session.accessToken = token.firebaseIdToken;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
} satisfies NextAuthConfig;
