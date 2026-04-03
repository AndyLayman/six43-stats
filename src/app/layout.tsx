import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { LiveGameTicker } from "@/components/live-game-ticker";
import "./globals.css";

export const metadata: Metadata = {
  title: "BaseballStats",
  description: "Baseball stats tracking and live scoring",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BaseballStats",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A0A0A",
};

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/players", label: "Players" },
  { href: "/games", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Animated mesh gradient background */}
        <div aria-hidden className="ambient-bg-mesh">
          <div className="mesh-band-1" />
          <div className="mesh-band-2" />
          <div className="mesh-band-3" />
        </div>
        {/* Dot grid overlay */}
        <div aria-hidden className="fixed inset-0 -z-[5] pointer-events-none dot-grid" />
        <header className="sticky top-0 z-50 border-b border-border/50 glass-strong">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
              <div className="relative">
                <svg viewBox="0 0 24 24" className="h-7 w-7 transition-transform group-hover:scale-110" fill="none" strokeWidth="1.5">
                  <defs>
                    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#08DDC8" />
                      <stop offset="50%" stopColor="#83DD68" />
                      <stop offset="100%" stopColor="#CF59F3" />
                    </linearGradient>
                  </defs>
                  <circle cx="12" cy="12" r="10.5" stroke="url(#logo-grad)" />
                  {/* Baseball seam curves */}
                  <path d="M 6.5 3.5 Q 4 8 6 12 Q 8 16 6.5 20.5" stroke="url(#logo-grad)" strokeLinecap="round" />
                  <path d="M 17.5 3.5 Q 20 8 18 12 Q 16 16 17.5 20.5" stroke="url(#logo-grad)" strokeLinecap="round" />
                  {/* Seam stitch marks */}
                  <line x1="5.2" y1="5.5" x2="7.5" y2="6" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="4.8" y1="8" x2="7" y2="8.8" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="5.5" y1="10.5" x2="7.2" y2="11.2" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="5.5" y1="13" x2="7.5" y2="13" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="4.8" y1="15.5" x2="7" y2="15.5" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="5.2" y1="18" x2="7.5" y2="18" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="16.5" y1="6" x2="18.8" y2="5.5" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="17" y1="8.8" x2="19.2" y2="8" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="16.8" y1="11.2" x2="18.5" y2="10.5" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="16.5" y1="13" x2="18.5" y2="13" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="17" y1="15.5" x2="19.2" y2="15.5" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="16.5" y1="18" x2="18.8" y2="18" stroke="url(#logo-grad)" strokeWidth="1" strokeLinecap="round" />
                </svg>
              </div>
              <span className="hidden sm:inline text-gradient font-extrabold tracking-tight">BaseballStats</span>
            </Link>

            {/* Live game ticker — shows when a game is in progress */}
            <LiveGameTicker />

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Mobile hamburger */}
            <MobileNav links={NAV_LINKS} />
          </div>
        </header>
        <main className="flex-1 container mx-auto px-4 py-4 sm:py-6 animate-fade-in">
          {children}
        </main>
      </body>
    </html>
  );
}
