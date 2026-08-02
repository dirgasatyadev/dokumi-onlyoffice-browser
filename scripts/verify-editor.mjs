import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { editorExtractDirectory, loadEditorLock, verifyEditorArchive } from './editor-artifact.mjs'
import { verifyFile } from './artifacts.mjs'

const sha256Pattern = /^[a-f0-9]{64}$/u
const sha512Pattern = /^[a-f0-9]{128}$/u
const commitPattern = /^[a-f0-9]{40}$/u

export async function validateEditorLock() {
  const lock = await loadEditorLock()
  const artifact = lock.artifact
  if (lock.lockVersion !== 1 || !commitPattern.test(artifact.sourceCommit) || !sha256Pattern.test(artifact.sha256) || !sha512Pattern.test(artifact.sha512)) {
    throw new Error('editor.lock.json must use immutable commit and checksum values')
  }
  const sourceUrl = new URL(artifact.sourceArchiveUrl)
  if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'codeload.github.com' || !sourceUrl.pathname.endsWith(`/cryptpad/onlyoffice-editor/tar.gz/${artifact.sourceCommit}`) || !sha256Pattern.test(artifact.sourceArchiveSha256)) {
    throw new Error('Editor source archive must be pinned to the distribution source commit')
  }
  const url = new URL(artifact.downloadUrl)
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.startsWith('/cryptpad/onlyoffice-editor/releases/download/')) {
    throw new Error('Editor distribution must be a pinned CryptPad GitHub release asset')
  }
  return lock
}

export async function verifyEditor() {
  const { artifact } = await validateEditorLock()
  const archive = await verifyEditorArchive(artifact)
  const extracted = editorExtractDirectory(artifact)
  const marker = JSON.parse(await readFile(join(extracted, '.dokumi-integrity.json'), 'utf8'))
  if (marker.sha256 !== artifact.sha256 || marker.sourceCommit !== artifact.sourceCommit) {
    throw new Error(`${artifact.name}: extracted editor marker does not match the lock`)
  }
  for (const file of artifact.criticalFiles) {
    await verifyFile(join(extracted, file.path), file.bytes, file.sha256)
  }
  await access(join(extracted, 'web-apps'))
  return { archive, extracted, name: artifact.name }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await verifyEditor()
  console.log(`Verified ${result.name}: ${result.archive.sha256}`)
}
