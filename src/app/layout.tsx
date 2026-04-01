import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BaseballStats",
  description: "Baseball stats tracking and live scoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-14 items-center px-4">
            <Link href="/" className="mr-8 flex items-center gap-2 font-bold text-lg">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M 5 19 Q 12 12 19 5" />
                <path d="M 5 5 Q 12 12 19 19" />
              </svg>
              BaseballStats
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link href="/players" className="text-muted-foreground hover:text-foreground transition-colors">
                Players
              </Link>
              <Link href="/games" className="text-muted-foreground hover:text-foreground transition-colors">
                Games
              </Link>
              <Link href="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors">
                Leaderboard
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 container mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
