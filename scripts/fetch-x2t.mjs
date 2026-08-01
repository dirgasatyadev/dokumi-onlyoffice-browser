import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { unzipSync } from 'fflate'

import {
  artifactArchivePath,
  artifactExtractDirectory,
  ensureArtifactCacheDirectory,
  loadArtifactsLock,
  verifyFile,
} from './artifacts.mjs'
import { verifyArtifacts } from './verify-artifacts.mjs'

/** @param {string} archive @param {string} destination @param {import('./artifacts.mjs').ArtifactFile[]} files */
async function extractZip(archive, destination, files) {
  await rm(destination, { force: true, recursive: true })
  await mkdir(destination, { recursive: true })
  const entries = unzipSync(new Uint8Array(await readFile(archive)))
  for (const file of files) {
    const data = entries[file.path]
    if (!data) throw new Error(`${archive}: missing locked entry ${file.path}`)
    const output = join(destination, file.path)
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, data, { flag: 'wx' })
  }
}

/** @param {string} url @param {string} destination */
async function download(url, destination) {
  const partial = `${destination}.part`
  await rm(partial, { force: true })
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`)
  await writeFile(partial, new Uint8Array(await response.arrayBuffer()), { flag: 'wx' })
  await rename(partial, destination)
}

await ensureArtifactCacheDirectory()
const lock = await loadArtifactsLock()
for (const artifact of lock.artifacts) {
  const archive = artifactArchivePath(artifact)
  let validArchive = false
  try {
    await verifyFile(archive, artifact.archiveBytes, artifact.sha256)
    validArchive = true
  } catch {
    // A missing or invalid cached archive is replaced only after the new file is complete.
  }
  if (!validArchive) {
    console.log(`Downloading pinned ${artifact.name}...`)
    await rm(archive, { force: true })
    await download(artifact.downloadUrl, archive)
    await verifyFile(archive, artifact.archiveBytes, artifact.sha256)
  }
  const destination = artifactExtractDirectory(artifact)
  await extractZip(archive, destination, artifact.files)
}

await verifyArtifacts()
console.log('Pinned x2t artifact is cached, extracted, and checksum-verified.')
