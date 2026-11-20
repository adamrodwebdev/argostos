import { describe, expect, test } from 'vitest';
import { SessionLog } from '../../../src/logic/session/SessionLog';
import { decodeSession, encodeSession } from '../../../src/rules/sessionCode';

describe('SessionLog: what a remote tester sends back, and nothing more', () => {
  test('the first gesture is timed from the start; later ones do not move it', () => {
    const log = new SessionLog();
    log.huntBegun(1);
    log.tick(3.2);
    log.gesture();
    log.tick(5);
    log.gesture();
    expect(log.facts().firstGestureS).toBeCloseTo(3.2);
  });

  test('time paused does not count as played; the hunt’s own time is kept', () => {
    const log = new SessionLog();
    log.huntBegun(1);
    log.tick(10);
    log.paused(true);
    log.tick(30);
    log.paused(false);
    log.tick(5);
    expect(log.facts()).toMatchObject({ playedS: 15, huntS: 15, stage: 'playing' });
  });

  test('hunts begun, won and failed, and why the last one failed', () => {
    const log = new SessionLog();
    log.huntBegun(1);
    log.tick(60);
    log.huntEnded('success', null);
    log.huntBegun(2);
    log.tick(20);
    log.huntEnded('failure', 'spotted');
    log.huntBegun(2);
    log.tick(7);
    expect(log.facts()).toMatchObject({
      hunt: 2,
      huntS: 7,
      huntsStarted: 3,
      wins: 1,
      failures: 1,
      lastFailure: 'spotted',
      stage: 'playing',
    });
  });

  test('its facts make a code that reads back', () => {
    const log = new SessionLog();
    log.huntBegun(1);
    log.tick(42);
    log.gesture();
    log.huntEnded('failure', 'attacked');
    const facts = log.facts();
    expect(decodeSession(encodeSession(facts))).toMatchObject({
      hunt: 1,
      playedS: 42,
      stage: 'ended',
      lastFailure: 'attacked',
    });
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, -3])(
    'a broken tick (%s) counts nothing',
    (s) => {
      const log = new SessionLog();
      log.huntBegun(1);
      log.tick(s);
      expect(log.facts().playedS).toBe(0);
    },
  );
});
