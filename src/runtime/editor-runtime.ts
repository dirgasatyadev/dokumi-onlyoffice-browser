import { RuntimeEditorChannel } from '../bridge/runtime-channel'
import type { EditorSessionManifest, ParentMessage } from '../bridge/protocol'
import { downloadLocalCopy, RecoveryStore, type RecoveryIdentity, type RecoverySnapshot } from '../storage/recovery'
import { X2tClient } from '../wasm/x2t-client'
import type { X2tMediaFile } from '../wasm/types'
import { EditorHost } from './editor-host'
import { LocalDocService } from './local-doc-service'

const engineVersion = '0.1.0+onlyoffice-9.3.0.140+x2t-9.3.0'
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

interface ActiveSession extends RecoveryIdentity {
  manifest: EditorSessionManifest
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

async function sha256(data: ArrayBuffer) {
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
}

function copyMedia(media: X2tMediaFile[]) {
  return media.map((item) => ({ data: item.data.slice(0), path: item.path }))
}

export class EditorRuntime {
  readonly #channel: RuntimeEditorChannel
  readonly #container: HTMLElement
  readonly #recovery = new RecoveryStore()
  readonly #x2t = new X2tClient({ timeoutMs: 240_000 })
  #dirty = false
  #docService?: LocalDocService
  #host?: EditorHost
  #idleSave?: ReturnType<typeof setTimeout>
  #maxSave?: ReturnType<typeof setTimeout>
  #saving?: Promise<ArrayBuffer>
  #session?: ActiveSession

