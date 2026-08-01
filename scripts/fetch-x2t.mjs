import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'

import {
  artifactArchivePath,
  artifactExtractDirectory,
  ensureArtifactCacheDirectory,
  loadArtifactsLock,
  verifyFile,
} from './artifacts.mjs'
import { verifyArtifacts } from './verify-artifacts.mjs'

/** @param {string} archive @param {string} destination */
async function extractZip(archive, destination) {
  await rm(destination, { force: true, recursive: true })
  await mkdir(destination, { recursive: true })
  await new Promise((resolve, reject) => {
    const child = spawn('tar', ['-xf', archive, '-C', destination], { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve(undefined) : reject(new Error(`tar exited with code ${code}`)))
  })
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
  await extractZip(archive, destination)
}

await verifyArtifacts()
console.log('Pinned x2t artifact is cached, extracted, and checksum-verified.')
