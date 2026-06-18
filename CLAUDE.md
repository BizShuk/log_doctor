# Log Doctor — 技術脈絡 (Technical Context)

VSCode 擴充功能的工程筆記:專案結構、技術棧、關鍵決策、模組對應、開發指南與慣例。

## 專案結構 (Project Structure)

```
log_doctor/
├── package.json              # 擴充功能 manifest:命令、activation events、設定 schema
├── tsconfig.json             # strict TS, ES2022 / Node16, rootDir=. outDir=out
├── vitest.config.ts          # Node env,coverage 排除 extension.ts 與 factory.ts
├── .vscodeignore             # 打包排除 test/ 與設定檔
├── .gitignore
├── README.md                 # 使用說明與業務領域
├── plans/
│   └── 2026-06-16-log-doctor.md  # TDD task-by-task 實作計畫
├── docs/
│   └── superpowers/          # 其他規格文件
├── src/
│   ├── extension.ts          # activate/deactivate,註冊命令,processOneItem 編排
│   ├── types.ts              # 共用型別 (Severity, DiagnosticInfo, QueueItem, ConfigSnapshot)
│   ├── config.ts             # loadConfig + SecretStorage getApiKey/setApiKey
│   ├── collector.ts          # vscode.Diagnostic → DiagnosticInfo
│   ├── dedup.ts              # 純:signatureOf, groupBySignature, normalizeMessage
│   ├── grouper.ts            # 純:sortAndCap
│   ├── risk.ts               # 純:decideRisk / classifyBySource / patchLineCount
│   ├── prompt.ts             # 純:buildFixPrompt + parseFixResponse
│   ├── queue.ts              # PersistentQueue (workspaceState 後端)
│   ├── scheduler.ts          # Scheduler (全域冷卻)
│   ├── fixer.ts              # 編排:讀檔 → 組提示 → provider → 修補
│   ├── applier.ts            # WorkspaceEdit 風險分流套用
│   ├── verifier.ts           # resolved/unresolved/regressed 判定
│   ├── report.ts             # 共用 Output channel
│   └── providers/
│       ├── provider.ts       # Provider 介面 + sendForFixes helper
│       ├── claude.ts         # Anthropic SDK 實作
│       ├── openai.ts         # OpenAI SDK 實作
│       └── factory.ts        # 依 cfg 挑 provider
├── test/                     # 14 個 .test.ts,Vitest 跑全部
│   └── providers/            # provider 測試
└── out/                      # esbuild 產物 (單檔 bundle,含 SDK 內嵌)
```

## 技術棧 (Tech Stack)

- Language: TypeScript 5.x (target ES2022, strict 全開)
- Framework: VSCode Extension API 1.85+ (`@types/vscode`)
- Build tool: `tsc -p . --noEmit` (型別檢查) + `esbuild` (bundle 成單檔)
- Test: Vitest 1.x (Node env,`vi.mock('vscode', ...)` 隔離)
- Packaging: `vsce package` (產 `.vsix`)
- LLM SDK: `@anthropic-ai/sdk ^0.27.0` + `openai ^4.40.0`
- Node typing: `@types/node ^20.11.0`

## 關鍵決策 (Key Decisions)

- 純模組與工作流模組分流:`dedup.ts` / `grouper.ts` / `risk.ts` / `prompt.ts` 不 import `vscode`,可在純 Node 環境直接測試;`applier.ts` / `extension.ts` 等需 `vi.mock('vscode')`。理由:把業務邏輯與 VSCode API 解耦,降低測試成本。
- 持久化用 `workspaceState` 而非磁碟:Queue 與 lastAppliedAt 都透過 `Memento` 存,好處是綁定工作區且 IDE 卸載時自動清掉;壞處是跨工作區不共享。
- 修補以「整段 oldText → newText」表達,不用 line/char offset:LLM 直接給檔內子字串,applier 內部 `locate()` 算位置;避免 LLM 給的行號與實際內容不同步。代價是 `oldText` 必須 verbatim,任何縮排差異都會找不到。
- 冷卻只在「實際套用」後推進:被拒絕或 LLM 無回應不消耗冷卻配額;透過 `Scheduler.markApplied()` 在 `applied === true` 之後才呼叫實作。
- 風險分流是兩段式:`classifyBySource` 與 `patchLineCount` 任一不通過就升 high,符合「and」語意;之後 `applyOrConfirm` 對 high 才走 diff 確認。
- 修補驗證靠 debounce 後重抓 diagnostics:預設 750ms 給 LSP 緩衝,並以 `sameSignature()` 比對代表項是否仍存在;若同檔冒出新 error 即視為 regression 並還原。
- 共用 `Provider` 介面,Factory 依 `ConfigSnapshot.provider` 切換:加新 provider 只要實作 `send(system, user, signal)`,不影響其他模組。

## 模組對應 (Module Mapping)

