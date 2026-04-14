import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { LiveGameTicker } from "@/components/live-game-ticker";
import { ThemeToggle } from "@/components/theme-toggle";
import { RefreshProvider } from "@/components/pull-to-refresh";
import { ToastContainer } from "@/components/toast";
import "./globals.css";

const isStaging = process.env.NEXT_PUBLIC_APP_ENV === "staging";

export const metadata: Metadata = {
  title: isStaging ? "[STAGE] Baseball Stats" : "Baseball Stats",
  description: "Baseball stats tracking and live scoring",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/Favicon.png", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/Score_128-128.png", sizes: "128x128", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: isStaging ? "[STAGE] Baseball Stats" : "Baseball Stats",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#181818",
};

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/players", label: "Players" },
  { href: "/schedule", label: "Schedule" },
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
      suppressHydrationWarning
      style={{ background: '#0A0A0A' }}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light"){document.documentElement.classList.remove("dark");document.documentElement.classList.add("light")}}catch(e){}})()`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b border-border/50 bg-sidebar">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
              <img src="/logos/Stats-White.svg" alt="Stats" className="h-6 w-auto transition-transform group-hover:scale-105 dark:block hidden" />
              <img src="/logos/Stats-Black.svg" alt="Stats" className="h-6 w-auto transition-transform group-hover:scale-105 dark:hidden block" />
              {isStaging && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  STG
                </span>
              )}
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
              <ThemeToggle />
            </nav>

            {/* Mobile hamburger */}
            <MobileNav links={NAV_LINKS} />
          </div>
        </header>
        <RefreshProvider>
          <main className="flex-1 container mx-auto px-4 py-4 sm:py-6 animate-fade-in">
            {children}
          </main>
        </RefreshProvider>
        <ToastContainer />
      </body>
    </html>
  );
}
