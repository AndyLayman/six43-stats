# BaseballStats

A live-scoring baseball app built for the dugout. Track games pitch-by-pitch from your phone or tablet, with automatic stat calculations, interactive spray charts, and real-time box scores.

---

## Features

### Live Scoring
- Tap-to-score interface optimized for mobile use at the ballpark
- Interactive **spray chart** -- tap where the ball went, get automatic fielding position detection
- **Scorebook notation** auto-generated from spray chart + result (e.g. `6-4-3`, `F8`, `K`)
- Track both **your team and opponents** in the same game
- **Undo** support -- fix mistakes without losing data

### Baseball Rules Engine
Built on the [Retrosheet](https://www.retrosheet.org/eventfile.htm) event file specification and the [Chadwick Bureau's](https://github.com/chadwickbureau/chadwick) reference implementation:

- **Force play detection** -- propagates through consecutively occupied bases per MLB Rule 5.09(b)(6)
- **Double play scenarios** -- GDP, LDP, FDP with context-aware runner outs based on actual base state
- **Smart defaults** -- runner advances auto-calculated for all 14 play result types
- **Runner advance editor** -- override any runner's destination before confirming (Scores / To 3rd / Holds / Out)
- **DP/FC buttons disabled** when bases are empty -- can't record a play that's impossible

### Automatic Stats
**Batting** -- AVG, OBP, SLG, OPS, hits by type, RBIs, walks, strikeouts, stolen bases

**Fielding** -- Putouts, assists, errors, fielding percentage -- auto-generated from scorebook notation by resolving fielding position numbers to players

**Box Scores** -- Inning-by-inning notation with AB/H/RBI totals for both teams

### Live Game Ticker
When a game is in progress, a compact scoreboard appears in the site header showing score, base runners, inning, and outs. Tap it to jump straight to live scoring.

### Season Leaderboards
Aggregated batting and fielding stats across all games with sortable leaderboard tables.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) |
| Language | TypeScript |
| Database | [Supabase](https://supabase.com/) (PostgreSQL) |
| UI | [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS |
| Charts | [Recharts](https://recharts.org/) |

## Project Structure

```
src/
  app/                        # Next.js pages
    games/
      new/                    # Create a game + set lineup
      [gameId]/               # Box score
        live/                 # Live scoring interface
    players/
      [playerId]/             # Individual player stats
    leaderboard/              # Season leaderboard
  components/
    scoring/SprayChart.tsx    # Interactive baseball field SVG
    live-game-ticker.tsx      # Header scoreboard widget
  lib/
    scoring/
      baseball-rules.ts      # Force plays, DP logic, runner advances
      game-engine.ts          # Game state management
      scorebook.ts            # Notation generation + fielding play parser
      types.ts                # All TypeScript interfaces
    stats/
      calculations.ts         # AVG, OBP, SLG, OPS, fielding %
supabase/
  migrations/                 # Database schema (4 migrations)
```

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
# Edit .env.local with your Supabase URL and anon key

# Run database migrations
# Execute each file in supabase/migrations/ in order via the Supabase SQL Editor

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Baseball Rules Reference

The rules engine follows these standards:

- **Retrosheet event file notation** -- the canonical encoding for baseball plays used across the analytics ecosystem
- **Chadwick event types** -- `2`=generic out, `3`=strikeout, `14`=walk, `19`=FC, `20`=single, `21`=double, `22`=triple, `23`=HR
- **Fielding positions** -- `1`=P, `2`=C, `3`=1B, `4`=2B, `5`=3B, `6`=SS, `7`=LF, `8`=CF, `9`=RF
- **DP types** -- `/GDP` (ground ball), `/LDP` (line drive), `/FDP` (fly ball)

---

Built for keeping score the way it should be kept.
