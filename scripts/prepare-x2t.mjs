import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

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
const publicDirectory = join(repositoryRoot, 'public', 'x2t')
await mkdir(publicDirectory, { recursive: true })
for (const file of artifact.files) {
  await copyFile(join(artifactExtractDirectory(artifact), file.path), join(publicDirectory, file.path))
}
console.log('Prepared verified x2t.js and x2t.wasm in public/x2t.')
