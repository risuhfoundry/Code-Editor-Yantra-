import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yantra Code Editor',
  description:
    'Yantra is a cinematic browser-native code studio with instant runs, AI guidance, live preview, and remixable share links.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
