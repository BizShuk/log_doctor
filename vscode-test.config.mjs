// vscode-test.config.mjs — 此檔案保留作為「若日後升級到 @vscode/test-cli」的設定樣板。
// 目前使用 @vscode/test-electron 的程式化 runner(test/integration/runTest.ts),
// 本檔不會被自動讀取。當未來切換到 @vscode/test-cli 時,改寫為以下形式即可:
/*
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  // 1.85.0 對齊 package.json 的 engines.vscode。
  version: '1.85.0',
  // 安裝到一個空 workspace 來跑;避免污染真實工作區。
  workspaceFolder: './test/integration/workspace',
  // 與 runTest.ts 對齊,讓 headless / CI 環境可運作。
  launchArgs: ['--disable-gpu', '--no-sandbox'],
});
*/
export default {};
