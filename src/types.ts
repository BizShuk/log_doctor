// src/types.ts — 集中所有跨模組型別。

export type Severity = 'error' | 'warning' | 'info' | 'hint';

export type RiskLevel = 'low' | 'high';

export type ProviderName = 'claude' | 'openai';

export interface DiagnosticPosition {
  line: number;       // 0-based
  character: number;  // 0-based
}

export interface DiagnosticRange {
  start: DiagnosticPosition;
  end: DiagnosticPosition;
}

export interface DiagnosticInfo {
  uri: string;                        // 絕對檔案路徑 (file:// or on-disk path)
  source: string;                     // 例: "eslint", "tsc"
  code?: string | number;
  message: string;
  severity: Severity;
  range: DiagnosticRange;
  /** 原始 vscode.Diagnostic,需要 raw 欄位時使用;測試可塞 mock。 */
  raw?: unknown;
}

export interface RepresentativeDiagnostic {
  info: DiagnosticInfo;     // 代表項
  groupSize: number;        // 重複總數 (含代表項)
  groupUris: string[];      // 同組其他 uri
}

export interface FixProposal {
  uri: string;              // 目標檔案
  oldText: string;          // 必須在檔案內精確出現
  newText: string;          // 替換內容
  rationale?: string;       // LLM 給的理由
}

export type QueueItemStatus =
  | 'pending'
  | 'in_flight'
  | 'awaiting_confirmation'
  | 'failed'
  | 'resolved';

export interface QueueItem {
  id: string;                                  // uuid 或 hash(rep info)
  diagnostic: RepresentativeDiagnostic;
  priority: number;                            // 0 = 最高
  attempts: number;
  status: QueueItemStatus;
  riskLevel?: RiskLevel;
  lastError?: string;
  createdAt: number;                           // epoch ms
  updatedAt: number;                           // epoch ms
}

export interface ConfigSnapshot {
  provider: ProviderName;
  model: string;
  autoApplySources: string[];
  autoApplyMaxLines: number;
  maxIssues: number;
  cooldownMinutes: number;
}
