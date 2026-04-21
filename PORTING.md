# Porting Guide — six43-stats → six43-ios (React Native)

Companion to the plan in `/root/.claude/plans/let-s-start-planning-this-sunny-wren.md`. This document is the concrete "copy this, rewrite that" reference for when you're at your Mac with Xcode open.

The whole portable surface of this repo is re-exported from `src/lib/domain/index.ts`. If it's not re-exported there, don't try to port it directly — it has browser, Next.js, or Supabase runtime dependencies.

---

## Phase 1 — Bootstrap the RN app (on your Mac)

Prerequisites (install once):
- Node 20+ (use `nvm` if you juggle versions)
- Xcode from the App Store (not the CLI — the full IDE)
- Xcode Command Line Tools: `xcode-select --install`
- CocoaPods: `sudo gem install cocoapods`
- Watchman: `brew install watchman`
- Free Apple ID signed into Xcode → Preferences → Accounts

Create the repo. Pick a location outside the six43-stats folder.

```bash
cd ~/Projects   # or wherever you keep code
npx @react-native-community/cli@latest init SixFourThree --skip-install
cd SixFourThree
npm install
cd ios && pod install && cd ..
npm run ios    # boots the simulator, confirms it builds
```

Set the bundle identifier in Xcode → target → General. Suggested: `co.six43.app`.

Push the new repo to GitHub as `six43-ios` (or whatever you prefer).

---

## Phase 2 — Copy the domain code

From `six43-stats` to `six43-ios`, copy these files as-is. No edits needed:

```
src/lib/scoring/types.ts              → src/domain/scoring/types.ts
src/lib/scoring/baseball-rules.ts     → src/domain/scoring/baseball-rules.ts
src/lib/scoring/game-engine.ts        → src/domain/scoring/game-engine.ts
src/lib/scoring/scorebook.ts          → src/domain/scoring/scorebook.ts
src/lib/stats/calculations.ts         → src/domain/stats/calculations.ts
src/lib/player-name.ts                → src/domain/player-name.ts
src/lib/domain/index.ts               → src/domain/index.ts
types/database.ts                     → src/domain/database.ts
```

Also copy the test files — they come with you and keep running:

```
src/lib/scoring/game-engine.test.ts
src/lib/scoring/baseball-rules.test.ts
src/lib/scoring/scorebook.test.ts
src/lib/stats/calculations.test.ts
```

### Import rewrites

The stats repo uses a TypeScript path alias `@/* → ./src/*`. In the RN repo the files live under `src/domain/` instead, so fix the imports:

- `from "@/lib/scoring/types"` → `from "./types"` (from within `src/domain/scoring/`)
- `from "@/lib/scoring/types"` inside `src/domain/stats/calculations.ts` → `from "../scoring/types"`
- `from "@/lib/scoring/types"` inside `src/domain/player-name.ts` → `from "./scoring/types"`
- The barrel file (`src/domain/index.ts`): change every `@/lib/scoring/...` / `@/lib/stats/...` / `@/lib/player-name` to relative paths (`./scoring/...`, `./stats/...`, `./player-name`).

Alternative: set up a `@/*` alias in the RN project's `tsconfig.json` + `babel.config.js` (`babel-plugin-module-resolver`) pointing at `./src/*`. Then you can keep the existing imports verbatim. Slightly more setup now, zero rewriting. Either works.

### Tests

Install Vitest in the RN repo the same way this repo does it:

```bash
npm install -D vitest
```

Copy `vitest.config.ts` from this repo; adjust the `@` alias path if your directory layout differs. Run `npm test` — all 105 tests should pass against the copied files. If they don't, the port has a bug before you've written any native code, which is exactly the signal you want.

---

## Phase 2b — `league-config.ts` needs to be split

`src/lib/league-config.ts` is **mostly portable but not entirely** — it imports the Supabase browser client. In the RN repo, split it into two files:

### `src/domain/league-config.ts` (portable — copy into domain)
The `LeagueConfig` type and the `defaults` object. No imports.

```typescript
export type LeagueConfig = { /* same as before */ }

export const LEAGUE_CONFIG_DEFAULTS: LeagueConfig = { /* same as before */ }

// Pure mapper — DB row → domain type. Useful in both Supabase and direct-fetch paths.
export function leagueConfigFromRow(row: Record<string, unknown>): LeagueConfig {
  return {
    maxInnings: Number(row.max_innings),
    // ... etc, same mapping as the current getLeagueConfig
  }
}
```

### `src/data/league-config.ts` (RN-flavored — calls Supabase)
Same `getLeagueConfig` / `updateLeagueConfig` logic, but imports the RN Supabase client instead of the web one. Uses `leagueConfigFromRow` and `LEAGUE_CONFIG_DEFAULTS` from the portable file.

This is the pattern for any "domain + DB access" module. Keep the shapes portable; isolate the Supabase client.

---

## Phase 3 — Supabase client

The web app uses `@supabase/ssr` (`createBrowserClient` / `createServerClient`). The RN app uses plain `@supabase/supabase-js` with an AsyncStorage adapter for session persistence.

