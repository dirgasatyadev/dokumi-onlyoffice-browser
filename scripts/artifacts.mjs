import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import { repositoryRoot } from './upstream.mjs'

export const artifactCacheDirectory = join(repositoryRoot, '.cache', 'x2t-artifacts')

/**
 * @typedef {object} ArtifactFile
 * @property {string} path
 * @property {number} bytes
 * @property {string} sha256
 */

/**
 * @typedef {object} LockedArtifact
 * @property {string} name
 * @property {string} sourceRepository
 * @property {string} sourceCommit
 * @property {string} releaseTag
 * @property {string} downloadUrl
 * @property {string} archiveFile
 * @property {number} archiveBytes
 * @property {string} sha256
 * @property {ArtifactFile[]} files
 */

/** @typedef {{ lockVersion: number, artifacts: LockedArtifact[] }} ArtifactsLock */

/** @returns {Promise<ArtifactsLock>} */
export async function loadArtifactsLock() {
  const content = await readFile(join(repositoryRoot, 'artifacts.lock.json'), 'utf8')
  return /** @type {ArtifactsLock} */ (JSON.parse(content))
}

/** @param {LockedArtifact} artifact */
export function artifactArchivePath(artifact) {
  return join(artifactCacheDirectory, artifact.archiveFile)
}

/** @param {LockedArtifact} artifact */
export function artifactExtractDirectory(artifact) {
  return join(artifactCacheDirectory, artifact.name)
}

/** @param {string} filePath */
export async function sha256File(filePath) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex')
}

/** @param {string} filePath @param {number} expectedBytes @param {string} expectedSha256 */
export async function verifyFile(filePath, expectedBytes, expectedSha256) {
  const metadata = await stat(filePath)
  if (metadata.size !== expectedBytes) {
    throw new Error(`${filePath}: expected ${expectedBytes} bytes, received ${metadata.size}`)
  }
  const actualSha256 = await sha256File(filePath)
  if (actualSha256 !== expectedSha256) {
    throw new Error(`${filePath}: SHA-256 mismatch (expected ${expectedSha256}, received ${actualSha256})`)
  }
  return { bytes: metadata.size, path: filePath, sha256: actualSha256 }
}

export async function ensureArtifactCacheDirectory() {
  await mkdir(artifactCacheDirectory, { recursive: true })
}
