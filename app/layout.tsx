import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/app/auth';

export const metadata: Metadata = {
  title: 'Microsite Generator',
  description: 'Generate Klook affiliate landing pages automatically',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#f5f5f5' }}>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
