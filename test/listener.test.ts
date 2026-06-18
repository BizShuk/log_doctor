import { describe, it, expect } from 'vitest';
import { fingerprint, matchRule, loadRules } from '../src/listener';

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
  const withRe = (id: string, channel: string, pattern: string) => ({
    id,
    channel,
    pattern,
    _re: new RegExp(pattern),
  });

  it('matches exact channel', () => {
    const rule = withRe('r1', 'ESLint', 'warning');
    expect(matchRule(rule, { channel: 'ESLint', text: 'some warning here' })).toBe(true);
  });

  it('matches channel glob ESLint* against "ESLint Server"', () => {
    const rule = withRe('r1', 'ESLint*', 'warning');
    expect(matchRule(rule, { channel: 'ESLint Server', text: 'a warning' })).toBe(true);
  });

  it('does not match channel glob ESLint* against "Jest Output"', () => {
    const rule = withRe('r1', 'ESLint*', 'warning');
    expect(matchRule(rule, { channel: 'Jest Output', text: 'a warning' })).toBe(false);
  });

  it('channel glob is case-sensitive: ESLint* does not match "eslint server"', () => {
    const rule = withRe('r1', 'ESLint*', 'warning');
    expect(matchRule(rule, { channel: 'eslint server', text: 'a warning' })).toBe(false);
  });

  it('matches regex ^error against "error TS1234: ..."', () => {
    const rule = withRe('r1', 'TypeScript', '^error TS\\d+:');
    expect(matchRule(rule, { channel: 'TypeScript', text: 'error TS1234: bad type' })).toBe(true);
  });

  it('regex (?i) enables case-insensitive matching', () => {
    const rule = withRe('r1', 'X', '[Ww][Aa][Rr][Nn][Ii][Nn][Gg]');
    expect(matchRule(rule, { channel: 'X', text: 'WARNING: foo' })).toBe(true);
  });
});

describe('loadRules', () => {
  it('accepts valid rules and defaults label = id when missing', () => {
    const { rules, warnings } = loadRules([
      { id: 'r1', channel: 'X', pattern: 'foo' },
      { id: 'r2', channel: 'Y', pattern: 'bar', label: 'Custom' },
    ]);
    expect(warnings).toEqual([]);
    expect(rules).toHaveLength(2);
    expect(rules[0].label).toBe('r1');
    expect(rules[1].label).toBe('Custom');
    expect(rules[0].cooldownMs).toBe(300000);
  });

  it('skips rules missing id, channel, or pattern', () => {
    const { rules, warnings } = loadRules([
      { id: 'r1', channel: 'X' /* missing pattern */ } as never,
      { id: 'r2', pattern: 'foo' } as never,
      { channel: 'X', pattern: 'foo' } as never,
    ]);
    expect(rules).toHaveLength(0);
    expect(warnings).toHaveLength(3);
  });

  it('skips rules with invalid regex and includes raw pattern in warning', () => {
    const { rules, warnings } = loadRules([
      { id: 'r1', channel: 'X', pattern: '[unclosed' },
    ]);
    expect(rules).toHaveLength(0);
    expect(warnings[0]).toContain('[unclosed');
  });

  it('keeps first occurrence when id duplicates', () => {
    const { rules, warnings } = loadRules([
      { id: 'r1', channel: 'A', pattern: 'foo' },
      { id: 'r1', channel: 'B', pattern: 'bar' },
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0].channel).toBe('A');
    expect(warnings[0]).toMatch(/duplicate/i);
  });

  it('forces cooldownMs to 300000 when invalid', () => {
    const { rules } = loadRules([
      { id: 'r1', channel: 'X', pattern: 'foo', cooldownMs: -1 },
      { id: 'r2', channel: 'Y', pattern: 'bar', cooldownMs: 'foo' as never },
    ]);
    expect(rules[0].cooldownMs).toBe(300000);
    expect(rules[1].cooldownMs).toBe(300000);
  });

  it('skips rules with id containing illegal characters', () => {
    const { rules, warnings } = loadRules([
      { id: 'has space', channel: 'X', pattern: 'foo' },
      { id: 'has.dot', channel: 'Y', pattern: 'bar' },
    ]);
    expect(rules).toHaveLength(0);
    expect(warnings).toHaveLength(2);
  });
});
