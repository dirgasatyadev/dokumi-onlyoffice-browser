import { createBridgeMessage, isRuntimeMessage, type ParentMessage, type ParentMessageType, type RuntimeMessage } from './protocol'
import { exactOrigin } from './origin-policy'

export class ParentEditorChannel extends EventTarget {
  readonly #iframeWindow: Window
  readonly #runtimeOrigin: string
  readonly #sessionId: string
  readonly #receive = (event: MessageEvent) => {
    if (event.origin !== this.#runtimeOrigin || event.source !== this.#iframeWindow || !isRuntimeMessage(event.data) || event.data.sessionId !== this.#sessionId) return
    this.dispatchEvent(new CustomEvent<RuntimeMessage>('message', { detail: event.data }))
    this.dispatchEvent(new CustomEvent<RuntimeMessage>(event.data.type, { detail: event.data }))
  }

  constructor(options: { iframeWindow: Window; runtimeOrigin: string; sessionId: string }) {
    super()
    this.#iframeWindow = options.iframeWindow
    this.#runtimeOrigin = exactOrigin(options.runtimeOrigin)
    this.#sessionId = options.sessionId
    window.addEventListener('message', this.#receive)
  }

  send<Type extends ParentMessageType>(type: Type, payload: Extract<ParentMessage, { type: Type }>['payload']) {
    const message = createBridgeMessage(this.#sessionId, type, payload) as ParentMessage
    if (!['DOKUMI_EDITOR_INIT', 'DOKUMI_EDITOR_REFRESH_TOKEN', 'DOKUMI_EDITOR_SAVE_NOW', 'DOKUMI_EDITOR_CLOSE', 'DOKUMI_EDITOR_DOWNLOAD_LOCAL'].includes(message.type)) {
      throw new Error(`Unsupported parent message: ${message.type}`)
    }
    this.#iframeWindow.postMessage(message, this.#runtimeOrigin)
    return message.requestId
  }

  close() {
    window.removeEventListener('message', this.#receive)
  }
}
