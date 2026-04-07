import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yantra Editor',
  description: 'Local development shell for the Yantra code editor.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
