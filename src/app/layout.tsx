import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { ExperimentalVersionSash } from '@/components/ExperimentalVersionSash';

export const metadata: Metadata = {
  metadataBase: new URL('https://grow-rho-two.vercel.app'),
  title: {
    default: 'Grow — Garden Assistant & Plant Viability Tracker',
    template: '%s | Grow',
  },
  description: 'Your personal digital garden assistant. Track microclimates, plant viability, and share seed packs with zero server costs.',
  applicationName: 'Grow',
  openGraph: {
    title: 'Grow — Garden Assistant & Plant Viability Tracker',
    description: 'Your personal digital garden assistant. Track microclimates, plant viability, and share seed packs with zero server costs.',
    siteName: 'Grow',
    images: [
      {
        url: '/images/plants/veg-1.jpg',
        width: 1200,
        height: 630,
        alt: 'Grow Garden Assistant',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grow — Garden Assistant & Plant Viability Tracker',
    description: 'Your personal digital garden assistant. Track microclimates, plant viability, and share seed packs with zero server costs.',
    images: ['/images/plants/veg-1.jpg'],
  },
  other: {
    'fb:app_id': process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '966242223397117',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta property="fb:app_id" content="966242223397117" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=Space+Grotesk:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={cn(
          'font-body antialiased',
          'bg-background text-foreground'
        )}
      >
        <ExperimentalVersionSash />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
