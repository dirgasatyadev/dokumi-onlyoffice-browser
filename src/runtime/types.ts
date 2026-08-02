import type { X2tMediaFile } from '../wasm/types'

export interface LocalParticipant {
  connectionId: string
  id: string
  idOriginal: string
  indexUser: number
  isCloseCoAuthoring: boolean
  username: string
  view: boolean
}

export interface SavePartsEvent {
  changes: unknown[]
  endSaveChanges: boolean
  index: number
  startSaveChanges: boolean
}

export interface LocalDocServiceOptions {
  editorBin: ArrayBuffer
  media: X2tMediaFile[]
  onDirty?: () => void
  onForceSave?: () => void
  onSaveParts?: (event: SavePartsEvent) => void | Promise<void>
  participant?: Partial<LocalParticipant>
}

export interface OnlyOfficeMessage {
  block?: unknown[]
  changes?: string | unknown[]
  endSaveChanges?: boolean
  message?: { c?: string; data?: unknown[] }
  startSaveChanges?: boolean
  type: string
  [key: string]: unknown
}

export interface MockServerConfiguration {
  getImageURL: (path: string) => Promise<string>
  getInitialChanges: () => unknown[]
  getParticipants: () => { index: number; list: LocalParticipant[] }
  onAuth: () => void
  onMessage: (message: OnlyOfficeMessage) => void
}

export interface OnlyOfficeEditor {
  connectMockServer(configuration: MockServerConfiguration): void
  destroyEditor(): void
  getIframe(): HTMLIFrameElement
  sendMessageToOO(message: OnlyOfficeMessage): void
}

export interface OnlyOfficeEditorConstructor {
  new (placeholderId: string, configuration: Record<string, unknown>): OnlyOfficeEditor
}
