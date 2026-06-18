// src/listener.ts — Output Channel Listener 純邏輯模組。
// 不 import vscode,可在純 Node 直接 Vitest 測。
import { createHash } from 'node:crypto';
import type { ListenerRule, PublishPayload } from './types';

/** 計算 dedup fingerprint:規則 id 與訊息文字的短碼。 */
export function fingerprint(rule: { id: string }, text: string): string {
  return createHash('sha1').update(`${rule.id}\n${text.trim()}`).digest('hex').slice(0, 12);
}

/** channel glob 匹配:僅支援 `*` 萬用字元,大小寫敏感。 */
function matchChannel(pattern: string, channel: string): boolean {
  if (pattern === channel) return true;
  if (!pattern.includes('*')) return false;
  // 把 glob 轉成 regex:* → .*
  const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return re.test(channel);
}

/** 規則是否匹配給定 payload?先比 channel glob,再比 regex。 */
export function matchRule(rule: ListenerRule, payload: PublishPayload): boolean {
  if (!matchChannel(rule.channel, payload.channel)) return false;
  // pattern 已在 loadRules 編譯,這裡直接拿 compiled
  const re = (rule as ListenerRule & { _re?: RegExp })._re;
  if (!re) return false;
  return re.test(payload.text);
}
