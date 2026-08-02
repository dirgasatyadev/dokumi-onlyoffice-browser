import { allowedParentOrigin } from './origin-policy'
import { createBridgeMessage, isParentMessage, type ParentMessage, type RuntimeMessage, type RuntimeMessageType } from './protocol'

export class RuntimeEditorChannel extends EventTarget {
  readonly #parentOrigin: string
  readonly #parentWindow: Window
  readonly #sessionId: string
  readonly #receive = (event: MessageEvent) => {
    if (event.origin !== this.#parentOrigin || event.source !== this.#parentWindow || !isParentMessage(event.data) || event.data.sessionId !== this.#sessionId) return
    this.dispatchEvent(new CustomEvent<ParentMessage>('message', { detail: event.data }))
    this.dispatchEvent(new CustomEvent<ParentMessage>(event.data.type, { detail: event.data }))
  }

  constructor(options: { additionalOrigins?: ReadonlySet<string>; parentOrigin: string; parentWindow?: Window; sessionId: string }) {
    super()
    this.#parentOrigin = allowedParentOrigin(options.parentOrigin, options.additionalOrigins)
    this.#parentWindow = options.parentWindow ?? window.parent
    this.#sessionId = options.sessionId
    window.addEventListener('message', this.#receive)
  }

  send<Type extends RuntimeMessageType>(type: Type, payload: Extract<RuntimeMessage, { type: Type }>['payload'], requestId?: string) {
    const message = createBridgeMessage(this.#sessionId, type, payload, requestId) as RuntimeMessage
    this.#parentWindow.postMessage(message, this.#parentOrigin)
    return message.requestId
  }

  close() {
    window.removeEventListener('message', this.#receive)
  }
}
