import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createBrowserClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder"
);

/**
 * Resolves once the auth session is initialized.
 * Await this before firing parallel queries to prevent auth-token lock contention.
 * (The Supabase client uses a browser Lock internally — concurrent requests
 *  that all try to read/refresh the token simultaneously will steal the lock
 *  from each other and fail.)
 */
export const sessionReady: Promise<void> =
  typeof window !== "undefined"
    ? supabase.auth.getSession().then(() => {})
    : Promise.resolve();
