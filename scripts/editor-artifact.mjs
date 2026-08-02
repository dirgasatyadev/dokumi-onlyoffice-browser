import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import { repositoryRoot } from './upstream.mjs'

export const editorCacheDirectory = join(repositoryRoot, '.cache', 'editor-artifact')

/**
 * @typedef {object} EditorArtifact
 * @property {string} name
 * @property {string} sourceRepository
 * @property {string} sourceCommit
 * @property {string} sourceArchiveUrl
 * @property {string} sourceArchiveFile
 * @property {number} sourceArchiveBytes
 * @property {string} sourceArchiveSha256
 * @property {string} releaseTag
 * @property {string} downloadUrl
 * @property {string} archiveFile
 * @property {number} archiveBytes
 * @property {string} sha256
 * @property {string} sha512
 * @property {{ path: string, bytes: number, sha256: string }[]} criticalFiles
 */

/** @returns {Promise<{ lockVersion: number, artifact: EditorArtifact }>} */
export async function loadEditorLock() {
  return JSON.parse(await readFile(join(repositoryRoot, 'editor.lock.json'), 'utf8'))
}

/** @param {EditorArtifact} artifact */
export function editorArchivePath(artifact) {
  return join(editorCacheDirectory, artifact.archiveFile)
}

/** @param {EditorArtifact} artifact */
export function editorExtractDirectory(artifact) {
  return join(editorCacheDirectory, artifact.name)
}

/** @param {EditorArtifact} artifact */
export function editorSourceArchivePath(artifact) {
  return join(editorCacheDirectory, artifact.sourceArchiveFile)
}

/** @param {string} algorithm @param {string} filePath */
async function hashFile(algorithm, filePath) {
  const hash = createHash(algorithm)
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex')
}

/** @param {EditorArtifact} artifact */
export async function verifyEditorArchive(artifact) {
  const archive = editorArchivePath(artifact)
  const metadata = await stat(archive)
  if (metadata.size !== artifact.archiveBytes) throw new Error(`${artifact.name}: archive byte length mismatch`)
  const [sha256, sha512] = await Promise.all([hashFile('sha256', archive), hashFile('sha512', archive)])
  if (sha256 !== artifact.sha256 || sha512 !== artifact.sha512) throw new Error(`${artifact.name}: archive checksum mismatch`)
  return { archive, bytes: metadata.size, sha256, sha512 }
}

/** @param {EditorArtifact} artifact */
export async function verifyEditorSourceArchive(artifact) {
  const archive = editorSourceArchivePath(artifact)
  const metadata = await stat(archive)
  if (metadata.size !== artifact.sourceArchiveBytes) throw new Error(`${artifact.name}: source archive byte length mismatch`)
  const sha256 = await hashFile('sha256', archive)
  if (sha256 !== artifact.sourceArchiveSha256) throw new Error(`${artifact.name}: source archive checksum mismatch`)
  return { archive, bytes: metadata.size, sha256 }
}
