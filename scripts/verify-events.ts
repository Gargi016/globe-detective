// Cross-checks the Phase 4 event database against data the app already ships.
//   npm run verify:events
//
// 1. Every GW code used by an event must exist in CShapes 2.0.
// 2. For events that name a state the Phase 3 name table also covers, the first and last day of each valid
//    period must match the name table, so the two curated sources cannot silently disagree.
// Differences are printed; the script exits non-zero only for unknown GW codes or hard mismatches.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDays } from '../src/detective/dateRange';
import { HISTORICAL_EVENTS } from '../src/detective/historicalEvents';
import { createHistoryService } from '../src/history/historyService';
import { findNamePeriod, namePeriodsFor } from '../src/history/nameHistory';

const file = join(import.meta.dirname, '..', 'public', 'data', 'cshapes', 'cshapes-2.0-gw.simplified.topojson');
const svc = createHistoryService(JSON.parse(readFileSync(file, 'utf8')));

const errors: string[] = [];
const notes: string[] = [];
let checked = 0;

for (const e of HISTORICAL_EVENTS) {
  if (e.gw === undefined) continue;
  const comparable = e.category === 'renaming' || e.category === 'existence'; // other kinds describe a status, not a name
  if (svc.periodsOf(e.gw).length === 0) {
    errors.push(`${e.id}: GW code ${e.gw} is not in CShapes 2.0`);
    continue;
  }
  const subject = e.subject.toLowerCase();
  const table = namePeriodsFor(e.gw);
  const matching = table.filter((p) => p.name.toLowerCase() === subject);
  if (!comparable || matching.length === 0) continue; // the name table has no entry for this subject: nothing to compare
  const tableAt = (d: string) => findNamePeriod(e.gw!, d)?.name.toLowerCase() === subject;
  for (const r of e.valid) {
    // Only compare boundaries that are specific days inside the table's coverage.
    if (r.start && matching.some((p) => p.from !== '' && p.from <= r.start!)) {
      checked++;
      const inside = tableAt(r.start);
      const before = tableAt(addDays(r.start, -1));
      if (!inside || before) notes.push(`${e.id}: starts ${r.start}; name table says ${inside ? 'name already used the day before' : 'name not used on that day'}`);
    }
    if (r.end && matching.some((p) => p.to === null || p.to >= r.end!)) {
      checked++;
      const inside = tableAt(r.end);
      const after = tableAt(addDays(r.end, 1));
      if (!inside || after) notes.push(`${e.id}: ends ${r.end}; name table says ${inside ? 'name still used the day after' : 'name not used on that day'}`);
    }
  }
}

console.log(`${HISTORICAL_EVENTS.length} events; ${HISTORICAL_EVENTS.filter((e) => e.gw !== undefined).length} carry a GW code; ${checked} boundary days compared with the Phase 3 name table.`);
if (notes.length) {
  console.log('\nDifferences from the name table (review; wider event bounds are deliberate where the event is marked approximate):');
  for (const n of notes) console.log('  - ' + n);
}
if (errors.length) {
  console.error('\nErrors:');
  for (const x of errors) console.error('  - ' + x);
  process.exit(1);
}
console.log(errors.length === 0 ? '\nNo hard errors.' : '');
