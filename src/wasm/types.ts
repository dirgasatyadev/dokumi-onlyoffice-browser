export type X2tPhase = 'initialize' | 'open-docx' | 'export-docx'

export interface X2tMediaFile {
  path: string
  data: ArrayBuffer
}

export interface X2tTimings {
  durationMs: number
  finishedAt: number
  startedAt: number
  wasmMemoryBytes: number
}

export interface X2tFailure {
  code: 'INITIALIZATION_FAILED' | 'CONVERSION_FAILED' | 'INVALID_REQUEST' | 'TIMEOUT' | 'WORKER_ERROR'
  exitCode?: number
  message: string
  phase: X2tPhase
}

export interface OpenDocxResult {
  cleanupVerified: boolean
  editorBin: ArrayBuffer
  media: X2tMediaFile[]
  timings: X2tTimings
}

export interface ExportDocxResult {
  cleanupVerified: boolean
  docx: ArrayBuffer
  timings: X2tTimings
}

export type X2tWorkerRequest =
  | { id: number; kind: 'initialize'; jsUrl: string; wasmUrl: string }
  | { id: number; kind: 'open-docx'; docx: ArrayBuffer }
  | { id: number; kind: 'export-docx'; editorBin: ArrayBuffer; media: X2tMediaFile[] }

export type X2tWorkerResponse =
  | { id: number; kind: 'ready' }
  | { id: number; kind: 'open-docx-result'; result: OpenDocxResult }
  | { id: number; kind: 'export-docx-result'; result: ExportDocxResult }
  | { id: number; kind: 'error'; error: X2tFailure }
