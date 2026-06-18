// test/integration/suite/extension.test.ts — 最小冒煙測試。
// 在真實 VSCode 內載入擴充套件,驗證:
//   1. activate() 跑完後兩個命令都註冊到 VSCode
//   2. 預設設定值可被讀取(代表 package.json 的 contributes.configuration 沒寫錯)
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Log Doctor integration smoke', () => {
  test('fixWorkspace command is registered after activation', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('logDoctor.fixWorkspace'),
      'logDoctor.fixWorkspace should be registered in the command palette',
    );
  });

  test('setApiKey command is registered after activation', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('logDoctor.setApiKey'),
      'logDoctor.setApiKey should be registered in the command palette',
    );
  });

  test('default provider is claude', () => {
    const cfg = vscode.workspace.getConfiguration('logDoctor');
    assert.strictEqual(cfg.get<string>('provider'), 'claude');
  });

  test('default cooldownMinutes is 30', () => {
    const cfg = vscode.workspace.getConfiguration('logDoctor');
    assert.strictEqual(cfg.get<number>('cooldownMinutes'), 30);
  });
});
