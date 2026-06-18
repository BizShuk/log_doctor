import { describe, it, expect } from 'vitest';
import { fingerprint } from '../src/listener';

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
