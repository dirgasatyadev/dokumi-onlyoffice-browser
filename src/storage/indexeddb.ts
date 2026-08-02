const databaseName = 'dokumi-office-recovery'
const databaseVersion = 1
export const recoveryStoreName = 'snapshots'

let connectionPromise: Promise<IDBDatabase> | undefined

export function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed')), { once: true })
  })
}

export function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction aborted')), { once: true })
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed')), { once: true })
  })
}

export function openRecoveryDatabase() {
  connectionPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.addEventListener('upgradeneeded', () => {
      const database = request.result
      const store = database.createObjectStore(recoveryStoreName, { keyPath: 'key' })
      store.createIndex('updatedAt', 'updatedAt')
      store.createIndex('templateId', 'templateId')
    })
    request.addEventListener('success', () => {
      request.result.addEventListener('versionchange', () => request.result.close())
      resolve(request.result)
    }, { once: true })
    request.addEventListener('error', () => {
      connectionPromise = undefined
      reject(request.error ?? new Error('Unable to open recovery database'))
    }, { once: true })
    request.addEventListener('blocked', () => {
      connectionPromise = undefined
      reject(new Error('Recovery database upgrade is blocked by another tab'))
    }, { once: true })
  })
  return connectionPromise
}

export async function deleteRecoveryDatabaseForTests() {
  const database = await connectionPromise?.catch(() => undefined)
  database?.close()
  connectionPromise = undefined
  await requestResult(indexedDB.deleteDatabase(databaseName))
}
