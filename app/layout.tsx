import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Microsite Generator',
  description: 'Generate Klook affiliate landing pages automatically',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  );
}
