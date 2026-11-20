import { describe, expect, test } from 'vitest';
import { DEFAULT_OPTIONS, MAX_QUERY_LENGTH, readUrlOptions } from '../../src/rules/urlOptions';

describe('readUrlOptions: the URL is an allow-list, read strictly', () => {
  test('no query gives the defaults', () => {
    expect(readUrlOptions('')).toEqual(DEFAULT_OPTIONS);
  });

  test('every option read when it is right', () => {
    expect(readUrlOptions('?seed=2026&detail=fine&debug=1&autopilot=1&mute=1')).toEqual({
      seed: 2026,
      detail: 'fine',
      debug: true,
      autopilot: true,
      mute: true,
    });
  });

  test('the largest seed is read, the smallest too', () => {
    expect(readUrlOptions('?seed=2147483647').seed).toBe(2_147_483_647);
    expect(readUrlOptions('?seed=0').seed).toBe(0);
  });

  test.each([
    ['letters after the digits', '?seed=12abc'],
    ['an exponent', '?seed=1e3'],
    ['hexadecimal', '?seed=0x10'],
    ['empty', '?seed='],
    ['spaces only', '?seed=%20%20'],
    ['a plus sign', '?seed=%2B12'],
    ['a decimal', '?seed=1.5'],
    ['grouping', '?seed=1%20000'],
    ['a decimal comma', '?seed=1,5'],
    ['Infinity', '?seed=Infinity'],
    ['NaN', '?seed=NaN'],
    ['full-width digits', '?seed=%EF%BC%91%EF%BC%92'],
    ['Arabic-Indic digits', '?seed=%D9%A1%D9%A2'],
    ['just under the range', '?seed=-1'],
    ['just over the range', '?seed=2147483648'],
    ['far beyond safe integers', '?seed=9007199254740993'],
    ['repeated', '?seed=1&seed=2'],
    ['an array form', '?seed[]=12'],
  ])('a seed with %s keeps the default', (_case, query) => {
    expect(readUrlOptions(query).seed).toBe(DEFAULT_OPTIONS.seed);
  });

  test('a space from a "+" is trimmed like any other (the URL decodes "+" as a space)', () => {
    expect(readUrlOptions('?seed=+12').seed).toBe(12);
  });

  test.each(['Fine', 'FINE', 'ultra', '__proto__', 'toString', 'constructor', ''])(
    'the detail "%s" is not on the list: the default stays',
    (value) => {
      expect(readUrlOptions(`?detail=${value}`).detail).toBe(DEFAULT_OPTIONS.detail);
    },
  );

  test('an invisible character around an allowed value is cleaned off, then the value is read', () => {
    expect(readUrlOptions('?detail=%E2%80%8Bcoarse').detail).toBe('coarse');
    expect(readUrlOptions('?detail=fine%E2%80%AE').detail).toBe('fine');
  });

  test.each(['true', 'yes', '0', '', '2', '1.0', ' 1x', '__proto__'])(
    'debug=%s is not the switch: it stays off',
    (value) => {
      expect(readUrlOptions(`?debug=${value}`).debug).toBe(false);
    },
  );

  test('a switch given twice stays off', () => {
    expect(readUrlOptions('?debug=1&debug=1').debug).toBe(false);
  });

  test('unknown options are ignored, the known ones still read', () => {
    expect(readUrlOptions('?__proto__=1&constructor=x&seed=9&debug=1')).toEqual({
      ...DEFAULT_OPTIONS,
      seed: 9,
      debug: true,
    });
  });

  test('a query longer than the limit is refused whole, before parsing', () => {
    const long = `?seed=5&pad=${'x'.repeat(MAX_QUERY_LENGTH)}`;
    expect(readUrlOptions(long)).toEqual(DEFAULT_OPTIONS);
  });

  test.each([[null], [undefined], [42], [['?seed=5']], [{ toString: () => '?seed=5' }]])(
    'a search that is not text (%j) gives the defaults',
    (search) => {
      expect(readUrlOptions(search)).toEqual(DEFAULT_OPTIONS);
    },
  );
});
