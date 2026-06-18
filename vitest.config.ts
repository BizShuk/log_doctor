import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // 整合測試需要真實 VSCode 環境,由 npm run test:integration 另起 Mocha 跑;
    // 在純 Node vitest 環境會找不到 'vscode' 模組,直接排除。
    exclude: ['node_modules/**', 'test/integration/**'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/extension.ts', 'src/providers/factory.ts'],
    },
  },
});
