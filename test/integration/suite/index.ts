// test/integration/suite/index.ts — Mocha 進入點;在 Extension Development Host 內被載入。
// 透過 glob 抓出所有 *.test.js 餵給 Mocha。
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60_000, // 整合測試含 LLM mock 與 LSP 等待,給 60s
  });

  const testsRoot = path.resolve(__dirname);
  return new Promise((resolve, reject) => {
    // 使用 callback 風格以對齊 @types/glob v8 的型別。
    glob('**/*.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
      if (err) {
        reject(err);
        return;
      }
      for (const f of files) {
        mocha.addFile(path.resolve(testsRoot, f));
      }
      try {
        mocha.run((failures: number) => {
          if (failures > 0) {
            reject(new Error(`${failures} integration test(s) failed.`));
          } else {
            resolve();
          }
        });
      } catch (caught: unknown) {
        reject(caught);
      }
    });
  });
}
