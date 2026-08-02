import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
export const upstreamCacheDirectory = join(repositoryRoot, '.cache', 'upstream')

/**
 * @typedef {object} UpstreamSource
 * @property {string} name
 * @property {string} repository
 * @property {string} [parentRepository]
 * @property {string} commit
 * @property {string} archiveUrl
 * @property {string} archiveFile
 * @property {number} archiveBytes
 * @property {string} sha256
 * @property {string} licensePath
 * @property {string} thirdPartyNoticePath
 */

/** @typedef {{ lockVersion: number, sources: UpstreamSource[] }} UpstreamLock */

/** @returns {Promise<UpstreamLock>} */
export async function loadUpstreamLock() {
  const content = await readFile(join(repositoryRoot, 'upstream.lock.json'), 'utf8')
  return /** @type {UpstreamLock} */ (JSON.parse(content))
}

/** @param {UpstreamSource} source */
export function archivePath(source) {
  return join(upstreamCacheDirectory, source.archiveFile)
}

/** @param {string} path */
export async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

/** @param {UpstreamSource} source */
export async function verifyArchive(source) {
  const path = archivePath(source)
  const metadata = await stat(path)
  if (metadata.size !== source.archiveBytes) {
    throw new Error(`${source.name}: expected ${source.archiveBytes} bytes, received ${metadata.size}`)
  }
  const actualSha256 = await sha256File(path)
  if (actualSha256 !== source.sha256) {
    throw new Error(`${source.name}: SHA-256 mismatch (expected ${source.sha256}, received ${actualSha256})`)
  }
  return { bytes: metadata.size, name: source.name, path, sha256: actualSha256 }
}
