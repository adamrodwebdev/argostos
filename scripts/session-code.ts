/*
 * Reads a remote tester's session code (`npm run session-code -- 7K2M-…`): how long before
 * their first gesture, how long they played, where they stopped, the hunts begun, won and
 * failed. The code holds nothing personal; this only unpacks it.
 */
import { decodeSession } from '../src/rules/sessionCode.ts';

const facts = decodeSession(process.argv.slice(2).join(' '));
if (!facts) {
  console.error('Not a session code (16 characters, its check right).');
  process.exit(2);
}
const lines: readonly (readonly [string, string])[] = [
  ['First gesture', facts.firstGestureS === null ? 'none' : `${String(facts.firstGestureS)} s`],
  ['Played', `${String(facts.playedS)} s`],
  ['Stopped at', `hunt ${String(facts.hunt)}, ${String(facts.huntS)} s in, ${facts.stage}`],
  ['Hunts begun', String(facts.huntsStarted)],
  ['Won', String(facts.wins)],
  ['Failed', `${String(facts.failures)} (last: ${facts.lastFailure})`],
];
for (const [label, value] of lines) console.log(`${label.padEnd(14)}${value}`);
