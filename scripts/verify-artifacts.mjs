import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  artifactArchivePath,
  artifactExtractDirectory,
  loadArtifactsLock,
  verifyFile,
} from './artifacts.mjs'

const sha256Pattern = /^[a-f0-9]{64}$/u
const commitPattern = /^[a-f0-9]{40}$/u

export async function validateArtifactsLock() {
  const lock = await loadArtifactsLock()
  if (lock.lockVersion !== 1 || lock.artifacts.length !== 1) {
    throw new Error('artifacts.lock.json must contain exactly one lockVersion 1 artifact')
  }
  const artifact = lock.artifacts[0]
  const url = new URL(artifact.downloadUrl)
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.includes('/releases/download/')) {
    throw new Error('x2t downloadUrl must be an HTTPS GitHub release asset')
  }
  const encodedTag = encodeURIComponent(artifact.releaseTag)
  if (!url.pathname.includes(`/${encodedTag}/`) && !url.pathname.includes(`/${artifact.releaseTag}/`)) {
    throw new Error('x2t downloadUrl must contain the pinned release tag')
  }
  if (!commitPattern.test(artifact.sourceCommit) || !sha256Pattern.test(artifact.sha256)) {
    throw new Error('x2t source commit and archive SHA-256 must be immutable hashes')
  }
  const paths = artifact.files.map((file) => file.path).sort()
  if (paths.join(',') !== 'x2t.js,x2t.wasm') {
    throw new Error('x2t artifact allowlist must contain exactly x2t.js and x2t.wasm')
  }
  for (const file of artifact.files) {
    if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0 || !sha256Pattern.test(file.sha256)) {
      throw new Error(`${file.path}: invalid bytes or SHA-256 lock`)
    }
  }
  return lock
}

export async function verifyArtifacts() {
  const lock = await validateArtifactsLock()
  const results = []
  for (const artifact of lock.artifacts) {
    const archive = await verifyFile(artifactArchivePath(artifact), artifact.archiveBytes, artifact.sha256)
    const files = []
    for (const file of artifact.files) {
      files.push(await verifyFile(join(artifactExtractDirectory(artifact), file.path), file.bytes, file.sha256))
    }
    results.push({ archive, files, name: artifact.name })
  }
  return results
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = await verifyArtifacts()
  for (const result of results) {
    console.log(`Verified ${result.name}: ${result.archive.sha256}`)
  }
}
