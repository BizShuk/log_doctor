// test/integration/runTest.ts — 啟動真實 VSCode 跑整合測試。
// 用法:npm run test:integration(會先 tsc 再 node 跑此檔的編譯產物)。
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import * as path from 'path';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    // 與 package.json 的 engines.vscode 對齊;若環境裝的版本較新也相容。
    const vscodeExecutablePath = await downloadAndUnzipVSCode('1.85.0');

    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      // 關 GPU 與 sandbox:CI 與無頭環境必備;GUI 也無害。
      launchArgs: ['--disable-gpu', '--no-sandbox'],
    });
  } catch (err) {
    console.error('Integration test runner failed:', err);
    process.exit(1);
  }
}

main();
