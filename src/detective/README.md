# Historical clue detection and date estimation (Phase 4)

```ts
import { createClue, createPrintedDateClue, estimateDate } from './detective';

const result = estimateDate([
  createClue('ceylon-name', 'shows'),
  createClue('bangladesh-independent', 'shows'),
  createPrintedDateClue({ year: 1972 }),
]);
result.information        // when the map CONTENT was current
result.manufactureLikely  // when the globe was most likely MADE
result.manufacturePossible// wider window allowing for reused plates (adjustable assumption)
result.confidence         // level + score + the factors behind it, for content and for manufacture
result.reasoning          // one step per clue, with the running range
result.conflicts          // minimal sets of clues that cannot all be true
result.alternatives       // consistent readings that leave some clues out
```

| File | Role |
| --- | --- |
| `types.ts` | Shared types |
| `dateRange.ts` | Calendar and interval-set algebra (union, intersection, complement) |
| `historicalEvents.ts` | The event database: dates, sources, aliases, omission risk |
| `clues.ts` | Turns an observation (“shows X”, “does not show X”, printed date) into date constraints |
| `clueValidation.ts` | Clue, clue-set and database validation; contradiction finding |
| `dateEstimator.ts` | Intersection, manufacture window, confidence, reasoning |

Tests: `npm run test:detective`. Cross-check against shipped data: `npm run verify:events`.
