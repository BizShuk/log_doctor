// src/listener.ts — Output Channel Listener 純邏輯模組。
// 不 import vscode,可在純 Node 直接 Vitest 測。
import { createHash } from 'node:crypto';

/** 計算 dedup fingerprint:規則 id 與訊息文字的短碼。 */
export function fingerprint(rule: { id: string }, text: string): string {
  return createHash('sha1').update(`${rule.id}\n${text.trim()}`).digest('hex').slice(0, 12);
}
