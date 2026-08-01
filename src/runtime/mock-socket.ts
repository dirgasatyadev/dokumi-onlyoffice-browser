import type { OnlyOfficeMessage } from './types'

export class LocalMockSocket {
  readonly #sendToEditor: (message: OnlyOfficeMessage) => void
  #closed = false

  constructor(sendToEditor: (message: OnlyOfficeMessage) => void) {
    this.#sendToEditor = sendToEditor
  }

  get closed() {
    return this.#closed
  }

  close() {
    this.#closed = true
  }

  send(message: OnlyOfficeMessage) {
    if (this.#closed) throw new Error('Local DocService socket is closed')
    this.#sendToEditor(structuredClone(message))
  }
}
