import './styles.css'
import { X2tClient } from './wasm/x2t-client'

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

input?.addEventListener('change', async () => {
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
