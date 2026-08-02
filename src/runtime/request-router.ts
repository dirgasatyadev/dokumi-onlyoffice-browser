import { LocalMockSocket } from './mock-socket'
import type { OnlyOfficeMessage, SavePartsEvent } from './types'

interface RequestRouterOptions {
  getImageUrl: (path: string) => Promise<string>
  onDirty: () => void
  onForceSave: () => void
  onSaveParts: (event: SavePartsEvent) => void | Promise<void>
  socket: LocalMockSocket
}

export class LocalRequestRouter {
  readonly #getImageUrl: RequestRouterOptions['getImageUrl']
  readonly #onDirty: RequestRouterOptions['onDirty']
  readonly #onForceSave: RequestRouterOptions['onForceSave']
  readonly #onSaveParts: RequestRouterOptions['onSaveParts']
  readonly #socket: LocalMockSocket
  #changesIndex = 0

  constructor(options: RequestRouterOptions) {
    this.#getImageUrl = options.getImageUrl
    this.#onDirty = options.onDirty
    this.#onForceSave = options.onForceSave
    this.#onSaveParts = options.onSaveParts
    this.#socket = options.socket
  }

  route(message: OnlyOfficeMessage) {
    void this.#route(message).catch((error) => {
      console.error('Local DocService request failed', error)
    })
  }

  async #route(message: OnlyOfficeMessage) {
    switch (message.type) {
      case 'auth':
      case 'cursor':
        return
      case 'isSaveLock':
        this.#socket.send({ saveLock: false, type: 'saveLock' })
        return
      case 'getLock':
        this.#socket.send({ locks: {}, type: 'getLock' })
        return
      case 'getMessages':
        this.#socket.send({ type: 'message' })
        return
      case 'forceSaveStart':
        this.#onForceSave()
        return
      case 'saveChanges':
        await this.#saveChanges(message)
        return
      case 'unLockDocument':
        if (message.isSave) this.#socket.send({ index: -1, time: -1, type: 'unSaveLock' })
        return
      case 'openDocument':
        await this.#openDocument(message)
        return
      default:
        // Single-participant mode intentionally ignores collaboration-only messages.
    }
  }

  async #openDocument(message: OnlyOfficeMessage) {
    if (message.message?.c !== 'imgurls' || !Array.isArray(message.message.data)) return
    const urls = await Promise.all(message.message.data.filter((path): path is string => typeof path === 'string').map(async (path) => ({
      path,
      url: await this.#getImageUrl(path),
    })))
    this.#socket.send({
      data: { data: { error: 0, urls }, status: 'ok', type: 'imgurls' },
      type: 'documentOpen',
    })
  }

  async #saveChanges(message: OnlyOfficeMessage) {
    let changes: unknown[] = []
    if (Array.isArray(message.changes)) changes = message.changes
    else if (typeof message.changes === 'string') {
      try {
        const parsed: unknown = JSON.parse(message.changes)
        if (Array.isArray(parsed)) changes = parsed
      } catch {
        changes = []
      }
    }
    const startSaveChanges = message.startSaveChanges !== false
    const endSaveChanges = message.endSaveChanges !== false
    await this.#onSaveParts({ changes, endSaveChanges, index: this.#changesIndex, startSaveChanges })
    this.#onDirty()
    if (endSaveChanges) {
      this.#changesIndex += 1
      this.#socket.send({ index: this.#changesIndex, time: Date.now(), type: 'unSaveLock' })
    } else {
      this.#socket.send({ changesIndex: -1, time: Date.now(), type: 'savePartChanges' })
    }
  }
}
