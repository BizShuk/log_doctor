# Log Doctor

VSCode / Antigravity 擴充功能:手動命令掃描工作區 diagnostics,經 LLM 修復,低風險自動套用、高風險顯示 diff 由使用者確認。

## 使用

1. 安裝相依套件並 build:
   ```bash
   npm install
   npm run build
   ```
2. 在 VSCode 中按 F5 開 Extension Development Host。
3. 在 Extension Development Host 設定 API key (建議綁定為 SecretStorage):
   - 設定 `logDoctor.provider` 為 `claude` 或 `openai`
   - 設定 `logDoctor.model` 為你想用的模型 ID (預設 `claude-sonnet-4-6`)
   - 透過命令面板 (或測試) 把 key 寫入 SecretStorage:
     ```
     logDoctor.apiKey.claude  = sk-ant-...
     logDoctor.apiKey.openai  = sk-...
     ```
4. 觸發命令面板 → "Log Doctor: Fix Workspace Issues"。

## 設定

| 設定 | 預設 | 說明 |
|------|------|------|
| `logDoctor.provider` | `claude` | `claude` 或 `openai` |
| `logDoctor.model` | `claude-sonnet-4-6` | 模型 ID |
| `logDoctor.autoApplySources` | `["eslint","prettier","ruff","gofmt","stylelint"]` | 低風險來源 |
| `logDoctor.autoApplyMaxLines` | `3` | 自動套用最大淨新增行數 |
| `logDoctor.maxIssues` | `50` | 單次入列上限 |
| `logDoctor.cooldownMinutes` | `30` | 兩次實際套用間最短間隔 (分鐘) |

## 測試

```bash
npm test
```

整合測試需先 `npm run build` 再以 `@vscode/test-electron` 跑(後續補上)。

## 範圍

僅處理 `vscode.languages.getDiagnostics()` 取得的 diagnostics;task 純文字輸出不在 MVP 範圍內。
