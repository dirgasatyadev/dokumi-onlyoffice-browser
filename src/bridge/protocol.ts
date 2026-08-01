export const editorProtocolVersion = 1 as const

export const parentMessageTypes = [
  'DOKUMI_EDITOR_INIT',
  'DOKUMI_EDITOR_REFRESH_TOKEN',
  'DOKUMI_EDITOR_SAVE_NOW',
  'DOKUMI_EDITOR_CLOSE',
  'DOKUMI_EDITOR_DOWNLOAD_LOCAL',
] as const

export const runtimeMessageTypes = [
  'DOKUMI_EDITOR_READY',
  'DOKUMI_EDITOR_LOADING',
  'DOKUMI_EDITOR_OPENED',
  'DOKUMI_EDITOR_DIRTY',
  'DOKUMI_EDITOR_SAVING',
  'DOKUMI_EDITOR_SAVED',
  'DOKUMI_EDITOR_CONFLICT',
  'DOKUMI_EDITOR_ERROR',
  'DOKUMI_EDITOR_CLOSE_ALLOWED',
] as const

export type ParentMessageType = typeof parentMessageTypes[number]
export type RuntimeMessageType = typeof runtimeMessageTypes[number]

export interface EditorDocumentManifest {
  checksumSha256: string
  contentLength: number
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  downloadUrl: string
  fileId: string
  fileName: string
  sourceRevision: number
}

export interface EditorSessionManifest {
  document: EditorDocumentManifest
  editorOrigin: string
  editorUrl: string
  expiresAt: string
  sessionId: string
  token: string
}

export interface EditorBridgeMessage<Type extends string = string, Payload = unknown> {
  payload: Payload
  protocolVersion: typeof editorProtocolVersion
  requestId: string
  sessionId: string
  type: Type
}

export type ParentMessage =
  | EditorBridgeMessage<'DOKUMI_EDITOR_INIT', { manifest: EditorSessionManifest; templateId: string; userId: string }>
  | EditorBridgeMessage<'DOKUMI_EDITOR_REFRESH_TOKEN', { expiresAt: string; token: string }>
  | EditorBridgeMessage<'DOKUMI_EDITOR_SAVE_NOW', Record<string, never>>
  | EditorBridgeMessage<'DOKUMI_EDITOR_CLOSE', { force?: boolean }>
  | EditorBridgeMessage<'DOKUMI_EDITOR_DOWNLOAD_LOCAL', Record<string, never>>

export type RuntimeMessage =
  | EditorBridgeMessage<'DOKUMI_EDITOR_READY', { engineVersion: string; sourceUrl: string }>
  | EditorBridgeMessage<'DOKUMI_EDITOR_LOADING', { stage: 'download' | 'convert' | 'editor' | 'recovery' }>
  | EditorBridgeMessage<'DOKUMI_EDITOR_OPENED', { baseRevision: number; recovered: boolean }>
  | EditorBridgeMessage<'DOKUMI_EDITOR_DIRTY', Record<string, never>>
  | EditorBridgeMessage<'DOKUMI_EDITOR_SAVING', { local: boolean }>
  | EditorBridgeMessage<'DOKUMI_EDITOR_SAVED', { checksumSha256: string; sourceRevision: number }>
  | EditorBridgeMessage<'DOKUMI_EDITOR_CONFLICT', { actualRevision: number; expectedRevision: number }>
  | EditorBridgeMessage<'DOKUMI_EDITOR_ERROR', { code: string; message: string; recoverable: boolean }>
  | EditorBridgeMessage<'DOKUMI_EDITOR_CLOSE_ALLOWED', { dirty: boolean }>

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const sha256Base64Pattern = /^[A-Za-z0-9+/]{43}=$/u

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function envelope(value: unknown): value is EditorBridgeMessage {
  return record(value) && exactKeys(value, ['payload', 'protocolVersion', 'requestId', 'sessionId', 'type']) &&
    value.protocolVersion === editorProtocolVersion && typeof value.type === 'string' && uuidPattern.test(String(value.requestId)) && uuidPattern.test(String(value.sessionId)) && record(value.payload)
}

function emptyPayload(payload: Record<string, unknown>) {
  return exactKeys(payload, [])
}

