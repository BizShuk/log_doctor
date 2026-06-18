import { describe, it, expect } from 'vitest';
import { fingerprint, matchRule } from '../src/listener';

describe('fingerprint', () => {
  it('returns same hash for same ruleId + same text', () => {
    const rule = { id: 'r1', channel: 'c', pattern: 'x' };
    expect(fingerprint(rule, 'hello')).toBe(fingerprint(rule, 'hello'));
  });

  it('treats trailing whitespace as same hash', () => {
    const rule = { id: 'r1', channel: 'c', pattern: 'x' };
    expect(fingerprint(rule, 'hello')).toBe(fingerprint(rule, 'hello   '));
  });

  it('returns different hash for different ruleId + same text', () => {
    const a = { id: 'r1', channel: 'c', pattern: 'x' };
    const b = { id: 'r2', channel: 'c', pattern: 'x' };
    expect(fingerprint(a, 'hello')).not.toBe(fingerprint(b, 'hello'));
  });
});

describe('matchRule', () => {
  it('matches exact channel', () => {
    const rule = { id: 'r1', channel: 'ESLint', pattern: 'warning' };
    expect(matchRule(rule, { channel: 'ESLint', text: 'some warning here' })).toBe(true);
  });

  it('matches channel glob ESLint* against "ESLint Server"', () => {
    const rule = { id: 'r1', channel: 'ESLint*', pattern: 'warning' };
    expect(matchRule(rule, { channel: 'ESLint Server', text: 'a warning' })).toBe(true);
  });

  it('does not match channel glob ESLint* against "Jest Output"', () => {
    const rule = { id: 'r1', channel: 'ESLint*', pattern: 'warning' };
    expect(matchRule(rule, { channel: 'Jest Output', text: 'a warning' })).toBe(false);
  });

  it('channel glob is case-sensitive: ESLint* does not match "eslint server"', () => {
    const rule = { id: 'r1', channel: 'ESLint*', pattern: 'warning' };
    expect(matchRule(rule, { channel: 'eslint server', text: 'a warning' })).toBe(false);
  });

  it('matches regex ^error against "error TS1234: ..."', () => {
    const rule = { id: 'r1', channel: 'TypeScript', pattern: '^error TS\\d+:' };
    expect(matchRule(rule, { channel: 'TypeScript', text: 'error TS1234: bad type' })).toBe(true);
  });

  it('regex (?i) enables case-insensitive matching', () => {
    const rule = { id: 'r1', channel: 'X', pattern: '(?i)warning' };
    expect(matchRule(rule, { channel: 'X', text: 'WARNING: foo' })).toBe(true);
  });
});
