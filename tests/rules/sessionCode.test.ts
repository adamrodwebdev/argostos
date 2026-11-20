import { describe, expect, test } from 'vitest';
import {
  CODE_CHARACTERS,
  decodeSession,
  encodeSession,
  type SessionFacts,
} from '../../src/rules/sessionCode';

const FACTS: SessionFacts = {
  firstGestureS: 2.4,
  playedS: 312,
  hunt: 3,
  huntS: 41,
  stage: 'paused',
  huntsStarted: 4,
  wins: 2,
  failures: 1,
  lastFailure: 'spotted',
};

describe('encodeSession: a short code, nothing personal in it', () => {
  test('it is 16 characters in four groups, from an alphabet easy to read aloud', () => {
    const code = encodeSession(FACTS);
    expect(CODE_CHARACTERS).toBe(16);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  });

  test('it reads back to the same facts', () => {
    expect(decodeSession(encodeSession(FACTS))).toEqual(FACTS);
  });

  test('a session with no gesture yet says so', () => {
    const facts = { ...FACTS, firstGestureS: null, stage: 'playing', lastFailure: 'none' } as const;
    expect(decodeSession(encodeSession(facts))).toEqual(facts);
  });

  test('numbers past what a field holds are kept at its largest, never wrapped', () => {
    const big = { ...FACTS, playedS: 1e9, hunt: 500, huntsStarted: 500, firstGestureS: 9999 };
    const read = decodeSession(encodeSession(big));
    expect(read?.playedS).toBe(16383);
    expect(read?.hunt).toBe(127);
    expect(read?.huntsStarted).toBe(127);
    expect(read?.firstGestureS).toBe(409.4);
  });

  test('broken numbers are written as zero', () => {
    const read = decodeSession(encodeSession({ ...FACTS, playedS: Number.NaN, huntS: -4 }));
    expect(read?.playedS).toBe(0);
    expect(read?.huntS).toBe(0);
  });
});

describe('decodeSession: the team reads a code strictly', () => {
  const code = encodeSession(FACTS);

  test('case, hyphens and spaces do not matter; O reads as 0 and I or L as 1', () => {
    const typed = code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
    expect(decodeSession(typed)).toEqual(FACTS);
  });

  test('one character mistyped is caught by the check', () => {
    const last = code.at(-1) === 'A' ? 'B' : 'A';
    expect(decodeSession(code.slice(0, -1) + last)).toBeNull();
  });

  test.each([
    ['too short', code.slice(0, -2)],
    ['too long', `${code}A`],
    ['a letter not in the alphabet', `U${code.slice(1)}`],
    ['punctuation', code.replace('-', '.')],
    ['empty', ''],
    ['far too long', 'A'.repeat(500)],
    ['a name', '__proto__'],
  ])('%s is refused', (_case, raw) => {
    expect(decodeSession(raw)).toBeNull();
  });

  test.each([[42], [null], [undefined], [[code]], [{ toString: () => code }]])(
    'something that is not text (%j) is refused',
    (raw) => {
      expect(decodeSession(raw)).toBeNull();
    },
  );
});
