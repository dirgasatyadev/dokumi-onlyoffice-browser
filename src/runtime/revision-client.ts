import type { EditorSessionManifest } from '../bridge/protocol'

const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

interface ErrorEnvelope { error?: { code?: string; details?: { actualRevision?: number; expectedRevision?: number }; message?: string } }

export class RevisionConflictError extends Error {
  readonly code = 'EDITOR_REVISION_CONFLICT'
  constructor(readonly actualRevision: number, readonly expectedRevision: number) {
    super('The source revision changed while this document was open')
  }
}

export class RevisionUploadError extends Error {
  constructor(readonly code: string, message: string, options?: ErrorOptions) { super(message, options) }
}

export class RevisionClient {
  readonly #apiOrigin: string
  readonly #templateId: string
  #token: string

  constructor(manifest: EditorSessionManifest, templateId: string) {
    this.#apiOrigin = new URL(manifest.apiOrigin).origin
    this.#templateId = templateId
    this.#token = manifest.token
  }

  refreshToken(token: string) { this.#token = token }

  async save(docx: ArrayBuffer, checksumSha256: string, baseRevision: number) {
    const created = await this.#json<{
      expiresAt: string
      fileId: string
      requiredHeaders: Record<string, string>
      saveSessionId: string
      uploadUrl: string
    }>(`${this.#apiOrigin}/creator/templates/${this.#templateId}/editor-save-sessions`, {
      body: JSON.stringify({ baseRevision, checksumSha256, contentLength: docx.byteLength, contentType: docxMime }),
      headers: this.#headers(), method: 'POST',
    }, baseRevision)
    let upload: Response
    try {
      upload = await fetch(created.uploadUrl, { body: docx, credentials: 'omit', headers: created.requiredHeaders, method: 'PUT' })
    } catch (cause) {
      throw new RevisionUploadError('EDITOR_NETWORK_ERROR', 'Revision upload could not reach object storage', { cause })
    }
    if (!upload.ok) throw new RevisionUploadError('EDITOR_UPLOAD_FAILED', `Revision upload failed with HTTP ${upload.status}`)
    const completed = await this.#json<{ fileId: string; savedAt: string; sourceRevision: number }>(
      `${this.#apiOrigin}/creator/editor-save-sessions/${created.saveSessionId}/complete`,
      { body: JSON.stringify({ baseRevision }), headers: this.#headers(), method: 'POST' },
      baseRevision,
    )
    return { ...completed, checksumSha256, contentLength: docx.byteLength }
  }

  #headers() { return { authorization: `Bearer ${this.#token}`, 'content-type': 'application/json' } }

  async #json<T>(url: string, init: RequestInit, expectedRevision: number): Promise<T> {
    let response: Response
    try {
      response = await fetch(url, { ...init, credentials: 'omit' })
    } catch (cause) {
      throw new RevisionUploadError('EDITOR_NETWORK_ERROR', 'Revision API is unreachable', { cause })
    }
    const payload = await response.json().catch(() => undefined) as ({ data?: T } & ErrorEnvelope) | undefined
    if (response.status === 409 && payload?.error?.code === 'EDITOR_REVISION_CONFLICT') {
      throw new RevisionConflictError(payload.error.details?.actualRevision ?? expectedRevision + 1, payload.error.details?.expectedRevision ?? expectedRevision)
    }
    if (!response.ok || !payload?.data) {
      throw new RevisionUploadError(payload?.error?.code ?? 'EDITOR_SAVE_FAILED', payload?.error?.message ?? `Revision API failed with HTTP ${response.status}`)
    }
    return payload.data
  }
}
