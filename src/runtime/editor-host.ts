import { LocalDocService } from './local-doc-service'
import type { OnlyOfficeEditor, OnlyOfficeEditorConstructor } from './types'

declare global {
  interface Window {
    APP?: { getImageURL?: (path: string, callback: (url: string) => void) => void }
    DocsAPI?: { DocEditor: OnlyOfficeEditorConstructor }
  }
}

interface EditorHostOptions {
  apiUrl?: string
  container: HTMLElement
  docService: LocalDocService
  fileName: string
  language?: string
}

let apiPromise: Promise<void> | undefined

function loadEditorApi(url: string) {
  if (window.DocsAPI?.DocEditor) return Promise.resolve()
  apiPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error(`Unable to load ONLYOFFICE API from ${url}`)), { once: true })
    document.head.append(script)
  }).catch((error) => {
    apiPromise = undefined
    throw error
  })
  return apiPromise
}

export class EditorHost extends EventTarget {
  readonly #options: EditorHostOptions
  #editor?: OnlyOfficeEditor
  #editorBinUrl?: string
  #placeholder?: HTMLElement

  constructor(options: EditorHostOptions) {
    super()
    this.#options = options
  }

  async open() {
    if (this.#editor) throw new Error('Editor is already open')
    const apiUrl = this.#options.apiUrl ?? '/releases/0.1.0/onlyoffice/web-apps/apps/api/documents/api.js'
    await loadEditorApi(apiUrl)
    // The public local-runtime wrapper deliberately delegates media lookup to
    // this host object. The stock Document Server normally creates it.
    window.APP ??= {}
    const placeholder = document.createElement('div')
    placeholder.id = `dokumi-editor-${crypto.randomUUID()}`
    placeholder.style.width = '100%'
    placeholder.style.height = '100%'
    const sourceLink = document.createElement('a')
    sourceLink.className = 'dokumi-source-link'
    sourceLink.href = 'https://github.com/cryptpad/onlyoffice-editor/tree/fc09b218064061b6deaea206c068b34e5a20bd39'
    sourceLink.rel = 'noopener noreferrer'
    sourceLink.target = '_blank'
    sourceLink.textContent = 'ONLYOFFICE source · AGPLv3'
    this.#options.container.replaceChildren(placeholder, sourceLink)
    this.#placeholder = placeholder
    this.#editorBinUrl = this.#options.docService.getEditorBinUrl()
    const ready = new Promise<void>((resolve, reject) => {
      let connected = false
      const configuration = {
        document: {
          fileType: 'docx',
          key: crypto.randomUUID(),
          permissions: { chat: false, download: true, edit: true, print: true },
          title: this.#options.fileName,
          url: this.#editorBinUrl,
        },
        documentType: 'word',
        editorConfig: {
          customization: {
            chat: false,
            comments: false,
            help: true,
            macros: false,
            plugins: false,
          },
          // The upstream Indonesian catalog is currently missing SDKJS form
          // placeholder keys; English is the complete, deterministic fallback.
          lang: this.#options.language ?? 'en',
          mode: 'edit',
          user: { id: 'dokumi-local-user', name: 'Dokumi User' },
        },
        events: {
          onAppReady: () => {
            if (!this.#editor || connected) return
            connected = true
            try {
              this.#options.docService.connect(this.#editor)
              this.dispatchEvent(new Event('ready'))
            } catch (error) {
              reject(error)
            }
          },
          onDocumentReady: () => {
            this.dispatchEvent(new Event('opened'))
            resolve()
          },
          onError: (event: unknown) => reject(new Error(`ONLYOFFICE editor error: ${JSON.stringify(event)}`)),
        },
        height: '100%',
        type: 'desktop',
        width: '100%',
      }
      this.#editor = new window.DocsAPI!.DocEditor(placeholder.id, configuration)
    })
    await ready
  }

  captureEditorBin() {
    const frameWindow = this.#editor?.getIframe().contentWindow as (Window & {
      editor?: { asc_nativeGetFile(): ArrayBuffer | ArrayBufferView | string }
    }) | null
    const data = frameWindow?.editor?.asc_nativeGetFile()
    if (!data) throw new Error('ONLYOFFICE native document state is not available')
    if (typeof data === 'string') {
      const bytes = new Uint8Array(data.length)
      for (let index = 0; index < data.length; index += 1) bytes[index] = data.charCodeAt(index) & 0xff
      return bytes.buffer
    }
    // `instanceof ArrayBuffer` is false across the editor iframe realm.
    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice().buffer
    }
    return new Uint8Array(data).slice().buffer
  }

  close() {
    this.#options.docService.disconnect()
    this.#editor?.destroyEditor()
    this.#editor = undefined
    this.#placeholder?.remove()
    this.#placeholder = undefined
    this.#options.container.querySelector('.dokumi-source-link')?.remove()
    if (this.#editorBinUrl) URL.revokeObjectURL(this.#editorBinUrl)
    this.#editorBinUrl = undefined
  }
}
