<div align="center">

# BaseballStats

**Live scoring from the dugout. Stats that update themselves.**

Track every pitch, hit, and play from your phone — spray charts, box scores, and season stats calculated automatically.

Built with Next.js, Supabase, and a rules engine that actually understands baseball.

[Get Started](#getting-started) · [Features](#features) · [Tech Stack](#tech-stack)

</div>

---

## Why BaseballStats?

Scorekeeping apps are either too complicated or too simple. BaseballStats sits right in the middle — tap a result, tap where the ball went, and the app handles the rest. Force plays, double plays, runner advances, fielding credits, scorebook notation — all automatic.

Your stats are live the moment you record a play. No spreadsheets. No post-game data entry.

---

## Features

### Live Scoring

- **Tap-to-score** interface built for one-handed mobile use at the ballpark
- **Interactive spray chart** — tap where the ball landed, get automatic fielding position detection
- **Scorebook notation** auto-generated from spray + result (e.g. `6-4-3`, `F8`, `K`)
- **Trajectory arcs** — ground balls bounce, fly balls arc, pop-ups soar
- Track both **your team and opponents** in the same game
- **Runner management** — see occupied bases highlighted on the spray chart, advance runners with a tap
- **Stolen base tracking** mid-at-bat
- **Undo support** — fix mistakes without losing data

### Baseball Rules Engine

The engine follows [Retrosheet](https://www.retrosheet.org/eventfile.htm) event file conventions and the [Chadwick Bureau](https://github.com/chadwickbureau/chadwick) reference implementation:

- **Force play detection** — propagates through consecutively occupied bases per MLB Rule 5.09(b)(6)
- **Double play scenarios** — GDP, LDP, FDP with context-aware runner outs based on actual base state
- **Smart defaults** — runner advances auto-calculated for all 14 play result types
- **Hit type auto-select** — ground out → ground ball, fly out → fly ball, double play → ground ball
- **Runner advance editor** — override any runner's destination before confirming
- **Impossible play prevention** — DP/FC buttons disabled when bases are empty

### Automatic Stats

| Batting | Fielding | Game |
|---------|----------|------|
| AVG, OBP, SLG, OPS | Putouts, Assists, Errors | Inning-by-inning box scores |
| H, 1B, 2B, 3B, HR | Fielding Percentage | Completed innings tracking |
| RBI, BB, SO, SB, HBP | Position-based attribution | Live score ticker in header |

### Player Profiles

- **Season stats table** with all major batting columns, sortable and horizontally scrollable on mobile
- **Individual spray charts** with hit/out filtering and trajectory visualization
- **Player photos** from Supabase Storage
- **Bats/Throws** handedness display
- **Optimized batting order** generator based on baseball strategy (OBP, SLG, contact rate, speed)

### Progressive Web App

Install it to your home screen. Works offline-ready with:
- Apple touch icon + manifest icons
- Standalone display mode
- Mobile-first responsive design

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | [Supabase](https://supabase.com/) (PostgreSQL + Storage) |
| UI | [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS v4 |
| Charts | [Recharts](https://recharts.org/) |
| Font | [Montserrat](https://fonts.google.com/specimen/Montserrat) (weight 300) |
| Deploy | [Vercel](https://vercel.com/) (staging + production) |

### Design System

Dark-first with a teal / green / purple accent gradient:

```
Teal    #08DDC8     Green   #83DD68     Purple  #CF59F3
```

Glass morphism cards, ambient aurora mesh background, and glow effects throughout.

---

## Project Structure

```
src/
  app/
    games/
      new/                    # Create a game + set lineup
      [gameId]/               # Box score view
        live/                 # Live scoring interface
    players/
      [playerId]/             # Individual player stats + spray chart
    leaderboard/              # Season leaderboard
  components/
    scoring/SprayChart.tsx    # Interactive baseball field SVG
    live-game-ticker.tsx      # Header scoreboard widget
  lib/
    scoring/
      baseball-rules.ts      # Force plays, DP logic, runner advances
      game-engine.ts          # Game state management
      scorebook.ts            # Notation + fielding play parser
      types.ts                # TypeScript interfaces
    stats/
      calculations.ts         # AVG, OBP, SLG, OPS, fielding %
supabase/
  migrations/                 # Database schema (8 migrations)
  bootstrap_production.sql    # Full schema for new projects
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Add your Supabase URL and anon key

# Run database migrations
# Execute each file in supabase/migrations/ in order via the Supabase SQL Editor
# Or run bootstrap_production.sql for a fresh setup

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Split

| Environment | Branch | Supabase Project |
|-------------|--------|------------------|
| Production | `main` | Production project |
| Staging | `staging` | Staging project |

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` per environment in Vercel.

---

<div align="center">

Built for keeping score the way it should be kept.

</div>