| 業務領域 (Domain) | 套件/模組 (Package/Module) | 進入點 (Entry Point) |
| ----------------- | -------------------------- | -------------------- |
| 診斷收集與去重 | `src/collector.ts`, `src/dedup.ts`, `src/grouper.ts` | `collectDiagnostics()`, `groupBySignature()`, `sortAndCap()` |
| 入列與節流 | `src/queue.ts`, `src/scheduler.ts`, `src/extension.ts` | `PersistentQueue.add/peek/update`, `Scheduler.canRun/markApplied`, `processOneItem()` |
| LLM 修補生成 | `src/fixer.ts`, `src/prompt.ts`, `src/providers/*` | `fixOne()`, `buildFixPrompt()`, `parseFixResponse()`, `createProvider()`, `ClaudeProvider.send()`, `OpenAIProvider.send()` |
| 風險分流與套用 | `src/risk.ts`, `src/applier.ts` | `decideRisk()`, `applyOrConfirm()`, `buildWorkspaceEdit()` |
| 修復驗證 | `src/verifier.ts`, `src/extension.ts` (`snapshotFile`/`restoreFile`) | `verifyFix()`, `processOneItem()` |
| 設定與金鑰 | `src/config.ts` | `loadConfig()`, `getApiKey()`, `setApiKey()` |
| 報告 | `src/report.ts` | `log()`, `show()`, `getReportChannel()` |

## 開發指南 (Development Guide)

### 前置需求 (Prerequisites)

- Node.js (對應 `@types/node ^20.11.0`;建議 20.x 以上)
- VSCode 1.85+ (執行 Extension Development Host)
- 對應 provider 的 API key (Claude 或 OpenAI)

### 安裝 (Installation)

```bash
npm install
```

### 建置 (Build)

```bash
npm run build    # tsc --noEmit (型別檢查) + node esbuild.config.mjs (bundle)
npm run watch    # tsc --watch --noEmit (型別即時檢查,bundle 需手動跑)
npm run typecheck # 同 watch 但單次
```

產物在 `out/src/extension.js`(單檔 bundle,含 `@anthropic-ai/sdk` 與 `openai` 內嵌)。`package.json` 的 `main` 指向此檔。

### 測試 (Test)

```bash
npm test           # vitest run (一次跑完)
npm run test:watch # vitest watch
npm run lint       # tsc --noEmit 型別檢查
```

測試檔位於 `test/**/*.test.ts`,Vitest 採 Node env;目前 14 個檔案、69 個測試,全綠。

### 部署 (Deploy)

```bash
npm run package   # vsce package,產 .vsix
```

`.vscodeignore` 排除 `test/`、`*.map`、`src/`、`docs/`、`plans/` 等不需隨 VSIX 打包的檔案;`node_modules` 的 SDK 已被 esbuild 內嵌,無需另外打包。

整合測試 (`@vscode/test-electron`) 已列為 devDependency,但目前未提供 npm script;若要加,在 `package.json` 新增 `"test:integration": "vscode-test"` 並補 `test/integration/` 與 `vscode-test.config.mjs`(後續補上)。

## 慣例 (Conventions)

- Naming:模組檔名與負責的單一概念對應 (`queue.ts` 管佇列,`risk.ts` 管風險);函式用動詞 (`collectDiagnostics`, `applyOrConfirm`);型別用名詞 (`DiagnosticInfo`, `FixProposal`)。
- TypeScript 設定:`strict: true` + `noImplicitAny` + `noUnusedLocals/Parameters` 全開,所以新寫的函式若參數未用會編譯失敗,要嘛用 `_` 前綴、要嘛移除。
- 模組切純與非純:純模組 (dedup/grouper/risk/prompt) 不 import `vscode`,可在純 Node 環境直接測試;非純模組在測試裡以 `vi.mock('vscode', ...)` 注入 mock。
- Provider 介面:`Provider.send(system, user, signal?)` 回傳 raw text;`sendForFixes()` 統一做 `parseFixResponse()`,呼叫端不直接處理 JSON。
- 持久化鍵值命名空間:全部以 `logDoctor.` 開頭並加版本後綴 (`.v1`),例如 `logDoctor.queue.v1`、`logDoctor.lastAppliedAt.v1`;改格式時新增版本鍵而非 in-place 升級。
- 風險判斷:任何低風險條件不通過都升 high (and 邏輯),不在多條件間做優先權;`decideRisk` 是唯一決策點。
- 冷卻與計數:冷卻只在 `applied === true` 後推進 (`scheduler.markApplied()`);`unresolved` 重試到 `MAX_ATTEMPTS = 3` 才升 failed,`regressed` 直接 failed 並還原檔案。
- 報告:全部進度與結果走 `report.ts` 的 Output channel `Log Doctor`,加 ISO timestamp;不在 console.log。
- SecretStorage:API key 永不寫進 `package.json` 或工作區設定,只能透過 `setApiKey` 走 `vscode.SecretStorage`。
- 測試位置:每個被測模組對應一個 `test/<name>.test.ts` (除了 `extension.ts` / `factory.ts` 被 `vitest.config.ts` 排除於 coverage);`test/providers/` 對應 `src/providers/`。
