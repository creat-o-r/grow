import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { Leaf } from 'lucide-react';

export const metadata: Metadata = {
  title: 'VerdantVerse',
  description: 'Your personal digital garden assistant.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
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
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <div className="mr-4 flex items-center">
              <a className="mr-6 flex items-center space-x-2" href="/">
                <Leaf className="h-6 w-6 text-primary" />
                <span className="font-bold font-headline">VerdantVerse</span>
              </a>
            </div>
          </div>
        </header>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

    