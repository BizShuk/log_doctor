// src/extension.ts — 擴充功能進入點。
import * as vscode from 'vscode';
import { collectDiagnostics } from './collector';
import { groupBySignature } from './dedup';
import { sortAndCap } from './grouper';
import { loadConfig, getApiKey, setApiKey } from './config';
import { PersistentQueue } from './queue';
import { Scheduler } from './scheduler';
import { createProvider } from './providers/factory';
import { fixOne } from './fixer';
import { applyOrConfirm } from './applier';
import { verifyFix } from './verifier';
import { log as reportLog, show as reportShow } from './report';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

let queue: PersistentQueue;
let scheduler: Scheduler;

const MAX_ATTEMPTS = 3;

async function snapshotFile(fsPath: string): Promise<string> {
  return readFile(fsPath, 'utf8');
}

async function restoreFile(fsPath: string, content: string): Promise<void> {
  await writeFile(fsPath, content, 'utf8');
}

async function showDiff(_oldText: string, _newText: string, uri: string): Promise<'apply' | 'reject'> {
  // 顯示虛擬文件差異;此處用最簡單的文字對話框,實務上可用 vscode.diff
  const choice = await vscode.window.showInformationMessage(
    `Log Doctor wants to modify ${uri}. Apply?`,
    { modal: true },
    'Apply',
    'Reject',
  );
  return choice === 'Apply' ? 'apply' : 'reject';
}

async function applyEdit(edit: vscode.WorkspaceEdit): Promise<boolean> {
  const ok = await vscode.workspace.applyEdit(edit);
  if (!ok) return false;
  await vscode.workspace.saveAll(false); // 儲存讓 LSP 重檢
  return true;
}

async function processOneItem(secrets: vscode.SecretStorage): Promise<boolean> {
  if (!scheduler.canRun()) {
    reportLog(`cooldown active, next run in ${Math.round(scheduler.msUntilNextRun() / 1000)}s`);
    return false;
  }
  const item = queue.peek();
  if (!item) {
    reportLog('queue empty');
    return false;
  }
  const cfg = loadConfig();
  const apiKey = await getApiKey(cfg.provider, secrets);
  if (!apiKey) {
    reportLog(`missing API key for ${cfg.provider}, pausing queue`);
    return false;
  }
  const provider = createProvider(cfg, apiKey);
  await queue.update(item.id, { status: 'in_flight' });

  const { fixes, error } = await fixOne({ diagnostic: item.diagnostic, provider });
  if (fixes.length === 0) {
    reportLog(`no usable fix for ${item.id}: ${error ?? 'no proposals'}`);
    const attempts = item.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await queue.update(item.id, { status: 'failed', lastError: error, attempts });
    } else {
      await queue.update(item.id, { status: 'pending', attempts });
    }
    return true;
  }

  const fix = fixes[0];
  const fsPath = fileURLToPath(fix.uri);
  const before = await snapshotFile(fsPath);
  const beforeDiags = collectDiagnostics(() => {
    const m = new Map<vscode.Uri, vscode.Diagnostic[]>();
    m.set(vscode.Uri.parse(fix.uri), vscode.languages.getDiagnostics(vscode.Uri.parse(fix.uri)));
    return m;
  });

  const { applied, reason } = await applyOrConfirm({
    fileText: before,
    fix,
    diagnostic: item.diagnostic.info,
    autoApplySources: cfg.autoApplySources,
    autoApplyMaxLines: cfg.autoApplyMaxLines,
    applyEdit,
    showDiffAndAsk: showDiff,
  });

  if (!applied) {
    reportLog(`fix not applied for ${item.id}: ${reason}`);
    await queue.update(item.id, { status: 'awaiting_confirmation', attempts: item.attempts + 1 });
    return true;
  }

  // 只有實際套用才推進冷卻時間戳
  await scheduler.markApplied();
  reportLog(`applied fix to ${fix.uri} for ${item.id}`);

  const verification = await verifyFix({
    representative: item.diagnostic,
    before: beforeDiags,
    fetchAfter: async () => {
      const m = new Map<vscode.Uri, vscode.Diagnostic[]>();
      m.set(vscode.Uri.parse(fix.uri), vscode.languages.getDiagnostics(vscode.Uri.parse(fix.uri)));
      return collectDiagnostics(() => m);
    },
  });

  if (verification.outcome === 'regressed') {
    reportLog(`regression detected, reverting ${fix.uri}`);
    await restoreFile(fsPath, before);
    await queue.update(item.id, { status: 'failed', lastError: 'regressed' });
  } else if (verification.outcome === 'resolved') {
    reportLog(`resolved ${item.id}`);
    await queue.update(item.id, { status: 'resolved' });
  } else {
    reportLog(`unresolved ${item.id}, will retry`);
    const attempts = item.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await queue.update(item.id, { status: 'failed', lastError: 'unresolved after retries' });
    } else {
      await queue.update(item.id, { status: 'pending', attempts });
    }
  }
  return true;
}

export async function activate(context: vscode.ExtensionContext) {
  queue = new PersistentQueue(context.workspaceState);
  queue.load();
  scheduler = new Scheduler(context.workspaceState, loadConfig().cooldownMinutes);

  context.subscriptions.push(
    vscode.commands.registerCommand('logDoctor.setApiKey', async () => {
      const cfg = loadConfig();
      const key = await vscode.window.showInputBox({
        prompt: `Enter API key for ${cfg.provider}`,
        password: true,
        ignoreFocusOut: true,
      });
      if (!key) {
        reportLog('setApiKey: cancelled');
        return;
      }
      await setApiKey(cfg.provider, key, context.secrets);
      reportLog(`setApiKey: stored key for ${cfg.provider}`);
    }),
    vscode.commands.registerCommand('logDoctor.fixWorkspace', async () => {
      reportLog('logDoctor.fixWorkspace invoked');
      const cfg = loadConfig();
      const all = collectDiagnostics(() => {
        const m = new Map<vscode.Uri, vscode.Diagnostic[]>();
        for (const [uri, diags] of vscode.languages.getDiagnostics()) {
          m.set(uri, diags);
        }
        return m;
      });
      const groups = groupBySignature(all);
      const items = sortAndCap(groups, cfg.maxIssues, (n) =>
        reportLog(`dropped ${n} issue(s) past cap`),
      );
      reportLog(`scan: ${all.length} raw → ${groups.length} groups → enqueue ${items.length}`);
      for (const r of items) {
        await queue.add({
          id: `${r.info.source}::${r.info.uri}::${r.info.range.start.line}::${r.info.code ?? ''}`,
          diagnostic: r,
          priority: 0,
          attempts: 0,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      // 跑到冷卻或佇列空;cooldown 結束時自動停下,不卡住命令
      let processed = true;
      while (processed) {
        processed = await processOneItem(context.secrets);
      }
      reportShow();
    }),
  );

  // 重啟接續:若佇列還有 pending 且冷卻已過,跑完整輪
  if (scheduler.canRun() && queue.peek()) {
    let processed = true;
    while (processed) {
      processed = await processOneItem(context.secrets);
    }
  }
}

export function deactivate() {
  // 無後台 timer 要清;Scheduler 沒有 setTimeout
}
