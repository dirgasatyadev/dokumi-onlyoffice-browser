import { ParentEditorChannel } from '../../src/bridge/parent-channel'
import type { EditorSessionManifest, RuntimeMessage } from '../../src/bridge/protocol'
import { RecoveryStore } from '../../src/storage/recovery'

const sessionId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'
const templateId = '33333333-3333-4333-8333-333333333333'
const iframe = document.querySelector<HTMLIFrameElement>('#runtime')!
const state = document.querySelector<HTMLOutputElement>('#state')!
iframe.src = `/editor?sessionId=${sessionId}&parentOrigin=${encodeURIComponent(location.origin)}`
const channel = new ParentEditorChannel({ iframeWindow: iframe.contentWindow!, runtimeOrigin: location.origin, sessionId })
const messages: RuntimeMessage[] = []
channel.addEventListener('message', (event) => {
  const message = (event as CustomEvent<RuntimeMessage>).detail
  messages.push(message)
  state.value = message.type
  state.dataset.type = message.type
})

const harness = {
  close: (force = false) => channel.send('DOKUMI_EDITOR_CLOSE', { force }),
  download: () => channel.send('DOKUMI_EDITOR_DOWNLOAD_LOCAL', {}),
  initialize: (manifest: EditorSessionManifest) => channel.send('DOKUMI_EDITOR_INIT', { manifest, templateId, userId }),
  loadRecovery: () => new RecoveryStore().load({ sessionId, templateId, userId }),
  messages,
  save: () => channel.send('DOKUMI_EDITOR_SAVE_NOW', {}),
  sessionId,
  templateId,
  userId,
}

Object.assign(window, { __dokumiParentHarness: harness })

declare global {
  interface Window {
    __dokumiParentHarness: typeof harness
  }
}
