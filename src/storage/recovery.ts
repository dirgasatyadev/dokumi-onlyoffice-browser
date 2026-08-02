import type { X2tMediaFile } from '../wasm/types'
import { openRecoveryDatabase, recoveryStoreName, requestResult, transactionComplete } from './indexeddb'

export interface RecoveryIdentity {
  sessionId: string
  templateId: string
  userId: string
}

export interface RecoverySnapshot extends RecoveryIdentity {
  baseRevision: number
  docx?: ArrayBuffer
  editorBin: ArrayBuffer
  engineVersion: string
  media: X2tMediaFile[]
  pendingUpload: boolean
  sourceChecksumSha256: string
  synced: boolean
  updatedAt: number
}

interface StoredRecoverySnapshot extends RecoverySnapshot {
  key: string
}

export class RecoveryQuotaError extends Error {
  readonly code = 'RECOVERY_QUOTA_EXCEEDED'

  constructor(options?: ErrorOptions) {
    super('Browser storage quota is insufficient for local document recovery', options)
    this.name = 'RecoveryQuotaError'
  }
}

function identityPart(value: string, name: string) {
  if (!value || value.includes(':')) throw new Error(`${name} must be non-empty and cannot contain ':'`)
  return value
}

export function recoveryKey(identity: RecoveryIdentity) {
  return `dokumi-office:${identityPart(identity.userId, 'userId')}:${identityPart(identity.templateId, 'templateId')}:${identityPart(identity.sessionId, 'sessionId')}`
}

function quotaError(error: unknown) {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
}

export class RecoveryStore {
  async save(snapshot: RecoverySnapshot) {
    const database = await openRecoveryDatabase()
    const transaction = database.transaction(recoveryStoreName, 'readwrite', { durability: 'strict' })
    try {
      transaction.objectStore(recoveryStoreName).put({ ...snapshot, key: recoveryKey(snapshot) } satisfies StoredRecoverySnapshot)
      await transactionComplete(transaction)
    } catch (error) {
      if (quotaError(error) || quotaError(transaction.error)) throw new RecoveryQuotaError({ cause: error })
      throw error
    }
  }

  async load(identity: RecoveryIdentity): Promise<RecoverySnapshot | undefined> {
    const database = await openRecoveryDatabase()
    const transaction = database.transaction(recoveryStoreName, 'readonly')
    const stored = await requestResult(transaction.objectStore(recoveryStoreName).get(recoveryKey(identity))) as StoredRecoverySnapshot | undefined
    await transactionComplete(transaction)
    if (!stored) return undefined
    const { key: _, ...snapshot } = stored
    return snapshot
  }

  async remove(identity: RecoveryIdentity) {
    const database = await openRecoveryDatabase()
    const transaction = database.transaction(recoveryStoreName, 'readwrite')
    transaction.objectStore(recoveryStoreName).delete(recoveryKey(identity))
    await transactionComplete(transaction)
  }

  async markSynced(identity: RecoveryIdentity, baseRevision: number, sourceChecksumSha256: string) {
    const snapshot = await this.load(identity)
    if (!snapshot) return false
    await this.save({ ...snapshot, baseRevision, pendingUpload: false, sourceChecksumSha256, synced: true, updatedAt: Date.now() })
    return true
  }

  async cleanup(options: { maxAgeMs?: number; now?: number } = {}) {
    const cutoff = (options.now ?? Date.now()) - (options.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000)
    const database = await openRecoveryDatabase()
    const transaction = database.transaction(recoveryStoreName, 'readwrite')
    const index = transaction.objectStore(recoveryStoreName).index('updatedAt')
    const request = index.openKeyCursor(IDBKeyRange.upperBound(cutoff, true))
    let removed = 0
    await new Promise<void>((resolve, reject) => {
      request.addEventListener('success', () => {
        const cursor = request.result
        if (!cursor) {
          resolve()
          return
        }
        transaction.objectStore(recoveryStoreName).delete(cursor.primaryKey)
        removed += 1
        cursor.continue()
      })
      request.addEventListener('error', () => reject(request.error ?? new Error('Recovery cleanup failed')), { once: true })
    })
    await transactionComplete(transaction)
    return removed
  }
}

export function downloadLocalCopy(docx: ArrayBuffer, fileName: string) {
  const safeName = fileName.replaceAll(/[\\/:*?"<>|]/gu, '_') || 'dokumi-recovery.docx'
  const url = URL.createObjectURL(new Blob([docx], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
  const anchor = document.createElement('a')
  anchor.download = safeName.toLowerCase().endsWith('.docx') ? safeName : `${safeName}.docx`
  anchor.href = url
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
