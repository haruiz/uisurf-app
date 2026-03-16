import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/lib/auth.config";
import { firebaseAdminAuth } from "@/lib/firebase/admin";

const credentialsSchema = z.object({
  idToken: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Firebase",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const decoded = await firebaseAdminAuth.verifyIdToken(parsed.data.idToken);
        return {
          id: decoded.uid,
          email: decoded.email ?? "",
          name: decoded.name ?? decoded.email ?? "Workspace User",
          firebaseIdToken: parsed.data.idToken,
        };
      },
    }),
  ],
});
