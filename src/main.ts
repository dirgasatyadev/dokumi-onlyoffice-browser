import './styles.css'
import { X2tClient } from './wasm/x2t-client'
import { EditorRuntime } from './runtime/editor-runtime'

const route = new URL(location.href)
if (route.pathname === '/editor') {
  const sessionId = route.searchParams.get('sessionId')
  const parentOrigin = route.searchParams.get('parentOrigin')
  const container = document.querySelector<HTMLElement>('main')
  if (!sessionId || !parentOrigin || !container) throw new Error('Editor route requires sessionId and parentOrigin')
  document.body.classList.add('editor-route')
  container.replaceChildren()
  const runtime = new EditorRuntime({ container, parentOrigin, sessionId })
  runtime.start()
  window.addEventListener('pagehide', () => void runtime.close(), { once: true })
}

const input = document.querySelector<HTMLInputElement>('#document')
const status = document.querySelector<HTMLOutputElement>('#status')
const client = new X2tClient()

if (new URLSearchParams(location.search).has('x2t-test')) {
  Object.assign(window, { __DokumiX2tClient: X2tClient })
}

function setStatus(message: string, state: 'ready' | 'working' | 'error' = 'ready') {
  if (!status) return
  status.value = message
  status.dataset.state = state
}

if (route.pathname !== '/editor') input?.addEventListener('change', async () => {
  const file = input.files?.[0]
  if (!file) return
  setStatus('Mengonversi DOCX ke Editor.bin…', 'working')
  try {
    const source = await file.arrayBuffer()
    const opened = await client.openDocx(source)
    const exported = await client.exportDocx(opened.editorBin, opened.media)
    setStatus(`Round-trip berhasil: ${file.size.toLocaleString('id-ID')} → ${exported.docx.byteLength.toLocaleString('id-ID')} byte.`)
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  }
})

window.addEventListener('pagehide', () => client.dispose(), { once: true })