```bash
npm install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

```typescript
// src/supabase/client.ts
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/domain/database'

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,       // or SIX43_SUPABASE_URL — see below
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,               // important — RN has no URL
    },
  }
)
```

### Environment variables

React Native (bare workflow) doesn't have `NEXT_PUBLIC_*` conventions. Options:

- **Simplest:** `react-native-config` or `react-native-dotenv`. Gives you `.env` support with a naming convention you control.
- **Stricter:** hard-code into `ios/SixFourThree/Info.plist` and read via a native module. Only do this if the anon key leak surface concerns you — the anon key is already public in the web apps.

Use the same Supabase project URL + anon key already in `.env.local` here. Never bundle the `SUPABASE_SERVICE_ROLE_KEY` into the mobile app.

---

## Phase 3b — Auth

Port `src/components/auth-provider.tsx` to RN. Remove:
- `useSearchParams` from `next/navigation` — no URL routing
- Cookie-based refresh logic — AsyncStorage handles persistence
- Any `redirect` calls — replace with navigation pushes
- The `/auth/callback` route (delete entirely — RN OTP flow is direct)

Keep:
- The `AuthProvider` context shape
- The team/role helpers (`hasRole`, etc.)
- The memberships query

The sign-in flow is just two screens: enter email → `signInWithOtp` → enter code → `verifyOtp`. No deep links, no email magic link handler.

---

## Phase 4 — Navigation + design tokens

### Navigation
```bash
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
cd ios && pod install && cd ..
```

### Design tokens

The design system (`references/DESIGN-SYSTEM.md`) is **tokens-first, CSS-second**. The tokens port; the CSS does not. Create an RN-native tokens file:

```typescript
// src/theme/tokens.ts
export const colors = {
  chalk: '#F7F7F7',
  nightGame: '#111111',
  clay: '#E9D7B4',
  dirt: '#574F3D',
  stitchRed: '#B93C3C',
  highHeat: '#FA4D4D',
  outfield: '#50684C',
  freshCut: '#71A368',
  gray950: '#181818',
  gray900: '#1E1E1E',
  gray800: '#2A2A2A',
  gray700: '#3A3A3A',
  gray600: '#5A5A5A',
  gray400: '#8A8A8A',
  gray200: '#B0B0B0',
}

export const semantic = {
  bg: colors.nightGame,
  bgCard: colors.gray900,
  text: colors.chalk,
  textMuted: colors.gray400,
  accent: colors.clay,
  danger: colors.highHeat,
  success: colors.freshCut,
  border: colors.gray700,
}

export const spacing = { sp1: 4, sp2: 8, sp3: 16, sp4: 24, sp5: 32, sp6: 48, sp8: 64 }
export const radius = { r1: 4, r2: 8, r3: 16, r4: 24, rFull: 9999 }
export const fontSize = { xs: 10, sm: 12, base: 14, lg: 16, xl: 20, '2xl': 24 }
```

Then either:
- **Plain `StyleSheet`** — simplest, no extra deps. Use `semantic.bg` etc. directly.
- **NativeWind** — Tailwind-like classnames in RN. If you want the web Tailwind muscle memory.
- **Tamagui** — opinionated styling framework with themes. Overkill for this app.

Recommend plain `StyleSheet` for v1 — fewer moving parts, faster to ship, easy to migrate later.

### Fonts
The design system calls for Montserrat 300. RN bare workflow requires linking:
1. Download Montserrat from Google Fonts
2. Drop `.ttf` files into `ios/SixFourThree/Fonts/`
3. Add them to `Info.plist` under `UIAppFonts`
4. Reference as `fontFamily: 'Montserrat-Light'` in styles

---

## What NOT to port

These stay on the web — don't recreate them in RN:

- **Tailwind, PostCSS, shadcn components** — not portable, and RN doesn't need them
- **`@supabase/ssr`** — server-side helpers for Next.js; RN uses `@supabase/supabase-js` directly
- **Next.js route handlers (`src/app/api/team/*`)** — migrate to Supabase Edge Functions per Phase 9 of the plan, then both web and native call `supabase.functions.invoke(...)`
- **`src/lib/supabase-admin.ts`, `src/lib/supabase-server.ts`** — server-only with service role keys. Never touches a phone.
- **The localStorage-based offline queue logic** — RN uses AsyncStorage with a different, cleaner pattern (see plan note on "rebuild the state layer around" the scoring engine)

---

## Checklist before you start writing screens

- [ ] `npm run ios` boots the default RN app on the simulator
- [ ] `src/domain/` folder populated from the copies above
- [ ] `npm test` passes all 105 scoring tests against the ported files
- [ ] Supabase client connects (smoke test: `supabase.auth.getSession()` doesn't throw)
- [ ] Sign-in OTP flow works end-to-end on the simulator
- [ ] Design tokens file exists and is in use for at least the tab bar background

When all six are checked, you're ready for Phase 5 (Stats tab).
