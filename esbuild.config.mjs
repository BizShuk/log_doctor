// esbuild.config.mjs
// Bundle log_doctor VSCode extension into a single CJS file.
// Bundles @anthropic-ai/sdk and openai inline; marks `vscode` as external
// because the VSCode Extension Host injects it as a global at runtime.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(__dirname, 'src/extension.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: resolve(__dirname, 'out/src/extension.js'),
  external: ['vscode'],
  // Keep sourcemaps off in the package; regenerate locally if needed.
  sourcemap: false,
  // Resolve from project root to pick up node_modules/@anthropic-ai/sdk etc.
  absWorkingDir: __dirname,
  logLevel: 'info',
});
