// src/listenerHost.ts — vscode 邊界:註冊 logDoctor.publish 命令,
//
// 把外部 extension 的 publish payload 透過 listener.ts 純邏輯過濾後,
// 寫入 Log Doctor channel。同源去重 + 計數。
import * as vscode from 'vscode';
import { loadRules, newDedupState, applyDedup, formatLogLine, matchRule } from './listener';
import type { ConfigSnapshot, PublishPayload } from './types';

const MAX_TEXT_LENGTH = 10 * 1024; // 10 KB

/** 驗證 publish payload 形狀,失敗時回傳錯誤訊息(給 channel prefix 用);通過回傳 null。 */
function validatePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return 'payload is not an object';
  }
  const p = payload as Partial<PublishPayload>;
  if (!('channel' in p)) return "missing 'channel'";
  if (typeof p.channel !== 'string') return "'channel' is not a string";
  if (!('text' in p)) return "missing 'text'";
  if (typeof p.text !== 'string') return "'text' is not a string";
  if (p.text.length > MAX_TEXT_LENGTH) {
    return `'text' exceeds 10 KB (got ${p.text.length}, truncated)`;
  }
  if (p.severity !== undefined && !['info', 'warn', 'error'].includes(p.severity)) {
    return `unknown severity '${p.severity}', dropped`;
  }
  return null;
}

export function activateListener(
  context: vscode.ExtensionContext,
  cfg: ConfigSnapshot,
): void {
  const { rules, warnings } = loadRules(cfg.listeners);

  // 載入時的警告一次寫進 channel
  for (const w of warnings) {
    const line = `[${new Date().toISOString()}] [listener] ${w}`;
    vscode.window.createOutputChannel('Log Doctor').appendLine(line);
  }

  const dedup = newDedupState();

  const handler = (raw: unknown): void => {
    const err = validatePayload(raw);
    if (err) {
      vscode.window
        .createOutputChannel('Log Doctor')
        .appendLine(`[${new Date().toISOString()}] [silent-drop] invalid publish payload: ${err}`);
      return;
    }
    const payload = raw as PublishPayload;
    for (const rule of rules) {
      if (!matchRule(rule, payload)) continue;
      const { line } = applyDedup(dedup, rule, payload.text, Date.now());
      if (payload.severity) line.severity = payload.severity;
      vscode.window
        .createOutputChannel('Log Doctor')
        .appendLine(formatLogLine(line));
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('logDoctor.publish', handler),
  );
}