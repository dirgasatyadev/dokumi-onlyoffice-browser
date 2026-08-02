import type {
  ExportDocxResult,
  OpenDocxResult,
  X2tFailure,
  X2tMediaFile,
  X2tWorkerRequest,
  X2tWorkerResponse,
} from './types'

interface X2tClientOptions {
  jsUrl?: string
  timeoutMs?: number
  wasmUrl?: string
  workerFactory?: () => Worker
}

interface PendingRequest {
  reject: (reason: unknown) => void
  resolve: (value: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

type X2tWorkerCommand = X2tWorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, 'id'>
    : never
  : never

export class X2tError extends Error {
  readonly code: X2tFailure['code']
  readonly exitCode?: number
  readonly phase: X2tFailure['phase']

  constructor(failure: X2tFailure) {
    super(failure.message)
    this.name = 'X2tError'
    this.code = failure.code
    this.exitCode = failure.exitCode
    this.phase = failure.phase
  }
}

export class X2tClient {
  readonly #jsUrl: string
  readonly #pending = new Map<number, PendingRequest>()
  readonly #timeoutMs: number
  readonly #wasmUrl: string
  readonly #worker: Worker
  #disposed = false
  #initialization?: Promise<void>
  #nextId = 1

  constructor(options: X2tClientOptions = {}) {
    this.#jsUrl = options.jsUrl ?? '/releases/0.1.0/x2t/x2t.js'
    // The transport revision is part of the immutable browser cache key. Bump
    // it whenever response encoding changes without changing pinned x2t bytes.
    this.#wasmUrl = options.wasmUrl ?? '/releases/0.1.0/x2t/x2t.wasm?transport=br1'
    this.#timeoutMs = options.timeoutMs ?? 120_000
    this.#worker = options.workerFactory?.() ?? new Worker(new URL('./x2t.worker.ts', import.meta.url))
    this.#worker.onmessage = ({ data }: MessageEvent<X2tWorkerResponse>) => this.#receive(data)
    this.#worker.onerror = (event) => this.#failAll({
      code: 'WORKER_ERROR',
      message: event.message || 'The x2t worker crashed',
      phase: 'initialize',
    })
  }

  initialize(): Promise<void> {
    this.#assertActive()
    this.#initialization ??= this.#send<void>({ kind: 'initialize', jsUrl: this.#jsUrl, wasmUrl: this.#wasmUrl })
      .catch((error) => {
        this.#initialization = undefined
        throw error
      })
    return this.#initialization
  }

  async openDocx(docx: ArrayBuffer): Promise<OpenDocxResult> {
    if (docx.byteLength > 50 * 1024 * 1024) {
      throw new X2tError({
        code: 'INVALID_REQUEST',
        message: 'DOCX exceeds the 50 MiB browser-editor limit',
        phase: 'open-docx',
      })
    }
    await this.initialize()
    return this.#send<OpenDocxResult>({ docx, kind: 'open-docx' }, [docx])
  }

  async exportDocx(editorBin: ArrayBuffer, media: X2tMediaFile[]): Promise<ExportDocxResult> {
    await this.initialize()
    return this.#send<ExportDocxResult>({ editorBin, kind: 'export-docx', media }, [
      editorBin,
      ...media.map((item) => item.data),
    ])
  }

  dispose() {
    if (this.#disposed) return
    this.#disposed = true
    this.#worker.terminate()
    this.#failAll({ code: 'WORKER_ERROR', message: 'x2t client was disposed', phase: 'initialize' })
  }

  #assertActive() {
    if (this.#disposed) throw new Error('x2t client has been disposed')
  }

  #failAll(failure: X2tFailure) {
    for (const { reject, timer } of this.#pending.values()) {
      clearTimeout(timer)
      reject(new X2tError(failure))
    }
    this.#pending.clear()
  }

  #receive(response: X2tWorkerResponse) {
    const pending = this.#pending.get(response.id)
    if (!pending) return
    clearTimeout(pending.timer)
    this.#pending.delete(response.id)
    if (response.kind === 'error') pending.reject(new X2tError(response.error))
    else if (response.kind === 'ready') pending.resolve(undefined)
    else pending.resolve(response.result)
  }

  #send<T>(request: X2tWorkerCommand, transfer: Transferable[] = []): Promise<T> {
    this.#assertActive()
    const id = this.#nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        const failure: X2tFailure = { code: 'TIMEOUT', message: `x2t request timed out after ${this.#timeoutMs} ms`, phase: request.kind === 'initialize' ? 'initialize' : request.kind }
        reject(new X2tError(failure))
        this.#disposed = true
        this.#worker.terminate()
        this.#failAll(failure)
      }, this.#timeoutMs)
      this.#pending.set(id, { reject, resolve: resolve as (value: unknown) => void, timer })
      this.#worker.postMessage({ ...request, id } as X2tWorkerRequest, transfer)
    })
  }
}

export type { ExportDocxResult, OpenDocxResult, X2tMediaFile } from './types'
