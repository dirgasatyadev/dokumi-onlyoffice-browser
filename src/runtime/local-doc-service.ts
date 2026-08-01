import type { X2tMediaFile } from '../wasm/types'
import { LocalMockSocket } from './mock-socket'
import { LocalRequestRouter } from './request-router'
import type { LocalDocServiceOptions, LocalParticipant, MockServerConfiguration, OnlyOfficeEditor, SavePartsEvent } from './types'

const defaultParticipant: LocalParticipant = {
  id: 'dokumi-local-user',
  idOriginal: 'dokumi-local-user',
  connectionId: 'dokumi-local-session',
  indexUser: 2,
  isCloseCoAuthoring: false,
  username: 'Dokumi User',
  view: false,
}

const historyParticipant: LocalParticipant = {
  connectionId: 'dokumi-local-history',
  id: 'dokumi-history',
  idOriginal: 'dokumi-history',
  indexUser: 1,
  isCloseCoAuthoring: false,
  username: 'History',
  view: false,
}

function safeMediaPath(path: string) {
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '').replace(/^media\//, '')
  if (!normalized || normalized.includes('..') || normalized.split('/').some((part) => !part)) throw new Error(`Unsafe media path: ${path}`)
  return normalized
}

const inlineImagePattern = /^data:image\/(?:gif|jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/iu

export class LocalDocService extends EventTarget {
  readonly #editorBin: ArrayBuffer
  readonly #media = new Map<string, { data: ArrayBuffer; objectUrl: string }>()
  readonly #onForceSave: () => void
  readonly #onSaveParts: (event: SavePartsEvent) => void | Promise<void>
  readonly #participant: LocalParticipant
  #editor?: OnlyOfficeEditor
  #router?: LocalRequestRouter
  #socket?: LocalMockSocket

  constructor(options: LocalDocServiceOptions) {
    super()
    this.#editorBin = options.editorBin
    this.#onForceSave = options.onForceSave ?? (() => this.dispatchEvent(new Event('forcesave')))
    this.#onSaveParts = options.onSaveParts ?? (() => undefined)
    this.#participant = { ...defaultParticipant, ...options.participant }
    for (const item of options.media) this.#setMedia(item)
    if (options.onDirty) this.addEventListener('dirty', options.onDirty)
  }

  connect(editor: OnlyOfficeEditor): MockServerConfiguration {
    if (this.#editor) throw new Error('Local DocService is already connected')
    this.#editor = editor
    this.#socket = new LocalMockSocket((message) => editor.sendMessageToOO(message))
    this.#router = new LocalRequestRouter({
      getImageUrl: (path) => this.getImageUrl(path),
      onDirty: () => this.dispatchEvent(new Event('dirty')),
      onForceSave: this.#onForceSave,
      onSaveParts: this.#onSaveParts,
      socket: this.#socket,
    })
    const configuration: MockServerConfiguration = {
      getImageURL: (path) => this.getImageUrl(path),
      getInitialChanges: () => [],
      // SDKJS expects the Document Server participant wire shape (not the
      // public editorConfig.user shape). A stable history participant keeps
      // single-user coauthoring state consistent with the local wrapper.
      getParticipants: () => ({
        index: this.#participant.indexUser,
        list: [{ ...historyParticipant }, { ...this.#participant }],
      }),
      onAuth: () => this.dispatchEvent(new Event('authenticated')),
      onMessage: (message) => this.#router?.route(message),
    }
    editor.connectMockServer(configuration)
    return configuration
  }

  disconnect() {
    this.#socket?.close()
    this.#socket = undefined
    this.#router = undefined
    this.#editor = undefined
    for (const item of this.#media.values()) URL.revokeObjectURL(item.objectUrl)
    this.#media.clear()
  }

  getEditorBinUrl() {
    return URL.createObjectURL(new Blob([this.#editorBin], { type: 'application/octet-stream' }))
  }

  async getImageUrl(path: string) {
    // SDKJS uses small built-in data-URI placeholders while opening a Word
    // document. Returning those verbatim completes its image-load barrier;
    // document media still goes through the traversal-safe VFS lookup.
    if (path.length <= 2 * 1024 * 1024 && inlineImagePattern.test(path)) return path
    try {
      return this.#media.get(safeMediaPath(path))?.objectUrl ?? ''
    } catch {
      return ''
    }
  }

  listMedia(): X2tMediaFile[] {
    return [...this.#media.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([path, item]) => ({
      data: item.data.slice(0),
      path,
    }))
  }

  uploadMedia(path: string, data: ArrayBuffer, type = 'application/octet-stream') {
    const normalized = safeMediaPath(path)
    const previous = this.#media.get(normalized)
    if (previous) URL.revokeObjectURL(previous.objectUrl)
    const item = { data: data.slice(0), objectUrl: URL.createObjectURL(new Blob([data], { type })) }
    this.#media.set(normalized, item)
    this.dispatchEvent(new CustomEvent('media', { detail: { path: normalized } }))
    return item.objectUrl
  }

  #setMedia(item: X2tMediaFile) {
    this.uploadMedia(item.path, item.data)
  }
}
