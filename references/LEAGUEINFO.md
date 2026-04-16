## League Configuration [SHARED]

League rules vary by age group and organization. These must be configurable per team/league, never hardcoded:

```typescript
type LeagueConfig = {
  maxInnings: number              // 4, 5, 6, 7 — never assume 9
  allowReEntry: boolean           // Can substituted players return?
  mercyRule: {
    enabled: boolean
    runDifference: number         // e.g., 10
    afterInning: number           // e.g., applies after inning 4
  }
  pitchCount: {
    enabled: boolean
    maxPerGame: number            // e.g., 85
    maxPerWeek: number            // e.g., 175
    restRules: PitchCountRestRule[]
  }
  battingOrderSize: number        // 9, 10, or full roster
  continuousBattingOrder: boolean // Bat the entire roster?
  extraHitterAllowed: boolean     // EH position
}
```