import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    signIn({ profile }) {
      // Only allow @klook.com emails
      return profile?.email?.endsWith('@klook.com') ?? false;
    },
    jwt({ token, profile }) {
      if (profile) {
        token.email = profile.email;
        token.picture = profile.picture as string | undefined;
        token.name = profile.name;
      }
      return token;
    },
    session({ session, token }) {
      session.user.email = token.email as string;
      session.user.image = token.picture as string | undefined;
      session.user.name = token.name as string;
      return session;
    },
  },
});
