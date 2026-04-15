"use client";

import { Suspense, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const authError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    authError === "auth" ? "Something went wrong. Please try again." : null
  );

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 -mt-4 sm:-mt-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <img
            src="/logos/Stats-White.svg"
            alt="Stats"
            className="h-8 w-auto mx-auto mb-6 dark:block hidden"
          />
          <img
            src="/logos/Stats-Black.svg"
            alt="Stats"
            className="h-8 w-auto mx-auto mb-6 dark:hidden block"
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Access your team dashboard
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-border/50 bg-card p-6 text-center space-y-3">
            <div className="text-3xl">✉️</div>
            <h2 className="text-lg font-bold text-foreground">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <strong className="text-foreground">{email}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Click the link in the email to sign in. Check spam if you don&apos;t see it.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-sm text-primary hover:underline mt-2"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Google sign-in */}
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border/50 bg-card text-sm font-semibold text-foreground hover:bg-accent transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground font-medium">or</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Magic link form */}
            <form onSubmit={handleMagicLink} className="space-y-3">
              <div>
                <label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="mt-1 w-full h-12 rounded-xl border border-border/50 bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Magic Link"}
              </button>
            </form>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