function validManifest(value: unknown): value is EditorSessionManifest {
  if (!record(value) || !exactKeys(value, ['document', 'editorOrigin', 'editorUrl', 'expiresAt', 'sessionId', 'token']) || !record(value.document)) return false
  const document = value.document
  if (!exactKeys(document, ['checksumSha256', 'contentLength', 'contentType', 'downloadUrl', 'fileId', 'fileName', 'sourceRevision'])) return false
  try {
    const editorOrigin = new URL(String(value.editorOrigin))
    const editorUrl = new URL(String(value.editorUrl))
    const downloadUrl = new URL(String(document.downloadUrl))
    return editorOrigin.origin === value.editorOrigin && editorUrl.origin === editorOrigin.origin && downloadUrl.protocol === 'https:' &&
      uuidPattern.test(String(value.sessionId)) && uuidPattern.test(String(document.fileId)) && typeof value.token === 'string' && value.token.length > 0 &&
      Date.parse(String(value.expiresAt)) > Date.now() && document.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      typeof document.fileName === 'string' && document.fileName.toLowerCase().endsWith('.docx') && Number.isSafeInteger(document.contentLength) && Number(document.contentLength) > 0 && Number(document.contentLength) <= 50 * 1024 * 1024 &&
      Number.isSafeInteger(document.sourceRevision) && Number(document.sourceRevision) >= 0 && sha256Base64Pattern.test(String(document.checksumSha256))
  } catch {
    return false
  }
}

export function isParentMessage(value: unknown): value is ParentMessage {
  if (!envelope(value) || !parentMessageTypes.includes(value.type as ParentMessageType) || !record(value.payload)) return false
  const payload = value.payload
  switch (value.type) {
    case 'DOKUMI_EDITOR_INIT':
      return exactKeys(payload, ['manifest', 'templateId', 'userId']) && validManifest(payload.manifest) &&
        (payload.manifest as EditorSessionManifest).sessionId === value.sessionId && uuidPattern.test(String(payload.templateId)) && uuidPattern.test(String(payload.userId))
    case 'DOKUMI_EDITOR_REFRESH_TOKEN':
      return exactKeys(payload, ['expiresAt', 'token']) && typeof payload.token === 'string' && payload.token.length > 0 && Date.parse(String(payload.expiresAt)) > Date.now()
    case 'DOKUMI_EDITOR_SAVE_NOW':
    case 'DOKUMI_EDITOR_DOWNLOAD_LOCAL':
      return emptyPayload(payload)
    case 'DOKUMI_EDITOR_CLOSE':
      return exactKeys(payload, Object.hasOwn(payload, 'force') ? ['force'] : []) && (payload.force === undefined || typeof payload.force === 'boolean')
    default:
      return false
  }
}

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!envelope(value) || !runtimeMessageTypes.includes(value.type as RuntimeMessageType) || !record(value.payload)) return false
  const payload = value.payload
  switch (value.type) {
    case 'DOKUMI_EDITOR_READY':
      return exactKeys(payload, ['engineVersion', 'sourceUrl']) && typeof payload.engineVersion === 'string' && typeof payload.sourceUrl === 'string'
    case 'DOKUMI_EDITOR_LOADING':
      return exactKeys(payload, ['stage']) && ['download', 'convert', 'editor', 'recovery'].includes(String(payload.stage))
    case 'DOKUMI_EDITOR_OPENED':
      return exactKeys(payload, ['baseRevision', 'recovered']) && Number.isSafeInteger(payload.baseRevision) && typeof payload.recovered === 'boolean'
    case 'DOKUMI_EDITOR_DIRTY':
      return emptyPayload(payload)
    case 'DOKUMI_EDITOR_SAVING':
      return exactKeys(payload, ['local']) && typeof payload.local === 'boolean'
    case 'DOKUMI_EDITOR_SAVED':
      return exactKeys(payload, ['checksumSha256', 'sourceRevision']) && typeof payload.checksumSha256 === 'string' && Number.isSafeInteger(payload.sourceRevision)
    case 'DOKUMI_EDITOR_CONFLICT':
      return exactKeys(payload, ['actualRevision', 'expectedRevision']) && Number.isSafeInteger(payload.actualRevision) && Number.isSafeInteger(payload.expectedRevision)
    case 'DOKUMI_EDITOR_ERROR':
      return exactKeys(payload, ['code', 'message', 'recoverable']) && typeof payload.code === 'string' && typeof payload.message === 'string' && typeof payload.recoverable === 'boolean'
    case 'DOKUMI_EDITOR_CLOSE_ALLOWED':
      return exactKeys(payload, ['dirty']) && typeof payload.dirty === 'boolean'
    default:
      return false
  }
}

export function createBridgeMessage<Type extends string, Payload>(sessionId: string, type: Type, payload: Payload, requestId: string = crypto.randomUUID()): EditorBridgeMessage<Type, Payload> {
  return { payload, protocolVersion: editorProtocolVersion, requestId, sessionId, type }
}
