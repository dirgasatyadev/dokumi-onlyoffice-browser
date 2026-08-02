import { createReadStream, createWriteStream } from 'node:fs'
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { constants, createBrotliCompress } from 'node:zlib'

import { artifactExtractDirectory, loadArtifactsLock } from './artifacts.mjs'
import { repositoryRoot } from './upstream.mjs'
import { verifyArtifacts } from './verify-artifacts.mjs'

try {
  await verifyArtifacts()
} catch {
  await import('./fetch-x2t.mjs')
  await verifyArtifacts()
}

const lock = await loadArtifactsLock()
const artifact = lock.artifacts[0]
const legacyDirectory = join(repositoryRoot, 'public', 'x2t')
const publicDirectory = join(repositoryRoot, 'public', 'releases', '0.1.0', 'x2t')
await rm(join(legacyDirectory, 'x2t.js'), { force: true })
await rm(join(legacyDirectory, 'x2t.wasm'), { force: true })
await mkdir(publicDirectory, { recursive: true })
for (const file of artifact.files) {
  await copyFile(join(artifactExtractDirectory(artifact), file.path), join(publicDirectory, file.path))
}
const wasmPath = join(publicDirectory, 'x2t.wasm')
const brotliPath = `${wasmPath}.br`
let compressed = false
try {
  compressed = (await stat(brotliPath)).size > 0
} catch {
  // The immutable compressed asset is generated once per prepared release.
}
if (!compressed) {
  const partial = `${brotliPath}.part`
  await rm(partial, { force: true })
  await pipeline(
    createReadStream(wasmPath),
    createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }),
    createWriteStream(partial, { flags: 'wx' }),
  )
  await rename(partial, brotliPath)
}
console.log('Prepared verified x2t.js and x2t.wasm in public/releases/0.1.0/x2t.')