  constructor(options: { container: HTMLElement; parentOrigin: string; parentWindow?: Window; sessionId: string }) {
    this.#container = options.container
    this.#channel = new RuntimeEditorChannel({
      additionalOrigins: new Set([options.parentOrigin]),
      parentOrigin: options.parentOrigin,
      parentWindow: options.parentWindow,
      sessionId: options.sessionId,
    })
    this.#channel.addEventListener('message', (event) => this.#onMessage((event as CustomEvent<ParentMessage>).detail))
  }

  start() {
    this.#channel.send('DOKUMI_EDITOR_READY', { engineVersion, sourceUrl: 'https://github.com/dirgasatyadev/dokumi-onlyoffice-browser' })
  }

  async close() {
    clearTimeout(this.#idleSave)
    clearTimeout(this.#maxSave)
    this.#host?.close()
    this.#host = undefined
    this.#docService = undefined
    this.#x2t.dispose()
    this.#channel.close()
  }

  async #initialize(message: Extract<ParentMessage, { type: 'DOKUMI_EDITOR_INIT' }>) {
    if (this.#session) throw new Error('Editor session is already initialized')
    const { manifest, templateId, userId } = message.payload
    if (manifest.editorOrigin !== location.origin || new URL(manifest.editorUrl).origin !== location.origin) {
      throw new Error('Editor manifest origin does not match this runtime')
    }
    this.#session = { manifest, sessionId: message.sessionId, templateId, userId }
    this.#channel.send('DOKUMI_EDITOR_LOADING', { stage: 'recovery' }, message.requestId)
    await this.#recovery.cleanup()
    const recovered = await this.#recovery.load(this.#session)
    let editorBin: ArrayBuffer
    let media: X2tMediaFile[]
    let usedRecovery = false
    if (recovered && recovered.sourceChecksumSha256 === manifest.document.checksumSha256 && recovered.baseRevision === manifest.document.sourceRevision) {
      editorBin = recovered.editorBin
      media = recovered.media
      usedRecovery = true
    } else {
      this.#channel.send('DOKUMI_EDITOR_LOADING', { stage: 'download' }, message.requestId)
      const response = await fetch(manifest.document.downloadUrl, { credentials: 'omit' })
      if (!response.ok) throw new Error(`Source download failed: HTTP ${response.status}`)
      const docx = await response.arrayBuffer()
      if (docx.byteLength !== manifest.document.contentLength || docx.byteLength > 50 * 1024 * 1024) throw new Error('Source document length is invalid')
      if (await sha256(docx) !== manifest.document.checksumSha256) throw new Error('Source document checksum mismatch')
      this.#channel.send('DOKUMI_EDITOR_LOADING', { stage: 'convert' }, message.requestId)
      const opened = await this.#x2t.openDocx(docx)
      editorBin = opened.editorBin
      media = opened.media
    }
    this.#channel.send('DOKUMI_EDITOR_LOADING', { stage: 'editor' }, message.requestId)
    this.#docService = new LocalDocService({
      editorBin,
      media,
      onDirty: () => this.#markDirty(),
      onForceSave: () => void this.#save(false),
      onSaveParts: () => undefined,
    })
    this.#host = new EditorHost({ container: this.#container, docService: this.#docService, fileName: manifest.document.fileName })
    await this.#host.open()
    this.#channel.send('DOKUMI_EDITOR_OPENED', { baseRevision: manifest.document.sourceRevision, recovered: usedRecovery }, message.requestId)
  }

  #markDirty() {
    if (!this.#session) return
    this.#dirty = true
    this.#channel.send('DOKUMI_EDITOR_DIRTY', {})
    clearTimeout(this.#idleSave)
    this.#idleSave = setTimeout(() => void this.#save(false), 15_000)
    this.#maxSave ??= setTimeout(() => void this.#save(false), 60_000)
  }

  #onMessage(message: ParentMessage) {
    void (async () => {
      try {
        switch (message.type) {
          case 'DOKUMI_EDITOR_INIT':
            await this.#initialize(message)
            break
          case 'DOKUMI_EDITOR_REFRESH_TOKEN':
            if (this.#session) this.#session.manifest = { ...this.#session.manifest, expiresAt: message.payload.expiresAt, token: message.payload.token }
            break
          case 'DOKUMI_EDITOR_SAVE_NOW':
            await this.#save(false, message.requestId)
            break
          case 'DOKUMI_EDITOR_DOWNLOAD_LOCAL':
            downloadLocalCopy(await this.#save(true, message.requestId), this.#session?.manifest.document.fileName ?? 'dokumi-recovery.docx')
            break
          case 'DOKUMI_EDITOR_CLOSE':
            if (message.payload.force) await this.close()
            else this.#channel.send('DOKUMI_EDITOR_CLOSE_ALLOWED', { dirty: this.#dirty }, message.requestId)
            break
        }
      } catch (error) {
        this.#channel.send('DOKUMI_EDITOR_ERROR', {
          code: error instanceof Error && error.name === 'RecoveryQuotaError' ? 'RECOVERY_QUOTA_EXCEEDED' : 'RUNTIME_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: Boolean(this.#session),
        }, message.requestId)
      }
    })()
  }

  #save(downloadOnly: boolean, requestId?: string) {
    if (this.#saving) return this.#saving
    this.#saving = this.#performSave(downloadOnly, requestId).finally(() => {
      this.#saving = undefined
    })
    return this.#saving
  }

  async #performSave(downloadOnly: boolean, requestId?: string) {
    if (!this.#session || !this.#host || !this.#docService) throw new Error('Editor session is not open')
    this.#channel.send('DOKUMI_EDITOR_SAVING', { local: true }, requestId)
    const editorBin = this.#host.captureEditorBin()
    const media = this.#docService.listMedia()
    const recoveryBin = editorBin.slice(0)
    const recoveryMedia = copyMedia(media)
    const snapshot: RecoverySnapshot = {
      baseRevision: this.#session.manifest.document.sourceRevision,
      editorBin: recoveryBin,
      engineVersion,
      media: recoveryMedia,
      pendingUpload: true,
      sessionId: this.#session.sessionId,
      sourceChecksumSha256: this.#session.manifest.document.checksumSha256,
      synced: false,
      templateId: this.#session.templateId,
      updatedAt: Date.now(),
      userId: this.#session.userId,
    }
    await this.#recovery.save(snapshot)
    const exported = await this.#x2t.exportDocx(editorBin, media)
    const checksumSha256 = await sha256(exported.docx)
    await this.#recovery.save({ ...snapshot, docx: exported.docx.slice(0), updatedAt: Date.now() })
    clearTimeout(this.#idleSave)
    clearTimeout(this.#maxSave)
    this.#idleSave = undefined
    this.#maxSave = undefined
    this.#dirty = false
    if (!downloadOnly) this.#channel.send('DOKUMI_EDITOR_SAVED', { checksumSha256, sourceRevision: snapshot.baseRevision }, requestId)
    return exported.docx
  }
}
